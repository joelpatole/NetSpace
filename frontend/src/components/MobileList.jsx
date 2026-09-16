import { motion } from 'framer-motion';
import { Router, Wifi, WifiOff } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

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

export default function MobileList({ network, devices, onSelectDevice }) {
  const routerDevice = devices.find(d => d.deviceType === 'Router');
  const otherDevices = [...devices.filter(d => d.deviceType !== 'Router')];
  const capacity = network?.maxOverride || network?.estimatedCapacity || '—';

  // Compute closeness ranks (1-indexed based on pingMs ascending)
  const closenessRanks = new Map();
  const rankedCandidates = otherDevices.filter(d => d.status === 'online' && d.pingMs != null && d.pingMs > 0);
  rankedCandidates.sort((a, b) => a.pingMs - b.pingMs);
  rankedCandidates.forEach((d, idx) => closenessRanks.set(d.id, idx + 1));

  // Sort otherDevices: Ranked devices first (in rank order), then unranked online, then offline
  otherDevices.sort((a, b) => {
    const rankA = closenessRanks.get(a.id) ?? 999;
    const rankB = closenessRanks.get(b.id) ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
    return a.ip.localeCompare(b.ip, undefined, { numeric: true });
  });

  return (
    <div className="p-4 space-y-4">
      {/* Router card */}
      {routerDevice && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onSelectDevice(routerDevice)}
          className="p-4 bg-gradient-to-br from-ns-accent/10 to-ns-card border border-ns-accent/20
                     rounded-xl cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-ns-accent/15 border border-ns-accent/20
                            flex items-center justify-center">
              <Router className="w-6 h-6 text-ns-accent" />
            </div>
            <div>
              <div className="text-base font-semibold text-ns-text">
                {routerDevice.nickname || 'Router'}
              </div>
              <div className="text-sm font-mono text-ns-text-secondary">{routerDevice.ip}</div>
              <div className="text-xs text-ns-cyan mt-0.5">
                {network?.connectedCount || 0} / {capacity} devices connected
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Device list */}
      <div className="space-y-2">
        {otherDevices.map((device, idx) => {
          const IconComponent = ICON_MAP[device.icon] || LucideIcons.HelpCircle;
          const isOnline = device.status === 'online';
          const isMe = network?.myIp === device.ip;
          const rank = closenessRanks.get(device.id);

          return (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              onClick={() => onSelectDevice(device)}
              className={`flex items-center gap-3 p-3 bg-ns-card border rounded-xl
                         cursor-pointer active:scale-[0.98] transition-transform ${isMe ? 'border-orange-500/50 shadow-[0_0_15px_rgba(251,146,60,0.15)]' : 'border-ns-border'}`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                ${isMe ? 'bg-orange-500/20 border-orange-500/30' : (isOnline ? 'bg-ns-accent/10 border-ns-accent/20 border' : 'bg-ns-border/20 border border-ns-border')}`}>
                <IconComponent className={`w-5 h-5 ${isMe ? 'text-orange-400' : (isOnline ? 'text-ns-accent' : 'text-ns-offline')}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ns-text truncate flex items-center gap-2 flex-wrap">
                  <span>{device.nickname || device.hostname || device.vendor || device.deviceType}</span>
                  {isMe && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">You</span>}
                  {rank != null && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase flex items-center gap-0.5 ${
                      rank === 1
                        ? 'bg-ns-cyan/20 text-ns-cyan border border-ns-cyan/30'
                        : rank === 2
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                        : rank === 3
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                        : 'bg-ns-surface text-ns-text-secondary border border-ns-border'
                    }`}>
                      {rank === 1 ? <LucideIcons.Zap className="w-3 h-3 text-ns-cyan" /> : null}
                      Rank #{rank}
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-ns-text-secondary">{device.ip}</div>
              </div>

              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  {isOnline
                    ? <Wifi className={`w-3.5 h-3.5 ${isMe ? 'text-orange-400' : 'text-ns-online'}`} />
                    : <WifiOff className="w-3.5 h-3.5 text-ns-offline" />
                  }
                  <span className={`text-xs ${isOnline ? (isMe ? 'text-orange-400' : 'text-ns-online') : 'text-ns-offline'}`}>
                    {isOnline ? 'On' : 'Off'}
                  </span>
                </div>
                {device.pingMs != null && (
                  <span className="text-[10px] text-ns-cyan font-mono font-medium">{device.pingMs} ms</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {devices.length === 0 && (
        <div className="text-center py-12 text-ns-text-secondary">
          <p className="text-sm">No devices found yet.</p>
          <p className="text-xs mt-1">Try running a scan.</p>
        </div>
      )}
    </div>
  );
}
