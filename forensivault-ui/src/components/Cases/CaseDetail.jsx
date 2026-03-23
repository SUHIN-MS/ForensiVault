import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesAPI, reportsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../Common/StatusBadge';
import Modal from '../Common/Modal';
import CaseForm from './CaseForm';
import EvidenceUpload from '../Evidence/EvidenceUpload';
import LoadingSpinner from '../Common/LoadingSpinner';
import './Cases.css';

const CaseDetail = ({ caseId }) => {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCase();
  }, [caseId]);

  const fetchCase = async () => {
    try {
      const data = await casesAPI.getById(caseId);
      setCaseData(data);
    } catch (err) {
      console.error('Error fetching case:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseCase = async () => {
    if (!window.confirm('Are you sure you want to close this case?')) return;

    try {
      await casesAPI.close(caseId);
      fetchCase();
    } catch (err) {
      alert('Error closing case: ' + err.message);
    }
  };

  const handleGenerateReport = async () => {
  await reportsAPI.getCaseReport(caseId);
};

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading case..." />;
  }

  if (!caseData) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <i className="fas fa-exclamation-triangle"></i>
        </div>
        <h3>Case not found</h3>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/cases')}>
          Back to Cases
        </button>
      </div>
    );
  }

  return (
    <div className="case-detail">
      {/* Header */}
      <div className="case-detail-header">
        <div className="case-detail-info">
          <button className="btn btn-ghost btn-sm mb-2" onClick={() => navigate('/cases')}>
            <i className="fas fa-arrow-left"></i> Back to Cases
          </button>
          <h1>{caseData.title}</h1>
          <div className="case-detail-meta">
            <span className="case-number">{caseData.caseNumber}</span>
            <StatusBadge status={caseData.status} />
            <StatusBadge status={caseData.priority} />
          </div>
        </div>

        <div className="case-detail-actions">
          {(user.role === 'admin' || user.role === 'analyst') && (
            <>
              <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}>
                <i className="fas fa-edit"></i> Edit
              </button>
              <button className="btn btn-primary" onClick={handleGenerateReport}>
                <i className="fas fa-file-pdf"></i> Report
              </button>
              {caseData.status !== 'closed' && (
                <button className="btn btn-warning" onClick={handleCloseCase}>
                  <i className="fas fa-lock"></i> Close Case
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Case Info */}
      <div className="detail-section">
        <div className="detail-section-header">
          <h3>Case Information</h3>
        </div>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Created By</span>
            <span className="detail-value">
              {caseData.createdBy?.fullName || caseData.createdBy?.username || 'Unknown'}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Created At</span>
            <span className="detail-value">{formatDate(caseData.createdAt)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Last Updated</span>
            <span className="detail-value">{formatDate(caseData.updatedAt)}</span>
          </div>
          {caseData.closedAt && (
            <div className="detail-item">
              <span className="detail-label">Closed At</span>
              <span className="detail-value">{formatDate(caseData.closedAt)}</span>
            </div>
          )}
        </div>

        {caseData.description && (
          <div className="detail-item mt-4">
            <span className="detail-label">Description</span>
            <span className="detail-value">{caseData.description}</span>
          </div>
        )}

        {caseData.tags?.length > 0 && (
          <div className="detail-item mt-4">
            <span className="detail-label">Tags</span>
            <div className="flex gap-2 flex-wrap mt-1">
              {caseData.tags.map((tag, i) => (
                <span key={i} className="status-badge status-secondary">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Evidence Files */}
      <div className="detail-section">
        <div className="detail-section-header">
          <h3>Evidence Files ({caseData.evidenceFiles?.length || 0})</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowUploadModal(true)}>
            <i className="fas fa-upload"></i> Upload
          </button>
        </div>

        {caseData.evidenceFiles?.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {caseData.evidenceFiles.map((evidence) => (
                  <tr key={evidence._id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <i className={`fas ${getFileIcon(evidence.fileType)} text-muted`}></i>
                        <span className="truncate" style={{ maxWidth: '200px' }}>
                          {evidence.originalName}
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={evidence.fileType} size="sm" />
                    </td>
                    <td>
                      <StatusBadge status={evidence.status} size="sm" />
                    </td>
                    <td>{formatDate(evidence.uploadedAt)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/evidence/${evidence._id}`)}
                      >
                        <i className="fas fa-eye"></i> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <i className="fas fa-file-shield"></i>
            </div>
            <h3>No evidence files</h3>
            <p>Upload evidence files to this case</p>
          </div>
        )}
      </div>

      {/* Assigned Users */}
      {caseData.assignedTo?.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-header">
            <h3>Assigned Team ({caseData.assignedTo.length})</h3>
          </div>
          <div className="flex gap-3 flex-wrap">
            {caseData.assignedTo.map((user) => (
              <div key={user._id} className="flex items-center gap-2 p-2 bg-tertiary rounded-md">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm">
                  <i className="fas fa-user"></i>
                </div>
                <div>
                  <div className="text-sm font-medium">{user.fullName || user.username}</div>
                  <div className="text-xs text-muted">{user.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Case" size="md">
        <CaseForm
          caseData={caseData}
          onSuccess={() => {
            setShowEditModal(false);
            fetchCase();
          }}
          onCancel={() => setShowEditModal(false)}
        />
      </Modal>

      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Evidence" size="md">
        <EvidenceUpload
          caseId={caseId}
          onSuccess={() => {
            setShowUploadModal(false);
            fetchCase();
          }}
          onCancel={() => setShowUploadModal(false)}
        />
      </Modal>
    </div>
  );
};

export default CaseDetail;