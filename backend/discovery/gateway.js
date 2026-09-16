import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Detect the default gateway IP, the local machine's IP, and subnet info.
 * Cross-platform: macOS, Linux, Windows.
 */
export async function discoverGateway() {
  const platform = process.platform;
  let gatewayIp = null;
  let localIp = null;
  let subnetMask = null;
  let interfaceName = null;
  let cidr = 24; // default fallback

  try {
    if (platform === 'darwin') {
      // macOS
      const { stdout } = await execAsync('route -n get default 2>/dev/null');
      const gwMatch = stdout.match(/gateway:\s+([\d.]+)/);
      const ifMatch = stdout.match(/interface:\s+(\S+)/);
      if (gwMatch) gatewayIp = gwMatch[1];
      if (ifMatch) interfaceName = ifMatch[1];
    } else if (platform === 'linux') {
      // Linux
      const { stdout } = await execAsync('ip route show default 2>/dev/null');
      const parts = stdout.trim().split(/\s+/);
      const viaIdx = parts.indexOf('via');
      const devIdx = parts.indexOf('dev');
      if (viaIdx !== -1) gatewayIp = parts[viaIdx + 1];
      if (devIdx !== -1) interfaceName = parts[devIdx + 1];
    } else if (platform === 'win32') {
      // Windows
      const { stdout } = await execAsync('route print 0.0.0.0');
      const lines = stdout.split('\n');
      for (const line of lines) {
        const match = line.match(/\s+0\.0\.0\.0\s+0\.0\.0\.0\s+([\d.]+)\s+([\d.]+)/);
        if (match) {
          gatewayIp = match[1];
          localIp = match[2];
          break;
        }
      }
    }
  } catch (err) {
    console.warn('Gateway detection via route failed:', err.message);
  }

  // Fallback gateway detection using default-gateway package
  if (!gatewayIp) {
    try {
      const { default: defaultGateway } = await import('default-gateway');
      const result = await defaultGateway.v4();
      gatewayIp = result.gateway;
      interfaceName = interfaceName || result.interface;
    } catch (err) {
      console.warn('default-gateway package fallback failed:', err.message);
    }
  }

  // Find local IP and subnet from network interfaces
  const interfaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        // If we know the interface name, prefer it
        if (interfaceName && name === interfaceName) {
          localIp = addr.address;
          subnetMask = addr.netmask;
          cidr = netmaskToCidr(addr.netmask);
          break;
        }
        // Otherwise, pick the first non-internal IPv4 that's on the same subnet as the gateway
        if (!localIp && gatewayIp && sameSubnet(addr.address, gatewayIp, addr.netmask)) {
          localIp = addr.address;
          subnetMask = addr.netmask;
          cidr = netmaskToCidr(addr.netmask);
          interfaceName = name;
        }
      }
    }
  }

  // Last resort: just pick any non-internal IPv4
  if (!localIp) {
    for (const addrs of Object.values(interfaces)) {
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          localIp = addr.address;
          subnetMask = addr.netmask;
          cidr = netmaskToCidr(addr.netmask);
          break;
        }
      }
      if (localIp) break;
    }
  }

  const subnet = localIp && subnetMask
    ? computeSubnet(localIp, subnetMask)
    : (localIp ? localIp.replace(/\.\d+$/, '.0') : null);

  const estimatedCapacity = Math.pow(2, 32 - cidr) - 2; // subtract network + broadcast

  return {
    routerIp: gatewayIp,
    myIp: localIp,
    subnet: subnet ? `${subnet}/${cidr}` : null,
    cidr,
    interfaceName,
    subnetMask,
    estimatedCapacity
  };
}

function netmaskToCidr(netmask) {
  return netmask.split('.').reduce((acc, octet) => {
    return acc + (parseInt(octet) >>> 0).toString(2).replace(/0/g, '').length;
  }, 0);
}

function sameSubnet(ip1, ip2, mask) {
  const ip1Parts = ip1.split('.').map(Number);
  const ip2Parts = ip2.split('.').map(Number);
  const maskParts = mask.split('.').map(Number);
  return ip1Parts.every((part, i) => (part & maskParts[i]) === (ip2Parts[i] & maskParts[i]));
}

function computeSubnet(ip, mask) {
  const ipParts = ip.split('.').map(Number);
  const maskParts = mask.split('.').map(Number);
  return ipParts.map((p, i) => p & maskParts[i]).join('.');
}

/**
 * Generate all usable host IPs in a subnet.
 */
export function generateSubnetIPs(baseIp, cidr) {
  const parts = baseIp.split('.').map(Number);
  const baseInt = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  const maskInt = (~0 << (32 - cidr)) >>> 0;
  const networkInt = (baseInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0;
  const ips = [];

  for (let i = networkInt + 1; i < broadcastInt; i++) {
    ips.push([
      (i >>> 24) & 0xFF,
      (i >>> 16) & 0xFF,
      (i >>> 8) & 0xFF,
      i & 0xFF
    ].join('.'));
  }
  return ips;
}
