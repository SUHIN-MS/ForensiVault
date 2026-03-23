import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { statsAPI, logsAPI, usersAPI } from '../../services/api';
import StatCard from '../Common/StatCard';
import QuickActions from '../Common/QuickActions';
import StatusBadge from '../Common/StatusBadge';
import Modal from '../Common/Modal';
import CaseForm from '../Cases/CaseForm';
import EvidenceUpload from '../Evidence/EvidenceUpload';
import UserForm from '../Users/UserForm';
import LoadingSpinner from '../Common/LoadingSpinner';
import './Dashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsData, logsData, usersData] = await Promise.all([
        statsAPI.get(),
        logsAPI.getRealtime(),
        usersAPI.getAll({ limit: 5 }),
      ]);

      setStats(statsData);
      setRecentLogs(logsData || []);
      setUsers(usersData.users || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action) => {
    if (action === 'new-case') {
      setShowCaseModal(true);
    } else if (action === 'upload-evidence') {
      setShowUploadModal(true);
    } else if (action === 'new-user') {
      setShowUserModal(true);
    }
  };

  const handleSuccess = () => {
    setShowCaseModal(false);
    setShowUploadModal(false);
    setShowUserModal(false);
    fetchData();
  };

  const getActionIcon = (action) => {
    const icons = {
      UPLOAD: 'fa-upload',
      VERIFY: 'fa-check-double',
      LOGIN: 'fa-sign-in-alt',
      LOGOUT: 'fa-sign-out-alt',
      CASE_CREATED: 'fa-folder-plus',
      USER_CREATED: 'fa-user-plus',
      REPORT_GENERATED: 'fa-file-pdf',
      SEARCH: 'fa-search',
    };
    return icons[action] || 'fa-circle';
  };

  const getActionColor = (action) => {
    const colors = {
      UPLOAD: 'upload',
      VERIFY: 'verify',
      LOGIN: 'login',
      LOGOUT: 'login',
      CASE_CREATED: 'case',
    };
    return colors[action] || 'login';
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading dashboard..." />;
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p>System overview and management</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard
          title="Total Cases"
          value={stats?.cases?.total || 0}
          icon="fa-folder-open"
          color="primary"
        />
        <StatCard
          title="Total Evidence"
          value={stats?.evidence?.total || 0}
          icon="fa-file-shield"
          color="info"
        />
        <StatCard
          title="Total Users"
          value={stats?.users?.total || 0}
          icon="fa-users"
          color="success"
        />
        <StatCard
          title="Tampered Files"
          value={stats?.evidence?.tampered || 0}
          icon="fa-exclamation-triangle"
          color="danger"
        />
      </div>

      {/* Quick Actions */}
      <QuickActions onAction={handleQuickAction} />

      {/* Two Column Grid */}
      <div className="dashboard-grid">
        {/* Recent Activity */}
        <div className="recent-items">
          <div className="recent-items-header">
            <h3>Recent Activity</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/logs')}>
              View All <i className="fas fa-arrow-right"></i>
            </button>
          </div>
          <div className="recent-items-body">
            {recentLogs.length > 0 ? (
              recentLogs.map((log) => (
                <div key={log._id} className="activity-item">
                  <div className={`activity-icon ${getActionColor(log.action)}`}>
                    <i className={`fas ${getActionIcon(log.action)}`}></i>
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">
                      {log.userId?.fullName || log.userId?.username || 'System'}
                    </div>
                    <div className="activity-desc">
                      <StatusBadge status={log.action} size="sm" />
                    </div>
                  </div>
                  <span className="activity-time">{formatTimeAgo(log.timestamp)}</span>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="fas fa-history"></i>
                </div>
                <h3>No activity yet</h3>
                <p>System activity will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Users */}
        <div className="recent-items">
          <div className="recent-items-header">
            <h3>System Users</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/users')}>
              Manage <i className="fas fa-arrow-right"></i>
            </button>
          </div>
          <div className="recent-items-body">
            {users.length > 0 ? (
              users.map((user) => (
                <div key={user._id} className="recent-item" onClick={() => navigate('/users')}>
                  <div className="recent-item-icon" style={{ background: 'var(--primary-gradient)', color: 'white' }}>
                    <i className="fas fa-user"></i>
                  </div>
                  <div className="recent-item-content">
                    <div className="recent-item-title">{user.fullName || user.username}</div>
                    <div className="recent-item-meta">@{user.username}</div>
                  </div>
                  <StatusBadge status={user.role} size="sm" />
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="fas fa-users"></i>
                </div>
                <h3>No users</h3>
                <p>Add users to the system</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <Modal isOpen={showCaseModal} onClose={() => setShowCaseModal(false)} title="Create New Case" size="md">
        <CaseForm onSuccess={handleSuccess} onCancel={() => setShowCaseModal(false)} />
      </Modal>

      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Evidence" size="md">
        <EvidenceUpload onSuccess={handleSuccess} onCancel={() => setShowUploadModal(false)} />
      </Modal>

      <Modal isOpen={showUserModal} onClose={() => setShowUserModal(false)} title="Add New User" size="md">
        <UserForm onSuccess={handleSuccess} onCancel={() => setShowUserModal(false)} />
      </Modal>
    </div>
  );
};

export default AdminDashboard;