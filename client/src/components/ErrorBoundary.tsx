import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorLogger } from '../utils/errorLogger';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches React errors and displays fallback UI
 * Also logs errors to our centralized error logger
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to our error logger
    errorLogger.log(error, 'unknown', {
      componentStack: errorInfo.componentStack,
      reactErrorBoundary: true,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({ errorInfo });

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.reload();
  };

  handleReportError = () => {
    const { error, errorInfo } = this.state;
    const logs = errorLogger.exportLogs();

    // Create a text file with error details
    const errorReport = `
Meal Planner Error Report
=========================

Error: ${error?.message}
Stack: ${error?.stack}

Component Stack:
${errorInfo?.componentStack}

All Error Logs:
${logs}

Environment:
- User Agent: ${navigator.userAgent}
- URL: ${window.location.href}
- Timestamp: ${new Date().toISOString()}
    `.trim();

    // Download error report
    const blob = new Blob([errorReport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meal-planner-error-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-600 mb-6">
                We're sorry, but something unexpected happened. The error has been logged.
              </p>

              {process.env.NODE_ENV !== 'production' && this.state.error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-left">
                  <p className="font-mono text-sm text-red-800 mb-2">
                    {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <details className="text-xs text-red-600">
                      <summary className="cursor-pointer font-semibold">
                        Stack trace
                      </summary>
                      <pre className="mt-2 overflow-auto">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <Button
                  onClick={this.handleReset}
                  className="w-full"
                  size="lg"
                >
                  Reload Page
                </Button>

                <Button
                  onClick={this.handleReportError}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Download Error Report
                </Button>

                <Button
                  onClick={() => window.location.href = '/'}
                  variant="ghost"
                  className="w-full"
                >
                  Go to Home
                </Button>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Error ID: {Date.now()}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date().toISOString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
