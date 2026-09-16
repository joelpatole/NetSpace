import * as LucideIcons from 'lucide-react';

/** Maps a classifier icon name to its Lucide component. */
export const ICON_MAP = {
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

export function deviceIcon(device) {
  return ICON_MAP[device.icon] || LucideIcons.HelpCircle;
}

export function deviceName(device) {
  return device.nickname || device.hostname || device.vendor || device.deviceType;
}

/** A device is "this machine" when the backend flagged it, with an IP fallback. */
export function isLocalDevice(device, network) {
  return Boolean(device.isLocal) || (!!network?.myIp && network.myIp === device.ip);
}

const NEW_DEVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** True when the device was first seen within the last 24 hours. */
export function isNewDevice(device) {
  if (!device.firstSeen) return false;
  const first = new Date(device.firstSeen).getTime();
  return Number.isFinite(first) && Date.now() - first < NEW_DEVICE_WINDOW_MS;
}

/** "3h ago", "just now", … */
export function relativeTime(value) {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '—';
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
