import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Download, Trash2, AlertCircle, TrendingUp, Clock, Bug } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import api from '../lib/api';
import { errorLogger } from '../utils/errorLogger';

interface ErrorLog {
  id: number;
  timestamp: string;
  error_type: string;
  message: string;
  stack_trace?: string;
  component?: string;
  url?: string;
  user_id?: number;
  browser_info?: any;
  metadata?: any;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  notes?: string;
}

interface ErrorStats {
  total: number;
  unresolved: number;
  recent_24h: number;
  by_type: Array<{ error_type: string; count: number }>;
  top_errors: Array<{ message: string; count: number }>;
}

const DiagnosticsPage: React.FC = () => {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [filterResolved, setFilterResolved] = useState(false);

  const fetchErrors = async () => {
    try {
      setLoading(true);
      const response = await api.get<ErrorLog[]>(
        `/api/errors?limit=200&resolved=${filterResolved ? 'true' : 'false'}`
      );
      setErrors(response.data);
    } catch (error) {
      console.error('Failed to fetch errors:', error);
      errorLogger.logApiError(error, '/api/errors', 'GET');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get<ErrorStats>('/api/errors/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch error stats:', error);
    }
  };

  useEffect(() => {
    fetchErrors();
    fetchStats();
  }, [filterResolved]);

  const handleResolveError = async () => {
    if (!selectedError) return;

    try {
      await api.put(`/api/errors/${selectedError.id}/resolve`, {
        notes: resolveNotes,
      });
      setResolveDialogOpen(false);
      setResolveNotes('');
      setSelectedError(null);
      fetchErrors();
      fetchStats();
    } catch (error) {
      console.error('Failed to resolve error:', error);
      alert('Failed to resolve error');
    }
  };

  const downloadLocalLogs = () => {
    const logs = errorLogger.exportLogs();
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearLocalLogs = () => {
    if (window.confirm('Are you sure you want to clear all local error logs?')) {
      errorLogger.clearLogs();
      alert('Local logs cleared');
    }
  };

  const getErrorTypeColor = (type: string) => {
    switch (type) {
      case 'api':
        return 'bg-red-100 text-red-800';
      case 'network':
        return 'bg-orange-100 text-orange-800';
      case 'parse':
        return 'bg-yellow-100 text-yellow-800';
      case 'auth':
        return 'bg-purple-100 text-purple-800';
      case 'validation':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const localStats = errorLogger.getStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Diagnostics & Error Tracking</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and debug application errors
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadLocalLogs}>
            <Download className="mr-2 h-4 w-4" />
            Export Logs
          </Button>
          <Button variant="outline" onClick={() => {
            fetchErrors();
            fetchStats();
          }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {localStats.total} in browser session
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unresolved</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.unresolved || 0}
            </div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24 Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.recent_24h || 0}</div>
            <p className="text-xs text-muted-foreground">
              {localStats.last24h} locally
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Hour</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{localStats.lastHour}</div>
            <p className="text-xs text-muted-foreground">Recent activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Error Types Breakdown */}
      {stats && stats.by_type.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Errors by Type</CardTitle>
            <CardDescription>Distribution of unresolved errors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.by_type.map((item) => (
                <div key={item.error_type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getErrorTypeColor(item.error_type)}>
                      {item.error_type}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Errors */}
      {stats && stats.top_errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Most Common Errors</CardTitle>
            <CardDescription>Top 5 recurring error messages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.top_errors.map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                  <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.count} occurrence{item.count > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Error Logs</CardTitle>
              <CardDescription>Recent errors from the database</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={filterResolved ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterResolved(!filterResolved)}
              >
                {filterResolved ? 'Show Unresolved' : 'Show Resolved'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading errors...</p>
            </div>
          ) : errors.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="text-muted-foreground">
                {filterResolved ? 'No resolved errors' : 'No errors found! 🎉'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {errors.map((error) => (
                <div
                  key={error.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedError(error);
                    setResolveDialogOpen(true);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getErrorTypeColor(error.error_type)}>
                          {error.error_type}
                        </Badge>
                        {error.resolved && (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolved
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(error.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium mb-1">{error.message}</p>
                      {error.component && (
                        <p className="text-xs text-muted-foreground">
                          Component: {error.component}
                        </p>
                      )}
                      {error.url && (
                        <p className="text-xs text-muted-foreground truncate">
                          URL: {error.url}
                        </p>
                      )}
                    </div>
                    {!error.resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedError(error);
                          setResolveDialogOpen(true);
                        }}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolve Error Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Error Details</DialogTitle>
            <DialogDescription>
              {selectedError?.resolved ? 'Resolved error' : 'Mark this error as resolved'}
            </DialogDescription>
          </DialogHeader>
          {selectedError && (
            <div className="space-y-4">
              <div>
                <Label>Error Type</Label>
                <Badge className={getErrorTypeColor(selectedError.error_type)}>
                  {selectedError.error_type}
                </Badge>
              </div>

              <div>
                <Label>Message</Label>
                <p className="text-sm mt-1">{selectedError.message}</p>
              </div>

              {selectedError.stack_trace && (
                <div>
                  <Label>Stack Trace</Label>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto mt-1">
                    {selectedError.stack_trace}
                  </pre>
                </div>
              )}

              {selectedError.browser_info && (
                <div>
                  <Label>Browser Info</Label>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto mt-1">
                    {JSON.stringify(selectedError.browser_info, null, 2)}
                  </pre>
                </div>
              )}

              {selectedError.metadata && (
                <div>
                  <Label>Metadata</Label>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto mt-1">
                    {JSON.stringify(selectedError.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {selectedError.resolved ? (
                <div>
                  <Label>Resolution Notes</Label>
                  <p className="text-sm mt-1">
                    {selectedError.notes || 'No notes provided'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Resolved by {selectedError.resolved_by} on{' '}
                    {selectedError.resolved_at && new Date(selectedError.resolved_at).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="resolve-notes">Resolution Notes (optional)</Label>
                  <Textarea
                    id="resolve-notes"
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    placeholder="Describe what was done to fix this error..."
                    rows={4}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedError?.resolved ? (
              <Button onClick={() => setResolveDialogOpen(false)}>Close</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleResolveError}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Resolved
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiagnosticsPage;
