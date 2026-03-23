import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { evidenceAPI } from '../../services/api';
import StatusBadge from '../Common/StatusBadge';
import Modal from '../Common/Modal';
import EvidenceUpload from './EvidenceUpload';
import LoadingSpinner from '../Common/LoadingSpinner';
import './Evidence.css';

const EvidenceList = () => {
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ status: '', fileType: '', search: '' });
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('action') === 'upload') {
      setShowModal(true);
    }
    if (searchParams.get('status')) {
      setFilters((prev) => ({ ...prev, status: searchParams.get('status') }));
    }
  }, [searchParams]);

  useEffect(() => {
    fetchEvidence();
  }, [pagination.page, filters]);

  const fetchEvidence = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: 12,
        ...(filters.status && { status: filters.status }),
        ...(filters.fileType && { fileType: filters.fileType }),
        ...(filters.search && { search: filters.search }),
      };

      const data = await evidenceAPI.getAll(params);
      setEvidence(data.evidence || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      console.error('Error fetching evidence:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleEvidenceClick = (evidenceId) => {
    navigate(`/evidence/${evidenceId}`);
  };

  const handleUploadSuccess = () => {
    setShowModal(false);
    fetchEvidence();
  };

  const getFileIcon = (fileType) => {
    const icons = {
      document: 'fa-file-alt',
      image: 'fa-image',
      video: 'fa-video',
      audio: 'fa-music',
      other: 'fa-file',
    };
    return icons[fileType] || 'fa-file';
  };

  const getPreviewColor = (fileType) => {
    const colors = {
      document: 'var(--info-color)',
      image: 'var(--success-color)',
      video: 'var(--danger-color)',
      audio: 'var(--warning-color)',
      other: 'var(--text-muted)',
    };
    return colors[fileType] || 'var(--text-muted)';
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="evidence-page">
      {/* Header */}
      <div className="page-header">
        <h1>Evidence Files</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <i className="fas fa-upload"></i> Upload Evidence
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Status:</label>
          <select
            className="filter-select"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="tampered">Tampered</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Type:</label>
          <select
            className="filter-select"
            value={filters.fileType}
            onChange={(e) => handleFilterChange('fileType', e.target.value)}
          >
            <option value="">All</option>
            <option value="document">Document</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="search-wrapper">
          <i className="fas fa-search"></i>
          <input
            type="text"
            className="search-input-small"
            placeholder="Search files..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>
      </div>

      {/* Evidence Grid */}
      {loading ? (
        <LoadingSpinner text="Loading evidence..." />
      ) : evidence.length > 0 ? (
        <>
          <div className="evidence-grid">
            {evidence.map((item) => (
              <div
                key={item._id}
                className="evidence-card"
                onClick={() => handleEvidenceClick(item._id)}
              >
                <div
                  className="evidence-card-preview"
                  style={{ color: getPreviewColor(item.fileType) }}
                >
                  <i className={`fas ${getFileIcon(item.fileType)}`}></i>
                </div>

                <div className="evidence-card-body">
                  <div className="evidence-card-header">
                    <span className="evidence-card-name">{item.originalName}</span>
                  </div>

                  <div className="evidence-card-meta">
                    <span>
                      <i className="fas fa-hdd"></i>
                      {formatSize(item.size)}
                    </span>
                    <span>
                      <i className="fas fa-calendar"></i>
                      {formatDate(item.uploadedAt)}
                    </span>
                    {item.caseId && (
                      <span>
                        <i className="fas fa-folder"></i>
                        {item.caseId.caseNumber}
                      </span>
                    )}
                  </div>

                  <div className="evidence-card-footer">
                    <StatusBadge status={item.status} size="sm" />
                    <StatusBadge status={item.fileType} size="sm" />
                  </div>
                </div>
              </div>
            ))}
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
            <i className="fas fa-file-shield"></i>
          </div>
          <h3>No evidence found</h3>
          <p>Upload evidence or adjust your filters</p>
          <button className="btn btn-primary mt-4" onClick={() => setShowModal(true)}>
            <i className="fas fa-upload"></i> Upload First Evidence
          </button>
        </div>
      )}

      {/* Upload Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Upload Evidence" size="md">
        <EvidenceUpload onSuccess={handleUploadSuccess} onCancel={() => setShowModal(false)} />
      </Modal>
    </div>
  );
};

export default EvidenceList;