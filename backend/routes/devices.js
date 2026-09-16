import { Router } from 'express';
import { scanner } from '../discovery/scanner.js';
import { setDeviceOverride } from '../store/db.js';

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
