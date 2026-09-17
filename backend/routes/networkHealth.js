import { Router } from 'express';
import { getDropLogs, getNetworkHealth } from '../store/db.js';
import { getLatencySamples, getMonitorState } from '../discovery/connectionMonitor.js';

export const networkHealthRoutes = Router();

/**
 * GET /api/network-health
 *
 * Returns a comprehensive health report:
 * - Current status (healthy / degraded / down)
 * - 24-hour uptime percentage
 * - Drop statistics & verdict breakdown
 * - Latency timeline for sparkline charts
 * - Recent drops with full diagnosis
 */
networkHealthRoutes.get('/', async (req, res) => {
  try {
    const [logs, healthSnapshot] = await Promise.all([
      getDropLogs(),
      getNetworkHealth(),
    ]);

    const monitorState = getMonitorState();
    const latencySamples = getLatencySamples();

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // ── Filter to last 24 hours ──
    const recentLogs = logs.filter(l => new Date(l.timestamp).getTime() >= oneDayAgo);
    const drops = recentLogs.filter(l => l.event === 'drop');
    const restores = recentLogs.filter(l => l.event === 'restore');

    // ── Drop statistics ──
    const totalDrops24h = drops.length;
    const durations = restores
      .map(r => r.duration)
      .filter(d => typeof d === 'number' && d > 0);
    const avgDropDuration = durations.length
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
      : 0;
    const longestDrop = durations.length ? Math.max(...durations) : 0;
    const shortestDrop = durations.length ? Math.min(...durations) : 0;

    // ── Total downtime and uptime calculation ──
    let totalDowntimeSeconds = durations.reduce((a, b) => a + b, 0);

    // If currently down, add ongoing downtime
    if (!monitorState.routerOnline && monitorState.lastDropTimestamp) {
      totalDowntimeSeconds += Math.round((now - monitorState.lastDropTimestamp) / 1000);
    }

    const totalSeconds24h = 24 * 60 * 60;
    const uptimePercent24h = Math.max(0,
      Math.round(((totalSeconds24h - totalDowntimeSeconds) / totalSeconds24h) * 1000) / 10
    );

    // ── Verdict breakdown ──
    const verdictBreakdown = { router: 0, isp: 0, dns: 0, device: 0, intermittent: 0 };
    let topVerdict = null;

    for (const drop of drops) {
      if (drop.diagnosis?.verdict && verdictBreakdown.hasOwnProperty(drop.diagnosis.verdict)) {
        verdictBreakdown[drop.diagnosis.verdict]++;
      }
    }

    // Find the most common cause
    let maxCount = 0;
    for (const [key, count] of Object.entries(verdictBreakdown)) {
      if (count > maxCount) {
        maxCount = count;
        topVerdict = key;
      }
    }

    // ── Latency stats from live samples ──
    const routerLatencies = latencySamples
      .map(s => s.router)
      .filter(v => typeof v === 'number');
    const latencyStats = computeStats(routerLatencies);

    // ── Health status ──
    let status = 'healthy';
    if (!monitorState.routerOnline) {
      status = 'down';
    } else if (healthSnapshot?.status === 'degraded') {
      status = 'degraded';
    } else if (latencyStats.jitter != null && latencyStats.jitter > 20) {
      status = 'degraded';
    } else if (totalDrops24h >= 5) {
      status = 'degraded';
    }

    // ── Latency timeline (last 1 hour, thinned for the chart) ──
    const oneHourAgo = now - 60 * 60 * 1000;
    const latencyTimeline = latencySamples
      .filter(s => s.t >= oneHourAgo)
      .map(s => ({ t: s.t, router: s.router, external: s.external }));

    // ── Recent drops (last 20, newest first, with full diagnosis) ──
    const recentDrops = [...recentLogs].reverse().slice(0, 20);

    res.json({
      status,
      routerIp: monitorState.routerIp,
      routerOnline: monitorState.routerOnline,
      uptimePercent24h,
      totalDrops24h,
      avgDropDuration,
      longestDrop,
      shortestDrop,
      totalDowntimeSeconds,
      latencyStats,
      topVerdict,
      verdictBreakdown,
      recentDrops,
      latencyTimeline,
    });
  } catch (err) {
    console.error('Network health endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

function computeStats(values) {
  if (values.length === 0) {
    return { avg: null, p95: null, jitter: null, current: null, min: null, max: null };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const p95Idx = Math.min(Math.floor(values.length * 0.95), values.length - 1);
  const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / values.length;

  return {
    avg: r2(avg),
    p95: r2(sorted[p95Idx]),
    jitter: r2(Math.sqrt(variance)),
    current: r2(values[values.length - 1]),
    min: r2(sorted[0]),
    max: r2(sorted[sorted.length - 1]),
  };
}

function r2(v) {
  return v != null ? Math.round(v * 100) / 100 : null;
}
