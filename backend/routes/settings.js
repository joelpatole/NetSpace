import { Router } from 'express';
import { getSettings, updateSettings } from '../store/db.js';
import { scanner } from '../discovery/scanner.js';

export const settingsRoutes = Router();

settingsRoutes.get('/', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

settingsRoutes.put('/', async (req, res) => {
  try {
    const { refreshIntervalSeconds, maxOverride, onlineVendorLookupEnabled } = req.body;
    const updates = {};
    
    if (refreshIntervalSeconds !== undefined) {
      updates.refreshIntervalSeconds = Math.max(5, Math.min(300, Number(refreshIntervalSeconds)));
    }
    if (maxOverride !== undefined) {
      updates.maxOverride = maxOverride === null ? null : Number(maxOverride);
    }
    if (onlineVendorLookupEnabled !== undefined) {
      updates.onlineVendorLookupEnabled = Boolean(onlineVendorLookupEnabled);
    }

    const settings = await updateSettings(updates);
    
    // Restart periodic scan with new interval
    if (updates.refreshIntervalSeconds !== undefined) {
      await scanner.restartPeriodicScan();
    }

    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
