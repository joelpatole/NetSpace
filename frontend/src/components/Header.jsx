import {
  Search, RefreshCw, Settings, Wifi, ToggleLeft, ToggleRight, List, Activity, Sparkles, HeartPulse
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function Header({
  network, scanning, autoRefresh, onToggleAutoRefresh,
  onScan, onOpenSettings, onOpenLogs, onOpenSpeedTest, onOpenHealth, searchQuery, onSearchChange, refreshInterval,
  newDeviceCount = 0, healthStatus = 'healthy'
}) {
  const capacity = network?.maxOverride || network?.estimatedCapacity || '—';
  const capacityLabel = network?.maxOverride ? 'rated' : 'est.';

  return (
    <header className="flex-shrink-0 bg-ns-card/80 backdrop-blur-xl border-b border-ns-border z-30">
      <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
        {/* Logo + Network Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ns-accent to-ns-cyan flex items-center justify-center">
              <Wifi className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-ns-text tracking-tight hidden sm:block">
              NetSpace
            </h1>
          </div>

          {network && (
            <div className="hidden lg:flex items-center gap-4 text-xs text-ns-text-secondary ml-2">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-ns-online animate-pulse" />
                Router: <span className="text-ns-text font-mono">{network.routerIp || '—'}</span>
              </span>
              <span>
                Your IP: <span className="text-ns-text font-mono">{network.myIp || '—'}</span>
              </span>
              <span>
                Subnet: <span className="text-ns-text font-mono">{network.subnet || '—'}</span>
              </span>
              <span className="text-ns-cyan font-medium">
                {network.connectedCount || 0} / {capacity} devices
                <span className="text-ns-text-secondary font-normal ml-1">({capacityLabel})</span>
              </span>
              {newDeviceCount > 0 && (
                <span className="flex items-center gap-1 text-purple-300 font-medium">
                  <Sparkles className="w-3 h-3" />
                  {newDeviceCount} new today
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ns-text-secondary" />
            <input
              id="device-search"
              type="text"
              placeholder="Search devices..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="w-36 sm:w-48 pl-8 pr-3 py-1.5 text-sm bg-ns-bg border border-ns-border rounded-lg
                         text-ns-text placeholder:text-ns-text-secondary/50
                         focus:outline-none focus:border-ns-accent/50 focus:ring-1 focus:ring-ns-accent/20
                         transition-all"
            />
          </div>

          {/* Auto-refresh toggle */}
          <button
            id="auto-refresh-toggle"
            onClick={onToggleAutoRefresh}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-ns-border
                       hover:border-ns-accent/30 transition-colors"
            title={`Auto-refresh ${autoRefresh ? 'on' : 'off'} (every ${refreshInterval || 20}s)`}
          >
            {autoRefresh
              ? <ToggleRight className="w-4 h-4 text-ns-online" />
              : <ToggleLeft className="w-4 h-4 text-ns-offline" />
            }
            <span className="hidden sm:inline text-ns-text-secondary">
              {refreshInterval || 20}s
            </span>
          </button>

          {/* Speed Test */}
          <button
            onClick={onOpenSpeedTest}
            className="p-2 rounded-lg border border-ns-border hover:border-ns-accent/30
                       hover:bg-ns-surface/50 transition-colors"
            title="Internet Speed Test"
          >
            <Activity className="w-4 h-4 text-ns-cyan" />
          </button>

          {/* Network Health */}
          <button
            id="health-button"
            onClick={onOpenHealth}
            className="relative p-2 rounded-lg border border-ns-border hover:border-ns-accent/30
                       hover:bg-ns-surface/50 transition-colors"
            title="Network Health Report"
          >
            <HeartPulse className={`w-4 h-4 ${
              healthStatus === 'down' ? 'text-red-400' :
              healthStatus === 'degraded' ? 'text-amber-400' :
              'text-emerald-400'
            }`} />
            <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
              healthStatus === 'down' ? 'bg-red-400 animate-pulse' :
              healthStatus === 'degraded' ? 'bg-amber-400 animate-pulse' :
              'bg-emerald-400'
            }`} />
          </button>

          {/* Logs */}
          <button
            id="logs-button"
            onClick={onOpenLogs}
            className="relative p-2 rounded-lg border border-ns-border hover:border-ns-accent/30
                       hover:bg-ns-surface/50 transition-colors"
            title="View activity"
          >
            <List className="w-4 h-4 text-ns-text-secondary" />
            {newDeviceCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full
                               bg-purple-500 text-white text-[9px] font-bold
                               flex items-center justify-center">
                {newDeviceCount}
              </span>
            )}
          </button>

          {/* Rescan button */}
          <motion.button
            id="rescan-button"
            onClick={onScan}
            disabled={scanning}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
                       bg-gradient-to-r from-ns-accent to-blue-600 text-white
                       hover:from-blue-500 hover:to-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all shadow-lg shadow-ns-accent/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{scanning ? 'Scanning...' : 'Rescan'}</span>
          </motion.button>

          {/* Settings */}
          <button
            id="settings-button"
            onClick={onOpenSettings}
            className="p-2 rounded-lg border border-ns-border hover:border-ns-accent/30
                       hover:bg-ns-surface/50 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-ns-text-secondary" />
          </button>
        </div>
      </div>

      {/* Mobile compact info bar */}
      {network && (
        <div className="lg:hidden flex items-center gap-3 px-4 pb-2 text-xs text-ns-text-secondary overflow-x-auto">
          <span className="flex items-center gap-1 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-ns-online animate-pulse" />
            <span className="font-mono text-ns-text">{network.routerIp || '—'}</span>
          </span>
          <span className="whitespace-nowrap">
            You: <span className="font-mono text-ns-text">{network.myIp || '—'}</span>
          </span>
          <span className="text-ns-cyan font-medium whitespace-nowrap">
            {network.connectedCount || 0}/{capacity} online
          </span>
          {newDeviceCount > 0 && (
            <span className="text-purple-300 font-medium whitespace-nowrap flex items-center gap-1">
              <Sparkles className="w-3 h-3" />{newDeviceCount} new
            </span>
          )}
        </div>
      )}
    </header>
  );
}
