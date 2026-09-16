import { motion } from 'framer-motion';
import { Wifi } from 'lucide-react';

export default function LoadingState() {
  return (
    <div className="h-full w-full bg-ns-bg flex flex-col items-center justify-center">
      {/* Animated rings */}
      <div className="relative w-48 h-48 mb-8">
        {[80, 60, 40].map((size, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 m-auto rounded-full border border-ns-accent/20"
            style={{ width: size + '%', height: size + '%' }}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.3, 0.1, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Center icon */}
        <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-ns-card border border-ns-border
                        flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            <Wifi className="w-7 h-7 text-ns-accent" />
          </motion.div>
        </div>
      </div>

      <motion.h2
        className="text-xl font-semibold text-ns-text mb-2"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Scanning your network…
      </motion.h2>
      <p className="text-sm text-ns-text-secondary max-w-xs text-center">
        Discovering devices on your local network. This may take a moment on the first run.
      </p>
    </div>
  );
}
