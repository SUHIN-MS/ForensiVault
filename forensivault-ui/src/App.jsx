import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AuthPage from './components/Auth/AuthPage';
import Layout from './components/Layout/Layout';
import DashboardPage from './pages/DashboardPage';
import CasesPage from './pages/CasesPage';
import EvidencePage from './pages/EvidencePage';
import UsersPage from './pages/UsersPage';
import LogsPage from './pages/LogsPage';
import ForensicToolsPage from './pages/ForensicToolsPage';
import LoadingSpinner from './components/Common/LoadingSpinner';
import './App.css';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Route */}
        <Route 
          path="/auth" 
          element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} 
        />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/:id" element={<CasesPage />} />
          <Route path="evidence" element={<EvidencePage />} />
          <Route path="evidence/:id" element={<EvidencePage />} />
          <Route 
            path="forensic-tools" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'analyst']}>
                <ForensicToolsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="users" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UsersPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="logs" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <LogsPage />
              </ProtectedRoute>
            } 
          />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;