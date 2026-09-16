import { motion } from 'framer-motion';
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

// Color palette for device types
const TYPE_COLORS = {
  iPhone: '#A78BFA',
  iPad: '#A78BFA',
  Mac: '#60A5FA',
  'Android phone': '#34D399',
  Printer: '#FB923C',
  'Google/Nest': '#F87171',
  'Amazon Echo': '#38BDF8',
  'Streaming device': '#E879F9',
  Xbox: '#4ADE80',
  PlayStation: '#3B82F6',
  'Nintendo Switch': '#F43F5E',
  'Sonos speaker': '#FBBF24',
  Camera: '#F97316',
  'NAS / Storage': '#6366F1',
  Router: '#3B82F6',
  'Apple device': '#A78BFA',
  'Samsung device': '#3B82F6',
  Computer: '#60A5FA',
  'Windows PC': '#38BDF8',
  Linux: '#FBBF24',
  'Raspberry Pi': '#34D399',
  'Network device': '#22D3EE',
  'Smart home': '#F59E0B',
  'Unknown device': '#64748B',
};

export default function DeviceNode({ device, x, y, dimmed, isMe, isClosest, closenessRank, onClick, onHover, onLeave }) {
  const IconComponent = ICON_MAP[device.icon] || LucideIcons.HelpCircle;
  const isOnline = device.status === 'online';
  const baseColor = TYPE_COLORS[device.deviceType] || '#64748B';
  const color = isMe ? '#FB923C' : baseColor;
  const displayName = device.nickname || device.hostname || device.vendor || device.deviceType;
  const truncatedName = displayName.length > 14 ? displayName.slice(0, 12) + '…' : displayName;

  const nodeSize = 32;

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: dimmed ? 0.25 : 1,
        scale: 1,
        x: 0,
        y: 0,
      }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ type: 'spring', stiffness: 150, damping: 20 }}
      className="cursor-pointer"
      onClick={onClick}
      onMouseMove={(e) => onHover({ x: e.clientX, y: e.clientY, device, isMe, isClosest, closenessRank })}
      onMouseLeave={onLeave}
      role="button"
      tabIndex={0}
    >
      {/* Radiant glow for "me" */}
      {isMe && (
        <circle
          cx={x}
          cy={y}
          r={nodeSize + 12}
          fill="none"
          stroke="#FB923C"
          strokeWidth="2"
          opacity="0.3"
        >
          <animate attributeName="r" values={`${nodeSize+2};${nodeSize+16};${nodeSize+2}`} dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Hover area + card background */}
      <motion.circle
        cx={x}
        cy={y}
        r={nodeSize}
        fill="#131A22"
        stroke={isOnline ? color : '#1F2A35'}
        strokeWidth={isOnline ? (isMe ? 2.5 : 1.5) : 1}
        whileHover={{ r: nodeSize + 4, strokeWidth: 2 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      />

      {/* Subtle glow for online devices */}
      {isOnline && !isMe && (
        <circle
          cx={x}
          cy={y}
          r={nodeSize + 6}
          fill="none"
          stroke={color}
          strokeWidth="0.5"
          opacity={0.2}
        />
      )}

      {/* Icon */}
      <foreignObject
        x={x - 12}
        y={y - 14}
        width={24}
        height={24}
      >
        <div className="flex items-center justify-center w-full h-full">
          <IconComponent
            className="w-5 h-5"
            style={{ color }}
          />
        </div>
      </foreignObject>

      {/* Status dot */}
      <circle
        cx={x + nodeSize - 6}
        cy={y - nodeSize + 6}
        r={4}
        fill={isOnline ? (isMe ? '#FB923C' : '#34D399') : '#64748B'}
      />
      {isOnline && (
        <circle
          cx={x + nodeSize - 6}
          cy={y - nodeSize + 6}
          r={4}
          fill={isMe ? '#FB923C' : '#34D399'}
          opacity={0.4}
        >
          <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Closeness Rank Badge */}
      {closenessRank != null && (
        <foreignObject
          x={x - nodeSize - 4}
          y={y - nodeSize - 8}
          width={36}
          height={24}
        >
          <div
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-sm ${
              closenessRank === 1
                ? 'bg-ns-cyan/20 border border-ns-cyan text-ns-cyan'
                : closenessRank === 2
                ? 'bg-blue-500/20 border border-blue-400 text-blue-300'
                : closenessRank === 3
                ? 'bg-purple-500/20 border border-purple-400 text-purple-300'
                : 'bg-ns-card border border-ns-border text-ns-text-secondary'
            }`}
            title={`Closeness Rank #${closenessRank} (${device.pingMs}ms)`}
          >
            {closenessRank === 1 ? <LucideIcons.Zap className="w-2.5 h-2.5 text-ns-cyan" /> : null}
            <span>#{closenessRank}</span>
          </div>
        </foreignObject>
      )}

      {/* Name label */}
      <text
        x={x}
        y={y + nodeSize + 14}
        textAnchor="middle"
        className="fill-ns-text"
        style={{ fontSize: '10px', fontFamily: 'Inter', fontWeight: 500 }}
      >
        {truncatedName} {isMe ? '(You)' : ''}
      </text>

      {/* IP label */}
      <text
        x={x}
        y={y + nodeSize + 26}
        textAnchor="middle"
        className="fill-ns-text-secondary"
        style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace' }}
      >
        {device.ip}
      </text>
    </motion.g>
  );
}
