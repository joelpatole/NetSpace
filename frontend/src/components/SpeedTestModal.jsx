import { useState } from 'react';
import { Activity, Download, Upload, Zap } from 'lucide-react';
import { runSpeedTest } from '../utils/api.js';
import DraggableModal from './DraggableModal.jsx';

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
    <DraggableModal
      id="speed-test-modal"
      title="Internet Speed"
      icon={Activity}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
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
    </DraggableModal>
  );
}
