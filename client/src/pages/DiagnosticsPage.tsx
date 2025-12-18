import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Download, Trash2, AlertCircle, TrendingUp, Clock, Bug, Copy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { supabase } from '../lib/supabase';
import { errorLogger } from '../utils/errorLogger';

interface ErrorLog {
  id: number;
  created_at: string;
  error_type: string;
  error_message: string;
  stack_trace?: string;
  component?: string;
  url?: string;
  user_id?: string;
  user_agent?: string;
  metadata?: any;
  resolved: boolean;
  resolved_at?: string;
}

interface ErrorStats {
  total: number;
  unresolved: number;
  recent_24h: number;
  by_type: Array<{ error_type: string; count: number }>;
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

      // Find duplicate meals by name
      const { data: meals, error } = await supabase
        .from('meals')
        .select('id, name, created_at')
        .order('name')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by name and find duplicates
      const nameGroups: { [key: string]: typeof meals } = {};
      meals?.forEach(meal => {
        if (!nameGroups[meal.name]) {
          nameGroups[meal.name] = [];
        }
        nameGroups[meal.name].push(meal);
      });

      // Collect IDs to delete (keep the oldest one)
      const idsToDelete: number[] = [];
      Object.values(nameGroups).forEach(group => {
        if (group.length > 1) {
          // Keep the first (oldest), delete the rest
          group.slice(1).forEach(meal => idsToDelete.push(meal.id));
        }
      });

      if (idsToDelete.length === 0) {
        setCleanupResult('No duplicate meals found!');
        return;
      }

