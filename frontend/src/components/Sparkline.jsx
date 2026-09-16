/**
 * Compact latency sparkline. Gaps (offline samples, or samples with no ping
 * reading) break the line rather than being drawn as zero.
 */
export default function Sparkline({ samples, width = 240, height = 40, color = '#22D3EE' }) {
  const points = samples
    .map((s, i) => ({ i, value: s.o === 1 && typeof s.p === 'number' ? s.p : null }))
    .filter(p => p.value !== null);

  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[10px] text-ns-text-secondary/60
                   border border-dashed border-ns-border rounded-lg"
        style={{ height }}
      >
        Not enough latency data yet
      </div>
    );
  }

  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;

  const x = (i) => (samples.length <= 1 ? 0 : (i / (samples.length - 1)) * width);
  const y = (v) => height - pad - ((v - min) / span) * (height - pad * 2);

  // Build a path that lifts the pen across gaps in the data.
  let d = '';
  let penDown = false;
  for (const p of points) {
    const cmd = penDown ? 'L' : 'M';
    d += `${cmd} ${x(p.i).toFixed(1)} ${y(p.value).toFixed(1)} `;
    penDown = true;
  }

  const last = points[points.length - 1];

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L ${x(last.i).toFixed(1)} ${height} L ${x(points[0].i).toFixed(1)} ${height} Z`}
        fill="url(#sparkFill)"
      />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.value)} r="2.5" fill={color} />
    </svg>
  );
}
