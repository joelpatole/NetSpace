import { useState, useEffect } from 'react';
import { Trash2, WifiOff, Wifi, Sparkles, LogIn, LogOut } from 'lucide-react';
import {
  fetchLogs, clearLogs, fetchDeviceEvents, clearDeviceEvents
} from '../utils/api.js';
import { relativeTime } from '../utils/devices.js';
import DraggableModal from './DraggableModal.jsx';

const TABS = [
  { key: 'devices', label: 'Device Activity' },
  { key: 'network', label: 'Network Drops' },
];

export default function LogsModal({ onClose }) {
  const [tab, setTab] = useState('devices');
  const [logs, setLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchLogs().then(setLogs).catch(console.error),
      fetchDeviceEvents().then(setEvents).catch(console.error)
    ]).finally(() => setLoading(false));
  }, []);

  const isDevices = tab === 'devices';
  const entries = isDevices ? events : logs;

  const handleClear = async () => {
    setClearing(true);
    try {
      if (isDevices) {
        await clearDeviceEvents();
        setEvents([]);
      } else {
        await clearLogs();
        setLogs([]);
      }
    } catch {
      alert('Failed to clear');
    } finally {
      setClearing(false);
    }
  };

  return (
    <DraggableModal
      id="logs-modal"
      title="Activity"
      icon={Sparkles}
      onClose={onClose}
      maxWidth="max-w-lg"
      maxHeight="max-h-[80vh]"
      headerExtra={
        <button
          onClick={handleClear}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={clearing || entries.length === 0}
          className="px-3 py-1.5 rounded-lg border border-red-900/50 text-red-500 text-xs font-medium hover:bg-red-900/20 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      }
    >
      {/* Tabs */}
      <div className="flex gap-1 px-5 py-3 border-b border-ns-border flex-shrink-0 bg-ns-card">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              tab === t.key
                ? 'bg-ns-accent/15 text-ns-accent border border-ns-accent/30'
                : 'text-ns-text-secondary border border-transparent hover:bg-ns-surface/50'
            }`}
          >
            {t.label}
            <span className="ml-1.5 opacity-60">
              {t.key === 'devices' ? events.length : logs.length}
            </span>
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="p-0 overflow-y-auto flex-1">
        {loading ? (
          <div className="p-6 text-center text-ns-text-secondary text-sm">Loading…</div>
        ) : entries.length === 0 ? (
          <EmptyState isDevices={isDevices} />
        ) : (
          <div className="divide-y divide-ns-border/50">
            {isDevices
              ? events.map(e => <DeviceEventRow key={e.id} event={e} />)
              : logs.map(log => <DropLogRow key={log.id} log={log} />)}
          </div>
        )}
      </div>
    </DraggableModal>
  );
}

const EVENT_STYLES = {
  new:    { Icon: Sparkles, cls: 'bg-purple-500/10 text-purple-300', verb: 'joined for the first time' },
  joined: { Icon: LogIn,    cls: 'bg-ns-online/10 text-ns-online',   verb: 'came back online' },
  left:   { Icon: LogOut,   cls: 'bg-ns-offline/10 text-ns-offline', verb: 'went offline' },
};

function DeviceEventRow({ event }) {
  const style = EVENT_STYLES[event.type] || EVENT_STYLES.joined;
  const { Icon } = style;

  return (
    <div className="p-4 hover:bg-ns-surface/30 transition-colors flex items-start gap-3">
      <div className={`mt-0.5 p-2 rounded-lg ${style.cls}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ns-text">
          <span className="font-medium">{event.name || event.mac}</span>
          <span className="text-ns-text-secondary"> {style.verb}</span>
        </p>
        <p className="text-xs text-ns-text-secondary mt-1 flex items-center gap-2 flex-wrap">
          <span className="font-mono">{event.ip}</span>
          <span>·</span>
          <span>{relativeTime(event.timestamp)}</span>
          <span>·</span>
          <span>{new Date(event.timestamp).toLocaleString()}</span>
        </p>
      </div>
    </div>
  );
}

function DropLogRow({ log }) {
  return (
    <div className="p-4 hover:bg-ns-surface/30 transition-colors flex items-start gap-3">
      <div className={`mt-0.5 p-2 rounded-lg
        ${log.event === 'restore' ? 'bg-ns-online/10 text-ns-online' : 'bg-red-500/10 text-red-500'}`}>
        {log.event === 'restore' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ns-text">{log.message}</p>
        <p className="text-xs text-ns-text-secondary mt-1">
          {relativeTime(log.timestamp)} · {new Date(log.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ isDevices }) {
  return (
    <div className="p-12 text-center text-ns-text-secondary flex flex-col items-center gap-2">
      {isDevices ? <Sparkles className="w-8 h-8 opacity-50" /> : <Wifi className="w-8 h-8 opacity-50" />}
      <p>{isDevices ? 'No device activity recorded yet.' : 'No network drops recorded yet.'}</p>
      <p className="text-xs opacity-75">
        {isDevices
          ? 'Devices joining or leaving your network will show up here.'
          : 'Your router connection has been stable.'}
      </p>
    </div>
  );
}
