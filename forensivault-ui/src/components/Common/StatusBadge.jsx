// ═══════════════════════════════════════════════════════════════════════════
// FILE: forensivault-ui/src/components/Common/StatusBadge.jsx
// UPDATED: Added TAMPERING_DETECTED and other missing actions
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react';
import './StatusBadge.css';

const StatusBadge = ({ status, type = 'default', size = 'md' }) => {
  const getStatusConfig = () => {
    const statusMap = {
      // Evidence status
      pending: { icon: 'fa-clock', label: 'Pending', variant: 'warning' },
      verified: { icon: 'fa-check-circle', label: 'Verified', variant: 'success' },
      tampered: { icon: 'fa-exclamation-triangle', label: 'Tampered', variant: 'danger' },
      archived: { icon: 'fa-archive', label: 'Archived', variant: 'secondary' },

      // Case status
      open: { icon: 'fa-folder-open', label: 'Open', variant: 'info' },
      'in-progress': { icon: 'fa-spinner', label: 'In Progress', variant: 'primary' },
      closed: { icon: 'fa-check', label: 'Closed', variant: 'success' },

      // Priority
      low: { icon: 'fa-arrow-down', label: 'Low', variant: 'secondary' },
      medium: { icon: 'fa-minus', label: 'Medium', variant: 'warning' },
      high: { icon: 'fa-arrow-up', label: 'High', variant: 'danger' },
      critical: { icon: 'fa-exclamation', label: 'Critical', variant: 'danger' },

      // User status
      active: { icon: 'fa-check-circle', label: 'Active', variant: 'success' },
      inactive: { icon: 'fa-minus-circle', label: 'Inactive', variant: 'secondary' },
      suspended: { icon: 'fa-ban', label: 'Suspended', variant: 'danger' },

      // File types
      document: { icon: 'fa-file-alt', label: 'Document', variant: 'info' },
      image: { icon: 'fa-image', label: 'Image', variant: 'primary' },
      video: { icon: 'fa-video', label: 'Video', variant: 'secondary' },
      audio: { icon: 'fa-music', label: 'Audio', variant: 'warning' },
      other: { icon: 'fa-file', label: 'Other', variant: 'secondary' },

      // Actions (Log types)
      UPLOAD: { icon: 'fa-upload', label: 'Upload', variant: 'primary' },
      VERIFY: { icon: 'fa-check-double', label: 'Verify', variant: 'success' },
      SEARCH: { icon: 'fa-search', label: 'Search', variant: 'info' },
      ADVANCED_SEARCH: { icon: 'fa-search-plus', label: 'Advanced Search', variant: 'info' },
      DOWNLOAD: { icon: 'fa-download', label: 'Download', variant: 'primary' },
      DELETE: { icon: 'fa-trash', label: 'Delete', variant: 'danger' },
      LOGIN: { icon: 'fa-sign-in-alt', label: 'Login', variant: 'info' },
      LOGOUT: { icon: 'fa-sign-out-alt', label: 'Logout', variant: 'secondary' },
      CASE_CREATED: { icon: 'fa-folder-plus', label: 'Case Created', variant: 'success' },
      CASE_UPDATED: { icon: 'fa-folder', label: 'Case Updated', variant: 'info' },
      CASE_CLOSED: { icon: 'fa-folder-minus', label: 'Case Closed', variant: 'secondary' },
      USER_CREATED: { icon: 'fa-user-plus', label: 'User Created', variant: 'success' },
      USER_UPDATED: { icon: 'fa-user-edit', label: 'User Updated', variant: 'info' },
      USER_DELETED: { icon: 'fa-user-minus', label: 'User Deleted', variant: 'danger' },
      PASSWORD_RESET: { icon: 'fa-key', label: 'Password Reset', variant: 'warning' },
      REPORT_GENERATED: { icon: 'fa-file-pdf', label: 'Report', variant: 'primary' },
      
      // ═══════════ NEW: Tampering Detection Actions ═══════════
      TAMPERING_DETECTED: { icon: 'fa-exclamation-triangle', label: 'Tampering Detected', variant: 'danger' },
      DISK_IMAGE_PARSED: { icon: 'fa-hdd', label: 'Disk Parsed', variant: 'info' },
      FILE_EXTRACTED: { icon: 'fa-file-export', label: 'File Extracted', variant: 'primary' },

      // Severity levels (for tampering)
      'severity-low': { icon: 'fa-info-circle', label: 'Low', variant: 'success' },
      'severity-medium': { icon: 'fa-exclamation-circle', label: 'Medium', variant: 'warning' },
      'severity-high': { icon: 'fa-exclamation-triangle', label: 'High', variant: 'danger' },
      'severity-critical': { icon: 'fa-radiation', label: 'Critical', variant: 'danger' },
    };

    return statusMap[status] || { icon: 'fa-circle', label: status || 'Unknown', variant: 'secondary' };
  };

  const config = getStatusConfig();

  return (
    <span className={`status-badge status-${config.variant} status-${size}`}>
      <i className={`fas ${config.icon}`}></i>
      <span>{config.label}</span>
    </span>
  );
};

export default StatusBadge;