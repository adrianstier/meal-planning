import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DragDropProvider } from './contexts/DragDropContext';
import { BroadcastSyncProvider } from './contexts/BroadcastSyncContext';
import { UndoToastProvider } from './components/ui/undo-toast';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorLogViewer from './components/ErrorLogViewer';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import PlanPageEnhanced from './pages/PlanPageEnhanced';
import RecipesPage from './pages/RecipesPage';
import BentoPage from './pages/BentoPage';
import LeftoversPage from './pages/LeftoversPage';
import SchoolMenuPage from './pages/SchoolMenuPage';
import ListsPage from './pages/ListsPage';
import RestaurantsPage from './pages/RestaurantsPage';
import ProfilePage from './pages/ProfilePage';
import DiagnosticsPage from './pages/DiagnosticsPage';
import PricingPage from './pages/PricingPage';
import SeasonalCookingPage from './pages/SeasonalCookingPage';
import HolidayPlannerPage from './pages/HolidayPlannerPage';
import { errorLogger } from './utils/errorLogger';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Protected route wrapper component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, supabaseUser, loading } = useAuth();

  // Wait for initial auth check to complete before deciding on redirect
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check supabaseUser first (set immediately), then user (profile, loaded async)
  if (!supabaseUser && !user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout>
              <Navigate to="/plan" replace />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/plan" element={
          <ProtectedRoute>
            <Layout>
              <PlanPageEnhanced />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/recipes" element={
          <ProtectedRoute>
            <Layout>
              <RecipesPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/bento" element={
          <ProtectedRoute>
            <Layout>
              <BentoPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/seasonal" element={
          <ProtectedRoute>
            <Layout>
              <SeasonalCookingPage />
            </Layout>
          </ProtectedRoute>
        } />
        {/* Redirect old CSA route to new seasonal route */}
        <Route path="/csa" element={<Navigate to="/seasonal" replace />} />
        <Route path="/browse" element={<Navigate to="/recipes" replace />} />
        <Route path="/leftovers" element={
          <ProtectedRoute>
            <Layout>
              <LeftoversPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/school-menu" element={
          <ProtectedRoute>
            <Layout>
              <SchoolMenuPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/lists" element={
          <ProtectedRoute>
            <Layout>
              <ListsPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/restaurants" element={
          <ProtectedRoute>
            <Layout>
              <RestaurantsPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/pricing" element={
          <ProtectedRoute>
            <Layout>
              <PricingPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/diagnostics" element={
          <ProtectedRoute>
            <Layout>
              <DiagnosticsPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/holiday" element={
          <ProtectedRoute>
            <Layout>
              <HolidayPlannerPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="*" element={
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
              <p className="text-gray-600 mb-4">Page not found</p>
              <Link to="/" className="text-blue-600 hover:underline">Go to home page</Link>
            </div>
          </div>
        } />
      </Routes>
    </Router>
  );
}

function App() {
  useEffect(() => {
    // Global error handler for uncaught errors
    const handleError = (event: ErrorEvent) => {
      errorLogger.log(event.error || event.message, 'unknown', {
        component: 'global',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    // Global handler for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      errorLogger.log(
        event.reason instanceof Error ? event.reason : String(event.reason),
        'unknown',
        {
          component: 'global',
          type: 'unhandledRejection',
        }
      );
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BroadcastSyncProvider>
          <AuthProvider>
            <DragDropProvider>
              <UndoToastProvider>
                <AppContent />
                <ErrorLogViewer />
              </UndoToastProvider>
            </DragDropProvider>
          </AuthProvider>
        </BroadcastSyncProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
