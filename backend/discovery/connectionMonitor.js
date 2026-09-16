import { spawn } from 'child_process';
import { getCachedNetworkInfo, addDropLog } from '../store/db.js';

let monitorInterval = null;
let routerWasOnline = true; // Assume online initially to catch the first drop
let lastKnownRouterIp = null;

function pingHost(ip, platform) {
  return new Promise((resolve) => {
    let cmd, args;
    if (platform === 'win32') {
      cmd = 'ping';
      args = ['-n', '1', '-w', '1000', ip]; // Windows: 1000ms timeout
    } else {
      cmd = 'ping';
      args = ['-c', '1', '-W', '1', ip]; // Unix: 1s timeout
    }

    const proc = spawn(cmd, args, { stdio: 'ignore' });
    const timeout = setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 2000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve(code === 0);
    });

    proc.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

export function startConnectionMonitor() {
  if (monitorInterval) clearInterval(monitorInterval);
  
  // Ping the router every 5 seconds to detect network drops
  monitorInterval = setInterval(async () => {
    try {
      const info = await getCachedNetworkInfo();
      const routerIp = info?.routerIp;
      
      if (!routerIp) return;
      
      // If router IP changed or initialized, update our state
      if (routerIp !== lastKnownRouterIp) {
        lastKnownRouterIp = routerIp;
        routerWasOnline = true; // reset state logic for new router
      }

      const isOnline = await pingHost(routerIp, process.platform);
      
      if (!isOnline && routerWasOnline) {
        routerWasOnline = false;
        await addDropLog({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          event: 'drop',
          message: `Lost connection to router (${routerIp})`
        });
        console.log(`\n  ⚠️  Network drop detected: Router (${routerIp}) is unreachable.\n`);
      } else if (isOnline && !routerWasOnline) {
        routerWasOnline = true;
        await addDropLog({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          event: 'restore',
          message: `Restored connection to router (${routerIp})`
        });
        console.log(`\n  ✅  Network restored: Router (${routerIp}) is reachable again.\n`);
      }
    } catch (err) {
      console.error('Connection monitor error:', err.message);
    }
  }, 5000);
}
