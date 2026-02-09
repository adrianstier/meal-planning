import React, { useState, useEffect } from 'react';
import { Bug } from 'lucide-react';
import { errorLogger, ErrorLog } from '../utils/errorLogger';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

/**
 * Stats interface matching the return type of errorLogger.getStats()
 */
interface ErrorLogStats {
  total: number;
  byType: Record<string, number>;
  last24h: number;
  lastHour: number;
}

/**
 * Error Log Viewer Component
 * Displays collected error logs for debugging
 * Access via keyboard shortcut: Ctrl+Shift+E (or Cmd+Shift+E on Mac)
 */
const ErrorLogViewer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [stats, setStats] = useState<ErrorLogStats | null>(null);

  // Load logs when dialog opens
  useEffect(() => {
    if (isOpen) {
      setLogs(errorLogger.getLogs());
      setStats(errorLogger.getStats());
    }
  }, [isOpen]);

  // Keyboard shortcut to open viewer: Ctrl+Shift+E
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter((log) => log.type === filter);

  const handleExport = () => {
    const json = errorLogger.exportLogs();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-logs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all error logs?')) {
      errorLogger.clearLogs();
      setLogs([]);
      setStats(errorLogger.getStats());
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'api': return 'text-blue-600 bg-blue-50';
      case 'parse': return 'text-purple-600 bg-purple-50';
      case 'auth': return 'text-yellow-600 bg-yellow-50';
      case 'network': return 'text-red-600 bg-red-50';
      case 'validation': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <>
      {/* Hidden button for manual opening (can be added to dev menu) */}
      {process.env.NODE_ENV !== 'production' && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 z-50"
          title="Open Error Logs (Ctrl+Shift+E)"
        >
          <Bug className="h-4 w-4" />
        </button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Error Logs & Debugging</DialogTitle>
          </DialogHeader>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded">
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-gray-600">Total Errors</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.lastHour}</div>
                <div className="text-xs text-gray-600">Last Hour</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{stats.last24h}</div>
                <div className="text-xs text-gray-600">Last 24h</div>
              </div>
              <div>
                <div className="text-sm font-mono text-gray-800">
                  {Object.entries(stats.byType).map(([type, count]) => (
                    <div key={type}>{type}: {count as number}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-2 items-center p-2 border-b">
            <span className="text-sm font-semibold mr-2">Filter:</span>
            {['all', 'api', 'parse', 'auth', 'network', 'validation', 'unknown'].map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  filter === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 p-2 border-b">
            <Button onClick={handleExport} size="sm" variant="outline">
              Export JSON
            </Button>
            <Button onClick={handleClear} size="sm" variant="destructive">
              Clear Logs
            </Button>
            <div className="ml-auto text-xs text-gray-500">
              {filteredLogs.length} of {logs.length} logs shown
            </div>
          </div>

          {/* Error List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {filter === 'all' ? 'No errors logged' : `No ${filter} errors`}
              </div>
            ) : (
              [...filteredLogs].reverse().map((log, index) => (
                <div key={index} className="border rounded p-3 bg-white hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(log.type)}`}>
                        {log.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        log.env === 'production' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {log.env}
                      </span>
                    </div>
                  </div>

                  <div className="font-mono text-sm text-red-600 mb-2">
                    {log.message}
                  </div>

                  {log.context && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-900 font-semibold">
                        Context Details
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded overflow-auto max-h-40">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    </details>
                  )}

                  {log.stack && (
                    <details className="text-xs mt-2">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-900 font-semibold">
                        Stack Trace
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded overflow-auto max-h-40 text-xs">
                        {log.stack}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t text-xs text-gray-500 text-center">
            Press Ctrl+Shift+E (Cmd+Shift+E on Mac) to open this viewer
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ErrorLogViewer;
