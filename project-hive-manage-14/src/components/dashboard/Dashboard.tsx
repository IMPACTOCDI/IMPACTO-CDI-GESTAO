
import React from 'react';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import AdminDashboard from './AdminDashboard';
import RegularDashboard from './RegularDashboard';

const Dashboard = () => {
  const { user, hasPermission } = useAuth();

  if (!user) return null;

  // Show admin dashboard for admin and manager roles
  if (hasPermission('view_analytics')) {
    return <AdminDashboard />;
  }

  // Show regular dashboard for other users
  return <RegularDashboard />;
};

export default Dashboard;
