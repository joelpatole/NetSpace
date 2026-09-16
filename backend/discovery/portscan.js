import net from 'net';

/**
 * On-demand TCP port scanning.
 *
 * This is deliberately never run automatically: it only executes when a user
 * explicitly asks for it on a single device they picked. Callers must also
 * confirm the target sits inside the local subnet (see isLocalSubnetIp).
 */

// Ports worth reporting on a home LAN, with the service most likely behind them.
const COMMON_PORTS = [
  { port: 21,    service: 'FTP' },
  { port: 22,    service: 'SSH' },
  { port: 23,    service: 'Telnet' },
  { port: 25,    service: 'SMTP' },
  { port: 53,    service: 'DNS' },
  { port: 80,    service: 'HTTP' },
  { port: 139,   service: 'NetBIOS' },
  { port: 443,   service: 'HTTPS' },
  { port: 445,   service: 'SMB' },
  { port: 515,   service: 'LPD (printing)' },
  { port: 548,   service: 'AFP (Apple file sharing)' },
  { port: 554,   service: 'RTSP (camera stream)' },
  { port: 631,   service: 'IPP (printing)' },
  { port: 1883,  service: 'MQTT' },
  { port: 3306,  service: 'MySQL' },
  { port: 3389,  service: 'RDP' },
  { port: 5432,  service: 'PostgreSQL' },
  { port: 5900,  service: 'VNC' },
  { port: 6379,  service: 'Redis' },
  { port: 7000,  service: 'AirPlay' },
  { port: 8006,  service: 'Proxmox' },
  { port: 8080,  service: 'HTTP (alt)' },
  { port: 8443,  service: 'HTTPS (alt)' },
  { port: 8883,  service: 'MQTT (TLS)' },
  { port: 9100,  service: 'Raw printing' },
  { port: 32400, service: 'Plex' },
  { port: 62078, service: 'iPhone sync' },
];

const CONCURRENCY = 12;
const PORT_TIMEOUT_MS = 1200;

// One scan per device at a time, so repeated clicks cannot pile up.
const inFlight = new Set();

/**
 * True when `ip` shares a subnet with `myIp` under `subnetMask`.
 * Guards against pointing the scanner at arbitrary internet hosts.
 */
export function isLocalSubnetIp(ip, myIp, subnetMask = '255.255.255.0') {
  if (!ip || !myIp) return false;
  const parts = [ip, myIp, subnetMask].map(v => v.split('.').map(Number));
  if (parts.some(p => p.length !== 4 || p.some(n => Number.isNaN(n)))) return false;
  const [target, local, mask] = parts;
  return target.every((octet, i) => (octet & mask[i]) === (local[i] & mask[i]));
}

function probePort(ip, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };

    socket.setTimeout(PORT_TIMEOUT_MS);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));
    socket.connect(port, ip);
  });
}

/**
 * Scan the common-port list against a single host.
 * @returns {Promise<{ip: string, openPorts: Array, scannedPorts: number, durationMs: number}>}
 */
export async function scanPorts(ip) {
  if (inFlight.has(ip)) {
    throw new Error('A port scan is already running for this device.');
  }
  inFlight.add(ip);

  const started = Date.now();
  const openPorts = [];

  try {
    for (let i = 0; i < COMMON_PORTS.length; i += CONCURRENCY) {
      const batch = COMMON_PORTS.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(p => probePort(ip, p.port)));
      results.forEach((open, idx) => {
        if (open) openPorts.push(batch[idx]);
      });
    }
  } finally {
    inFlight.delete(ip);
  }

  openPorts.sort((a, b) => a.port - b.port);

  return {
    ip,
    openPorts,
    scannedPorts: COMMON_PORTS.length,
    durationMs: Date.now() - started,
    scannedAt: new Date().toISOString()
  };
}
