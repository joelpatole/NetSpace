import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkRoutes } from './routes/network.js';
import { deviceRoutes } from './routes/devices.js';
import { scanRoutes } from './routes/scan.js';
import { settingsRoutes } from './routes/settings.js';
import { logsRoutes } from './routes/logs.js';
import { speedtestRoutes } from './routes/speedtest.js';
import { scanner } from './discovery/scanner.js';
import { startConnectionMonitor } from './discovery/connectionMonitor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3778;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/network', networkRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/speedtest', speedtestRoutes);

// Serve production frontend build if it exists
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n  ╔══════════════════════════════════════════════╗`);
  console.log(`  ║        🛰️  NetSpace is running!               ║`);
  console.log(`  ╠══════════════════════════════════════════════╣`);
  console.log(`  ║  Backend:  http://0.0.0.0:${PORT}              ║`);
  console.log(`  ╚══════════════════════════════════════════════╝\n`);

  // Perform initial scan
  try {
    console.log('  🔍 Starting initial network scan...');
    await scanner.scan();
    console.log('  ✅ Initial scan complete.\n');
  } catch (err) {
    console.error('  ⚠️  Initial scan failed:', err.message);
    console.error('  Tip: On some OSes, try running with elevated privileges (sudo).\n');
  }

  // Start periodic background scanning
  scanner.startPeriodicScan();
  // Start constant connection monitoring for drop logs
  startConnectionMonitor();
});

export default app;
