import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Save } from 'lucide-react';
import { updateSettings } from '../utils/api.js';

export default function SettingsModal({ settings, network, onClose, onSaved }) {
  const [refreshInterval, setRefreshInterval] = useState(settings?.refreshIntervalSeconds || 20);
  const [maxOverride, setMaxOverride] = useState(settings?.maxOverride || '');
  const [onlineVendor, setOnlineVendor] = useState(settings?.onlineVendorLookupEnabled || false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        refreshIntervalSeconds: Number(refreshInterval),
        maxOverride: maxOverride === '' ? null : Number(maxOverride),
        onlineVendorLookupEnabled: onlineVendor
      });
      onSaved();
      onClose();
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
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
                   w-full max-w-md bg-ns-card border border-ns-border rounded-2xl
                   shadow-2xl z-50 overflow-hidden"
        id="settings-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-ns-border">
          <h2 className="text-lg font-semibold text-ns-text">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ns-surface transition-colors"
            id="close-settings"
          >
            <X className="w-5 h-5 text-ns-text-secondary" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Refresh interval */}
          <div className="space-y-2">
            <label htmlFor="refresh-interval" className="text-sm font-medium text-ns-text">
              Auto-refresh interval (seconds)
            </label>
            <input
              id="refresh-interval"
              type="number"
              min={5}
              max={300}
              value={refreshInterval}
              onChange={e => setRefreshInterval(e.target.value)}
              className="w-full px-3 py-2 bg-ns-bg border border-ns-border rounded-lg text-sm text-ns-text
                         focus:outline-none focus:border-ns-accent/50 focus:ring-1 focus:ring-ns-accent/20"
            />
            <p className="text-xs text-ns-text-secondary">
              How often the frontend polls for updated data. Range: 5–300s.
            </p>
          </div>

          {/* Max capacity override */}
          <div className="space-y-2">
            <label htmlFor="max-override" className="text-sm font-medium text-ns-text">
              Router max client capacity (override)
            </label>
            <input
              id="max-override"
              type="number"
              min={1}
              max={9999}
              value={maxOverride}
              onChange={e => setMaxOverride(e.target.value)}
              placeholder={`Estimated from subnet: ${network?.estimatedCapacity || '—'}`}
              className="w-full px-3 py-2 bg-ns-bg border border-ns-border rounded-lg text-sm text-ns-text
                         placeholder:text-ns-text-secondary/40
                         focus:outline-none focus:border-ns-accent/50 focus:ring-1 focus:ring-ns-accent/20"
            />
            <p className="text-xs text-ns-text-secondary">
              Enter your router's rated max-client count from its specs. Leave blank to use the subnet-based estimate.
            </p>
          </div>

          {/* Online vendor lookup */}
          <div className="flex items-center justify-between p-3 bg-ns-bg rounded-lg border border-ns-border">
            <div>
              <div className="text-sm font-medium text-ns-text">Online vendor lookup</div>
              <div className="text-xs text-ns-text-secondary mt-0.5">
                Query external APIs for device vendor info. Off by default for privacy.
              </div>
            </div>
            <button
              id="online-vendor-toggle"
              onClick={() => setOnlineVendor(!onlineVendor)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ml-3
                ${onlineVendor ? 'bg-ns-accent' : 'bg-ns-border'}`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                  ${onlineVendor ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-ns-border">
          <button
            id="save-settings"
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
                       rounded-lg bg-gradient-to-r from-ns-accent to-blue-600 text-white
                       hover:from-blue-500 hover:to-blue-700
                       disabled:opacity-50 transition-all"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </motion.div>
    </>
  );
}
