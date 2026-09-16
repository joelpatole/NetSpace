import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Clock, Wifi, WifiOff } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { updateDevice } from '../utils/api.js';

const ICON_MAP = {
  Smartphone: LucideIcons.Smartphone,
  Tablet: LucideIcons.Tablet,
  Laptop: LucideIcons.Laptop,
  Printer: LucideIcons.Printer,
  Cast: LucideIcons.Cast,
  Speaker: LucideIcons.Speaker,
  Tv: LucideIcons.Tv,
  Gamepad2: LucideIcons.Gamepad2,
  Camera: LucideIcons.Camera,
  HardDrive: LucideIcons.HardDrive,
  Router: LucideIcons.Router,
  HelpCircle: LucideIcons.HelpCircle,
  Monitor: LucideIcons.Monitor,
  Terminal: LucideIcons.Terminal,
  Cpu: LucideIcons.Cpu,
  Home: LucideIcons.Home,
};

export default function DeviceDrawer({ device, onClose, onUpdate }) {
  const [nickname, setNickname] = useState(device.nickname || '');
  const [notes, setNotes] = useState(device.notes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const IconComponent = ICON_MAP[device.icon] || LucideIcons.HelpCircle;
  const isOnline = device.status === 'online';

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
        className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-ns-card border-l border-ns-border
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
          <div className="flex items-center gap-4 p-4 bg-ns-bg rounded-xl border border-ns-border">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center
              ${isOnline ? 'bg-ns-accent/10 border border-ns-accent/20' : 'bg-ns-border/20 border border-ns-border'}`}>
              <IconComponent className={`w-7 h-7 ${isOnline ? 'text-ns-accent' : 'text-ns-offline'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-ns-text truncate">
                {device.nickname || device.hostname || device.deviceType}
              </div>
              <div className="text-sm text-ns-text-secondary">{device.deviceType}</div>
              <div className="flex items-center gap-1.5 mt-1">
                {isOnline
                  ? <><Wifi className="w-3 h-3 text-ns-online" /><span className="text-xs text-ns-online">Online</span></>
                  : <><WifiOff className="w-3 h-3 text-ns-offline" /><span className="text-xs text-ns-offline">Offline</span></>
                }
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="space-y-3">
            <InfoRow label="IP Address" value={device.ip} mono />
            <InfoRow label="MAC Address" value={device.mac} mono />
            {device.oui && <InfoRow label="OUI Prefix" value={device.oui} mono />}
            {device.vendor && (
              <InfoRow
                label="Vendor / Maker"
                value={
                  <span className="flex items-center gap-1.5 justify-end">
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
            <InfoRow
              label="First Seen"
              value={new Date(device.firstSeen).toLocaleString()}
              icon={<Clock className="w-3 h-3" />}
            />
            <InfoRow
              label="Last Seen"
              value={new Date(device.lastSeen).toLocaleString()}
              icon={<Clock className="w-3 h-3" />}
            />
          </div>

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

function InfoRow({ label, value, mono, icon }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-ns-border/30">
      <span className="text-xs text-ns-text-secondary flex items-center gap-1">
        {icon}{label}
      </span>
      <span className={`text-sm text-ns-text text-right max-w-[60%] break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}
