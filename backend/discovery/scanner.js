import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import dns from 'dns';
import net from 'net';
import os from 'os';
import { discoverGateway, generateSubnetIPs } from './gateway.js';
import { classifyDevice } from './classifier.js';
import { getOuiInfo } from './oui-lookup.js';
import {
  getDeviceOverrides, getSettings, cacheNetworkInfo,
  getAllDeviceRecords, upsertDeviceRecords, recordHistorySamples, addDeviceEvents
} from '../store/db.js';

const execAsync = promisify(exec);
const dnsReverse = promisify(dns.reverse);

// In-memory state
let networkInfo = null;
let deviceMap = new Map(); // keyed by MAC address
let scanning = false;
let lastScanTime = null;
let scanInterval = null;
let previousStatus = new Map(); // mac -> 'online' | 'offline', for join/leave detection

/**
 * Main scanner class orchestrating the entire discovery pipeline.
 */
class NetworkScanner {
  /**
   * Run a full network scan.
   */
  async scan() {
    if (scanning) {
      return this.getDevices();
    }
    scanning = true;
    
    try {
      // Step 1: Discover gateway and network topology
      const gwInfo = await discoverGateway();
      const settings = await getSettings();
      
      // Built locally and only published at the end of the scan: a scan can take
      // longer than the refresh interval, and clobbering networkInfo up front
      // made /api/network report 0 connected devices while one was in flight.
      const info = {
        routerIp: gwInfo.routerIp,
        myIp: gwInfo.myIp,
        subnet: gwInfo.subnet,
        cidr: gwInfo.cidr,
        estimatedCapacity: gwInfo.estimatedCapacity,
        maxOverride: settings.maxOverride,
        connectedCount: 0
      };

      // Step 2: Ping sweep to populate ARP cache and gather latency
      let pingResults = new Map();
      if (gwInfo.myIp && gwInfo.cidr) {
        const baseIp = gwInfo.myIp;
        pingResults = await this.pingSweep(baseIp, gwInfo.cidr);
      }

      // Step 3: Read ARP cache
      const arpEntries = await this.readArpCache();

      // Step 4: Enrich each device
      const now = new Date().toISOString();
      const seenMacs = new Set();

      for (const entry of arpEntries) {
        if (!entry.mac || entry.mac === '(incomplete)' || entry.mac === 'ff:ff:ff:ff:ff:ff') {
          continue;
        }

        // Filter out multicast (224.0.0.0/4), broadcast, and link-local (169.254.x.x) addresses
        const firstOctet = parseInt(entry.ip.split('.')[0], 10);
        if (firstOctet >= 224 || firstOctet === 0 || entry.ip === '255.255.255.255') {
          continue;
        }
        if (entry.ip.startsWith('169.254.')) {
          continue;
        }

        const mac = entry.mac.toLowerCase().replace(/-/g, ':');
        seenMacs.add(mac);
        
        // Resolve hostname
        let hostname = null;
        try {
          const names = await dnsReverse(entry.ip);
          hostname = names && names[0] ? names[0] : null;
        } catch {
          // Reverse DNS often fails — that's fine
        }

        // mDNS attempt (best-effort, timeout quickly)
        if (!hostname) {
          hostname = await this.tryMdns(entry.ip).catch(() => null);
        }

        // OUI & Vendor lookup
        const ouiInfo = getOuiInfo(mac);
        const vendor = ouiInfo.vendor;
        const oui = ouiInfo.oui;

        // Classification
        const classification = classifyDevice(
          { ip: entry.ip, mac, hostname, vendor },
          info.routerIp
        );

        // Get stored overrides
        const overrides = await getDeviceOverrides(mac);

        // Merge into device map
        const existing = deviceMap.get(mac);
        const device = {
          id: mac,
          ip: entry.ip,
          mac,
          oui,
          hostname: hostname || (existing && existing.hostname) || null,
          vendor,
          isRandomizedMac: ouiInfo.isRandomized,
          deviceType: classification.deviceType,
          icon: classification.icon,
          status: 'online',
          firstSeen: (existing && existing.firstSeen) || overrides.firstSeen || now,
          lastSeen: now,
          nickname: overrides.nickname || null,
          notes: overrides.notes || null,
          pingMs: pingResults.get(entry.ip) ?? null
        };

        deviceMap.set(mac, device);
      }

      // Step 4b: Add this machine explicitly.
      //
      // A host never ARPs for its own address, so on Linux (`ip neigh`) and
      // Windows the local machine is simply absent from the neighbour table.
      // macOS is the odd one out: `arp -a` lists a `permanent` self entry, which
      // is why the "You" node appeared there but nowhere else. Injecting it from
      // the OS interface list makes the behaviour identical on every platform.
      await this.addSelfDevice(gwInfo, now, seenMacs, pingResults);

      // Step 5: TCP probe fallback for devices that didn't respond to ICMP
      const probePromises = [];
      for (const [mac, device] of deviceMap) {
        if (device.status === 'online' && device.pingMs == null && seenMacs.has(mac)) {
          probePromises.push(
            this.tcpProbe(device.ip).then(ms => {
              if (ms != null) device.pingMs = ms;
            })
          );
        }
      }
      if (probePromises.length > 0) {
        await Promise.allSettled(probePromises);
      }

      // Mark devices not seen in this scan as offline
      for (const [mac, device] of deviceMap) {
        if (!seenMacs.has(mac)) {
          device.status = 'offline';
        }
      }

      // Update connected count and publish
      info.connectedCount = [...deviceMap.values()].filter(d => d.status === 'online').length;
      networkInfo = info;

      // Step 6: Record availability history and join/leave events
      await this.recordIntelligence(now);

      // Persist network info cache
      await cacheNetworkInfo(networkInfo);
      lastScanTime = Date.now();

      return this.getDevices();
    } finally {
      scanning = false;
    }
  }

