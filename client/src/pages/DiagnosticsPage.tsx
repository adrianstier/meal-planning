import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Download, Trash2, AlertCircle, TrendingUp, Clock, Bug, Sparkles, Copy, FileText } from 'lucide-react';
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
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const cleanupDuplicates = async () => {
    try {
      setCleanupResult('Running cleanup...');
      const response = await api.post('/api/admin/cleanup-duplicates');

      console.log('Cleanup response:', response);

      // Handle both unwrapped and wrapped responses
      const data = response.data?.data || response.data;

      console.log('Cleanup data:', data);

      if (data && typeof data === 'object' && 'deleted' in data) {
        if (data.deleted === 0) {
          setCleanupResult('No duplicate meals found!');
        } else {
          setCleanupResult(`Success! Deleted ${data.deleted} duplicate meals.\n\n${JSON.stringify(data.details, null, 2)}`);
        }
      } else {
        setCleanupResult(`Error: ${JSON.stringify(data) || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Cleanup error:', error);
      console.error('Error response:', error.response);
      setCleanupResult(`Failed: ${JSON.stringify(error.response?.data) || error.message}`);
    }
  };

  const setupErrorTable = async () => {
    try {
      const response = await api.post('/api/errors/setup-table');
      if (response.data.success) {
        alert('Error tracking table created! Refreshing page...');
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Failed to setup table:', error);
      alert(`Failed to setup table: ${error.response?.data?.error || error.message}`);
    }
  };

  const fetchErrors = async () => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }
      const response = await api.get<ErrorLog[]>(
        `/api/errors?limit=200&resolved=${filterResolved ? 'true' : 'false'}`
      );
      setErrors(response.data);
      console.log(`[Diagnostics] Refreshed: Loaded ${response.data.length} errors`);
    } catch (error: any) {
      console.error('Failed to fetch errors:', error);

      // Check if it's a "no such table" error
      if (error.response?.data?.error?.includes('no such table: error_logs')) {
        const setup = window.confirm(
          'Error tracking table not found. Would you like to create it now?'
        );
        if (setup) {
          await setupErrorTable();
        }
      } else {
        errorLogger.logApiError(error, '/api/errors', 'GET');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get<ErrorStats>('/api/errors/stats');
      setStats(response.data);
      console.log('[Diagnostics] Refreshed: Stats updated', response.data);
    } catch (error: any) {
      console.error('Failed to fetch error stats:', error);

      // Check if it's a "no such table" error
      if (error.response?.data?.error?.includes('no such table: error_logs')) {
        // Already handled in fetchErrors
        return;
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    console.log('[Diagnostics] Refreshing data...');
    await Promise.all([
      fetchErrors(),
      fetchStats()
    ]);
    console.log('[Diagnostics] Refresh complete');
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

  const exportForClaude = async () => {
    try {
      const response = await api.get('/api/errors/export-for-claude');

      // Backend returns data nested in response.data.data
      const report = response.data?.data?.markdown_report || response.data?.markdown_report;

      if (!report) {
        throw new Error('No report data received from server');
      }

      // Copy to clipboard
      await navigator.clipboard.writeText(report);
      alert('Error report copied to clipboard! Paste it in Claude Code to get instant debugging help.');

      // Also download as file
      const blob = new Blob([report], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error-report-${new Date().toISOString()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Failed to export errors:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to export errors';
      alert(`Error: ${errorMsg}`);
    }
  };

  const analyzeWithAI = async () => {
    if (errors.length === 0) {
      alert('No errors to analyze');
      return;
    }

    const errorIds = errors.slice(0, 10).map(e => e.id); // Analyze top 10
    const confirmed = window.confirm(`Analyze ${errorIds.length} most recent errors with Claude AI? This will use AI API credits.`);

    if (!confirmed) return;

    try {
      setLoading(true);
      const response = await api.post('/api/errors/analyze', { error_ids: errorIds });
      const analysis = response.data.analysis;

      // Show analysis in a dialog or download
      const blob = new Blob([analysis], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-analysis-${new Date().toISOString()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('AI analysis complete! Check your downloads folder.');
    } catch (error: any) {
      console.error('Failed to analyze errors:', error);
      alert(error.response?.data?.error || 'Failed to analyze errors');
    } finally {
      setLoading(false);
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
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Diagnostics & Error Tracking</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Monitor and debug application errors
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 sm:flex-wrap">
          <Button
            variant="default"
            size="sm"
            onClick={exportForClaude}
            disabled={errors.length === 0}
            className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 h-10 min-h-[40px]"
          >
            <Copy className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Copy for Claude</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={analyzeWithAI}
            disabled={errors.length === 0}
            className="h-10 min-h-[40px]"
          >
            <Sparkles className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">AI Analysis</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={cleanupDuplicates}
            className="h-10 min-h-[40px]"
          >
            <Trash2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Cleanup</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadLocalLogs}
            className="h-10 min-h-[40px]"
          >
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-10 min-h-[40px] col-span-2 sm:col-span-1"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Quick Actions Card */}
      {stats && stats.unresolved > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Get help debugging {stats.unresolved} unresolved error{stats.unresolved > 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={exportForClaude}>
                <FileText className="mr-2 h-4 w-4" />
                Export Report for Claude Code
              </Button>
              <Button size="sm" variant="outline" onClick={analyzeWithAI}>
                <Sparkles className="mr-2 h-4 w-4" />
                Get AI Analysis
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Tip: Click "Copy for Claude" to get a formatted error report you can paste directly into Claude Code for instant debugging help!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Cleanup Result Card */}
      {cleanupResult && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-blue-600" />
              Cleanup Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap font-mono bg-white p-4 rounded border">
              {cleanupResult}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
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
                {filterResolved ? 'No resolved errors' : 'No errors found!'}
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
