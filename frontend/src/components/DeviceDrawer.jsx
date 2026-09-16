import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  X, Save, Clock, Wifi, WifiOff, Activity, ShieldQuestion,
  Radar, Loader2, Sparkles, TrendingUp
} from 'lucide-react';
import { updateDevice, fetchDeviceHistory, scanDevicePorts } from '../utils/api.js';
import { deviceIcon, deviceName, isLocalDevice, isNewDevice, relativeTime } from '../utils/devices.js';
import Sparkline from './Sparkline.jsx';
import UptimeTimeline from './UptimeTimeline.jsx';

export default function DeviceDrawer({ device, network, onClose, onUpdate }) {
  const [nickname, setNickname] = useState(device.nickname || '');
  const [notes, setNotes] = useState(device.notes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState(null);

  const [ports, setPorts] = useState(null);
  const [portsScanning, setPortsScanning] = useState(false);
  const [portsError, setPortsError] = useState(null);

  const IconComponent = deviceIcon(device);
  const isOnline = device.status === 'online';
  const isMe = isLocalDevice(device, network);
  const isNew = isNewDevice(device);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await fetchDeviceHistory(device.id));
      setHistoryError(null);
    } catch (err) {
      setHistoryError(err.message);
    }
  }, [device.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Reset per-device panels when the drawer switches to another device.
  useEffect(() => {
    setNickname(device.nickname || '');
    setNotes(device.notes || '');
    setPorts(null);
    setPortsError(null);
  }, [device.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDevice(device.id, {
        nickname: nickname || null,
        notes: notes || null
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onUpdate();
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePortScan = async () => {
    setPortsScanning(true);
    setPortsError(null);
    try {
      setPorts(await scanDevicePorts(device.id));
    } catch (err) {
      setPortsError(err.message);
    } finally {
      setPortsScanning(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[26rem] bg-ns-card border-l border-ns-border
                   shadow-2xl z-50 flex flex-col overflow-hidden"
        id="device-drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ns-border">
          <h2 className="text-lg font-semibold text-ns-text">Device Details</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ns-surface transition-colors"
            id="close-drawer"
          >
            <X className="w-5 h-5 text-ns-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Device hero */}
          <div className={`flex items-center gap-4 p-4 bg-ns-bg rounded-xl border
            ${isMe ? 'border-orange-500/40' : 'border-ns-border'}`}>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center border
              ${isMe
                ? 'bg-orange-500/15 border-orange-500/30'
                : isOnline ? 'bg-ns-accent/10 border-ns-accent/20' : 'bg-ns-border/20 border-ns-border'}`}>
              <IconComponent className={`w-7 h-7 ${isMe ? 'text-orange-400' : isOnline ? 'text-ns-accent' : 'text-ns-offline'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-ns-text truncate flex items-center gap-2">
                <span className="truncate">{deviceName(device)}</span>
                {isMe && <Badge className="bg-orange-500/20 text-orange-400">You</Badge>}
              </div>
              <div className="text-sm text-ns-text-secondary">{device.deviceType}</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {isOnline
                  ? <span className="flex items-center gap-1.5"><Wifi className="w-3 h-3 text-ns-online" /><span className="text-xs text-ns-online">Online</span></span>
                  : <span className="flex items-center gap-1.5"><WifiOff className="w-3 h-3 text-ns-offline" /><span className="text-xs text-ns-offline">Offline</span></span>
                }
                {isNew && (
                  <Badge className="bg-purple-500/20 text-purple-300 border border-purple-400/30">
                    <Sparkles className="w-2.5 h-2.5" /> New
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Activity & history */}
          <Section title="Activity" icon={<Activity className="w-3.5 h-3.5" />}>
            {historyError ? (
              <p className="text-xs text-yellow-400/80">{historyError}</p>
            ) : !history ? (
              <p className="text-xs text-ns-text-secondary">Loading history…</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <Stat
                    label={`Uptime ${history.windowHours}h`}
                    value={history.uptimePercent != null ? `${history.uptimePercent}%` : '—'}
                    accent={
                      history.uptimePercent == null ? '' :
                      history.uptimePercent >= 95 ? 'text-ns-online' :
                      history.uptimePercent >= 70 ? 'text-yellow-400' : 'text-red-400'
                    }
                  />
                  <Stat
                    label="Avg latency"
                    value={history.avgPingMs != null ? `${history.avgPingMs} ms` : '—'}
                    accent="text-ns-cyan"
                  />
                  <Stat label="Samples" value={history.sampleCount || '0'} />
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-ns-text-secondary mb-1.5">
                    Availability
                  </p>
                  <UptimeTimeline samples={history.samples} windowHours={history.windowHours} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-ns-text-secondary">
                      Latency
                    </p>
                    {history.minPingMs != null && (
                      <p className="text-[10px] text-ns-text-secondary font-mono">
                        {history.minPingMs} – {history.maxPingMs} ms
                      </p>
                    )}
                  </div>
                  <Sparkline samples={history.samples} />
                </div>

                <p className="text-[10px] text-ns-text-secondary/70 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  History is sampled every 5 minutes and kept for {history.windowHours} hours.
                </p>
              </div>
            )}
          </Section>

          {/* Info grid */}
          <Section title="Identity" icon={<ShieldQuestion className="w-3.5 h-3.5" />}>
            <div className="space-y-1">
              <InfoRow label="IP Address" value={device.ip} mono />
              <InfoRow label="MAC Address" value={device.mac} mono />
              {device.oui && <InfoRow label="OUI Prefix" value={device.oui} mono />}
              {device.vendor && (
                <InfoRow
                  label="Vendor / Maker"
                  value={
                    <span className="flex items-center gap-1.5 justify-end flex-wrap">
                      <span>{device.vendor}</span>
                      {device.isRandomizedMac && (
                        <span className="text-[9px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1 py-0.5 rounded font-medium">
                          Private MAC
                        </span>
                      )}
                    </span>
                  }
                />
              )}
              {device.hostname && <InfoRow label="Hostname" value={device.hostname} />}
              <InfoRow label="Device Type" value={device.deviceType} />
              {device.pingMs != null && (
                <InfoRow label="Last Ping" value={`${device.pingMs} ms`} mono />
              )}
              <InfoRow
                label="First Seen"
                value={`${new Date(device.firstSeen).toLocaleString()} (${relativeTime(device.firstSeen)})`}
                icon={<Clock className="w-3 h-3" />}
              />
              <InfoRow
                label="Last Seen"
                value={`${new Date(device.lastSeen).toLocaleString()} (${relativeTime(device.lastSeen)})`}
                icon={<Clock className="w-3 h-3" />}
              />
            </div>
          </Section>

          {/* Open ports — on demand only */}
          <Section title="Open Ports" icon={<Radar className="w-3.5 h-3.5" />}>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-ns-text-secondary">
                  Probes {ports?.scannedPorts || 27} common service ports on this device.
                  Runs only when you click — never in the background.
                </p>
                <button
                  id="scan-ports"
                  onClick={handlePortScan}
                  disabled={portsScanning || !isOnline}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                             rounded-lg border border-ns-border text-ns-text
                             hover:border-ns-accent/40 hover:bg-ns-surface/50
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={isOnline ? 'Scan common ports' : 'Device is offline'}
                >
                  {portsScanning
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning…</>
                    : <><Radar className="w-3.5 h-3.5" /> Scan ports</>}
                </button>
              </div>

              {portsError && <p className="text-xs text-yellow-400/90">{portsError}</p>}

              {ports && !portsScanning && (
                ports.openPorts.length === 0 ? (
                  <p className="text-xs text-ns-text-secondary">
                    No common ports responded ({ports.scannedPorts} probed in {(ports.durationMs / 1000).toFixed(1)}s).
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {ports.openPorts.map(p => (
                      <div
                        key={p.port}
                        className="flex items-center justify-between px-3 py-2 bg-ns-bg
                                   border border-ns-border rounded-lg"
                      >
                        <span className="font-mono text-xs text-ns-cyan">{p.port}/tcp</span>
                        <span className="text-xs text-ns-text-secondary">{p.service}</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-ns-text-secondary/70 pt-1">
                      {ports.openPorts.length} open of {ports.scannedPorts} probed ·
                      {' '}{(ports.durationMs / 1000).toFixed(1)}s
                    </p>
                  </div>
                )
              )}
            </div>
          </Section>

          {/* Editable nickname */}
          <div className="space-y-2">
            <label htmlFor="device-nickname" className="text-sm font-medium text-ns-text">
              Nickname
            </label>
            <input
              id="device-nickname"
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="Give this device a name..."
              className="w-full px-3 py-2 bg-ns-bg border border-ns-border rounded-lg text-sm text-ns-text
                         placeholder:text-ns-text-secondary/40
                         focus:outline-none focus:border-ns-accent/50 focus:ring-1 focus:ring-ns-accent/20"
            />
          </div>

          {/* Editable notes */}
          <div className="space-y-2">
            <label htmlFor="device-notes" className="text-sm font-medium text-ns-text">
              Notes
            </label>
            <textarea
              id="device-notes"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes about this device..."
              className="w-full px-3 py-2 bg-ns-bg border border-ns-border rounded-lg text-sm text-ns-text
                         placeholder:text-ns-text-secondary/40 resize-none
                         focus:outline-none focus:border-ns-accent/50 focus:ring-1 focus:ring-ns-accent/20"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-ns-border">
          <button
            id="save-device"
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
                       rounded-lg bg-gradient-to-r from-ns-accent to-blue-600 text-white
                       hover:from-blue-500 hover:to-blue-700
                       disabled:opacity-50 transition-all"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      </motion.aside>
    </>
  );
}

function Section({ title, icon, children }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ns-text-secondary
                     flex items-center gap-1.5">
        {icon}{title}
      </h3>
      <div className="p-3 bg-ns-bg/60 border border-ns-border rounded-xl">
        {children}
      </div>
    </section>
  );
}

function Stat({ label, value, accent = '' }) {
  return (
    <div className="px-2 py-2 bg-ns-bg border border-ns-border rounded-lg text-center">
      <div className={`text-sm font-semibold ${accent || 'text-ns-text'}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-ns-text-secondary mt-0.5">{label}</div>
    </div>
  );
}

function Badge({ children, className = '' }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider
                      inline-flex items-center gap-0.5 flex-shrink-0 ${className}`}>
      {children}
    </span>
  );
}

function InfoRow({ label, value, mono, icon }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-ns-border/30 last:border-0">
      <span className="text-xs text-ns-text-secondary flex items-center gap-1 flex-shrink-0">
        {icon}{label}
      </span>
      <span className={`text-sm text-ns-text text-right max-w-[60%] break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}
