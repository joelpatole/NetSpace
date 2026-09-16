import { motion } from 'framer-motion';
import { useId } from 'react';

export default function ConnectionLine({ x1, y1, x2, y2, online, dimmed }) {
  const id = useId();
  const color = online ? '#3B82F6' : '#1F2A35';
  const opacity = dimmed ? 0.08 : online ? 0.5 : 0.15;

  // Calculate the line path for the traveling pulse
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Main line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={online ? 1.2 : 0.5}
        opacity={opacity}
        strokeLinecap="round"
      />

      {/* Traveling pulse (only for online devices) */}
      {online && !dimmed && (
        <>
          <path
            id={`path-${id}`}
            d={`M ${x1} ${y1} L ${x2} ${y2}`}
            fill="none"
            stroke="none"
          />
          <circle r="2" fill="#3B82F6" opacity="0.8">
            <animateMotion
              dur={`${2 + Math.random() * 2}s`}
              repeatCount="indefinite"
              path={`M ${x1} ${y1} L ${x2} ${y2}`}
            >
            </animateMotion>
            <animate
              attributeName="opacity"
              values="0;0.8;0.8;0"
              dur={`${2 + Math.random() * 2}s`}
              repeatCount="indefinite"
            />
          </circle>
        </>
      )}
    </motion.g>
  );
}
