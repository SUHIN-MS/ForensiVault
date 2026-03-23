import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './QuickActions.css';

const QuickActions = ({ onAction }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const actions = [
    {
      id: 'new-case',
      icon: 'fa-folder-plus',
      label: 'New Case',
      description: 'Create a new case',
      color: 'primary',
      roles: ['admin', 'officer', 'analyst'],
      action: () => onAction ? onAction('new-case') : navigate('/cases?action=new'),
    },
    {
      id: 'upload-evidence',
      icon: 'fa-cloud-upload-alt',
      label: 'Upload Evidence',
      description: 'Add new evidence file',
      color: 'success',
      roles: ['admin', 'officer', 'analyst'],
      action: () => onAction ? onAction('upload-evidence') : navigate('/evidence?action=upload'),
    },
    {
      id: 'verify',
      icon: 'fa-check-double',
      label: 'Verify Files',
      description: 'Check file integrity',
      color: 'info',
      roles: ['admin', 'analyst'],
      action: () => navigate('/evidence?view=pending'),
    },
    {
      id: 'reports',
      icon: 'fa-file-pdf',
      label: 'Generate Report',
      description: 'Create custody report',
      color: 'warning',
      roles: ['admin', 'analyst'],
      action: () => navigate('/evidence'),
    },
    {
      id: 'users',
      icon: 'fa-user-plus',
      label: 'Add User',
      description: 'Create new user',
      color: 'secondary',
      roles: ['admin'],
      action: () => onAction ? onAction('new-user') : navigate('/users?action=new'),
    },
    {
      id: 'logs',
      icon: 'fa-history',
      label: 'View Logs',
      description: 'Activity history',
      color: 'default',
      roles: ['admin'],
      action: () => navigate('/logs'),
    },
  ];

  const filteredActions = actions.filter(action => 
    action.roles.includes(user?.role)
  );

  return (
    <div className="quick-actions">
      <div className="quick-actions-header">
        <h3>Quick Actions</h3>
      </div>
      <div className="quick-actions-grid">
        {filteredActions.map((action) => (
          <button
            key={action.id}
            className={`quick-action-btn action-${action.color}`}
            onClick={action.action}
          >
            <div className="quick-action-icon">
              <i className={`fas ${action.icon}`}></i>
            </div>
            <div className="quick-action-content">
              <span className="quick-action-label">{action.label}</span>
              <span className="quick-action-desc">{action.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;