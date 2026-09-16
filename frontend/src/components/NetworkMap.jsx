import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DeviceNode from './DeviceNode.jsx';
import ConnectionLine from './ConnectionLine.jsx';
import RouterNode from './RouterNode.jsx';
import { isLocalDevice, isNewDevice, deviceName, relativeTime } from '../utils/devices.js';

export default function NetworkMap({ network, devices, highlightedIds, onSelectDevice }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [tooltip, setTooltip] = useState(null);

  // Track container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Compute closeness ranks (1-indexed based on pingMs ascending)
  const closenessRanks = useMemo(() => {
    const candidates = devices.filter(
      d => d.deviceType !== 'Router' && !isLocalDevice(d, network) &&
           d.status === 'online' && d.pingMs != null && d.pingMs > 0
    );
    candidates.sort((a, b) => a.pingMs - b.pingMs);
    
    const rankMap = new Map();
    candidates.forEach((d, idx) => {
      rankMap.set(d.id, idx + 1);
    });
    return rankMap;
  }, [devices, network]);

  // Compute which device is closest to router (lowest ping)
  const closestDeviceId = useMemo(() => {
    const candidates = devices.filter(
      d => d.deviceType !== 'Router' && !isLocalDevice(d, network) &&
           d.status === 'online' && d.pingMs != null && d.pingMs > 0
    );
    if (candidates.length === 0) return null;
    const closest = candidates.reduce((prev, curr) => (prev.pingMs < curr.pingMs ? prev : curr));
    return closest.id;
  }, [devices, network]);

  // Compute layout positions sorted by closeness rank
  const { cx, cy, routerDevice, devicePositions } = useMemo(() => {
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;

    const nonRouterDevices = [...devices.filter(d => d.deviceType !== 'Router')];
    // Sort by closeness rank (closest first, then by IP)
    nonRouterDevices.sort((a, b) => {
      const rankA = closenessRanks.get(a.id) ?? 999;
      const rankB = closenessRanks.get(b.id) ?? 999;
      if (rankA !== rankB) return rankA - rankB;
      return a.ip.localeCompare(b.ip, undefined, { numeric: true });
    });

    const routerDevice = devices.find(d => d.deviceType === 'Router') || null;
    const count = nonRouterDevices.length;
    const maxRadius = Math.min(cx, cy) - 80;
    
    // Single ring for up to ~16 devices, two rings beyond that
    let rings = [];
    if (count <= 16) {
      rings = [{ devices: nonRouterDevices, radius: Math.min(maxRadius, Math.max(160, count * 22)) }];
    } else {
      const half = Math.ceil(count / 2);
      rings = [
        { devices: nonRouterDevices.slice(0, half), radius: maxRadius * 0.55 },
        { devices: nonRouterDevices.slice(half), radius: maxRadius * 0.9 },
      ];
    }

    const positions = new Map();
    for (const ring of rings) {
      const n = ring.devices.length;
      ring.devices.forEach((device, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2; // start from top
        positions.set(device.id, {
          x: cx + ring.radius * Math.cos(angle),
          y: cy + ring.radius * Math.sin(angle),
          angle
        });
      });
    }

    return { cx, cy, routerDevice, devicePositions: positions };
  }, [devices, dimensions, closenessRanks]);

  return (
    <div ref={containerRef} className="w-full h-full relative" id="network-map">
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
      >
        <defs>
          {/* Radial gradient for background */}
          <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.04" />
            <stop offset="60%" stopColor="#3B82F6" stopOpacity="0.01" />
            <stop offset="100%" stopColor="#0B0F14" stopOpacity="0" />
          </radialGradient>
          
          {/* Glow filter for connections */}
          <filter id="connectionGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Pulse dot gradient */}
          <radialGradient id="pulseDot">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="1" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background glow */}
        <rect width="100%" height="100%" fill="url(#bgGlow)" />

        {/* Faint concentric guide rings */}
        {[0.3, 0.55, 0.8].map((ratio, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={Math.min(cx, cy) * ratio}
            fill="none"
            stroke="#1F2A35"
            strokeWidth="0.5"
            strokeDasharray="4 8"
            opacity={0.5}
          />
        ))}

        {/* Connection lines */}
        <AnimatePresence>
          {Array.from(devicePositions).map(([id, pos]) => {
            const device = devices.find(d => d.id === id);
            if (!device) return null;
            const dimmed = highlightedIds && !highlightedIds.has(id);
            return (
              <ConnectionLine
                key={`line-${id}`}
                x1={cx}
                y1={cy}
                x2={pos.x}
                y2={pos.y}
                online={device.status === 'online'}
                dimmed={dimmed}
              />
            );
          })}
        </AnimatePresence>

        {/* Router node */}
        <RouterNode
          cx={cx}
          cy={cy}
          device={routerDevice}
          network={network}
          onClick={() => routerDevice && onSelectDevice(routerDevice)}
        />

        {/* Device nodes */}
        <AnimatePresence>
          {Array.from(devicePositions).map(([id, pos]) => {
            const device = devices.find(d => d.id === id);
            if (!device) return null;
            const dimmed = highlightedIds && !highlightedIds.has(id);
            const rank = closenessRanks.get(id);
            
            return (
              <DeviceNode
                key={id}
                device={device}
                x={pos.x}
                y={pos.y}
                dimmed={dimmed}
                isMe={isLocalDevice(device, network)}
                isNew={isNewDevice(device)}
                isClosest={closestDeviceId === device.id}
                closenessRank={rank}
                onClick={() => onSelectDevice(device)}
                onHover={(info) => setTooltip(info)}
                onLeave={() => setTooltip(null)}
              />
            );
          })}
        </AnimatePresence>
      </svg>

      {/* Floating tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="tooltip fixed px-3 py-2 bg-ns-card border border-ns-border rounded-lg shadow-xl
                       text-xs max-w-xs"
            style={{ left: tooltip.x + 15, top: tooltip.y - 10 }}
          >
            <div className="font-medium text-ns-text flex items-center gap-2">
              {deviceName(tooltip.device)}
              {tooltip.isMe && <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1 py-0.5 rounded font-bold">YOU</span>}
              {tooltip.isNew && <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1 py-0.5 rounded font-bold">NEW</span>}
              {tooltip.closenessRank && (
                <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1 py-0.5 rounded font-bold">
                  RANK #{tooltip.closenessRank}
                </span>
              )}
            </div>
            <div className="text-ns-text-secondary mt-1 space-y-0.5">
              <div>MAC: <span className="font-mono">{tooltip.device.mac}</span></div>
              {tooltip.device.oui && <div>OUI: <span className="font-mono text-ns-cyan">{tooltip.device.oui}</span></div>}
              {tooltip.device.vendor && <div>Vendor: {tooltip.device.vendor}</div>}
              {tooltip.device.pingMs != null && <div>Ping: <span className="font-mono text-ns-cyan">{tooltip.device.pingMs} ms</span></div>}
              <div>Last seen: {relativeTime(tooltip.device.lastSeen)}</div>
              <div>First seen: {relativeTime(tooltip.device.firstSeen)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
