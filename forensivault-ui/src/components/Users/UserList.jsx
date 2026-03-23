import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usersAPI } from '../../services/api';
import StatusBadge from '../Common/StatusBadge';
import Modal from '../Common/Modal';
import UserForm from './UserForm';
import LoadingSpinner from '../Common/LoadingSpinner';
import './Users.css';

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ role: '', status: '', search: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, filters]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: 10,
        ...(filters.role && { role: filters.role }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      };

      const data = await usersAPI.getAll(params);
      setUsers(data.users || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setShowModal(true);
  };

  const handleDelete = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }

    try {
      await usersAPI.delete(userId);
      fetchUsers();
    } catch (err) {
      alert('Error deleting user: ' + err.message);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      await usersAPI.resetPassword(resetUserId, newPassword);
      alert('Password reset successfully');
      setShowResetModal(false);
      setResetUserId(null);
      setNewPassword('');
    } catch (err) {
      alert('Error resetting password: ' + err.message);
    }
  };

  const handleSuccess = () => {
    setShowModal(false);
    setEditingUser(null);
    fetchUsers();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getUserStats = () => {
    const total = users.length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const analysts = users.filter((u) => u.role === 'analyst').length;
    const officers = users.filter((u) => u.role === 'officer').length;
    return { total: pagination.total, admins, analysts, officers };
  };

  const stats = getUserStats();

  return (
    <div className="users-page">
      {/* Header */}
      <div className="page-header">
        <h1>User Management</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <i className="fas fa-user-plus"></i> Add User
        </button>
      </div>

      {/* Stats */}
      <div className="users-stats">
        <div className="user-stat-card">
          <div className="user-stat-icon total">
            <i className="fas fa-users"></i>
          </div>
          <div className="user-stat-content">
            <h4>Total Users</h4>
            <p>{stats.total}</p>
          </div>
        </div>
        <div className="user-stat-card">
          <div className="user-stat-icon admin">
            <i className="fas fa-user-shield"></i>
          </div>
          <div className="user-stat-content">
            <h4>Admins</h4>
            <p>{stats.admins}</p>
          </div>
        </div>
        <div className="user-stat-card">
          <div className="user-stat-icon analyst">
            <i className="fas fa-user-tie"></i>
          </div>
          <div className="user-stat-content">
            <h4>Analysts</h4>
            <p>{stats.analysts}</p>
          </div>
        </div>
        <div className="user-stat-card">
          <div className="user-stat-icon officer">
            <i className="fas fa-user"></i>
          </div>
          <div className="user-stat-content">
            <h4>Officers</h4>
            <p>{stats.officers}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Role:</label>
          <select
            className="filter-select"
            value={filters.role}
            onChange={(e) => handleFilterChange('role', e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="analyst">Analyst</option>
            <option value="officer">Officer</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select
            className="filter-select"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div className="search-wrapper">
          <i className="fas fa-search"></i>
          <input
            type="text"
            className="search-input-small"
            placeholder="Search users..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <LoadingSpinner text="Loading users..." />
      ) : users.length > 0 ? (
        <>
          <div className="users-table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Email</th>
                  <th>Last Login</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={`user-avatar ${user.role}`}>
                          <i className="fas fa-user"></i>
                        </div>
                        <div className="user-info">
                          <span className="user-name">{user.fullName || user.username}</span>
                          <span className="user-username">@{user.username}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={user.role} size="sm" />
                    </td>
                    <td>
                      <StatusBadge status={user.status} size="sm" />
                    </td>
                    <td>
                      <span className="text-sm text-muted">{user.email || '-'}</span>
                    </td>
                    <td>
                      <span className="text-sm text-muted">{formatDate(user.lastLogin)}</span>
                    </td>
                    <td>
                      <span className="text-sm text-muted">{formatDate(user.createdAt)}</span>
                    </td>
                    <td>
                      <div className="user-actions">
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => handleEdit(user)}
                          title="Edit"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => {
                            setResetUserId(user._id);
                            setShowResetModal(true);
                          }}
                          title="Reset Password"
                        >
                          <i className="fas fa-key"></i>
                        </button>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => handleDelete(user._id, user.username)}
                          title="Delete"
                          style={{ color: 'var(--danger-color)' }}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <i className="fas fa-users"></i>
          </div>
          <h3>No users found</h3>
          <p>Add users or adjust your filters</p>
          <button className="btn btn-primary mt-4" onClick={() => setShowModal(true)}>
            <i className="fas fa-user-plus"></i> Add First User
          </button>
        </div>
      )}

      {/* Add/Edit User Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingUser ? 'Edit User' : 'Add New User'}
        size="md"
      >
        <UserForm
          user={editingUser}
          onSuccess={handleSuccess}
          onCancel={handleCloseModal}
        />
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          setResetUserId(null);
          setNewPassword('');
        }}
        title="Reset Password"
        size="sm"
      >
        <div className="form-group">
          <label className="form-label">New Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="Enter new password (min 6 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button
            className="btn btn-secondary"
            onClick={() => {
              setShowResetModal(false);
              setResetUserId(null);
              setNewPassword('');
            }}
          >
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleResetPassword}>
            <i className="fas fa-key"></i> Reset Password
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default UserList;