  /**
   * Persist the device registry, emit join/leave/new events, and append a
   * history sample. Runs once per scan; history writes are throttled inside
   * recordHistorySamples so the JSON store is not rewritten every 20 seconds.
   */
  async recordIntelligence(now) {
    const devices = [...deviceMap.values()];
    const records = await getAllDeviceRecords();
    // A fresh install has no registry yet — seed it silently rather than
    // announcing every device on the network as "new".
    const seeding = Object.keys(records).length === 0;

    const events = [];
    const updates = {};

    for (const device of devices) {
      const known = records[device.mac];
      const label = device.nickname || device.hostname || device.vendor || device.deviceType;
      const wasOnline = previousStatus.get(device.mac) === 'online';

      if (device.status === 'online') {
        // Prefer the persisted first-seen so it survives restarts.
        if (known && known.firstSeen) device.firstSeen = known.firstSeen;

        if (!known && !seeding) {
          events.push({ type: 'new', mac: device.mac, name: label, ip: device.ip });
        } else if (known && previousStatus.has(device.mac) && !wasOnline) {
          events.push({ type: 'joined', mac: device.mac, name: label, ip: device.ip });
        }

        updates[device.mac] = {
          firstSeen: (known && known.firstSeen) || device.firstSeen,
          lastSeen: now,
          name: label,
          ip: device.ip
        };
      } else if (wasOnline) {
        events.push({ type: 'left', mac: device.mac, name: label, ip: device.ip });
      }

      previousStatus.set(device.mac, device.status);
    }

    await upsertDeviceRecords(updates);

    if (events.length > 0) {
      await addDeviceEvents(events.map((e, i) => ({
        id: `${Date.parse(now)}-${i}`,
        timestamp: now,
        ...e
      })));
    }

    await recordHistorySamples(
      devices.map(d => ({
        mac: d.mac,
        online: d.status === 'online',
        pingMs: d.pingMs
      })),
      Date.parse(now)
    );
  }

  /**
   * Build and register the device entry for the machine NetSpace runs on.
   * Returns the device, or null when the local IP/MAC could not be determined.
   */
  async addSelfDevice(gwInfo, now, seenMacs, pingResults) {
    const { myIp, myMac, routerIp } = gwInfo;
    if (!myIp || !myMac) {
      console.warn('  \u26a0\ufe0f  Could not determine local IP/MAC — "You" device will be missing.');
      return null;
    }

    const mac = myMac.toLowerCase();
    seenMacs.add(mac);

    const ouiInfo = getOuiInfo(mac);
    const hostname = os.hostname().replace(/\.local\.?$/i, '') || null;
    const classification = classifyDevice(
      { ip: myIp, mac, hostname, vendor: ouiInfo.vendor, isLocal: true },
      routerIp
    );
    const overrides = await getDeviceOverrides(mac);
    const existing = deviceMap.get(mac);

    const device = {
      id: mac,
      ip: myIp,
      mac,
      oui: ouiInfo.oui,
      vendor: ouiInfo.vendor,
      hostname,
      isLocal: true,
      isRandomizedMac: ouiInfo.isRandomized,
      deviceType: classification.deviceType,
      icon: classification.icon,
      status: 'online',
      firstSeen: (existing && existing.firstSeen) || overrides.firstSeen || now,
      lastSeen: now,
      nickname: overrides.nickname || null,
      notes: overrides.notes || null,
      pingMs: pingResults.get(myIp) ?? 0
    };

    deviceMap.set(mac, device);
    return device;
  }

