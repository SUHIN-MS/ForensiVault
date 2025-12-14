import React, { useState, useEffect } from 'react';
import { getAdminData } from './api';

const AdminDashboard = ({ onLogout }) => {
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const data = await getAdminData(token);
        setAdminData(data);
      } catch (error) {
        console.error("Failed to fetch admin data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="dashboard-loading">Loading Admin Dashboard...</div>;

  return (
    <div className="dashboard admin-dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="user-welcome">System Administrator Panel</p>
        </div>
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </header>
      
      <div className="dashboard-content">
        <div className="dashboard-stats">
          <div className="stat-card">
            <h3>Total Users</h3>
            <p className="stat-number">{adminData?.totalUsers || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Active Cases</h3>
            <p className="stat-number">{adminData?.activeCases || 0}</p>
          </div>
          <div className="stat-card">
            <h3>System Health</h3>
            <p className="stat-number">{adminData?.systemHealth || "100%"}</p>
          </div>
          <div className="stat-card">
            <h3>Storage Used</h3>
            <p className="stat-number">{adminData?.storageUsed || "2.3TB"}</p>
          </div>
        </div>

        <div className="admin-features">
          <h2>Administrative Functions</h2>
          <div className="features-grid">
            <div className="feature-card admin-feature">
              <h3>User Management</h3>
              <p>Create, modify, and manage system users and permissions</p>
              <button className="feature-btn">Manage Users</button>
            </div>
            <div className="feature-card admin-feature">
              <h3>System Settings</h3>
              <p>Configure system parameters, security, and global settings</p>
              <button className="feature-btn">System Config</button>
            </div>
            <div className="feature-card admin-feature">
              <h3>Audit Logs</h3>
              <p>View system activity, access logs, and security events</p>
              <button className="feature-btn">View Logs</button>
            </div>
            <div className="feature-card admin-feature">
              <h3>Database Management</h3>
              <p>Backup, restore, and maintain database operations</p>
              <button className="feature-btn">Database Tools</button>
            </div>
            <div className="feature-card admin-feature">
              <h3>Role Management</h3>
              <p>Define and manage user roles and access permissions</p>
              <button className="feature-btn">Manage Roles</button>
            </div>
            <div className="feature-card admin-feature">
              <h3>System Reports</h3>
              <p>Generate comprehensive system usage and performance reports</p>
              <button className="feature-btn">Generate Reports</button>
            </div>
          </div>
        </div>

        <div className="recent-activity">
          <h3>System Alerts</h3>
          <div className="activity-list">
            {adminData?.systemAlerts?.map((alert, index) => (
              <div key={index} className="activity-item">
                <span className={`alert-level ${alert.level}`}>{alert.level.toUpperCase()}</span>
                <span className="activity-desc">{alert.message}</span>
                <span className="activity-time">{alert.time}</span>
              </div>
            )) || (
              <div className="activity-item">
                <span className="activity-desc">No system alerts</span>
                <span className="activity-time">All systems operational</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;