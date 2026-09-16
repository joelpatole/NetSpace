import { Router } from 'express';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const speedtestRoutes = Router();

/**
 * Pure Node.js speed test — no native binaries needed.
 * 
 * Download: fetches a large file from a CDN and measures throughput.
 * Upload:   POSTs random data to a public endpoint and measures throughput.
 * Ping:     measures ICMP round-trip to a well-known server.
 */

// Several test file URLs (large-ish, publicly accessible, no auth)
const DOWNLOAD_URLS = [
  'https://speed.cloudflare.com/__down?bytes=25000000',   // 25 MB from Cloudflare
  'https://speed.cloudflare.com/__down?bytes=10000000',   // 10 MB fallback
];

const UPLOAD_URL = 'https://speed.cloudflare.com/__up';

/**
 * Download speed test — download a file and measure bytes/sec.
 */
function measureDownload(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const startTime = Date.now();
    let totalBytes = 0;

    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        req.destroy();
        return reject(new Error(`Download returned status ${res.statusCode}`));
      }

      res.on('data', (chunk) => {
        totalBytes += chunk.length;
      });

      res.on('end', () => {
        const elapsed = (Date.now() - startTime) / 1000; // seconds
        const bitsPerSecond = (totalBytes * 8) / elapsed;
        const mbps = bitsPerSecond / 1_000_000;
        resolve({ mbps, bytes: totalBytes, elapsed });
      });

      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Download timed out'));
    });
  });
}

/**
 * Upload speed test — POST random data and measure throughput.
 */
function measureUpload(url, sizeMB = 5, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const sizeBytes = sizeMB * 1_000_000;
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      method: 'POST',
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': sizeBytes,
      },
      timeout: timeoutMs,
    };

    const startTime = Date.now();
    const req = client.request(options, (res) => {
      // Consume the response
      res.on('data', () => {});
      res.on('end', () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const bitsPerSecond = (sizeBytes * 8) / elapsed;
        const mbps = bitsPerSecond / 1_000_000;
        resolve({ mbps, bytes: sizeBytes, elapsed });
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Upload timed out'));
    });

    // Write random-ish data in chunks
    const chunkSize = 65536;
    const chunk = Buffer.alloc(chunkSize, 0x42); // fill with 'B'
    let remaining = sizeBytes;

    function writeChunk() {
      while (remaining > 0) {
        const size = Math.min(chunkSize, remaining);
        const buf = remaining === size ? chunk.subarray(0, size) : chunk;
        remaining -= size;
        if (!req.write(buf)) {
          req.once('drain', writeChunk);
          return;
        }
      }
      req.end();
    }

    writeChunk();
  });
}

/**
 * Ping test — measure RTT to a server.
 */
async function measurePing(host = '1.1.1.1', count = 3) {
  try {
    const platform = process.platform;
    const cmd = platform === 'win32'
      ? `ping -n ${count} ${host}`
      : `ping -c ${count} ${host}`;

    const { stdout } = await execAsync(cmd, { timeout: 10000 });

    // Extract average ping
    // macOS/linux: "round-trip min/avg/max/stddev = 1.234/2.345/3.456/0.567 ms"
    // Windows:     "Average = 2ms"
    const macLinuxMatch = stdout.match(/=\s*[\d.]+\/([\d.]+)\//);
    if (macLinuxMatch) return parseFloat(macLinuxMatch[1]);

    const winMatch = stdout.match(/Average\s*=\s*(\d+)/);
    if (winMatch) return parseFloat(winMatch[1]);

    return -1;
  } catch {
    return -1;
  }
}

// The actual route
speedtestRoutes.get('/', async (req, res) => {
  try {
    // Run ping, download, and upload concurrently where possible
    const pingPromise = measurePing();

    // Download
    let downloadResult = null;
    for (const url of DOWNLOAD_URLS) {
      try {
        downloadResult = await measureDownload(url);
        break;
      } catch (err) {
        console.warn(`Download test failed for ${url}: ${err.message}`);
      }
    }

    // Upload
    let uploadResult = null;
    try {
      uploadResult = await measureUpload(UPLOAD_URL, 5);
    } catch (err) {
      console.warn(`Upload test failed: ${err.message}`);
    }

    const ping = await pingPromise;

    res.json({
      download: downloadResult ? parseFloat(downloadResult.mbps.toFixed(2)) : 0,
      upload: uploadResult ? parseFloat(uploadResult.mbps.toFixed(2)) : 0,
      ping: ping >= 0 ? parseFloat(ping.toFixed(1)) : 0,
      server: 'Cloudflare',
    });
  } catch (error) {
    console.error('Speedtest Error:', error.message);
    res.status(500).json({ error: 'Speed test failed: ' + error.message });
  }
});
