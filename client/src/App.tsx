import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import PlanPage from './pages/PlanPage';
import RecipesPage from './pages/RecipesPage';
import BentoPage from './pages/BentoPage';
import LeftoversPage from './pages/LeftoversPage';
import SchoolMenuPage from './pages/SchoolMenuPage';
import ListsPage from './pages/ListsPage';

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/plan" replace />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/bento" element={<BentoPage />} />
            <Route path="/browse" element={<Navigate to="/recipes" replace />} />
            <Route path="/leftovers" element={<LeftoversPage />} />
            <Route path="/school-menu" element={<SchoolMenuPage />} />
            <Route path="/lists" element={<ListsPage />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
