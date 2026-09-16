import { Router } from 'express';
import { scanner } from '../discovery/scanner.js';
import { getCachedNetworkInfo, getSettings } from '../store/db.js';

export const networkRoutes = Router();

networkRoutes.get('/', async (req, res) => {
  try {
    let info = scanner.getNetworkInfo();
    
    // If no info yet (server just started), try cached
    if (!info) {
      info = await getCachedNetworkInfo();
    }

    if (!info) {
      return res.json({
        routerIp: null,
        myIp: null,
        subnet: null,
        cidr: null,
        estimatedCapacity: null,
        maxOverride: null,
        connectedCount: 0,
        status: 'pending'
      });
    }

    const settings = await getSettings();
    res.json({
      ...info,
      maxOverride: settings.maxOverride
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
