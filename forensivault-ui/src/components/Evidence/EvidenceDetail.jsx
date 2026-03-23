// ═══════════════════════════════════════════════════════════════════════════
// FILE: forensivault-ui/src/components/Evidence/EvidenceDetail.jsx
// PURPOSE: Display evidence details with complete tampering detection UI
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { evidenceAPI, reportsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../Common/StatusBadge';
import LoadingSpinner from '../Common/LoadingSpinner';
import './Evidence.css';

const EvidenceDetail = ({ evidenceId }) => {
  const [evidence, setEvidence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvidence();
  }, [evidenceId]);

  const fetchEvidence = async () => {
    try {
      setLoading(true);
      const data = await evidenceAPI.getById(evidenceId);
      setEvidence(data);
    } catch (err) {
      console.error('Error fetching evidence:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerificationResult(null);

    try {
      const result = await evidenceAPI.verify(evidenceId);
      setVerificationResult(result);
      // Refresh evidence data to get updated status and tampering history
      await fetchEvidence();
    } catch (err) {
      alert('Verification failed: ' + err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleGenerateReport = async () => {
    setDownloadingReport(true);
    try {
      await reportsAPI.getEvidenceReport(evidenceId);
    } catch (err) {
      alert('Failed to generate report: ' + err.message);
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleDownloadTamperingReport = async () => {
    setDownloadingReport(true);
    try {
      await reportsAPI.getTamperingReport(evidenceId);
    } catch (err) {
      alert('Failed to generate tampering report: ' + err.message);
    } finally {
      setDownloadingReport(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

  const getSeverityColor = (severity) => {
    const colors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      critical: '#dc2626',
    };
    return colors[severity] || '#6b7280';
  };

  const getSeverityClass = (severity) => {
    return 'severity-' + (severity || 'medium');
  };

  const canVerify = user && (user.role === 'admin' || user.role === 'analyst');
  const canGenerateReport = user && (user.role === 'admin' || user.role === 'analyst');

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading evidence..." />;
  }

  if (!evidence) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <i className="fas fa-exclamation-triangle"></i>
        </div>
        <h3>Evidence not found</h3>
        <p>The requested evidence file could not be found.</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/evidence')}>
          <i className="fas fa-arrow-left"></i> Back to Evidence
        </button>
      </div>
    );
  }

  return (
    <div className="evidence-detail">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER SECTION
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="evidence-detail-header">
        <div className="evidence-detail-info">
          <button className="btn btn-ghost btn-sm mb-2" onClick={() => navigate('/evidence')}>
            <i className="fas fa-arrow-left"></i> Back to Evidence
          </button>
          <h1>
            <i className={`fas ${getFileIcon(evidence.fileType)} mr-2`}></i>
            {evidence.originalName}
          </h1>
          <div className="case-detail-meta">
            <StatusBadge status={evidence.status} />
            <StatusBadge status={evidence.fileType} />
            <span className="text-muted text-sm">
              {formatSize(evidence.size)}
            </span>
          </div>
        </div>

        <div className="evidence-detail-actions">
          {canVerify && (
            <button
              className="btn btn-success"
              onClick={handleVerify}
              disabled={verifying}
            >
              {verifying ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Verifying...
                </>
              ) : (
                <>
                  <i className="fas fa-check-double"></i>
                  Verify Integrity
                </>
              )}
            </button>
          )}
          {canGenerateReport && (
            <button 
              className="btn btn-primary" 
              onClick={handleGenerateReport}
              disabled={downloadingReport}
            >
              {downloadingReport ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Generating...
                </>
              ) : (
                <>
                  <i className="fas fa-file-pdf"></i>
                  Download Report
                </>
              )}
            </button>
          )}
          {/* Show tampering report button if evidence is tampered */}
          {canGenerateReport && evidence.status === 'tampered' && (
            <button 
              className="btn btn-danger" 
              onClick={handleDownloadTamperingReport}
              disabled={downloadingReport}
            >
              <i className="fas fa-exclamation-triangle"></i>
              Tampering Report
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          VERIFICATION RESULT
          ═══════════════════════════════════════════════════════════════════ */}
      {verificationResult && (
        <div className={`verification-result ${verificationResult.verified ? 'success' : 'danger'}`}>
          <h4>
            <i className={`fas fa-${verificationResult.verified ? 'check-circle' : 'exclamation-triangle'}`}></i>
            {verificationResult.verified ? 'Verification Passed' : 'TAMPERING DETECTED'}
          </h4>
          <p>{verificationResult.message}</p>

          {/* ═══════════════════════════════════════════════════════════════
              TAMPERING DETAILS DISPLAY
              ═══════════════════════════════════════════════════════════════ */}
          {!verificationResult.verified && verificationResult.tampering && (
            <div className="tampering-details">
              {/* Header with severity and timestamp */}
              <div className="tampering-header">
                <span 
                  className={`severity-badge ${getSeverityClass(verificationResult.tampering.severity)}`}
                  style={{ backgroundColor: getSeverityColor(verificationResult.tampering.severity) }}
                >
                  {(verificationResult.tampering.severity || 'unknown').toUpperCase()} SEVERITY
                </span>
                <span className="tampering-time">
                  <i className="fas fa-clock"></i> Detected: {formatDate(verificationResult.tampering.detectedAt)}
                </span>
              </div>

              {/* Summary */}
              <div className="tampering-summary">
                <i className="fas fa-info-circle"></i>
                <span>
                  <strong>Summary:</strong> {verificationResult.tampering.summary || 'File content has been modified'}
                </span>
              </div>

              {/* Statistics */}
              {verificationResult.tampering.statistics && (
                <div className="tampering-stats">
                  <div className="stat-item">
                    <span className="stat-label">Lines Added</span>
                    <span className="stat-value added">
                      +{verificationResult.tampering.statistics.linesAdded || 0}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Lines Removed</span>
                    <span className="stat-value removed">
                      -{verificationResult.tampering.statistics.linesRemoved || 0}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Lines Modified</span>
                    <span className="stat-value modified">
                      ~{verificationResult.tampering.statistics.linesModified || 0}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Changed</span>
                    <span className="stat-value">
                      {verificationResult.tampering.statistics.percentageChanged || 0}%
                    </span>
                  </div>
                </div>
              )}

              {/* Detailed Changes */}
              {verificationResult.tampering.details && verificationResult.tampering.details.length > 0 && (
                <div className="tampering-changes">
                  <h5>
                    <i className="fas fa-code-compare"></i>
                    Detected Changes ({verificationResult.tampering.details.length})
                  </h5>
                  <div className="changes-list">
                    {verificationResult.tampering.details.map((change, index) => (
                      <div key={index} className={`change-item change-${change.changeType}`}>
                        <div className="change-header">
                          <span className="change-field">{change.field}</span>
                          <span className={`change-type ${change.changeType}`}>
                            {change.changeType === 'added' && <i className="fas fa-plus"></i>}
                            {change.changeType === 'removed' && <i className="fas fa-minus"></i>}
                            {change.changeType === 'modified' && <i className="fas fa-edit"></i>}
                            {(change.changeType || 'unknown').toUpperCase()}
                          </span>
                        </div>
                        <div className="change-content">
                          {change.changeType !== 'added' && change.original && (
                            <div className="original">
                              <span className="label">Original:</span>
                              <code>{change.original}</code>
                            </div>
                          )}
                          {change.changeType !== 'removed' && change.current && (
                            <div className="current">
                              <span className="label">Current:</span>
                              <code>{change.current}</code>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hash Comparison */}
              <div className="hash-comparison">
                <h5><i className="fas fa-fingerprint"></i> Hash Comparison</h5>
                <div className="hash-row">
                  <span className="hash-label">Original (Stored):</span>
                  <code className="hash-value">{verificationResult.storedHash}</code>
                </div>
                <div className="hash-row">
                  <span className="hash-label">Current (Computed):</span>
                  <code className="hash-value mismatch">{verificationResult.computedHash}</code>
                </div>
              </div>

              {/* Detected By */}
              {verificationResult.tampering.detectedBy && (
                <div className="incident-detected-by" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <i className="fas fa-user-shield"></i>
                  <span>Detected by: <strong>{verificationResult.tampering.detectedBy}</strong></span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          FILE INFORMATION SECTION
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="detail-section">
        <div className="detail-section-header">
          <h3><i className="fas fa-info-circle"></i> File Information</h3>
        </div>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Uploaded By</span>
            <span className="detail-value">
              {evidence.uploader?.fullName || evidence.uploader?.username || 'Unknown'}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Uploaded At</span>
            <span className="detail-value">{formatDate(evidence.uploadedAt)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">File Size</span>
            <span className="detail-value">{formatSize(evidence.size)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">MIME Type</span>
            <span className="detail-value">{evidence.mimeType || 'Unknown'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Verification Count</span>
            <span className="detail-value">{evidence.verificationCount || 0}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Status</span>
            <StatusBadge status={evidence.status} />
          </div>
          {evidence.lastVerifiedAt && (
            <>
              <div className="detail-item">
                <span className="detail-label">Last Verified</span>
                <span className="detail-value">{formatDate(evidence.lastVerifiedAt)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Verified By</span>
                <span className="detail-value">
                  {evidence.lastVerifiedBy?.fullName || evidence.lastVerifiedBy?.username || 'Unknown'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Case Assignment */}
        {evidence.caseId && (
          <div className="detail-item mt-4">
            <span className="detail-label">Assigned Case</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="case-number" style={{ 
                background: 'var(--primary-color)', 
                color: 'white', 
                padding: '0.25rem 0.5rem', 
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}>
                {evidence.caseId.caseNumber}
              </span>
              <span className="detail-value">{evidence.caseId.title}</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate(`/cases/${evidence.caseId._id}`)}
              >
                <i className="fas fa-external-link-alt"></i> View Case
              </button>
            </div>
          </div>
        )}

        {/* Description */}
        {evidence.description && (
          <div className="detail-item mt-4">
            <span className="detail-label">Description</span>
            <span className="detail-value">{evidence.description}</span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          DIGITAL FINGERPRINT SECTION
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="detail-section">
        <div className="detail-section-header">
          <h3><i className="fas fa-fingerprint"></i> Digital Fingerprint</h3>
        </div>
        <div className="detail-item">
          <span className="detail-label">SHA-256 Hash</span>
          <div className="hash-display">{evidence.sha256}</div>
        </div>
        <p className="text-muted text-sm mt-2">
          <i className="fas fa-shield-alt"></i> This cryptographic hash uniquely identifies the file. 
          Any modification to the file content will result in a completely different hash value, 
          enabling tamper detection.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAMPERING HISTORY SECTION
          ═══════════════════════════════════════════════════════════════════ */}
      {evidence.tamperingHistory && evidence.tamperingHistory.length > 0 && (
        <div className="detail-section tampering-history-section">
          <div className="detail-section-header">
            <h3>
              <i className="fas fa-exclamation-triangle" style={{ color: 'var(--danger-color)' }}></i>
              Tampering History ({evidence.tamperingHistory.length} incident{evidence.tamperingHistory.length > 1 ? 's' : ''})
            </h3>
          </div>
          <div className="tampering-history-list">
            {evidence.tamperingHistory.map((incident, index) => (
              <div key={index} className="tampering-incident">
                <div className="incident-header">
                  <span 
                    className={`severity-badge ${getSeverityClass(incident.severity)}`}
                    style={{ backgroundColor: getSeverityColor(incident.severity) }}
                  >
                    {(incident.severity || 'unknown').toUpperCase()}
                  </span>
                  <span className="incident-date">
                    <i className="fas fa-calendar-alt"></i> {formatDate(incident.detectedAt)}
                  </span>
                </div>
                <div className="incident-summary">
                  {incident.differences?.summary || 'Content was modified'}
                </div>
                {incident.differences?.percentageChanged !== undefined && (
                  <div className="text-sm text-muted mt-2">
                    <i className="fas fa-chart-pie"></i> {incident.differences.percentageChanged}% of content changed
                  </div>
                )}
                {incident.detectedBy && (
                  <div className="incident-detected-by">
                    <i className="fas fa-user"></i>
                    Detected by: {incident.detectedBy.fullName || incident.detectedBy.username || 'Unknown'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAGS SECTION
          ═══════════════════════════════════════════════════════════════════ */}
      {evidence.tags && evidence.tags.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-header">
            <h3><i className="fas fa-tags"></i> Tags</h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            {evidence.tags.map((tag, i) => (
              <span key={i} className="status-badge status-secondary">
                <i className="fas fa-tag"></i> {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceDetail;