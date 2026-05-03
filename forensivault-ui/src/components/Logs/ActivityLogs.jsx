import React, { useState, useEffect, useCallback } from 'react';
import { logsAPI } from '../../services/api';
import StatusBadge from '../Common/StatusBadge';
import StatCard from '../Common/StatCard';
import LoadingSpinner from '../Common/LoadingSpinner';
import './Logs.css';

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ action: '', startDate: '', endDate: '' });
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const params = {
        page: pagination.page,
        limit: 50,
        ...(filters.action && { action: filters.action }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      };

      const [logsData, statsData] = await Promise.all([
        logsAPI.getAll(params),
        logsAPI.getStats(),
      ]);

      setLogs(logsData.logs || []);
      setPagination(logsData.pagination || { page: 1, pages: 1, total: 0 });
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 5000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const getActionIcon = (action) => {
    const icons = {
      UPLOAD: 'fa-upload',
      VERIFY: 'fa-check-double',
      LOGIN: 'fa-sign-in-alt',
      LOGOUT: 'fa-sign-out-alt',
      CASE_CREATED: 'fa-folder-plus',
      CASE_UPDATED: 'fa-folder',
      CASE_CLOSED: 'fa-folder-minus',
      USER_CREATED: 'fa-user-plus',
      USER_UPDATED: 'fa-user-edit',
      USER_DELETED: 'fa-user-minus',
      REPORT_GENERATED: 'fa-file-pdf',
      SEARCH: 'fa-search',
      ADVANCED_SEARCH: 'fa-search-plus',
      DELETE: 'fa-trash',
      PASSWORD_RESET: 'fa-key',
    };
    return icons[action] || 'fa-circle';
  };

  const getActionClass = (action) => {
    if (action.includes('UPLOAD')) return 'upload';
    if (action.includes('VERIFY')) return 'verify';
    if (action.includes('LOGIN')) return 'login';
    if (action.includes('LOGOUT')) return 'logout';
    if (action.includes('CASE')) return 'case';
    if (action.includes('USER')) return 'user';
    if (action.includes('REPORT')) return 'report';
    if (action.includes('SEARCH')) return 'search';
    if (action.includes('DELETE')) return 'delete';
    return 'login';
  };

  const formatTime = (date) => {
    const now = new Date();
    const logDate = new Date(date);
    const diff = now - logDate;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';

    return logDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionDescription = (log) => {
    const user = log.userId?.fullName || log.userId?.username || 'System';
    const evidence = log.evidenceId?.originalName || '';
    const caseInfo = log.caseId?.caseNumber || '';
    const targetUser = log.targetUserId?.username || '';

    switch (log.action) {
      case 'UPLOAD':
        return `${user} uploaded ${evidence}`;
      case 'VERIFY':
        return `${user} verified ${evidence}`;
      case 'LOGIN':
        return `${user} logged in`;
      case 'LOGOUT':
        return `${user} logged out`;
      case 'CASE_CREATED':
        return `${user} created case ${caseInfo}`;
      case 'CASE_CLOSED':
        return `${user} closed case ${caseInfo}`;
      case 'USER_CREATED':
        return `${user} created user ${targetUser}`;
      case 'USER_DELETED':
        return `${user} deleted user ${targetUser}`;
      case 'REPORT_GENERATED':
        return `${user} generated report for ${evidence || caseInfo}`;
      case 'SEARCH':
        return `${user} performed a search`;
      case 'PASSWORD_RESET':
        return `${user} reset password for ${targetUser}`;
      default:
        return `${user} performed ${log.action}`;
    }
  };

  const actionTypes = [
    'UPLOAD',
    'VERIFY',
    'LOGIN',
    'LOGOUT',
    'CASE_CREATED',
    'USER_CREATED',
    'REPORT_GENERATED',
    'SEARCH',
  ];

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading activity logs..." />;
  }

  return (
    <div className="logs-page">
      {/* Header */}
      <div className="page-header">
        <h1>Activity Logs</h1>
        <div className="flex items-center gap-2">
          <button
            className={`btn ${autoRefresh ? 'btn-success' : 'btn-secondary'}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <>
                <span className="realtime-dot"></span>
                Live
              </>
            ) : (
              <>
                <i className="fas fa-sync"></i>
                Auto-refresh
              </>
            )}
          </button>
          <button className="btn btn-secondary" onClick={fetchLogs}>
            <i className="fas fa-refresh"></i> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="logs-stats">
        <StatCard
          title="Total Logs"
          value={stats?.totalLogs || 0}
          icon="fa-list"
          color="primary"
        />
        <StatCard
          title="Today's Activity"
          value={stats?.todayLogs || 0}
          icon="fa-calendar-day"
          color="success"
        />
        <StatCard
          title="Verifications"
          value={stats?.byAction?.find((a) => a._id === 'VERIFY')?.count || 0}
          icon="fa-check-double"
          color="info"
        />
        <StatCard
          title="Uploads"
          value={stats?.byAction?.find((a) => a._id === 'UPLOAD')?.count || 0}
          icon="fa-upload"
          color="warning"
        />
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Action:</label>
          <select
            className="filter-select"
            value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
          >
            <option value="">All Actions</option>
            {actionTypes.map((action) => (
              <option key={action} value={action}>
                {action.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>From:</label>
          <input
            type="date"
            className="filter-select"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>To:</label>
          <input
            type="date"
            className="filter-select"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />
        </div>

        {autoRefresh && (
          <div className="realtime-indicator">
            <span className="realtime-dot"></span>
            <span>Live updates enabled</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="logs-grid">
        {/* Logs List */}
        <div className="logs-container">
          <div className="logs-header">
            <h3>Activity Feed</h3>
            <span className="text-muted text-sm">{pagination.total} total entries</span>
          </div>
          <div className="logs-list">
            {logs.length > 0 ? (
              logs.map((log) => (
                <div key={log._id} className="log-item">
                  <div className={`log-icon ${getActionClass(log.action)}`}>
                    <i className={`fas ${getActionIcon(log.action)}`}></i>
                  </div>
                  <div className="log-content">
                    <div className="log-title">{getActionDescription(log)}</div>
                    <div className="log-details">
                      <span>
                        <i className="fas fa-user"></i>
                        {log.userId?.username || 'System'}
                      </span>
                      <StatusBadge status={log.action} size="sm" />
                    </div>
                  </div>
                  <div className="log-meta">
                    <span className="log-time">{formatTime(log.timestamp)}</span>
                    <span className="log-hash">{log.entryHash?.substring(0, 8)}...</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="fas fa-history"></i>
                </div>
                <h3>No logs found</h3>
                <p>Activity logs will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Side Panel */}
        <div className="flex flex-col gap-4">
          {/* Activity Chart */}
          {stats?.lastWeek && stats.lastWeek.length > 0 && (
            <div className="logs-chart">
              <div className="logs-chart-header">
                <h3>Last 7 Days</h3>
              </div>
              <div className="chart-bars">
                {stats.lastWeek.map((day, index) => {
                  const maxCount = Math.max(...stats.lastWeek.map((d) => d.count));
                  const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;

                  return (
                    <div key={index} className="chart-bar-container">
                      <span className="chart-bar-value">{day.count}</span>
                      <div
                        className="chart-bar"
                        style={{ height: `${Math.max(height, 5)}%` }}
                      ></div>
                      <span className="chart-bar-label">
                        {new Date(day._id).toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Distribution */}
          {stats?.byAction && stats.byAction.length > 0 && (
            <div className="action-distribution">
              <h3>Action Distribution</h3>
              {stats.byAction.slice(0, 6).map((action) => {
                const maxCount = Math.max(...stats.byAction.map((a) => a.count));
                const percentage = maxCount > 0 ? (action.count / maxCount) * 100 : 0;

                return (
                  <div key={action._id} className="action-item">
                    <span className="action-label">{action._id}</span>
                    <div className="action-bar">
                      <div
                        className="action-bar-fill"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="action-count">{action.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            disabled={pagination.page === 1}
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
          >
            <i className="fas fa-chevron-left"></i>
          </button>

          <span className="pagination-info">
            Page {pagination.page} of {pagination.pages}
          </span>

          <button
            className="pagination-btn"
            disabled={pagination.page === pagination.pages}
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;