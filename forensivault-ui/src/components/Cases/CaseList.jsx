import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { casesAPI } from '../../services/api';
import StatusBadge from '../Common/StatusBadge';
import Modal from '../Common/Modal';
import CaseForm from './CaseForm';
import LoadingSpinner from '../Common/LoadingSpinner';
import './Cases.css';

const CaseList = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchCases();
  }, [pagination.page, filters]);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: 12,
        ...(filters.status && { status: filters.status }),
        ...(filters.priority && { priority: filters.priority }),
        ...(filters.search && { search: filters.search }),
      };

      const data = await casesAPI.getAll(params);
      setCases(data.cases || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      console.error('Error fetching cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleCaseClick = (caseId) => {
    navigate(`/cases/${caseId}`);
  };

  const handleCaseCreated = () => {
    setShowModal(false);
    fetchCases();
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getPriorityIcon = (priority) => {
    const icons = {
      low: 'fa-arrow-down',
      medium: 'fa-minus',
      high: 'fa-arrow-up',
      critical: 'fa-exclamation',
    };
    return icons[priority] || 'fa-minus';
  };

  return (
    <div className="cases-page">
      {/* Header */}
      <div className="page-header">
        <h1>Cases</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <i className="fas fa-plus"></i> New Case
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
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Priority:</label>
          <select
            className="filter-select"
            value={filters.priority}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
          >
            <option value="">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className="search-wrapper">
          <i className="fas fa-search"></i>
          <input
            type="text"
            className="search-input-small"
            placeholder="Search cases..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>
      </div>

      {/* Cases Grid */}
      {loading ? (
        <LoadingSpinner text="Loading cases..." />
      ) : cases.length > 0 ? (
        <>
          <div className="cases-grid">
            {cases.map((caseItem) => (
              <div
                key={caseItem._id}
                className="case-card"
                onClick={() => handleCaseClick(caseItem._id)}
              >
                <div className="case-card-header">
                  <span className="case-number">{caseItem.caseNumber}</span>
                  <StatusBadge status={caseItem.status} size="sm" />
                </div>

                <h3 className="case-card-title">{caseItem.title}</h3>
                <p className="case-card-desc">
                  {caseItem.description || 'No description provided'}
                </p>

                <div className="case-card-meta">
                  <span>
                    <i className="fas fa-file"></i>
                    {caseItem.evidenceFiles?.length || 0} files
                  </span>
                  <span>
                    <i className="fas fa-calendar"></i>
                    {formatDate(caseItem.createdAt)}
                  </span>
                </div>

                <div className="case-card-footer">
                  <span className={`case-priority priority-${caseItem.priority}`}>
                    <i className={`fas ${getPriorityIcon(caseItem.priority)}`}></i>
                    {caseItem.priority}
                  </span>
                  <span className="text-muted text-sm">
                    by {caseItem.createdBy?.fullName || caseItem.createdBy?.username || 'Unknown'}
                  </span>
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

              {[...Array(pagination.pages)].map((_, i) => (
                <button
                  key={i + 1}
                  className={`pagination-btn ${pagination.page === i + 1 ? 'active' : ''}`}
                  onClick={() => setPagination((prev) => ({ ...prev, page: i + 1 }))}
                >
                  {i + 1}
                </button>
              ))}

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
            <i className="fas fa-folder-open"></i>
          </div>
          <h3>No cases found</h3>
          <p>Create a new case or adjust your filters</p>
          <button className="btn btn-primary mt-4" onClick={() => setShowModal(true)}>
            <i className="fas fa-plus"></i> Create First Case
          </button>
        </div>
      )}

      {/* Create Case Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Create New Case"
        size="md"
      >
        <CaseForm onSuccess={handleCaseCreated} onCancel={() => setShowModal(false)} />
      </Modal>
    </div>
  );
};

export default CaseList;