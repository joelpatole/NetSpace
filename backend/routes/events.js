import { Router } from 'express';
import { getDeviceEvents, clearDeviceEvents } from '../store/db.js';

export const eventsRoutes = Router();

// Device activity feed — new devices, joins and departures, newest first.
eventsRoutes.get('/', async (req, res) => {
  try {
    const events = await getDeviceEvents();
    res.json([...events].reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

eventsRoutes.delete('/', async (req, res) => {
  try {
    await clearDeviceEvents();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
