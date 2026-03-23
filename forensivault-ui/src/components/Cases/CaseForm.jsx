import React, { useState, useEffect } from 'react';
import { casesAPI, usersAPI } from '../../services/api';
import './Cases.css';

const CaseForm = ({ caseData, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assignedTo: [],
    tags: '',
  });

  useEffect(() => {
    if (caseData) {
      setFormData({
        title: caseData.title || '',
        description: caseData.description || '',
        priority: caseData.priority || 'medium',
        assignedTo: caseData.assignedTo?.map((u) => u._id) || [],
        tags: caseData.tags?.join(', ') || '',
      });
    }

    fetchUsers();
  }, [caseData]);

  const fetchUsers = async () => {
    try {
      const data = await usersAPI.getAll({ limit: 100 });
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAssigneeChange = (userId) => {
    setFormData((prev) => {
      const assignedTo = prev.assignedTo.includes(userId)
        ? prev.assignedTo.filter((id) => id !== userId)
        : [...prev.assignedTo, userId];
      return { ...prev, assignedTo };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        tags: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };

      if (caseData) {
        await casesAPI.update(caseData._id, payload);
      } else {
        await casesAPI.create(payload);
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
      <div className="form-group">
        <label className="form-label">Case Title *</label>
        <input
          type="text"
          name="title"
          className="form-input"
          placeholder="Enter case title"
          value={formData.title}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          name="description"
          className="form-textarea"
          placeholder="Describe the case..."
          value={formData.description}
          onChange={handleChange}
          rows={4}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Priority</label>
        <select
          name="priority"
          className="form-select"
          value={formData.priority}
          onChange={handleChange}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Tags (comma-separated)</label>
        <input
          type="text"
          name="tags"
          className="form-input"
          placeholder="e.g., fraud, financial, urgent"
          value={formData.tags}
          onChange={handleChange}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Assign To</label>
        <div className="assignee-list">
          {users.map((user) => (
            <label key={user._id} className="assignee-item">
              <input
                type="checkbox"
                checked={formData.assignedTo.includes(user._id)}
                onChange={() => handleAssigneeChange(user._id)}
              />
              <span>{user.fullName || user.username}</span>
              <span className="text-muted text-xs">({user.role})</span>
            </label>
          ))}
        </div>
      </div>

      <div className="modal-footer" style={{ margin: '1.5rem -1.5rem -1.5rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              {caseData ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            <>
              <i className="fas fa-check"></i>
              {caseData ? 'Update Case' : 'Create Case'}
            </>
          )}
        </button>
      </div>

      <style jsx>{`
        .assignee-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 150px;
          overflow-y: auto;
          padding: 0.5rem;
          background: var(--bg-tertiary);
          border-radius: var(--radius-md);
        }

        .assignee-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          border-radius: var(--radius-sm);
          cursor: pointer;
        }

        .assignee-item:hover {
          background: var(--bg-hover);
        }

        .assignee-item input {
          accent-color: var(--primary-color);
        }
      `}</style>
    </form>
  );
};

export default CaseForm;