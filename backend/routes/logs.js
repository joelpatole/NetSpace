import { Router } from 'express';
import { getDropLogs, clearDropLogs } from '../store/db.js';

export const logsRoutes = Router();

logsRoutes.get('/', async (req, res) => {
  try {
    const logs = await getDropLogs();
    // Return logs ordered by newest first
    res.json([...logs].reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

logsRoutes.delete('/', async (req, res) => {
  try {
    await clearDropLogs();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
