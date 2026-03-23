import React from 'react';
import { useAuth } from '../context/AuthContext';
import OfficerDashboard from '../components/Dashboard/OfficerDashboard';
import AnalystDashboard from '../components/Dashboard/AnalystDashboard';
import AdminDashboard from '../components/Dashboard/AdminDashboard';

const DashboardPage = () => {
  const { user } = useAuth();

  switch (user?.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'analyst':
      return <AnalystDashboard />;
    case 'officer':
    default:
      return <OfficerDashboard />;
  }
};

export default DashboardPage;