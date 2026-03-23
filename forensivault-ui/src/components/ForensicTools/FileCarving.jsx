import React, { useState, useEffect } from 'react';
import { diskImageAPI, casesAPI } from '../../services/api';

const FILE_TYPE_OPTIONS = [
  { value: 'images', label: 'Images', icon: 'fa-image', color: '#16a34a' },
  { value: 'documents', label: 'Documents', icon: 'fa-file-pdf', color: '#2563eb' },
  { value: 'archives', label: 'Archives', icon: 'fa-file-archive', color: '#d97706' },
  { value: 'audio', label: 'Audio', icon: 'fa-music', color: '#9333ea' },
  { value: 'videos', label: 'Videos', icon: 'fa-video', color: '#db2777' },
  { value: 'executables', label: 'Executables', icon: 'fa-cog', color: '#dc2626' },
];

const FileCarving = ({ diskImage, onBack }) => {
  const [step, setStep] = useState('options');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [results, setResults] = useState([]);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [expandedFile, setExpandedFile] = useState(null);

  // Add to case modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingFile, setAddingFile] = useState(null);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addingToEvidence, setAddingToEvidence] = useState(false);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      const resp = await casesAPI.getAll({ limit: 100 });
      setCases(resp.cases || []);
    } catch (e) {
      console.error('Error loading cases:', e);
    }
  };

  const toggleType = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const startCarving = async () => {
    setError('');
    setStep('carving');
    setProgress(0);
    setStatusText('Starting carver...');

    try {
      await diskImageAPI.startCarving(diskImage._id, selectedTypes.length > 0 ? selectedTypes : null);

      const poll = setInterval(async () => {
        try {
          const resp = await diskImageAPI.getCarvingStatus(diskImage._id);
          const d = resp.data || resp;
          setProgress(d.progress || 0);
          setStatusText(
            d.status === 'scanning' ? `Scanning disk image... ${d.progress}%` :
            d.status === 'extracting' ? `Extracting files... ${d.progress}%` :
            d.status === 'complete' ? 'Carving complete!' :
            d.status === 'error' ? `Error: ${d.error}` : 'Processing...'
          );
          if (d.status === 'complete') { clearInterval(poll); await loadResults(); }
          else if (d.status === 'error') { clearInterval(poll); setError(d.error || 'Failed'); setStep('options'); }
        } catch (e) { clearInterval(poll); setError(e.message); setStep('options'); }
      }, 2000);
    } catch (e) { setError(e.message); setStep('options'); }
  };

  const loadResults = async () => {
    try {
      const resp = await diskImageAPI.getCarvingResults(diskImage._id);
      setResults(resp.data?.results || resp.results || []);
      setStep('results');
    } catch (e) { setError(e.message); }
  };

  const runAnalysis = async () => {
    if (results.length === 0) return;
    setAnalyzing(true);
    try {
      const filenames = results.map((r) => r.filename);
      const resp = await diskImageAPI.analyzeCarvedFiles(diskImage._id, filenames);
      setAnalysisResults(resp.data?.results || resp.results || []);
    } catch (e) { alert('Analysis failed: ' + e.message); }
    finally { setAnalyzing(false); }
  };

  const handleAddToEvidence = (file) => {
    setAddingFile(file);
    setAddDescription(`Carved from disk image: ${diskImage.originalName}`);
    setSelectedCase('');
    setShowAddModal(true);
  };

  const confirmAddToEvidence = async () => {
    if (!addingFile) return;
    setAddingToEvidence(true);
    try {
      await diskImageAPI.addCarvedToEvidence(
        diskImage._id,
        addingFile.filename,
        selectedCase || null,
        addDescription,
        ['carved', 'recovered', addingFile.isDeleted ? 'deleted-file' : 'active-file']
      );
      alert(`"${addingFile.filename}" added to evidence successfully!`);
      setShowAddModal(false);
      setAddingFile(null);
    } catch (e) { alert('Failed: ' + e.message); }
    finally { setAddingToEvidence(false); }
  };

  const getAnalysis = (filename) => {
    if (!analysisResults) return null;
    return analysisResults.find((a) => a.fileName === filename) || null;
  };

  const getCategoryIcon = (cat) => ({ images: 'fa-image', documents: 'fa-file-alt', archives: 'fa-file-archive', audio: 'fa-music', videos: 'fa-video', other: 'fa-file' }[cat] || 'fa-file');
  const getCategoryColor = (cat) => ({ images: '#16a34a', documents: '#2563eb', archives: '#d97706', audio: '#9333ea', videos: '#db2777', other: '#64748b' }[cat] || '#64748b');
  const getSeverityColor = (s) => ({ none: '#16a34a', low: '#84cc16', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' }[s] || '#94a3b8');
  const getSeverityBg = (s) => ({ none: '#dcfce7', low: '#ecfccb', medium: '#fef3c7', high: '#fee2e2', critical: '#fee2e2' }[s] || '#f1f5f9');

  return (
    <div className="file-carving">
      {/* Header */}
      <div className="carving-header">
        <button className="btn-back" onClick={onBack}><i className="fas fa-arrow-left"></i> Back</button>
        <div>
          <h2><i className="fas fa-cut" style={{ color: '#8b5cf6' }}></i> File Carving & Forensic Analysis</h2>
          <p className="carving-subtitle">{diskImage.originalName}</p>
        </div>
      </div>

      {error && (
        <div className="carving-error">
          <i className="fas fa-exclamation-circle"></i> {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Step 1: Options */}
      {step === 'options' && (
        <div className="carving-options">
          <div className="options-card">
            <h3><i className="fas fa-filter"></i> Select File Types to Recover</h3>
            <p style={{ color: '#64748b', marginBottom: 16 }}>Leave all unchecked to scan for every supported type.</p>
            <div className="type-grid">
              {FILE_TYPE_OPTIONS.map((t) => (
                <div key={t.value} className={`type-option ${selectedTypes.includes(t.value) ? 'selected' : ''}`} onClick={() => toggleType(t.value)}>
                  <i className={`fas ${t.icon}`} style={{ color: t.color }}></i>
                  <span>{t.label}</span>
                  {selectedTypes.includes(t.value) && <i className="fas fa-check-circle" style={{ color: '#8b5cf6' }}></i>}
                </div>
              ))}
            </div>
            <div className="disk-info-bar">
              <span><i className="fas fa-hdd"></i> {diskImage.originalName}</span>
              <span><i className="fas fa-database"></i> {diskImage.sizeFormatted || `${(diskImage.size / (1024 * 1024)).toFixed(1)} MB`}</span>
              <span><i className="fas fa-server"></i> {diskImage.fileSystem || 'RAW'}</span>
            </div>
            <button className="btn-start-carving" onClick={startCarving}><i className="fas fa-search"></i> Start File Carving</button>
          </div>
        </div>
      )}

      {/* Step 2: Progress */}
      {step === 'carving' && (
        <div className="carving-progress-section">
          <div className="progress-card">
            <div className="progress-icon"><i className="fas fa-cog fa-spin"></i></div>
            <h3>{statusText}</h3>
            <div className="progress-bar-wrapper">
              <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${progress}%` }}></div></div>
              <span className="progress-pct">{progress}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 'results' && (
        <div className="carving-results">
          {/* Summary */}
          <div className="results-summary">
            <div className="summary-stat">
              <span className="stat-number">{results.length}</span>
              <span className="stat-label">Files Carved</span>
            </div>
            {(() => {
              const cats = {};
              results.forEach((r) => { cats[r.category] = (cats[r.category] || 0) + 1; });
              return Object.entries(cats).map(([cat, cnt]) => (
                <div className="summary-stat" key={cat}>
                  <span className="stat-number">{cnt}</span>
                  <span className="stat-label" style={{ textTransform: 'capitalize' }}>{cat}</span>
                </div>
              ));
            })()}
            <div className="summary-stat">
              <span className="stat-number">{results.filter((r) => r.isDeleted).length}</span>
              <span className="stat-label">Deleted Files</span>
            </div>
            <button className="btn-compare" onClick={runAnalysis} disabled={analyzing || results.length === 0} style={{ background: '#dc2626' }}>
              {analyzing ? <><i className="fas fa-spinner fa-spin"></i> Analyzing...</> : <><i className="fas fa-shield-alt"></i> Analyze for Tampering</>}
            </button>
          </div>

          {/* Analysis summary banner */}
          {analysisResults && (
            <div className="tamper-summary-banner">
              <div className="tamper-stat" style={{ background: '#dcfce7', color: '#166534' }}>
                <i className="fas fa-check-circle"></i>
                <div>
                  <div className="tamper-stat-number">{analysisResults.filter((a) => a.overallSeverity === 'none').length}</div>
                  <div className="tamper-stat-label">Clean</div>
                </div>
              </div>
              <div className="tamper-stat" style={{ background: '#fef3c7', color: '#92400e' }}>
                <i className="fas fa-exclamation-circle"></i>
                <div>
                  <div className="tamper-stat-number">{analysisResults.filter((a) => ['low', 'medium'].includes(a.overallSeverity)).length}</div>
                  <div className="tamper-stat-label">Suspicious</div>
                </div>
              </div>
              <div className="tamper-stat" style={{ background: '#fee2e2', color: '#991b1b' }}>
                <i className="fas fa-exclamation-triangle"></i>
                <div>
                  <div className="tamper-stat-number">{analysisResults.filter((a) => ['high', 'critical'].includes(a.overallSeverity)).length}</div>
                  <div className="tamper-stat-label">Tampered</div>
                </div>
              </div>
            </div>
          )}

          {/* File cards */}
          {results.length === 0 ? (
            <div className="empty-state"><i className="fas fa-search"></i><h3>No Files Found</h3></div>
          ) : (
            <div className="carved-file-list">
              {results.map((file) => {
                const analysis = getAnalysis(file.filename);
                const isExpanded = expandedFile === file.filename;

                return (
                  <div key={file.index} className="carved-file-card-wrapper">
                    <div className="carved-file-card" onClick={() => setExpandedFile(isExpanded ? null : file.filename)} style={{ cursor: 'pointer' }}>
                      <div className="carved-file-icon" style={{ background: getCategoryColor(file.category) + '20', color: getCategoryColor(file.category) }}>
                        <i className={`fas ${getCategoryIcon(file.category)}`}></i>
                      </div>

                      <div className="carved-file-info">
                        <div className="carved-file-name">{file.filename}</div>
                        <div className="carved-file-meta">
                          <span><strong>{file.fileType}</strong></span>
                          <span>{file.sizeFormatted}</span>
                          <span>Offset: {file.offsetHex}</span>
                          {file.isDeleted && <span style={{ color: '#dc2626', fontWeight: 600 }}><i className="fas fa-trash-alt"></i> Deleted</span>}
                          {file.isDeleted === false && <span style={{ color: '#16a34a' }}><i className="fas fa-check"></i> Active</span>}
                        </div>
                        <div className="carved-file-hash">SHA-256: <code>{file.hashes?.sha256?.substring(0, 24)}...</code></div>
                      </div>

                      {/* Analysis badge */}
                      {analysis && !analysis.error && (
                        <div className="tamper-badge" style={{ background: getSeverityBg(analysis.overallSeverity), color: getSeverityColor(analysis.overallSeverity) }}>
                          <i className={`fas ${analysis.overallSeverity === 'none' ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {analysis.overallSeverity === 'none' ? 'Clean' : `${analysis.indicators?.length || 0} Issues (${analysis.overallSeverity})`}
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.8 }}>{analysis.tamperingLikelihood?.replace('_', ' ')}</div>
                          </div>
                        </div>
                      )}

                      {/* Add to case button */}
                      <button
                        className="btn-add-evidence"
                        style={{ flexShrink: 0, padding: '8px 12px', fontSize: 13 }}
                        onClick={(e) => { e.stopPropagation(); handleAddToEvidence(file); }}
                      >
                        <i className="fas fa-plus"></i> Add to Case
                      </button>
                    </div>

                    {/* Expanded analysis details */}
                    {isExpanded && analysis && !analysis.error && (
                      <div className="tamper-details-panel">
                        <h4><i className="fas fa-microscope"></i> Forensic Analysis Report</h4>

                        {/* File metadata */}
                        <div className="tamper-detail-grid">
                          <div className="tamper-detail-item">
                            <span className="detail-label">Detected Type</span>
                            <span className="detail-value">{analysis.detectedType?.name}</span>
                          </div>
                          <div className="tamper-detail-item">
                            <span className="detail-label">Integrity</span>
                            <span className="detail-value" style={{ color: analysis.structuralIntegrity === 'valid' ? '#16a34a' : '#dc2626', textTransform: 'uppercase' }}>
                              {analysis.structuralIntegrity}
                            </span>
                          </div>
                          <div className="tamper-detail-item">
                            <span className="detail-label">Entropy</span>
                            <span className="detail-value">{analysis.metadata?.entropy?.toFixed(2) || 'N/A'} / 8.0</span>
                          </div>
                          {analysis.metadata?.width && (
                            <div className="tamper-detail-item">
                              <span className="detail-label">Dimensions</span>
                              <span className="detail-value">{analysis.metadata.width} x {analysis.metadata.height}</span>
                            </div>
                          )}
                          {analysis.metadata?.revisionCount && (
                            <div className="tamper-detail-item">
                              <span className="detail-label">PDF Revisions</span>
                              <span className="detail-value">{analysis.metadata.revisionCount}</span>
                            </div>
                          )}
                          {analysis.metadata?.lineCount && (
                            <div className="tamper-detail-item">
                              <span className="detail-label">Lines</span>
                              <span className="detail-value">{analysis.metadata.lineCount}</span>
                            </div>
                          )}
                        </div>

                        {/* EXIF info */}
                        {analysis.metadata?.exif && Object.keys(analysis.metadata.exif).length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <h5 style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b' }}>EXIF Metadata</h5>
                            <div className="tamper-detail-grid">
                              {Object.entries(analysis.metadata.exif).map(([key, val]) => (
                                <div className="tamper-detail-item" key={key}>
                                  <span className="detail-label">{key}</span>
                                  <span className="detail-value">{String(val)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Summary */}
                        <div className="tamper-summary-text">
                          <i className="fas fa-info-circle"></i> {analysis.summary}
                        </div>

                        {/* Indicators list */}
                        {analysis.indicators && analysis.indicators.length > 0 && (
                          <div className="tamper-diff-list">
                            <h5>Tampering Indicators ({analysis.indicators.length}):</h5>
                            {analysis.indicators.map((ind, idx) => (
                              <div key={idx} className={`diff-item diff-${ind.severity === 'critical' || ind.severity === 'high' ? 'removed' : ind.severity === 'medium' ? 'modified' : 'added'}`}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <span className="diff-type">{ind.severity}</span>
                                  <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{ind.title}</span>
                                </div>
                                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{ind.detail}</div>
                                <div style={{ color: '#fbbf24', fontSize: 11, fontStyle: 'italic' }}>{ind.significance}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {analysis.indicators?.length === 0 && (
                          <div style={{ padding: 16, background: '#dcfce7', borderRadius: 8, color: '#166534', textAlign: 'center' }}>
                            <i className="fas fa-check-circle"></i> No tampering indicators found. File appears genuine.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button className="btn-back-results" onClick={() => { setStep('options'); setResults([]); setAnalysisResults(null); }}>
            <i className="fas fa-redo"></i> Carve Again
          </button>
        </div>
      )}

      {/* Add to Case Modal */}
      {showAddModal && (
        <div className="extract-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2><i className="fas fa-plus-circle" style={{ color: '#059669' }}></i> Add to Evidence</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}><i className="fas fa-times"></i></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>File</label>
                <div style={{ padding: 12, background: '#f1f5f9', borderRadius: 8, fontSize: 14 }}>
                  {addingFile?.filename}
                  {addingFile?.isDeleted && <span style={{ color: '#dc2626', marginLeft: 8 }}>(Deleted File)</span>}
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>Link to Case</label>
                <select value={selectedCase} onChange={(e) => setSelectedCase(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                  <option value="">No case (standalone evidence)</option>
                  {cases.map((c) => (
                    <option key={c._id} value={c._id}>{c.caseNumber} - {c.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>Description</label>
                <textarea value={addDescription} onChange={(e) => setAddDescription(e.target.value)} rows={3}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn-confirm" style={{ background: '#059669' }} onClick={confirmAddToEvidence} disabled={addingToEvidence}>
                {addingToEvidence ? <><i className="fas fa-spinner fa-spin"></i> Adding...</> : <><i className="fas fa-check"></i> Add to Evidence</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileCarving;