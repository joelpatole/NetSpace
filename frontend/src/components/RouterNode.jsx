import { motion } from 'framer-motion';
import { Router } from 'lucide-react';

export default function RouterNode({ cx, cy, device, network, onClick }) {
  const label = device?.nickname || 'Router';
  const ip = network?.routerIp || device?.ip || '—';
  const capacity = network?.maxOverride || network?.estimatedCapacity || '—';
  const capacityLabel = network?.maxOverride ? 'rated' : 'est.';
  const count = network?.connectedCount || 0;

  return (
    <g
      className="cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {/* Animated outer glow rings */}
      <motion.circle
        cx={cx}
        cy={cy}
        r={55}
        fill="none"
        stroke="#3B82F6"
        strokeWidth="1"
        opacity={0.3}
        animate={{
          r: [55, 65, 55],
          opacity: [0.3, 0.12, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.circle
        cx={cx}
        cy={cy}
        r={65}
        fill="none"
        stroke="#22D3EE"
        strokeWidth="0.5"
        opacity={0.15}
        animate={{
          r: [65, 78, 65],
          opacity: [0.15, 0.05, 0.15],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.5,
        }}
      />

      {/* Main router circle */}
      <circle
        cx={cx}
        cy={cy}
        r={48}
        fill="url(#routerGradient)"
        stroke="#3B82F6"
        strokeWidth="2"
      />

      {/* Gradient definition */}
      <defs>
        <radialGradient id="routerGradient" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#1E3A5F" />
          <stop offset="100%" stopColor="#131A22" />
        </radialGradient>
      </defs>

      {/* Router icon (foreignObject for lucide) */}
      <foreignObject x={cx - 16} y={cy - 20} width={32} height={32}>
        <div className="flex items-center justify-center w-full h-full">
          <Router className="w-7 h-7 text-ns-accent" />
        </div>
      </foreignObject>

      {/* Status dot */}
      <circle cx={cx + 32} cy={cy - 32} r={5} fill="#34D399" />
      <circle cx={cx + 32} cy={cy - 32} r={5} fill="#34D399" opacity={0.5}>
        <animate attributeName="r" values="5;8;5" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Label */}
      <text
        x={cx}
        y={cy + 38}
        textAnchor="middle"
        className="fill-ns-text text-xs font-semibold"
        style={{ fontSize: '12px', fontFamily: 'Inter' }}
      >
        {label}
      </text>
      <text
        x={cx}
        y={cy + 52}
        textAnchor="middle"
        className="fill-ns-text-secondary"
        style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}
      >
        {ip}
      </text>
      <text
        x={cx}
        y={cy + 65}
        textAnchor="middle"
        className="fill-ns-cyan"
        style={{ fontSize: '10px', fontFamily: 'Inter' }}
      >
        {count} / {capacity} devices ({capacityLabel})
      </text>
    </g>
  );
}
