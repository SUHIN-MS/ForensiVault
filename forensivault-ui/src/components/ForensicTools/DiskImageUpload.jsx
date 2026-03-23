import React, { useState, useRef } from 'react';
import { diskImageAPI, casesAPI } from '../../services/api';

const DiskImageUpload = ({ onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [description, setDescription] = useState('');
  const [selectedCase, setSelectedCase] = useState('');
  const [cases, setCases] = useState([]);
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  React.useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      const response = await casesAPI.getAll({ limit: 100 });
      setCases(response.cases || []);
    } catch (err) {
      console.error('Error loading cases:', err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    validateAndSetFile(droppedFile);
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (file) => {
    setError('');
    
    if (!file) return;

    const ext = file.name.toLowerCase().split('.').pop();
    const allowedExtensions = ['img', 'raw', 'dd'];
    
    if (!allowedExtensions.includes(ext)) {
      setError(`Invalid file format. Allowed: .img, .raw, .dd`);
      return;
    }

    setFile(file);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError('');

    try {
      const formData = new FormData();
      formData.append('diskImage', file);
      if (description) formData.append('description', description);
      if (selectedCase) formData.append('caseId', selectedCase);
      if (tags) formData.append('tags', tags);

      // Simulate progress (actual progress would require XHR)
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await diskImageAPI.upload(formData);

      clearInterval(progressInterval);
      setProgress(100);

      setTimeout(() => {
        setFile(null);
        setDescription('');
        setSelectedCase('');
        setTags('');
        setProgress(0);
        setUploading(false);
        
        if (onUploadComplete) {
          onUploadComplete(response.diskImage);
        }
      }, 500);

    } catch (err) {
      setError(err.message || 'Upload failed');
      setUploading(false);
      setProgress(0);
    }
  };

  const formatFileSize = (bytes) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(2)} ${units[i]}`;
  };

  return (
    <div className="upload-section">
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".img,.raw,.dd"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        {file ? (
          <>
            <i className="fas fa-check-circle" style={{ color: '#16a34a' }}></i>
            <h3>{file.name}</h3>
            <p>{formatFileSize(file.size)}</p>
          </>
        ) : (
          <>
            <i className="fas fa-cloud-upload-alt"></i>
            <h3>Drop disk image here or click to browse</h3>
            <p>Upload raw disk images for forensic analysis</p>
            <div className="formats">
              <span className="format-badge">.IMG</span>
              <span className="format-badge">.RAW</span>
              <span className="format-badge">.DD</span>
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          background: '#fee2e2', 
          color: '#991b1b', 
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}

      {file && !uploading && (
        <div className="upload-form">
          <div className="form-row">
            <div className="form-group">
              <label>Link to Case (Optional)</label>
              <select
                value={selectedCase}
                onChange={(e) => setSelectedCase(e.target.value)}
              >
                <option value="">Select a case...</option>
                {cases.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.caseNumber} - {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Tags (comma separated)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., suspect-laptop, case-2024"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this disk image..."
              rows={3}
            />
          </div>

          <button
            className="btn-extract"
            onClick={handleUpload}
            style={{ width: '100%', padding: '14px' }}
          >
            <i className="fas fa-upload"></i>
            Upload & Parse Disk Image
          </button>
        </div>
      )}

      {uploading && (
        <div className="upload-progress">
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="progress-text">
            {progress < 100 
              ? `Uploading... ${progress}%` 
              : 'Processing disk image...'}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiskImageUpload;