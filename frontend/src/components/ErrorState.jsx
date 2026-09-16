import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorState({ message, onRetry }) {
  // OS-specific hints
  let hint = '';
  if (message.includes('permission') || message.includes('EPERM') || message.includes('EACCES')) {
    hint = 'Try running the backend with elevated privileges (sudo on macOS/Linux, Administrator on Windows).';
  } else if (message.includes('rate limit') || message.includes('429')) {
    hint = 'Please wait a few seconds before scanning again.';
  }

  return (
    <div className="mx-4 my-2 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg flex items-start gap-3"
         id="error-banner">
      <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-yellow-200">{message}</p>
        {hint && <p className="text-xs text-yellow-300/70 mt-1">{hint}</p>}
      </div>
      <button
        onClick={onRetry}
        className="flex-shrink-0 px-3 py-1 text-xs font-medium text-yellow-200 bg-yellow-800/30
                   border border-yellow-700/30 rounded-lg hover:bg-yellow-800/50 transition-colors"
      >
        <RefreshCw className="w-3 h-3 inline mr-1" />
        Retry
      </button>
    </div>
  );
}
