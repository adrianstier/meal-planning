/**
 * Centralized error logging and tracking utility
 * Provides detailed error information for debugging in development and production
 */

// Types for error context and responses
type ErrorContext = Record<string, unknown>;

interface ApiErrorResponse {
  response?: {
    status?: number;
    statusText?: string;
    data?: unknown;
  };
}

export interface ErrorLog {
  timestamp: string;
  type: 'api' | 'parse' | 'auth' | 'network' | 'validation' | 'unknown';
  message: string;
  stack?: string;
  context?: ErrorContext;
  userAgent?: string;
  url?: string;
  env: 'development' | 'production';
}

class ErrorLogger {
  private logs: ErrorLog[] = [];
  private maxLogs = 20; // Reduced from 100 for privacy
  private readonly STORAGE_KEY = 'meal_planner_error_logs';
  // In-memory buffer for errors that couldn't be saved to localStorage
  private fallbackBuffer: ErrorLog[] = [];
  private readonly maxFallbackBuffer = 10;

  constructor() {
    // Load existing logs from localStorage
    this.loadLogs();
  }

  /**
   * Log an error with context
   */
  log(
    error: Error | string,
    type: ErrorLog['type'] = 'unknown',
    context?: ErrorContext
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      type,
      message: errorMessage,
      stack: errorStack,
      context: {
        ...context,
        // Add useful debugging info
        currentPath: window.location.pathname,
        searchParams: window.location.search,
      },
      userAgent: navigator.userAgent,
      url: window.location.href,
      env: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    };

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.group(`[Error] ${type}`);
      console.error('Message:', errorMessage);
      if (errorStack) console.error('Stack:', errorStack);
      if (context) console.error('Context:', context);
      console.groupEnd();
    }

    // Add to logs array
    this.logs.push(errorLog);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Persist to localStorage
    this.saveLogs();

    // Send to backend for persistent storage (async, don't block)
    this.sendToBackend(errorLog);
  }

  /**
   * Send error log to backend API
   * Currently disabled as we're using Supabase directly
   */
  private async sendToBackend(_errorLog: ErrorLog): Promise<void> {
    // Backend error logging disabled - using client-side only
    // Future: could log to Supabase error_logs table if needed
    return;
  }

  /**
   * Log API-specific errors with detailed context
   */
  logApiError(
    error: Error | ApiErrorResponse | string,
    endpoint: string,
    method: string = 'GET',
    requestData?: unknown
  ): void {
    const apiError = error as ApiErrorResponse;
    const context: ErrorContext = {
      endpoint,
      method,
      requestData,
      status: apiError.response?.status,
      statusText: apiError.response?.statusText,
      responseData: apiError.response?.data,
      apiBaseUrl: process.env.REACT_APP_API_URL || 'not set',
    };

    this.log(error instanceof Error ? error : String(error), 'api', context);
  }

  /**
   * Log parsing errors (recipe, school menu, etc.)
   */
  logParseError(
    error: Error | string,
    parseType: 'recipe' | 'school-menu' | 'url',
    input: string
  ): void {
    const context = {
      parseType,
      inputLength: input.length,
      inputPreview: input.substring(0, 200),
      isUrl: input.trim().startsWith('http'),
    };

    this.log(error, 'parse', context);
  }

  /**
   * Log authentication errors
   */
  logAuthError(error: Error | string, action: 'login' | 'logout' | 'session'): void {
    const context = {
      action,
      withCredentials: true, // We use withCredentials for session cookies
    };

    this.log(error, 'auth', context);
  }

  /**
   * Log network errors
   */
  logNetworkError(error: Error | string, context?: ErrorContext): void {
    // Network Information API types
    interface NetworkInformation {
      effectiveType?: string;
    }
    interface NavigatorWithConnection extends Navigator {
      connection?: NetworkInformation;
    }

    this.log(error, 'network', {
      ...context,
      online: navigator.onLine,
      connectionType: (navigator as NavigatorWithConnection).connection?.effectiveType,
    });
  }

  /**
   * Log validation errors
   */
  logValidationError(
    field: string,
    value: unknown,
    constraint: string,
    message?: string
  ): void {
    this.log(
      new Error(message || `Validation failed for ${field}`),
      'validation',
      {
        field,
        value: typeof value === 'string' ? value : JSON.stringify(value),
        constraint,
      }
    );
  }

  /**
   * Get all error logs
   */
  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  /**
   * Get recent errors (last N)
   */
  getRecentLogs(count: number = 10): ErrorLog[] {
    return this.logs.slice(-count);
  }

  /**
   * Get errors by type
   */
  getLogsByType(type: ErrorLog['type']): ErrorLog[] {
    return this.logs.filter((log) => log.type === type);
  }

  /**
   * Get error statistics
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      byType: {} as Record<string, number>,
      last24h: 0,
      lastHour: 0,
    };

    const now = new Date().getTime();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    this.logs.forEach((log) => {
      // Count by type
      stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;

      // Count recent errors
      const logTime = new Date(log.timestamp).getTime();
      if (now - logTime < hour) stats.lastHour++;
      if (now - logTime < day) stats.last24h++;
    });

    return stats;
  }

  /**
   * Export logs as JSON for debugging
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.saveLogs();
  }

  /**
   * Save logs to localStorage with sanitization
   */
  private saveLogs(): void {
    try {
      // Sanitize logs before storing - remove PII and sensitive data
      const sanitizedLogs = this.logs.map(log => ({
        timestamp: log.timestamp,
        type: log.type,
        message: log.message,
        env: log.env,
        // Only include component info from context, not full details
        context: log.context?.component ? { component: log.context.component } : undefined,
        // Exclude: userAgent, url, stack, full context with potential PII
      }));

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sanitizedLogs));
    } catch (error) {
      // Fallback: Log to console and store in memory buffer
      console.warn('[ErrorLogger] Failed to save logs to localStorage:', error);

      // Keep the most recent log in an in-memory fallback buffer
      const lastLog = this.logs[this.logs.length - 1];
      if (lastLog) {
        this.fallbackBuffer.push(lastLog);
        // Keep fallback buffer size limited
        if (this.fallbackBuffer.length > this.maxFallbackBuffer) {
          this.fallbackBuffer = this.fallbackBuffer.slice(-this.maxFallbackBuffer);
        }
      }

      // Log to console to ensure error is never lost
      if (process.env.NODE_ENV === 'production') {
        console.error('[ErrorLogger] Error not persisted:', lastLog?.message);
      }
    }
  }

  /**
   * Get errors from fallback buffer (errors that couldn't be saved to localStorage)
   */
  getFallbackBuffer(): ErrorLog[] {
    return [...this.fallbackBuffer];
  }

  /**
   * Check if there are unsaved errors in the fallback buffer
   */
  hasUnsavedErrors(): boolean {
    return this.fallbackBuffer.length > 0;
  }

  /**
   * Load logs from localStorage
   */
  private loadLogs(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load error logs from localStorage:', error);
      this.logs = [];
    }
  }

  /**
   * Create a formatted error message for user display
   */
  formatUserMessage(error: Error | string | unknown, friendlyMessage?: string): string {
    const isDev = process.env.NODE_ENV !== 'production';
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (friendlyMessage) {
      return isDev ? `${friendlyMessage}\n\nDebug: ${errorMsg}` : friendlyMessage;
    }

    // Default friendly messages by error type
    if (errorMsg.includes('Network Error') || errorMsg.includes('Failed to fetch')) {
      return isDev
        ? `Network error - please check your connection.\n\nDebug: ${errorMsg}`
        : 'Network error - please check your connection.';
    }

    if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
      return isDev
        ? `Authentication failed - please log in again.\n\nDebug: ${errorMsg}`
        : 'Authentication failed - please log in again.';
    }

    if (errorMsg.includes('timeout')) {
      return isDev
        ? `Request timed out - please try again.\n\nDebug: ${errorMsg}`
        : 'Request timed out - please try again.';
    }

    // In development, show full error. In production, show generic message
    return isDev ? `Error: ${errorMsg}` : 'An error occurred. Please try again.';
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();

// Export utility function for easy use
export const logError = (
  error: Error | string,
  type?: ErrorLog['type'],
  context?: ErrorContext
) => errorLogger.log(error, type, context);

export default errorLogger;
