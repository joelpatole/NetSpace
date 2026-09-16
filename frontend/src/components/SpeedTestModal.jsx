import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Activity, Download, Upload, Zap } from 'lucide-react';
import { runSpeedTest } from '../utils/api.js';

export default function SpeedTestModal({ onClose }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleStart = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const data = await runSpeedTest();
      setResult(data);
    } catch (err) {
      setError(err.message || 'Speed test failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                   w-full max-w-sm bg-ns-card border border-ns-border rounded-2xl
                   shadow-2xl z-50 flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-ns-border">
          <h2 className="text-lg font-semibold text-ns-text flex items-center gap-2">
            <Activity className="w-5 h-5 text-ns-cyan" />
            Internet Speed
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ns-surface transition-colors">
            <X className="w-5 h-5 text-ns-text-secondary" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          {error && <div className="text-red-500 text-sm mb-4 text-center">{error}</div>}

          {result ? (
            <div className="w-full grid grid-cols-2 gap-4 mb-6 text-center">
              <div className="bg-ns-bg border border-ns-border rounded-xl p-4">
                <Download className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-ns-text">{result.download.toFixed(1)}</div>
                <div className="text-xs text-ns-text-secondary">Mbps</div>
              </div>
              <div className="bg-ns-bg border border-ns-border rounded-xl p-4">
                <Upload className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-ns-text">{result.upload.toFixed(1)}</div>
                <div className="text-xs text-ns-text-secondary">Mbps</div>
              </div>
              <div className="col-span-2 bg-ns-bg border border-ns-border rounded-xl p-4">
                <Zap className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
                <div className="text-xl font-bold text-ns-text">{result.ping.toFixed(0)} <span className="text-sm font-normal text-ns-text-secondary">ms ping</span></div>
              </div>
            </div>
          ) : (
             <div className="h-32 flex flex-col items-center justify-center text-center text-ns-text-secondary mb-4">
                {running ? (
                   <div className="flex flex-col items-center gap-3">
                     <span className="w-8 h-8 rounded-full border-2 border-ns-accent border-t-transparent animate-spin"/>
                     <p className="text-sm">Testing your internet speed...</p>
                     <p className="text-xs opacity-75">This will take about 15 seconds.</p>
                   </div>
                ) : (
                   <p className="text-sm">Run a speed test to measure your network's download and upload performance.</p>
                )}
             </div>
          )}

          <button
            onClick={handleStart}
            disabled={running}
            className="w-full py-2.5 rounded-lg font-medium bg-gradient-to-r from-ns-accent to-blue-600 text-white
                       hover:from-blue-500 hover:to-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-ns-accent/20"
          >
            {running ? 'Testing...' : result ? 'Test Again' : 'Start Speed Test'}
          </button>
        </div>
      </motion.div>
    </>
  );
}
