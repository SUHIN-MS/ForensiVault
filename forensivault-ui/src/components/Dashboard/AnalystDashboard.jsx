import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { statsAPI, casesAPI, evidenceAPI } from '../../services/api';
import StatCard from '../Common/StatCard';
import QuickActions from '../Common/QuickActions';
import StatusBadge from '../Common/StatusBadge';
import Modal from '../Common/Modal';
import CaseForm from '../Cases/CaseForm';
import EvidenceUpload from '../Evidence/EvidenceUpload';
import LoadingSpinner from '../Common/LoadingSpinner';
import './Dashboard.css';

const AnalystDashboard = () => {
  const [stats, setStats] = useState(null);
  const [pendingVerification, setPendingVerification] = useState([]);
  const [recentCases, setRecentCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsData, pendingData, casesData] = await Promise.all([
        statsAPI.get(),
        evidenceAPI.getAll({ status: 'pending', limit: 5 }),
        casesAPI.getAll({ limit: 5 }),
      ]);

      setStats(statsData);
      setPendingVerification(pendingData.evidence || []);
      setRecentCases(casesData.cases || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action) => {
    if (action === 'new-case') {
      setShowCaseModal(true);
    } else if (action === 'upload-evidence') {
      setShowUploadModal(true);
    }
  };

  const handleCaseCreated = () => {
    setShowCaseModal(false);
    fetchData();
  };

  const handleEvidenceUploaded = () => {
    setShowUploadModal(false);
    fetchData();
  };

  const handleVerify = async (evidenceId) => {
    try {
      const result = await evidenceAPI.verify(evidenceId);
      alert(result.message);
      fetchData();
    } catch (err) {
      alert('Verification failed: ' + err.message);
    }
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

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading dashboard..." />;
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Analyst Dashboard</h1>
          <p>Verify evidence and generate reports</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard
          title="Total Evidence"
          value={stats?.evidence?.total || 0}
          icon="fa-file-shield"
          color="primary"
        />
        <StatCard
          title="Pending Verification"
          value={stats?.evidence?.pending || 0}
          icon="fa-clock"
          color="warning"
        />
        <StatCard
          title="Verified"
          value={stats?.evidence?.verified || 0}
          icon="fa-check-circle"
          color="success"
        />
        <StatCard
          title="Tampered"
          value={stats?.evidence?.tampered || 0}
          icon="fa-exclamation-triangle"
          color="danger"
        />
      </div>

      {/* Quick Actions */}
      <QuickActions onAction={handleQuickAction} />

      {/* Pending Verification */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2>Pending Verification</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/evidence?status=pending')}>
            View All <i className="fas fa-arrow-right"></i>
          </button>
        </div>

        <div className="recent-items">
          <div className="recent-items-body">
            {pendingVerification.length > 0 ? (
              pendingVerification.map((evidence) => (
                <div key={evidence._id} className="recent-item">
                  <div className="recent-item-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning-color)' }}>
                    <i className={`fas ${getFileIcon(evidence.fileType)}`}></i>
                  </div>
                  <div className="recent-item-content">
                    <div className="recent-item-title">{evidence.originalName}</div>
                    <div className="recent-item-meta">
                      {evidence.caseId?.caseNumber || 'No case'} • {formatTimeAgo(evidence.uploadedAt)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVerify(evidence._id);
                      }}
                    >
                      <i className="fas fa-check"></i> Verify
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/evidence/${evidence._id}`);
                      }}
                    >
                      <i className="fas fa-eye"></i> View
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="fas fa-check-circle"></i>
                </div>
                <h3>All caught up!</h3>
                <p>No evidence pending verification</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Cases */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2>Recent Cases</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/cases')}>
            View All <i className="fas fa-arrow-right"></i>
          </button>
        </div>

        <div className="recent-items">
          <div className="recent-items-body">
            {recentCases.length > 0 ? (
              recentCases.map((caseItem) => (
                <div
                  key={caseItem._id}
                  className="recent-item"
                  onClick={() => navigate(`/cases/${caseItem._id}`)}
                >
                  <div className="recent-item-icon" style={{ background: 'var(--info-bg)', color: 'var(--info-color)' }}>
                    <i className="fas fa-folder"></i>
                  </div>
                  <div className="recent-item-content">
                    <div className="recent-item-title">{caseItem.title}</div>
                    <div className="recent-item-meta">
                      {caseItem.caseNumber} • {caseItem.evidenceFiles?.length || 0} files
                    </div>
                  </div>
                  <StatusBadge status={caseItem.status} size="sm" />
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="fas fa-folder-open"></i>
                </div>
                <h3>No cases yet</h3>
                <p>Create a case to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <Modal isOpen={showCaseModal} onClose={() => setShowCaseModal(false)} title="Create New Case" size="md">
        <CaseForm onSuccess={handleCaseCreated} onCancel={() => setShowCaseModal(false)} />
      </Modal>

      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Evidence" size="md">
        <EvidenceUpload onSuccess={handleEvidenceUploaded} onCancel={() => setShowUploadModal(false)} />
      </Modal>
    </div>
  );
};

export default AnalystDashboard;