import React, { useState, useEffect } from 'react';
import { usersAPI } from '../../services/api';
import './Users.css';

const UserForm = ({ user, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    role: 'officer',
    status: 'active',
    department: '',
    phone: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        password: '', // Don't populate password for editing
        fullName: user.fullName || '',
        email: user.email || '',
        role: user.role || 'officer',
        status: user.status || 'active',
        department: user.department || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (user) {
        // Update existing user (don't send password if empty)
        const updateData = { ...formData };
        delete updateData.password;
        delete updateData.username; // Can't change username
        await usersAPI.update(user._id, updateData);
      } else {
        // Create new user
        if (!formData.password || formData.password.length < 6) {
          alert('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        await usersAPI.create(formData);
      }

      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="user-form-grid">
        <div className="form-group">
          <label className="form-label">Username *</label>
          <input
            type="text"
            name="username"
            className="form-input"
            placeholder="Enter username"
            value={formData.username}
            onChange={handleChange}
            disabled={!!user}
            required
          />
        </div>

        {!user && (
          <div className="form-group">
            <label className="form-label">Password *</label>
            <input
              type="password"
              name="password"
              className="form-input"
              placeholder="Min 6 characters"
              value={formData.password}
              onChange={handleChange}
              required={!user}
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input
            type="text"
            name="fullName"
            className="form-input"
            placeholder="John Doe"
            value={formData.fullName}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            name="email"
            className="form-input"
            placeholder="john@example.com"
            value={formData.email}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Role *</label>
          <select
            name="role"
            className="form-select"
            value={formData.role}
            onChange={handleChange}
            required
          >
            <option value="officer">Officer</option>
            <option value="analyst">Analyst</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Status</label>
          <select
            name="status"
            className="form-select"
            value={formData.status}
            onChange={handleChange}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Department</label>
          <input
            type="text"
            name="department"
            className="form-input"
            placeholder="Forensics Unit"
            value={formData.department}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Phone</label>
          <input
            type="tel"
            name="phone"
            className="form-input"
            placeholder="+1 234 567 8900"
            value={formData.phone}
            onChange={handleChange}
          />
        </div>
      </div>

      <div
        className="modal-footer"
        style={{
          margin: '1.5rem -1.5rem -1.5rem',
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
        }}
      >
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              {user ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            <>
              <i className="fas fa-check"></i>
              {user ? 'Update User' : 'Create User'}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default UserForm;    