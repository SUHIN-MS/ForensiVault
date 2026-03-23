import React, { useState, useEffect, useRef } from 'react';
import { evidenceAPI, casesAPI } from '../../services/api';
import './Evidence.css';

const EvidenceUpload = ({ caseId: defaultCaseId, onSuccess, onCancel }) => {
  const [file, setFile] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragover, setDragover] = useState(false);
  const [formData, setFormData] = useState({
    caseId: defaultCaseId || '',
    description: '',
    tags: '',
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const data = await casesAPI.getAll({ limit: 100, status: 'open' });
      setCases(data.cases || []);
    } catch (err) {
      console.error('Error fetching cases:', err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragover(true);
  };

  const handleDragLeave = () => {
    setDragover(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      alert('Please select a file to upload');
      return;
    }

    setLoading(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      if (formData.caseId) uploadFormData.append('caseId', formData.caseId);
      if (formData.description) uploadFormData.append('description', formData.description);
      if (formData.tags) uploadFormData.append('tags', formData.tags);

      await evidenceAPI.upload(uploadFormData);
      onSuccess();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
      pdf: 'fa-file-pdf',
      doc: 'fa-file-word',
      docx: 'fa-file-word',
      xls: 'fa-file-excel',
      xlsx: 'fa-file-excel',
      jpg: 'fa-file-image',
      jpeg: 'fa-file-image',
      png: 'fa-file-image',
      gif: 'fa-file-image',
      mp4: 'fa-file-video',
      avi: 'fa-file-video',
      mov: 'fa-file-video',
      mp3: 'fa-file-audio',
      wav: 'fa-file-audio',
      txt: 'fa-file-alt',
    };
    return iconMap[ext] || 'fa-file';
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Drop Zone */}
      <div
        className={`upload-area ${dragover ? 'dragover' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <div className="upload-area-icon">
          <i className="fas fa-cloud-upload-alt"></i>
        </div>
        <h3>Drag & drop file here</h3>
        <p>or click to browse</p>
      </div>

      {/* File Preview */}
      {file && (
        <div className="upload-preview">
          <div className="upload-preview-icon">
            <i className={`fas ${getFileIcon(file.name)}`}></i>
          </div>
          <div className="upload-preview-info">
            <div className="upload-preview-name">{file.name}</div>
            <div className="upload-preview-size">{formatSize(file.size)}</div>
          </div>
          <button type="button" className="upload-preview-remove" onClick={handleRemoveFile}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Case Selection */}
      <div className="form-group mt-4">
        <label className="form-label">Assign to Case (Optional)</label>
        <select
          name="caseId"
          className="form-select"
          value={formData.caseId}
          onChange={handleChange}
        >
          <option value="">No case selected</option>
          {cases.map((c) => (
            <option key={c._id} value={c._id}>
              {c.caseNumber} - {c.title}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className="form-group">
        <label className="form-label">Description (Optional)</label>
        <textarea
          name="description"
          className="form-textarea"
          placeholder="Describe this evidence..."
          value={formData.description}
          onChange={handleChange}
          rows={3}
        />
      </div>

      {/* Tags */}
      <div className="form-group">
        <label className="form-label">Tags (Optional, comma-separated)</label>
        <input
          type="text"
          name="tags"
          className="form-input"
          placeholder="e.g., photo, crime-scene, exhibit-a"
          value={formData.tags}
          onChange={handleChange}
        />
      </div>

      {/* Actions */}
      <div className="modal-footer" style={{ margin: '1.5rem -1.5rem -1.5rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading || !file}>
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              Uploading...
            </>
          ) : (
            <>
              <i className="fas fa-upload"></i>
              Upload Evidence
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default EvidenceUpload;