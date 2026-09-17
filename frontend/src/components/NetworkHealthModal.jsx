import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ShieldCheck, ShieldAlert, ShieldX, WifiOff, Wifi,
  ArrowDown, ArrowUp, Clock, Zap, Activity, ChevronDown,
  ChevronUp, Router, Globe, Server, Monitor, AlertTriangle
} from 'lucide-react';
import { fetchNetworkHealth } from '../utils/api.js';
import { relativeTime } from '../utils/devices.js';
import DraggableModal from './DraggableModal.jsx';

// ── Verdict metadata ──
const VERDICT_META = {
  router:       { label: 'Router / Wi-Fi',   Icon: Router,        color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' },
  isp:          { label: 'ISP Outage',        Icon: Globe,         color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30' },
  dns:          { label: 'DNS Failure',        Icon: Server,        color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
  device:       { label: 'Local Device',       Icon: Monitor,       color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' },
  intermittent: { label: 'Intermittent',       Icon: AlertTriangle, color: 'text-amber-300',  bg: 'bg-amber-300/10',  border: 'border-amber-300/30' },
};

const STATUS_META = {
  healthy:  { label: 'Healthy',  Icon: ShieldCheck, cls: 'from-emerald-500 to-green-600',  ring: 'ring-emerald-500/30', text: 'text-emerald-400' },
  degraded: { label: 'Degraded', Icon: ShieldAlert, cls: 'from-amber-500 to-yellow-600',   ring: 'ring-amber-500/30',   text: 'text-amber-400' },
  down:     { label: 'Down',     Icon: ShieldX,     cls: 'from-red-500 to-rose-600',       ring: 'ring-red-500/30',     text: 'text-red-400' },
};

// ── Main component ──
export default function NetworkHealthModal({ onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshRef = useRef(null);

  const load = async () => {
    try {
      const d = await fetchNetworkHealth();
      setData(d);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Auto-refresh every 10 seconds while open
    refreshRef.current = setInterval(load, 10000);
    return () => clearInterval(refreshRef.current);
  }, []);

  const statusMeta = data ? STATUS_META[data.status] || STATUS_META.healthy : STATUS_META.healthy;

  return (
    <DraggableModal
      id="network-health-modal"
      title="Network Health"
      icon={Activity}
      onClose={onClose}
      maxWidth="max-w-2xl"
      maxHeight="max-h-[88vh]"
    >
      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="p-8 text-center text-red-400 text-sm">
            <WifiOff className="w-8 h-8 mx-auto mb-3 opacity-60" />
            <p>{error}</p>
            <button onClick={load} className="mt-3 text-ns-accent hover:underline text-xs">Retry</button>
          </div>
        ) : data ? (
          <>
            {/* ── 1. Health Status Hero ── */}
            <HealthHero data={data} statusMeta={statusMeta} />

            {/* ── 2. Key Metrics ── */}
            <MetricsGrid data={data} />

            {/* ── 3. Latency Sparkline ── */}
            <LatencyChart data={data} />

            {/* ── 4. Root Cause Breakdown ── */}
            {data.totalDrops24h > 0 && <VerdictBreakdown data={data} />}

            {/* ── 5. Drop Timeline ── */}
            <DropTimeline data={data} />
          </>
        ) : null}
      </div>
    </DraggableModal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function HealthHero({ data, statusMeta }) {
  const { Icon } = statusMeta;
  return (
    <div className="relative overflow-hidden rounded-xl border border-ns-border bg-gradient-to-br from-ns-surface/50 to-ns-bg p-5">
      {/* Background glow */}
      <div className={`absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gradient-to-br ${statusMeta.cls} opacity-[0.07] blur-3xl`} />

      <div className="flex items-center gap-5 relative z-10">
        {/* Status ring */}
        <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${statusMeta.cls} p-[3px] ring-4 ${statusMeta.ring} flex-shrink-0`}>
          <div className="w-full h-full rounded-full bg-ns-card flex items-center justify-center">
            <Icon className={`w-8 h-8 ${statusMeta.text}`} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`text-2xl font-bold ${statusMeta.text}`}>
              {statusMeta.label}
            </span>
            {data.routerIp && (
              <span className="text-xs text-ns-text-secondary font-mono">
                via {data.routerIp}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-4 text-sm text-ns-text-secondary flex-wrap">
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${data.routerOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              Router {data.routerOnline ? 'online' : 'offline'}
            </span>
            <span className="font-medium text-ns-text">
              {data.uptimePercent24h}% <span className="text-ns-text-secondary font-normal">uptime (24h)</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricsGrid({ data }) {
  const cards = [
    {
      label: 'Total Drops',
      value: data.totalDrops24h,
      sub: '24 hours',
      Icon: WifiOff,
      iconCls: data.totalDrops24h > 0 ? 'text-red-400' : 'text-ns-text-secondary',
    },
    {
      label: 'Avg Duration',
      value: data.avgDropDuration > 0 ? `${data.avgDropDuration}s` : '—',
      sub: data.longestDrop > 0 ? `longest ${data.longestDrop}s` : 'no drops',
      Icon: Clock,
      iconCls: 'text-amber-400',
    },
    {
      label: 'Latency',
      value: data.latencyStats?.current != null ? `${data.latencyStats.current}ms` : '—',
      sub: data.latencyStats?.avg != null ? `avg ${data.latencyStats.avg}ms` : 'no data',
      Icon: Zap,
      iconCls: 'text-ns-cyan',
    },
    {
      label: 'Jitter',
      value: data.latencyStats?.jitter != null ? `${data.latencyStats.jitter}ms` : '—',
      sub: data.latencyStats?.p95 != null ? `p95 ${data.latencyStats.p95}ms` : 'no data',
      Icon: Activity,
      iconCls: data.latencyStats?.jitter > 20 ? 'text-orange-400' : 'text-emerald-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="bg-ns-bg border border-ns-border rounded-xl p-3.5 text-center"
        >
          <c.Icon className={`w-5 h-5 mx-auto mb-2 ${c.iconCls}`} />
          <div className="text-lg font-bold text-ns-text">{c.value}</div>
          <div className="text-[11px] text-ns-text-secondary mt-0.5">{c.sub}</div>
          <div className="text-[10px] text-ns-text-secondary/60 mt-1 uppercase tracking-wider">{c.label}</div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Latency Sparkline Chart ──
function LatencyChart({ data }) {
  const timeline = data.latencyTimeline || [];
  if (timeline.length < 2) {
    return (
      <div className="bg-ns-bg border border-ns-border rounded-xl p-4 text-center text-ns-text-secondary text-sm">
        <Activity className="w-6 h-6 mx-auto mb-2 opacity-40" />
        Collecting latency data… chart will appear shortly.
      </div>
    );
  }

  const routerValues = timeline.map(s => s.router).filter(v => v != null);
  if (routerValues.length < 2) return null;

  const max = Math.max(...routerValues, 1);
  const W = 560;
  const H = 80;
  const padY = 4;

  const points = timeline
    .map((s, i) => {
      if (s.router == null) return null;
      const x = (i / (timeline.length - 1)) * W;
      const y = H - padY - ((s.router / max) * (H - padY * 2));
      return `${x},${y}`;
    })
    .filter(Boolean);

  const polyline = points.join(' ');
  // Gradient fill area
  const areaPath = `M${points[0]} ${points.join(' L')} L${W},${H} L0,${H} Z`;

  return (
    <div className="bg-ns-bg border border-ns-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-ns-text-secondary uppercase tracking-wider">Router Latency (1h)</span>
        <span className="text-xs text-ns-text-secondary">
          {data.latencyStats?.min != null && `${data.latencyStats.min} – ${data.latencyStats.max}ms`}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="latency-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(56,189,248)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(56,189,248)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Fill area */}
        <path d={areaPath} fill="url(#latency-grad)" />
        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="rgb(56,189,248)"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

// ── Verdict Breakdown ──
function VerdictBreakdown({ data }) {
  const breakdown = data.verdictBreakdown || {};
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const entries = Object.entries(breakdown)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-ns-bg border border-ns-border rounded-xl p-4">
      <h3 className="text-xs font-medium text-ns-text-secondary uppercase tracking-wider mb-3">
        Root Cause Breakdown (24h)
      </h3>
      <div className="space-y-2.5">
        {entries.map(([key, count]) => {
          const meta = VERDICT_META[key] || VERDICT_META.intermittent;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={key} className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${meta.bg}`}>
                <meta.Icon className={`w-3.5 h-3.5 ${meta.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-ns-text font-medium">{meta.label}</span>
                  <span className="text-xs text-ns-text-secondary">{count} drop{count !== 1 ? 's' : ''} ({pct}%)</span>
                </div>
                <div className="h-1.5 bg-ns-surface rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full rounded-full bg-gradient-to-r ${
                      key === 'router' ? 'from-orange-500 to-amber-400' :
                      key === 'isp' ? 'from-red-500 to-rose-400' :
                      key === 'dns' ? 'from-yellow-500 to-amber-300' :
                      key === 'device' ? 'from-purple-500 to-violet-400' :
                      'from-amber-400 to-yellow-300'
                    }`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Drop Timeline ──
function DropTimeline({ data }) {
  const drops = data.recentDrops || [];

  return (
    <div className="bg-ns-bg border border-ns-border rounded-xl overflow-hidden">
      <div className="p-4 pb-2 border-b border-ns-border/50">
        <h3 className="text-xs font-medium text-ns-text-secondary uppercase tracking-wider">
          Recent Events
          <span className="ml-2 opacity-60">{drops.length}</span>
        </h3>
      </div>

      {drops.length === 0 ? (
        <div className="p-8 text-center text-ns-text-secondary flex flex-col items-center gap-2">
          <Wifi className="w-8 h-8 opacity-40" />
          <p className="text-sm">No network events recorded yet.</p>
          <p className="text-xs opacity-75">Your connection has been stable — great!</p>
        </div>
      ) : (
        <div className="divide-y divide-ns-border/30 max-h-64 overflow-y-auto">
          {drops.map(log => (
            <DropRow key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}

function DropRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const isDrop = log.event === 'drop';
  const diagnosis = log.diagnosis;
  const verdictMeta = diagnosis?.verdict ? VERDICT_META[diagnosis.verdict] : null;

  return (
    <div className="transition-colors hover:bg-ns-surface/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3.5 flex items-start gap-3"
      >
        {/* Icon */}
        <div className={`mt-0.5 p-2 rounded-lg flex-shrink-0 ${
          isDrop ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
        }`}>
          {isDrop ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-ns-text">{log.message}</span>
            {verdictMeta && isDrop && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${verdictMeta.bg} ${verdictMeta.color} ${verdictMeta.border} border`}>
                {verdictMeta.label}
              </span>
            )}
            {log.duration != null && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-ns-surface text-ns-text-secondary">
                {log.duration}s
              </span>
            )}
          </div>
          <p className="text-xs text-ns-text-secondary mt-1">
            {relativeTime(log.timestamp)} · {new Date(log.timestamp).toLocaleString()}
          </p>
        </div>

        {/* Expand chevron */}
        {diagnosis && (
          <div className="flex-shrink-0 mt-1">
            {expanded
              ? <ChevronUp className="w-4 h-4 text-ns-text-secondary" />
              : <ChevronDown className="w-4 h-4 text-ns-text-secondary" />
            }
          </div>
        )}
      </button>

      {/* Expanded diagnosis */}
      <AnimatePresence>
        {expanded && diagnosis && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-4 pt-0 ml-[52px]">
              {/* Root Cause Attribution Badge */}
              {diagnosis.blame && (
                <div className="mb-3 flex items-center gap-2 text-xs">
                  <span className="text-ns-text-secondary font-medium">Root Cause:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[11px] flex items-center gap-1.5 ${
                    diagnosis.blame === 'device' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                    diagnosis.blame === 'router' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' :
                    diagnosis.blame === 'isp' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                    diagnosis.blame === 'dns' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' :
                    'bg-ns-surface text-ns-text-secondary border border-ns-border'
                  }`}>
                    {diagnosis.blame === 'device' ? '📱 Current Device' :
                     diagnosis.blame === 'router' ? '📡 Router' :
                     diagnosis.blame === 'isp' ? '🌐 ISP' :
                     diagnosis.blame === 'dns' ? '🔍 DNS' : '⚡ Intermittent'}
                  </span>
                </div>
              )}

              {/* Layer checks */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <LayerCheck
                  label="Device Link"
                  ok={diagnosis.deviceHealthy ?? true}
                  detail={diagnosis.deviceIp || (diagnosis.deviceInterfaceUp ? 'Active' : 'Down')}
                />
                <LayerCheck
                  label="Router"
                  ok={diagnosis.routerReachable}
                  detail={diagnosis.routerPingMs != null ? `${diagnosis.routerPingMs}ms` : null}
                />
                {diagnosis.peerTested && (
                  <LayerCheck
                    label={`LAN Peer (${diagnosis.peerName || 'Host'})`}
                    ok={diagnosis.peerReachable}
                    detail={diagnosis.peerPingMs != null ? `${diagnosis.peerPingMs}ms` : null}
                  />
                )}
                <LayerCheck
                  label="Internet"
                  ok={diagnosis.internetReachable}
                  detail={diagnosis.externalPingMs != null ? `${diagnosis.externalPingMs}ms` : null}
                />
                <LayerCheck label="DNS" ok={diagnosis.dnsWorking} />
                <LayerCheck label="HTTP" ok={diagnosis.httpWorking} />
              </div>

              {/* Detail text */}
              {diagnosis.detail && (
                <p className="text-xs text-ns-text-secondary leading-relaxed bg-ns-surface/50 rounded-lg p-3 border border-ns-border/50">
                  {diagnosis.detail}
                </p>
              )}

              {/* Latency snapshot at time of event */}
              {diagnosis.latencyStats?.avg != null && (
                <div className="mt-2 flex gap-3 text-[11px] text-ns-text-secondary">
                  <span>Avg: {diagnosis.latencyStats.avg}ms</span>
                  <span>P95: {diagnosis.latencyStats.p95}ms</span>
                  <span>Jitter: {diagnosis.latencyStats.jitter}ms</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LayerCheck({ label, ok, detail }) {
  return (
    <div className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border ${
      ok ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
         : 'bg-red-500/5 border-red-500/20 text-red-400'
    }`}>
      <span>{ok ? '✓' : '✗'}</span>
      <span className="font-medium">{label}</span>
      {detail && <span className="ml-auto opacity-70">{detail}</span>}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-xl skeleton" />
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl skeleton" />)}
      </div>
      <div className="h-28 rounded-xl skeleton" />
      <div className="h-40 rounded-xl skeleton" />
    </div>
  );
}