  /**
   * Ping sweep – send pings in parallel batches to populate ARP cache.
   * Returns a Map of ip -> pingMs for successful pings.
   */
  async pingSweep(baseIp, cidr) {
    // For large subnets, limit the sweep
    if (cidr < 20) {
      console.warn(`Subnet /${cidr} is very large, limiting ping sweep to /24 equivalent`);
      cidr = 24;
    }

    const ips = generateSubnetIPs(baseIp, cidr);
    const platform = process.platform;
    const batchSize = 50;
    const pingResults = new Map();

    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(ip => this.pingHost(ip, platform))
      );
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.alive) {
          pingResults.set(batch[idx], result.value.ms);
        }
      });
    }

    return pingResults;
  }

  /**
   * Ping a single host with a short timeout.
   * Returns { alive: boolean, ms: number|null }.
   */
  pingHost(ip, platform) {
    return new Promise((resolve) => {
      let cmd, args;
      if (platform === 'win32') {
        cmd = 'ping';
        args = ['-n', '1', '-w', '500', ip];
      } else {
        cmd = 'ping';
        args = ['-c', '1', '-W', '1', ip];
      }

      let stdout = '';
      const proc = spawn(cmd, args);
      const timeout = setTimeout(() => {
        proc.kill();
        resolve({ alive: false, ms: null });
      }, 2000);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', () => {}); // consume stderr

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          resolve({ alive: false, ms: null });
          return;
        }
        // Parse ping time from output
        // macOS: "time=1.234 ms"   Linux: "time=1.23 ms"   Windows: "time=1ms" or "time<1ms"
        const match = stdout.match(/time[=<]([\d.]+)\s*ms/i);
        const ms = match ? parseFloat(match[1]) : null;
        resolve({ alive: true, ms });
      });

      proc.on('error', () => {
        clearTimeout(timeout);
        resolve({ alive: false, ms: null });
      });
    });
  }

  /**
   * TCP connect probe — measures round-trip time by opening a TCP connection.
   * Tries common ports. Works for devices that block ICMP.
   * Returns latency in ms or null if all ports fail.
   */
  async tcpProbe(ip, timeoutMs = 1500) {
    const ports = [80, 443, 7, 22, 548, 62078]; // HTTP, HTTPS, echo, SSH, AFP (macOS), iPhone lockdown

    for (const port of ports) {
      try {
        const ms = await this._tcpConnect(ip, port, timeoutMs);
        if (ms != null) return parseFloat(ms.toFixed(2));
      } catch {
        // Try next port
      }
    }
    return null;
  }

  _tcpConnect(ip, port, timeoutMs) {
    return new Promise((resolve) => {
      const start = performance.now();
      const socket = new net.Socket();

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        const elapsed = performance.now() - start;
        socket.destroy();
        resolve(elapsed);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(null);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(null);
      });

      socket.connect(port, ip);
    });
  }

  /**
   * Read ARP cache. Cross-platform.
   */
  async readArpCache() {
    const platform = process.platform;
    const entries = [];

    try {
      let stdout;
      if (platform === 'win32') {
        ({ stdout } = await execAsync('arp -a'));
      } else if (platform === 'linux') {
        // Try ip neigh first, fall back to arp -a
        try {
          ({ stdout } = await execAsync('ip neigh show'));
          const neighbours = this.parseIpNeigh(stdout);
          if (neighbours.length > 0) return neighbours;
          // Empty neighbour table (e.g. iproute2 missing entries) — try arp.
          ({ stdout } = await execAsync('arp -a'));
        } catch {
          ({ stdout } = await execAsync('arp -a'));
        }
      } else {
        // macOS
        ({ stdout } = await execAsync('arp -a'));
      }

      return this.parseArpA(stdout);
    } catch (err) {
      console.error('Failed to read ARP cache:', err.message);
      return entries;
    }
  }

  /**
   * Parse `arp -a` output (macOS / Windows / Linux fallback).
   * macOS format: hostname (ip) at mac on interface [ifscope ...]
   * Windows format: Internet Address  Physical Address  Type
   */
  parseArpA(stdout) {
    const entries = [];
    const lines = stdout.split('\n');

    for (const line of lines) {
      // macOS format: ? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]
      const macMatch = line.match(/\(([\d.]+)\)\s+at\s+([\da-fA-F:]+)/);
      if (macMatch) {
        entries.push({ ip: macMatch[1], mac: macMatch[2] });
        continue;
      }

      // Windows format: 192.168.1.1     aa-bb-cc-dd-ee-ff     dynamic
      const winMatch = line.match(/([\d.]+)\s+([\da-fA-F-]{17})\s+\w+/);
      if (winMatch) {
        entries.push({ ip: winMatch[1], mac: winMatch[2].replace(/-/g, ':') });
      }
    }

    return entries;
  }

  /**
   * Parse `ip neigh show` output (Linux).
   * Format: 192.168.1.1 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE
   */
  parseIpNeigh(stdout) {
    const entries = [];
    const lines = stdout.split('\n');

    for (const line of lines) {
      // Anchor on a dotted quad so IPv6 neighbours are skipped — an address like
      // `fe80::1` would otherwise yield a bogus "1" entry.
      const match = line.match(/^(\d{1,3}(?:\.\d{1,3}){3})\s+dev\s+\S+\s+lladdr\s+((?:[\da-fA-F]{2}:){5}[\da-fA-F]{2})/);
      if (!match) continue;
      // FAILED/INCOMPLETE neighbours are unreachable, not connected devices.
      if (/\b(FAILED|INCOMPLETE)\b/.test(line)) continue;
      entries.push({ ip: match[1], mac: match[2] });
    }

    return entries;
  }

  /**
   * Attempt mDNS hostname resolution.
   */
  async tryMdns(ip) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('mDNS timeout')), 2000);
      
      import('multicast-dns').then(({ default: mdns }) => {
        const m = mdns();
        const reverseIp = ip.split('.').reverse().join('.') + '.in-addr.arpa';
        
        m.query(reverseIp, 'PTR');
        
        m.on('response', (response) => {
          clearTimeout(timeout);
          for (const answer of response.answers) {
            if (answer.type === 'PTR' && answer.data) {
              m.destroy();
              resolve(answer.data.replace(/\.local\.?$/, ''));
              return;
            }
          }
          m.destroy();
          reject(new Error('No mDNS answer'));
        });

        setTimeout(() => {
          m.destroy();
          clearTimeout(timeout);
          reject(new Error('mDNS timeout'));
        }, 2000);
      }).catch(reject);
    });
  }

  /**
   * Get the current network info.
   */
  getNetworkInfo() {
    return networkInfo;
  }

  /**
   * Get all known devices as an array.
   */
  getDevices() {
    return [...deviceMap.values()].sort((a, b) => {
      // Router first, then online before offline, then by IP
      if (a.deviceType === 'Router') return -1;
      if (b.deviceType === 'Router') return 1;
      if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
      return a.ip.localeCompare(b.ip, undefined, { numeric: true });
    });
  }

  /**
   * Look up a single known device by MAC.
   */
  getDevice(mac) {
    return deviceMap.get(mac) || null;
  }

  /**
   * Check if scan is in progress.
   */
  isScanning() {
    return scanning;
  }

  /**
   * Start periodic background scans.
   */
  async startPeriodicScan() {
    const settings = await getSettings();
    const intervalMs = (settings.refreshIntervalSeconds || 20) * 1000;

    if (scanInterval) clearInterval(scanInterval);
    
    scanInterval = setInterval(async () => {
      try {
        await this.scan();
        console.log(`  🔄 Background scan complete. ${networkInfo?.connectedCount || 0} devices online.`);
      } catch (err) {
        console.error('  ⚠️  Background scan error:', err.message);
      }
    }, intervalMs);

    console.log(`  ⏱️  Auto-scan every ${settings.refreshIntervalSeconds}s`);
  }

  /**
   * Restart periodic scan with new interval.
   */
  async restartPeriodicScan() {
    if (scanInterval) clearInterval(scanInterval);
    await this.startPeriodicScan();
  }
}

export const scanner = new NetworkScanner();