      // Delete duplicates
      const { error: deleteError } = await supabase
        .from('meals')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) throw deleteError;

      setCleanupResult(`Success! Deleted ${idsToDelete.length} duplicate meals.`);
    } catch (error: any) {
      console.error('Cleanup error:', error);
      setCleanupResult(`Failed: ${error.message}`);
    }
  };

  const fetchErrors = async () => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }

      let query = supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!filterResolved) {
        query = query.eq('resolved', false);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch errors:', error);
        // Table might not exist yet
        if (error.message.includes('does not exist')) {
          setErrors([]);
        }
        return;
      }

      setErrors(data || []);
      console.log(`[Diagnostics] Refreshed: Loaded ${data?.length || 0} errors`);
    } catch (error: any) {
      console.error('Failed to fetch errors:', error);
      errorLogger.logApiError(error, '/error_logs', 'GET');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Get total count
      const { count: total } = await supabase
        .from('error_logs')
        .select('*', { count: 'exact', head: true });

      // Get unresolved count
      const { count: unresolved } = await supabase
        .from('error_logs')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', false);

      // Get recent 24h count
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const { count: recent_24h } = await supabase
        .from('error_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString());

      // Get by type (simplified - just count unresolved)
      const { data: typeData } = await supabase
        .from('error_logs')
        .select('error_type')
        .eq('resolved', false);

      const typeCounts: { [key: string]: number } = {};
      typeData?.forEach(row => {
        typeCounts[row.error_type] = (typeCounts[row.error_type] || 0) + 1;
      });

      setStats({
        total: total || 0,
        unresolved: unresolved || 0,
        recent_24h: recent_24h || 0,
        by_type: Object.entries(typeCounts).map(([error_type, count]) => ({ error_type, count })),
      });
    } catch (error: any) {
      console.error('Failed to fetch error stats:', error);
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
      const { error } = await supabase
        .from('error_logs')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', selectedError.id);

      if (error) throw error;

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
      // Generate markdown report from current errors
      const report = generateErrorReport(errors);

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
      alert(`Error: ${error.message || 'Failed to export errors'}`);
    }
  };

  const generateErrorReport = (errors: ErrorLog[]): string => {
    let report = `# Error Report\n\nGenerated: ${new Date().toISOString()}\n\n`;
    report += `## Summary\n- Total errors: ${errors.length}\n- Unresolved: ${errors.filter(e => !e.resolved).length}\n\n`;
    report += `## Errors\n\n`;

    errors.slice(0, 20).forEach((error, i) => {
      report += `### Error ${i + 1}: ${error.error_type}\n`;
      report += `- **Message:** ${error.error_message}\n`;
      report += `- **Component:** ${error.component || 'Unknown'}\n`;
      report += `- **URL:** ${error.url || 'Unknown'}\n`;
      report += `- **Time:** ${error.created_at}\n`;
      if (error.stack_trace) {
        report += `\n\`\`\`\n${error.stack_trace.substring(0, 500)}\n\`\`\`\n`;
      }
      report += '\n';
    });

    return report;
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
            onClick={handleRefresh}
            disabled={loading}
            className="h-10 min-h-[40px]"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadLocalLogs}
            className="h-10 min-h-[40px]"
          >
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Download Local</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={clearLocalLogs}
            className="h-10 min-h-[40px]"
          >
            <Trash2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Clear Local</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Total Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Unresolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-red-600">{stats?.unresolved || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{stats?.recent_24h || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Local Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{localStats.total}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="server" className="space-y-4">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
          <TabsTrigger value="server">Server Errors</TabsTrigger>
          <TabsTrigger value="local">Local Logs</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="server" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={filterResolved ? 'outline' : 'default'}
                size="sm"
                onClick={() => setFilterResolved(false)}
              >
                Unresolved
              </Button>
              <Button
                variant={filterResolved ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterResolved(true)}
              >
                All
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Showing {errors.length} errors
            </div>
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Loading errors...</p>
              </CardContent>
            </Card>
          ) : errors.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                <p className="mt-2 text-lg font-medium">No errors found!</p>
                <p className="text-muted-foreground">Your application is running smoothly.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {errors.map((error) => (
                <Card
                  key={error.id}
                  className={`cursor-pointer transition-colors hover:bg-accent ${
                    error.resolved ? 'opacity-60' : ''
                  }`}
                  onClick={() => {
                    setSelectedError(error);
                    setResolveDialogOpen(true);
                  }}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={getErrorTypeColor(error.error_type)}>
                          {error.error_type}
                        </Badge>
                        {error.resolved && (
                          <Badge variant="outline" className="bg-green-50">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolved
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(error.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-medium line-clamp-2">{error.error_message}</p>
                    {error.component && (
                      <p className="text-xs text-muted-foreground mt-1">Component: {error.component}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="local" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Local Error Logs</CardTitle>
              <CardDescription>
                Errors captured in the browser before being sent to the server
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Total:</strong> {localStats.total}
                </p>
                <p className="text-sm">
                  <strong>Last 24 Hours:</strong> {localStats.last24h}
                </p>
                <p className="text-sm">
                  <strong>Last Hour:</strong> {localStats.lastHour}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Cleanup</CardTitle>
              <CardDescription>
                Remove duplicate meals from the database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={cleanupDuplicates}>
                <Trash2 className="h-4 w-4 mr-2" />
                Cleanup Duplicate Meals
              </Button>
              {cleanupResult && (
                <pre className="p-4 bg-muted rounded-lg text-sm overflow-auto whitespace-pre-wrap">
                  {cleanupResult}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Error Details</DialogTitle>
            <DialogDescription>
              View error details and mark as resolved
            </DialogDescription>
          </DialogHeader>
          {selectedError && (
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <Badge className={getErrorTypeColor(selectedError.error_type)}>
                  {selectedError.error_type}
                </Badge>
              </div>
              <div>
                <Label>Message</Label>
                <p className="text-sm mt-1">{selectedError.error_message}</p>
              </div>
              {selectedError.component && (
                <div>
                  <Label>Component</Label>
                  <p className="text-sm mt-1">{selectedError.component}</p>
                </div>
              )}
              {selectedError.url && (
                <div>
                  <Label>URL</Label>
                  <p className="text-sm mt-1 break-all">{selectedError.url}</p>
                </div>
              )}
              {selectedError.stack_trace && (
                <div>
                  <Label>Stack Trace</Label>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-48">
                    {selectedError.stack_trace}
                  </pre>
                </div>
              )}
              <div>
                <Label>Timestamp</Label>
                <p className="text-sm mt-1">
                  {new Date(selectedError.created_at).toLocaleString()}
                </p>
              </div>
              {!selectedError.resolved && (
                <div>
                  <Label htmlFor="resolve-notes">Resolution Notes (optional)</Label>
                  <Textarea
                    id="resolve-notes"
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    placeholder="Describe how this error was resolved..."
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Close
            </Button>
            {selectedError && !selectedError.resolved && (
              <Button onClick={handleResolveError}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Resolved
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiagnosticsPage;
