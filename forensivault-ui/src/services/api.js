// ═══════════════════════════════════════════════════════════════════════════
// FILE: forensivault-ui/src/services/api.js
// PURPOSE: API service for ForensiVault frontend
// UPDATED: Added Disk Image API for forensic tools
// ═══════════════════════════════════════════════════════════════════════════

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Helper to get auth headers
const getHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  return headers;
};

// Helper for file uploads (no Content-Type)
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  return headers;
};

// Handle API response
const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
};

// ════════════════════════════════════════════════════════════════════════════
// AUTH API
// ════════════════════════════════════════════════════════════════════════════

export const authAPI = {
  login: async (username, password) => {
    const response = await fetch(API_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return response.json();
  },

  signup: async (userData) => {
    const response = await fetch(API_URL + '/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return response.json();
  },

  logout: async () => {
    const response = await fetch(API_URL + '/auth/logout', {
      method: 'POST',
      headers: getHeaders(),
    });
    return response.json();
  },

  getMe: async () => {
    const response = await fetch(API_URL + '/auth/me', {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};

// ════════════════════════════════════════════════════════════════════════════
// CASES API
// ════════════════════════════════════════════════════════════════════════════

export const casesAPI = {
  getAll: async (params) => {
    params = params || {};
    const query = new URLSearchParams(params).toString();
    const response = await fetch(API_URL + '/cases?' + query, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getById: async (id) => {
    const response = await fetch(API_URL + '/cases/' + id, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  create: async (caseData) => {
    const response = await fetch(API_URL + '/cases', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(caseData),
    });
    return handleResponse(response);
  },

  update: async (id, caseData) => {
    const response = await fetch(API_URL + '/cases/' + id, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(caseData),
    });
    return handleResponse(response);
  },

  close: async (id) => {
    const response = await fetch(API_URL + '/cases/' + id + '/close', {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};

// ════════════════════════════════════════════════════════════════════════════
// EVIDENCE API
// ════════════════════════════════════════════════════════════════════════════

export const evidenceAPI = {
  getAll: async (params) => {
    params = params || {};
    const query = new URLSearchParams(params).toString();
    const response = await fetch(API_URL + '/evidence?' + query, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getById: async (id) => {
    const response = await fetch(API_URL + '/evidence/' + id, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  upload: async (formData) => {
    const response = await fetch(API_URL + '/evidence/upload', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  verify: async (id) => {
    const response = await fetch(API_URL + '/verify/' + id, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  // Get tampered evidence only
  getTampered: async (params) => {
    params = params || {};
    params.status = 'tampered';
    const query = new URLSearchParams(params).toString();
    const response = await fetch(API_URL + '/evidence?' + query, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};

// ════════════════════════════════════════════════════════════════════════════
// USERS API
// ════════════════════════════════════════════════════════════════════════════

export const usersAPI = {
  getAll: async (params) => {
    params = params || {};
    const query = new URLSearchParams(params).toString();
    const response = await fetch(API_URL + '/users?' + query, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getById: async (id) => {
    const response = await fetch(API_URL + '/users/' + id, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  create: async (userData) => {
    const response = await fetch(API_URL + '/users', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData),
    });
    return handleResponse(response);
  },

  update: async (id, userData) => {
    const response = await fetch(API_URL + '/users/' + id, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(userData),
    });
    return handleResponse(response);
  },

  delete: async (id) => {
    const response = await fetch(API_URL + '/users/' + id, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  resetPassword: async (id, newPassword) => {
    const response = await fetch(API_URL + '/users/' + id + '/reset-password', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ newPassword: newPassword }),
    });
    return handleResponse(response);
  },
};

// ════════════════════════════════════════════════════════════════════════════
// LOGS API
// ════════════════════════════════════════════════════════════════════════════

export const logsAPI = {
  getAll: async (params) => {
    params = params || {};
    const query = new URLSearchParams(params).toString();
    const response = await fetch(API_URL + '/logs?' + query, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getRealtime: async () => {
    const response = await fetch(API_URL + '/logs/realtime', {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getStats: async () => {
    const response = await fetch(API_URL + '/logs/stats', {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};

// ════════════════════════════════════════════════════════════════════════════
// TAMPERING API
// ════════════════════════════════════════════════════════════════════════════

export const tamperingAPI = {
  // Get all tampering detection logs
  getLogs: async (params) => {
    params = params || {};
    const query = new URLSearchParams(params).toString();
    const response = await fetch(API_URL + '/tampering-logs?' + query, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  // Get tampering stats
  getStats: async () => {
    const response = await fetch(API_URL + '/tampering-stats', {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  // Get tampering history for specific evidence
  getEvidenceHistory: async (evidenceId) => {
    const response = await fetch(API_URL + '/evidence/' + evidenceId + '/tampering-history', {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};

// ════════════════════════════════════════════════════════════════════════════
// STATS API
// ════════════════════════════════════════════════════════════════════════════

export const statsAPI = {
  get: async () => {
    const response = await fetch(API_URL + '/stats', {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};

// ════════════════════════════════════════════════════════════════════════════
// SEARCH API
// ════════════════════════════════════════════════════════════════════════════

export const searchAPI = {
  search: async (query) => {
    const response = await fetch(API_URL + '/search?q=' + encodeURIComponent(query), {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};

// ════════════════════════════════════════════════════════════════════════════
// REPORTS API
// ════════════════════════════════════════════════════════════════════════════

export const reportsAPI = {
  getEvidenceReport: async function(id) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_URL + '/report/evidence/' + id, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate report');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Evidence_Report_' + id + '.pdf';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  },

  getCaseReport: async function(id) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_URL + '/report/case/' + id, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate report');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Case_Report_' + id + '.pdf';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  },

  // Tampering report
  getTamperingReport: async function(evidenceId) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_URL + '/report/tampering/' + evidenceId, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Tampering_Report_' + evidenceId + '.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  },
};

// ════════════════════════════════════════════════════════════════════════════
// DISK IMAGE API
// ════════════════════════════════════════════════════════════════════════════

export const diskImageAPI = {
  // Check Python service status
  getServiceStatus: async () => {
    const response = await fetch(API_URL + '/disk-images/service-status', {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  // Get all disk images
  getAll: async (params) => {
    params = params || {};
    const query = new URLSearchParams(params).toString();
    const response = await fetch(API_URL + '/disk-images?' + query, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  // Get single disk image
  getById: async (id) => {
    const response = await fetch(API_URL + '/disk-images/' + id, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  // Upload disk image
  upload: async (formData) => {
    const response = await fetch(API_URL + '/disk-images/upload', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  // Delete disk image
  delete: async (id) => {
    const response = await fetch(API_URL + '/disk-images/' + id, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  // Browse files in disk image
  browseFiles: async (id, directory, recursive) => {
    directory = directory || '/';
    recursive = recursive || false;
    const response = await fetch(API_URL + '/disk-images/' + id + '/browse', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ directory, recursive }),
    });
    return handleResponse(response);
  },

  // Get file tree
  getFileTree: async (id, maxDepth) => {
    maxDepth = maxDepth || 5;
    const response = await fetch(API_URL + '/disk-images/' + id + '/tree', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ maxDepth }),
    });
    return handleResponse(response);
  },

  // Get file info
  getFileInfo: async (id, filePath) => {
    const response = await fetch(API_URL + '/disk-images/' + id + '/file/info', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ filePath }),
    });
    return handleResponse(response);
  },

  // Get file preview
  getFilePreview: async (id, filePath, maxSize) => {
    maxSize = maxSize || 10240;
    const response = await fetch(API_URL + '/disk-images/' + id + '/file/preview', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ filePath, maxSize }),
    });
    return handleResponse(response);
  },

  // Extract file from disk image
  extractFile: async (id, filePath, addToEvidence, caseId) => {
    addToEvidence = addToEvidence || false;
    caseId = caseId || null;
    const response = await fetch(API_URL + '/disk-images/' + id + '/file/extract', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ filePath, addToEvidence, caseId }),
    });
    return handleResponse(response);
  },

  // Search files in disk image
  searchFiles: async (id, searchParams) => {
    searchParams = searchParams || {};
    const response = await fetch(API_URL + '/disk-images/' + id + '/search', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(searchParams),
    });
    return handleResponse(response);
  },

  // Search content in files
  searchContent: async (id, query, options) => {
    options = options || {};
    const response = await fetch(API_URL + '/disk-images/' + id + '/search/content', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ query, ...options }),
    });
    return handleResponse(response);
  },

  // Get disk image statistics
  getStats: async (id) => {
    const response = await fetch(API_URL + '/disk-images/' + id + '/stats', {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
    // ── File Carving ──

  startCarving: async (id, fileTypes) => {
    const response = await fetch(API_URL + '/disk-images/' + id + '/carve', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ fileTypes }),
    });
    return handleResponse(response);
  },

  getCarvingStatus: async (id) => {
    const response = await fetch(API_URL + '/disk-images/' + id + '/carve/status', {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getCarvingResults: async (id) => {
    const response = await fetch(API_URL + '/disk-images/' + id + '/carve/results', {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  compareCarvedFiles: async (id, hashes) => {
    const response = await fetch(API_URL + '/disk-images/' + id + '/carve/compare', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ hashes }),
    });
    return handleResponse(response);
  },
    // Analyze carved files for tampering (standalone)
  analyzeCarvedFiles: async (id, filenames) => {
    const response = await fetch(API_URL + '/disk-images/' + id + '/carve/analyze', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ filenames }),
    });
    return handleResponse(response);
  },

  // Add carved file to evidence
  addCarvedToEvidence: async (id, filename, caseId, description, tags) => {
    const response = await fetch(API_URL + '/disk-images/' + id + '/carve/add-to-evidence', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ filename, caseId, description, tags }),
    });
    return handleResponse(response);
  },
};