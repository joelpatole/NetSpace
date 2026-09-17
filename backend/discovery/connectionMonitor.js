import { spawn } from 'child_process';
import os from 'os';
import dns from 'dns';
import { promisify } from 'util';
import http from 'http';
import https from 'https';
import { getCachedNetworkInfo, addDropLog, getDb } from '../store/db.js';

const dnsResolve = promisify(dns.resolve4);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const MONITOR_INTERVAL_MS = 5000;        // check every 5 seconds
const LATENCY_WINDOW_SIZE = 720;         // 1 hour of 5-second samples
const EXTERNAL_HOSTS = ['1.1.1.1', '8.8.8.8'];
const DNS_TEST_HOST = 'google.com';
const HTTP_TEST_URL = 'http://1.1.1.1/cdn-cgi/trace';
const JITTER_SPIKE_THRESHOLD = 3;        // 3× average = "spike"
const DEGRADED_JITTER_MS = 20;           // jitter above this = degraded

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let monitorInterval = null;
let routerWasOnline = true;
let lastKnownRouterIp = null;
let lastDropTimestamp = null;             // for calculating drop duration

// Rolling latency samples: { t: timestamp, router: ms|null, external: ms|null }
let latencySamples = [];

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

function pingHost(ip) {
  return new Promise((resolve) => {
    const platform = process.platform;
    let cmd, args;
    if (platform === 'win32') {
      cmd = 'ping';
      args = ['-n', '1', '-w', '1000', ip];
    } else {
      cmd = 'ping';
      args = ['-c', '1', '-W', '1', ip];
    }

    let stdout = '';
    const proc = spawn(cmd, args);
    const timeout = setTimeout(() => {
      proc.kill();
      resolve({ alive: false, ms: null });
    }, 3000);

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', () => {});

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        resolve({ alive: false, ms: null });
        return;
      }
      // Try per-packet format: "time=1.234 ms" or "time<1ms"
      let match = stdout.match(/time[=<]([\d.]+)\s*ms/i);
      if (!match) {
        // macOS with -W flag only shows summary: "round-trip min/avg/max/stddev = 1.0/2.0/3.0/0.5 ms"
        match = stdout.match(/=\s*[\d.]+\/([\d.]+)\//);
      }
      const ms = match ? parseFloat(match[1]) : null;
      resolve({ alive: true, ms });
    });

    proc.on('error', () => {
      clearTimeout(timeout);
      resolve({ alive: false, ms: null });
    });
  });
}

async function checkDns(host = DNS_TEST_HOST) {
  try {
    const addresses = await dnsResolve(host);
    return { working: true, resolved: addresses };
  } catch {
    return { working: false, resolved: null };
  }
}

function checkHttp(url = HTTP_TEST_URL, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ working: res.statusCode >= 200 && res.statusCode < 400, statusCode: res.statusCode });
      });
      res.on('error', () => resolve({ working: false, statusCode: null }));
    });
    req.on('error', () => resolve({ working: false, statusCode: null }));
    req.on('timeout', () => { req.destroy(); resolve({ working: false, statusCode: null }); });
  });
}

// ---------------------------------------------------------------------------
// Latency statistics
// ---------------------------------------------------------------------------

