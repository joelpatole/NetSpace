/**
 * 24-hour availability strip. Each sample becomes one segment: green when the
 * device answered, slate when it did not.
 */
export default function UptimeTimeline({ samples, windowHours = 24 }) {
  if (!samples.length) {
    return (
      <div className="h-6 rounded-md border border-dashed border-ns-border flex items-center
                      justify-center text-[10px] text-ns-text-secondary/60">
        Collecting availability history…
      </div>
    );
  }

  const oldest = samples[0].t;
  const newest = samples[samples.length - 1].t;

  return (
    <div>
      <div className="flex gap-[1px] h-6 rounded-md overflow-hidden bg-ns-bg border border-ns-border">
        {samples.map((s) => (
          <div
            key={s.t}
            className={`flex-1 min-w-[2px] ${s.o === 1 ? 'bg-ns-online/70' : 'bg-ns-offline/40'}`}
            title={`${new Date(s.t).toLocaleString()} — ${s.o === 1 ? 'online' : 'offline'}${
              s.o === 1 && typeof s.p === 'number' ? ` (${s.p} ms)` : ''
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-ns-text-secondary/70 mt-1">
        <span>{new Date(oldest).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span>last {windowHours}h</span>
        <span>{new Date(newest).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}
