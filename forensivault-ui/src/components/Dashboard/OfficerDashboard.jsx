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

const OfficerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentCases, setRecentCases] = useState([]);
  const [recentEvidence, setRecentEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsData, casesData, evidenceData] = await Promise.all([
        statsAPI.get(),
        casesAPI.getAll({ limit: 5 }),
        evidenceAPI.getAll({ limit: 5 }),
      ]);

      setStats(statsData);
      setRecentCases(casesData.cases || []);
      setRecentEvidence(evidenceData.evidence || []);
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
          <h1>Officer Dashboard</h1>
          <p>Manage cases and upload evidence</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard
          title="Total Cases"
          value={stats?.cases?.total || 0}
          icon="fa-folder-open"
          color="primary"
        />
        <StatCard
          title="Open Cases"
          value={stats?.cases?.open || 0}
          icon="fa-folder"
          color="warning"
        />
        <StatCard
          title="Total Evidence"
          value={stats?.evidence?.total || 0}
          icon="fa-file-shield"
          color="info"
        />
        <StatCard
          title="Pending Verification"
          value={stats?.evidence?.pending || 0}
          icon="fa-clock"
          color="danger"
        />
      </div>

      {/* Quick Actions */}
      <QuickActions onAction={handleQuickAction} />

      {/* Recent Items Grid */}
      <div className="dashboard-grid">
        {/* Recent Cases */}
        <div className="recent-items">
          <div className="recent-items-header">
            <h3>Recent Cases</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/cases')}>
              View All <i className="fas fa-arrow-right"></i>
            </button>
          </div>
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
                    <div className="recent-item-meta">{caseItem.caseNumber}</div>
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
                <p>Create your first case to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Evidence */}
        <div className="recent-items">
          <div className="recent-items-header">
            <h3>Recent Evidence</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/evidence')}>
              View All <i className="fas fa-arrow-right"></i>
            </button>
          </div>
          <div className="recent-items-body">
            {recentEvidence.length > 0 ? (
              recentEvidence.map((evidence) => (
                <div
                  key={evidence._id}
                  className="recent-item"
                  onClick={() => navigate(`/evidence/${evidence._id}`)}
                >
                  <div className="recent-item-icon" style={{ background: 'rgba(102, 126, 234, 0.15)', color: 'var(--primary-color)' }}>
                    <i className={`fas ${getFileIcon(evidence.fileType)}`}></i>
                  </div>
                  <div className="recent-item-content">
                    <div className="recent-item-title">{evidence.originalName}</div>
                    <div className="recent-item-meta">{formatTimeAgo(evidence.uploadedAt)}</div>
                  </div>
                  <StatusBadge status={evidence.status} size="sm" />
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="fas fa-file-shield"></i>
                </div>
                <h3>No evidence yet</h3>
                <p>Upload your first evidence file</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Case Modal */}
      <Modal
        isOpen={showCaseModal}
        onClose={() => setShowCaseModal(false)}
        title="Create New Case"
        size="md"
      >
        <CaseForm onSuccess={handleCaseCreated} onCancel={() => setShowCaseModal(false)} />
      </Modal>

      {/* Upload Evidence Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Evidence"
        size="md"
      >
        <EvidenceUpload onSuccess={handleEvidenceUploaded} onCancel={() => setShowUploadModal(false)} />
      </Modal>
    </div>
  );
};

export default OfficerDashboard;