import { Router } from 'express';
import { scanner } from '../discovery/scanner.js';
import { setDeviceOverride, getDeviceHistory, HISTORY_WINDOW_MS } from '../store/db.js';
import { scanPorts, isLocalSubnetIp } from '../discovery/portscan.js';

export const deviceRoutes = Router();

// Get all devices
deviceRoutes.get('/', (req, res) => {
  try {
    const devices = scanner.getDevices();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Availability + latency history for one device
deviceRoutes.get('/:id/history', async (req, res) => {
  try {
    const mac = decodeURIComponent(req.params.id).toLowerCase();
    const samples = await getDeviceHistory(mac);

    const onlineSamples = samples.filter(s => s.o === 1);
    const pings = onlineSamples.map(s => s.p).filter(p => typeof p === 'number');

    res.json({
      mac,
      samples,
      sampleCount: samples.length,
      windowHours: HISTORY_WINDOW_MS / (60 * 60 * 1000),
      uptimePercent: samples.length
        ? Math.round((onlineSamples.length / samples.length) * 1000) / 10
        : null,
      avgPingMs: pings.length
        ? Math.round((pings.reduce((a, b) => a + b, 0) / pings.length) * 100) / 100
        : null,
      minPingMs: pings.length ? Math.min(...pings) : null,
      maxPingMs: pings.length ? Math.max(...pings) : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// On-demand TCP port scan. Never triggered by background scanning — a user has
// to ask for it on a specific device, and the target must be on our own subnet.
deviceRoutes.post('/:id/ports', async (req, res) => {
  try {
    const mac = decodeURIComponent(req.params.id).toLowerCase();
    const device = scanner.getDevice(mac);
    if (!device) {
      return res.status(404).json({ error: 'Unknown device' });
    }

    const network = scanner.getNetworkInfo();
    const mask = cidrToNetmask(network?.cidr ?? 24);
    if (!isLocalSubnetIp(device.ip, network?.myIp, mask)) {
      return res.status(400).json({
        error: 'Refusing to scan an address outside your local subnet.'
      });
    }

    const result = await scanPorts(device.ip);
    res.json(result);
  } catch (err) {
    res.status(err.message.includes('already running') ? 409 : 500).json({ error: err.message });
  }
});

// Update device nickname/notes
deviceRoutes.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, notes } = req.body;
    const mac = decodeURIComponent(id);
    
    const updates = {};
    if (nickname !== undefined) updates.nickname = nickname;
    if (notes !== undefined) updates.notes = notes;

    await setDeviceOverride(mac, updates);

    // Also update in-memory device
    const devices = scanner.getDevices();
    const device = devices.find(d => d.mac === mac);
    if (device) {
      if (nickname !== undefined) device.nickname = nickname;
      if (notes !== undefined) device.notes = notes;
    }

    res.json({ success: true, device });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function cidrToNetmask(cidr) {
  const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  return [24, 16, 8, 0].map(shift => (mask >>> shift) & 0xFF).join('.');
}
