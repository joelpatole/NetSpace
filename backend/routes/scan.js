import { Router } from 'express';
import { scanner } from '../discovery/scanner.js';

export const scanRoutes = Router();

let lastScanRequest = 0;
const DEBOUNCE_MS = 5000; // Minimum 5s between manual scans

scanRoutes.post('/', async (req, res) => {
  try {
    const now = Date.now();
    if (now - lastScanRequest < DEBOUNCE_MS) {
      return res.status(429).json({
        error: 'Scan rate limited',
        message: `Please wait ${Math.ceil((DEBOUNCE_MS - (now - lastScanRequest)) / 1000)}s before scanning again.`,
        devices: scanner.getDevices()
      });
    }

    if (scanner.isScanning()) {
      return res.json({
        message: 'Scan already in progress',
        devices: scanner.getDevices()
      });
    }

    lastScanRequest = now;
    const devices = await scanner.scan();
    res.json(devices);
  } catch (err) {
    res.status(500).json({
      error: err.message,
      hint: process.platform === 'linux'
        ? 'On Linux, try running with sudo for full ARP visibility.'
        : process.platform === 'darwin'
        ? 'On macOS, some network commands may require admin privileges.'
        : 'On Windows, run the terminal as Administrator for best results.'
    });
  }
});
