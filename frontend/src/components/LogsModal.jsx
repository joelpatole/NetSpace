import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2, WifiOff, Wifi } from 'lucide-react';
import { fetchLogs, clearLogs } from '../utils/api.js';

export default function LogsModal({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const data = await fetchLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearLogs();
      setLogs([]);
    } catch (err) {
      alert('Failed to clear logs');
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                   w-full max-w-lg bg-ns-card border border-ns-border rounded-2xl
                   shadow-2xl z-50 flex flex-col max-h-[80vh]"
        id="logs-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-ns-border flex-shrink-0">
          <h2 className="text-lg font-semibold text-ns-text">Network Drop Logs</h2>
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              disabled={clearing || logs.length === 0}
              className="px-3 py-1.5 rounded-lg border border-red-900/50 text-red-500 text-xs font-medium hover:bg-red-900/20 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-ns-surface transition-colors"
            >
              <X className="w-5 h-5 text-ns-text-secondary" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-0 overflow-y-auto flex-1">
          {loading ? (
            <div className="p-6 text-center text-ns-text-secondary text-sm">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-ns-text-secondary flex flex-col items-center gap-2">
              <Wifi className="w-8 h-8 opacity-50" />
              <p>No network drops recorded yet.</p>
              <p className="text-xs opacity-75">Your router connection has been stable.</p>
            </div>
          ) : (
            <div className="divide-y divide-ns-border/50">
              {logs.map(log => (
                <div key={log.id} className="p-4 hover:bg-ns-surface/30 transition-colors flex items-start gap-3">
                  <div className={`mt-0.5 p-2 rounded-lg 
                    ${log.event === 'restore' ? 'bg-ns-online/10 text-ns-online' : 'bg-red-500/10 text-red-500'}`}>
                    {log.event === 'restore' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ns-text">{log.message}</p>
                    <p className="text-xs text-ns-text-secondary mt-1">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
