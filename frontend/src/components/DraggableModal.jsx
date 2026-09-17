import { motion, useDragControls } from 'framer-motion';
import { GripHorizontal, X } from 'lucide-react';

export default function DraggableModal({
  id,
  onClose,
  title,
  icon: Icon,
  headerExtra,
  maxWidth = 'max-w-md',
  maxHeight = 'max-h-[88vh]',
  children,
  className = '',
}) {
  const dragControls = useDragControls();

  const handlePointerDown = (e) => {
    // Prevent drag if interacting with buttons, inputs, links, or controls
    if (e.target.closest('button, input, select, textarea, a, [role="button"]')) {
      return;
    }
    dragControls.start(e);
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Screen container for centered positioning and free viewport dragging */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pointer-events-none">
        <motion.div
          id={id}
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          dragElastic={0}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`pointer-events-auto w-full ${maxWidth} ${maxHeight} bg-ns-card border border-ns-border rounded-2xl shadow-2xl flex flex-col overflow-hidden ${className}`}
        >
          {/* Header - Drag Handle with Touch and Pointer Support */}
          <div
            onPointerDown={handlePointerDown}
            className="flex flex-col p-4 sm:p-5 pb-3 border-b border-ns-border flex-shrink-0 cursor-grab active:cursor-grabbing select-none touch-none bg-ns-card transition-colors"
            title="Drag to move modal"
          >
            {/* Mobile / Touch Drag Pill Indicator */}
            <div className="w-10 h-1 bg-ns-border/80 hover:bg-ns-text-secondary/50 rounded-full mx-auto -mt-1 mb-2.5 transition-colors" />

            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ns-text flex items-center gap-2 truncate">
                {Icon && <Icon className="w-5 h-5 text-ns-cyan flex-shrink-0" />}
                <span className="truncate">{title}</span>
                <span
                  className="inline-flex items-center text-ns-text-secondary/40 hover:text-ns-text-secondary/70 transition-colors ml-0.5"
                  title="Drag to move modal"
                >
                  <GripHorizontal className="w-4 h-4 flex-shrink-0" />
                </span>
              </h2>

              <div className="flex items-center gap-2 flex-shrink-0">
                {headerExtra}
                <button
                  onClick={onClose}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-lg hover:bg-ns-surface text-ns-text-secondary hover:text-ns-text transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Modal Content */}
          {children}
        </motion.div>
      </div>
    </>
  );
}