function computeLatencyStats(samples, key = 'router') {
  const values = samples.map(s => s[key]).filter(v => typeof v === 'number');
  if (values.length === 0) {
    return { avg: null, p95: null, jitter: null, current: null, min: null, max: null };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const p95Idx = Math.min(Math.floor(values.length * 0.95), values.length - 1);
  const p95 = sorted[p95Idx];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // Jitter = standard deviation
  const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / values.length;
  const jitter = Math.sqrt(variance);

  const current = values[values.length - 1];

  return {
    avg: round2(avg),
    p95: round2(p95),
    jitter: round2(jitter),
    current: round2(current),
    min: round2(min),
    max: round2(max),
  };
}

function round2(v) {
  return v != null ? Math.round(v * 100) / 100 : null;
}

// ---------------------------------------------------------------------------
// Current Device & LAN Peer checks (distinguish device vs router issue)
// ---------------------------------------------------------------------------

async function checkDeviceHealth(netInfo) {
  try {
    const ifaces = os.networkInterfaces();
    const ifaceName = netInfo?.iface;
    let activeIface = null;

    if (ifaceName && ifaces[ifaceName]) {
      activeIface = ifaces[ifaceName].find(i => i.family === 'IPv4' && !i.internal);
    }
    if (!activeIface) {
      for (const list of Object.values(ifaces)) {
        const found = (list || []).find(i => i.family === 'IPv4' && !i.internal);
        if (found) {
          activeIface = found;
          break;
        }
      }
    }

    const currentIp = activeIface?.address || null;
    const hasValidIp = !!currentIp && currentIp !== '127.0.0.1' && !currentIp.startsWith('169.254');

    // Test local loopback stack
    const loopback = await pingHost('127.0.0.1');

    const healthy = !!activeIface && hasValidIp && loopback.alive;

    let detail = `Interface active (${currentIp})`;
    if (!activeIface) {
      detail = 'Network interface is down or disconnected from Wi-Fi/Ethernet';
    } else if (!hasValidIp) {
      detail = `Lost valid local IP (assigned: ${currentIp || 'none'})`;
    } else if (!loopback.alive) {
      detail = 'Local network stack unresponsive';
    }

    return {
      healthy,
      interfaceUp: !!activeIface,
      hasValidIp,
      currentIp,
      loopbackOk: loopback.alive,
      detail,
    };
  } catch (err) {
    return {
      healthy: false,
      interfaceUp: false,
      hasValidIp: false,
      currentIp: null,
      loopbackOk: false,
      detail: `Interface check error: ${err.message}`,
    };
  }
}

async function checkLanPeers(routerIp, myIp) {
  try {
    const db = await getDb();
    const devices = Object.values(db.data.devices || {});
    // Select up to 2 online peers on the subnet, excluding router and current device
    const peers = devices
      .filter(d => d.ip && d.ip !== routerIp && d.ip !== myIp && d.status === 'online')
      .slice(0, 2);

    if (peers.length === 0) {
      return { tested: false, reachable: null, peerIp: null, peerName: null, pingMs: null };
    }

    for (const peer of peers) {
      const res = await pingHost(peer.ip);
      if (res.alive) {
        return {
          tested: true,
          reachable: true,
          peerIp: peer.ip,
          peerName: peer.nickname || peer.hostname || peer.ip,
          pingMs: res.ms,
        };
      }
    }

    return {
      tested: true,
      reachable: false,
      peerIp: peers[0].ip,
      peerName: peers[0].nickname || peers[0].hostname || peers[0].ip,
      pingMs: null,
    };
  } catch {
    return { tested: false, reachable: null, peerIp: null, peerName: null, pingMs: null };
  }
}

// ---------------------------------------------------------------------------
// Root-cause diagnosis
// ---------------------------------------------------------------------------

function classifyDropCause(results) {
  const { routerAlive, externalAlive, dnsOk, httpOk, deviceHealth, peerCheck, routerIp } = results;

  // 1. Current Device Issue:
  // If the device's own network interface is down, has no IP, or stack failed
  if (deviceHealth && !deviceHealth.healthy) {
    return {
      verdict: 'device',
      verdictLabel: 'Current Device Issue',
      blame: 'device',
      detail: `Your device's network interface disconnected or lost its IP address (${deviceHealth.detail}). The router may still be functioning normally for other devices.`,
    };
  }

  // 2. Peer Cross-Check:
  // Your device CAN reach another LAN device, but CANNOT reach the router!
  // This is definitive proof that your device's Wi-Fi link and local network stack work,
  // and the router's gateway/software specifically failed!
  if (!routerAlive && peerCheck?.reachable) {
    return {
      verdict: 'router',
      verdictLabel: 'Router Gateway Crash',
      blame: 'router',
      detail: `Your device communicates fine with other LAN devices (${peerCheck.peerName || peerCheck.peerIp} responded in ${peerCheck.pingMs ? peerCheck.pingMs + 'ms' : 'OK'}), but the router gateway (${routerIp}) is not responding. This proves the issue is the router, not your device.`,
    };
  }

  // 3. Router is unreachable and external is unreachable, while device interface is healthy:
  if (!routerAlive && !externalAlive && !dnsOk && !httpOk) {
    return {
      verdict: 'router',
      verdictLabel: 'Router / Wi-Fi Outage',
      blame: 'router',
      detail: `Your router (${routerIp}) is completely unreachable. Your device's network interface remained active (${deviceHealth?.currentIp || 'valid IP'}), indicating the router rebooted, crashed, or its Wi-Fi access point radio dropped all clients.`,
    };
  }

  // 4. Router is alive, but external is unreachable → ISP
  if (routerAlive && !externalAlive && !httpOk) {
    return {
      verdict: 'isp',
      verdictLabel: 'ISP / Internet Outage',
      blame: 'isp',
      detail: `Your router is reachable and functioning, but external internet servers (1.1.1.1, 8.8.8.8) are unreachable. The drop is caused by your Internet Service Provider (ISP).`,
    };
  }

  // 5. Router & internet alive, but DNS failed → DNS
  if (routerAlive && externalAlive && !dnsOk) {
    return {
      verdict: 'dns',
      verdictLabel: 'DNS Resolution Failure',
      blame: 'dns',
      detail: `Pings to router and internet succeed, but domain name lookup failed for ${DNS_TEST_HOST}. Your configured DNS server is down.`,
    };
  }

  // 6. Router & internet alive, but HTTP failed
  if (routerAlive && externalAlive && dnsOk && !httpOk) {
    return {
      verdict: 'dns',
      verdictLabel: 'Partial Connectivity / Captive Portal',
      blame: 'router',
      detail: `Pings and DNS succeed, but HTTP web requests are blocked. A router firewall, captive portal, or proxy may be interfering.`,
    };
  }

  // 7. Intermittent
  return {
    verdict: 'intermittent',
    verdictLabel: 'Intermittent Instability',
    blame: 'unknown',
    detail: `Network dropped intermittently. Some tests succeeded while others failed, indicating Wi-Fi interference, packet loss, or high router load.`,
  };
}

// ---------------------------------------------------------------------------
// Full diagnostic battery (runs when a drop is detected)
// ---------------------------------------------------------------------------

async function runDiagnosticBattery(routerIp) {
  const netInfo = await getCachedNetworkInfo();
  const myIp = netInfo?.localIp;

  // Run all checks in parallel (including Device Health and Peer Cross-Check)
  const [routerPing, ext1Ping, ext2Ping, dnsResult, httpResult, deviceHealth, peerCheck] = await Promise.allSettled([
    pingHost(routerIp),
    pingHost(EXTERNAL_HOSTS[0]),
    pingHost(EXTERNAL_HOSTS[1]),
    checkDns(),
    checkHttp(),
    checkDeviceHealth(netInfo),
    checkLanPeers(routerIp, myIp),
  ]);

  const routerAlive = routerPing.status === 'fulfilled' && routerPing.value.alive;
  const ext1Alive = ext1Ping.status === 'fulfilled' && ext1Ping.value.alive;
  const ext2Alive = ext2Ping.status === 'fulfilled' && ext2Ping.value.alive;
  const externalAlive = ext1Alive || ext2Alive;
  const dnsOk = dnsResult.status === 'fulfilled' && dnsResult.value.working;
  const httpOk = httpResult.status === 'fulfilled' && httpResult.value.working;
  const devHealth = deviceHealth.status === 'fulfilled' ? deviceHealth.value : { healthy: true, detail: 'Interface active' };
  const peer = peerCheck.status === 'fulfilled' ? peerCheck.value : { tested: false, reachable: null };

  const cause = classifyDropCause({
    routerAlive,
    externalAlive,
    dnsOk,
    httpOk,
    deviceHealth: devHealth,
    peerCheck: peer,
    routerIp,
  });

  const stats = computeLatencyStats(latencySamples, 'router');

  return {
    routerIp,
    routerReachable: routerAlive,
    routerPingMs: routerPing.status === 'fulfilled' ? routerPing.value.ms : null,
    internetReachable: externalAlive,
    externalPingMs: ext1Ping.status === 'fulfilled' ? ext1Ping.value.ms : null,
    dnsWorking: dnsOk,
    httpWorking: httpOk,
    deviceHealthy: devHealth.healthy,
    deviceInterfaceUp: devHealth.interfaceUp,
    deviceIp: devHealth.currentIp,
    deviceDetail: devHealth.detail,
    peerTested: peer.tested,
    peerReachable: peer.reachable,
    peerName: peer.peerName,
    peerPingMs: peer.pingMs,
    ...cause,
    latencyStats: stats,
  };
}

// ---------------------------------------------------------------------------
// Persist network health snapshot (for the /api/network-health endpoint)
// ---------------------------------------------------------------------------

async function persistHealthSnapshot(routerIp) {
  try {
    const db = await getDb();
    if (!db.data.networkHealth) db.data.networkHealth = {};

    const stats = computeLatencyStats(latencySamples, 'router');
    const externalStats = computeLatencyStats(latencySamples, 'external');

    // Determine status based on current state
    let status = 'healthy';
    if (!routerWasOnline) {
      status = 'down';
    } else if (stats.jitter != null && stats.jitter > DEGRADED_JITTER_MS) {
      status = 'degraded';
    } else if (stats.current != null && stats.avg != null && stats.current > stats.avg * JITTER_SPIKE_THRESHOLD) {
      status = 'degraded';
    }

    db.data.networkHealth = {
      status,
      routerIp,
      routerLatency: stats,
      externalLatency: externalStats,
      latencyTimeline: latencySamples.slice(-720).map(s => ({
        t: s.t,
        router: s.router,
        external: s.external,
      })),
      updatedAt: Date.now(),
    };

    await db.write();
  } catch (err) {
    console.error('Failed to persist health snapshot:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Main monitor loop
// ---------------------------------------------------------------------------

let persistCounter = 0;
const PERSIST_EVERY_N = 6; // persist health snapshot every 30 seconds (6 × 5s)

export function startConnectionMonitor() {
  if (monitorInterval) clearInterval(monitorInterval);

  monitorInterval = setInterval(async () => {
    try {
      const info = await getCachedNetworkInfo();
      const routerIp = info?.routerIp;
      if (!routerIp) return;

      // Reset state if router changed
      if (routerIp !== lastKnownRouterIp) {
        lastKnownRouterIp = routerIp;
        routerWasOnline = true;
        latencySamples = [];
      }

      // ── Ping both router and external in parallel ──
      const [routerResult, externalResult] = await Promise.allSettled([
        pingHost(routerIp),
        pingHost(EXTERNAL_HOSTS[0]),
      ]);

      const routerAlive = routerResult.status === 'fulfilled' && routerResult.value.alive;
      const routerMs = routerResult.status === 'fulfilled' ? routerResult.value.ms : null;
      const externalMs = externalResult.status === 'fulfilled' ? externalResult.value.ms : null;

      // Record latency sample
      latencySamples.push({
        t: Date.now(),
        router: routerAlive ? routerMs : null,
        external: externalResult.status === 'fulfilled' && externalResult.value.alive ? externalMs : null,
      });
      if (latencySamples.length > LATENCY_WINDOW_SIZE) {
        latencySamples = latencySamples.slice(-LATENCY_WINDOW_SIZE);
      }

      // ── Drop detection ──
      if (!routerAlive && routerWasOnline) {
        routerWasOnline = false;
        lastDropTimestamp = Date.now();

        // Run full diagnosis
        const diagnosis = await runDiagnosticBattery(routerIp);

        await addDropLog({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          event: 'drop',
          message: `Lost connection to router (${routerIp})`,
          duration: null,
          diagnosis,
        });

        console.log(`\n  ⚠️  Network drop detected: ${diagnosis.verdictLabel}`);
        console.log(`      ${diagnosis.detail}\n`);

      } else if (routerAlive && !routerWasOnline) {
        routerWasOnline = true;

        // Calculate how long we were down
        const duration = lastDropTimestamp
          ? Math.round((Date.now() - lastDropTimestamp) / 1000)
          : null;

        // Run diagnosis on restore too (to confirm what recovered)
        const diagnosis = await runDiagnosticBattery(routerIp);

        await addDropLog({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          event: 'restore',
          message: `Restored connection to router (${routerIp})`,
          duration,
          diagnosis,
        });

        lastDropTimestamp = null;
        console.log(`\n  ✅  Network restored after ${duration ?? '?'}s — all layers recovered.\n`);
      }

      // ── Periodic health persistence ──
      persistCounter++;
      if (persistCounter >= PERSIST_EVERY_N) {
        persistCounter = 0;
        await persistHealthSnapshot(routerIp);
      }

    } catch (err) {
      console.error('Connection monitor error:', err.message);
    }
  }, MONITOR_INTERVAL_MS);

  console.log(`  🫀 Network health monitor started (every ${MONITOR_INTERVAL_MS / 1000}s)`);
}

// ---------------------------------------------------------------------------
// Exported for the /api/network-health route
// ---------------------------------------------------------------------------

export function getLatencySamples() {
  return latencySamples;
}

export function getMonitorState() {
  return {
    routerOnline: routerWasOnline,
    routerIp: lastKnownRouterIp,
    lastDropTimestamp,
  };
}
