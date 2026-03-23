import React, { useState, useEffect } from 'react';
import { diskImageAPI } from '../../services/api';
import DiskImageList from './DiskImageList';
import DiskImageUpload from './DiskImageUpload';
import FileExplorer from './FileExplorer';
import FileCarving from './FileCarving';
import './ForensicTools.css';

const ForensicTools = () => {
  const [activeTab, setActiveTab] = useState('images');
  const [diskImages, setDiskImages] = useState([]);
  const [selectedDiskImage, setSelectedDiskImage] = useState(null);
  const [carvingDiskImage, setCarvingDiskImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serviceStatus, setServiceStatus] = useState({ running: false });

  useEffect(() => {
    checkServiceStatus();
    loadDiskImages();
  }, []);

  const checkServiceStatus = async () => {
    try {
      const status = await diskImageAPI.getServiceStatus();
      setServiceStatus(status);
    } catch (err) {
      setServiceStatus({ running: false, error: err.message });
    }
  };

  const loadDiskImages = async () => {
    setLoading(true);
    try {
      const response = await diskImageAPI.getAll();
      setDiskImages(response.diskImages || []);
    } catch (err) {
      console.error('Error loading disk images:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = (newImage) => {
    setDiskImages((prev) => [newImage, ...prev]);
    setActiveTab('images');

    const pollStatus = setInterval(async () => {
      try {
        const updated = await diskImageAPI.getById(newImage.id);
        setDiskImages((prev) =>
          prev.map((img) => (img._id === updated._id || img.id === updated._id ? updated : img))
        );
        if (updated.status !== 'processing') clearInterval(pollStatus);
      } catch {
        clearInterval(pollStatus);
      }
    }, 3000);
  };

  const handleDeleteDiskImage = async (image) => {
    if (!window.confirm(`Are you sure you want to delete "${image.originalName}"?`)) return;
    try {
      await diskImageAPI.delete(image._id);
      setDiskImages((prev) => prev.filter((img) => img._id !== image._id));
    } catch (err) {
      alert('Error deleting disk image: ' + err.message);
    }
  };

  const handleBackToList = () => {
    setSelectedDiskImage(null);
    setCarvingDiskImage(null);
    loadDiskImages();
  };

  // File Explorer view
  if (selectedDiskImage) {
    return (
      <div className="forensic-tools">
        <FileExplorer diskImage={selectedDiskImage} onBack={handleBackToList} />
      </div>
    );
  }

  // File Carving view
  if (carvingDiskImage) {
    return (
      <div className="forensic-tools">
        <FileCarving diskImage={carvingDiskImage} onBack={handleBackToList} />
      </div>
    );
  }

  return (
    <div className="forensic-tools">
      <div className="forensic-tools-header">
        <h1>
          <i className="fas fa-microscope"></i>
          Forensic Tools
        </h1>
        <div className={`service-status ${serviceStatus.running ? 'online' : 'offline'}`}>
          <i className="fas fa-circle"></i>
          {serviceStatus.running ? 'Parser Service Online' : 'Parser Service Offline'}
        </div>
      </div>

      <div className="forensic-tabs">
        <button
          className={`forensic-tab ${activeTab === 'images' ? 'active' : ''}`}
          onClick={() => setActiveTab('images')}
        >
          <i className="fas fa-hdd"></i>
          Disk Images ({diskImages.length})
        </button>
        <button
          className={`forensic-tab ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <i className="fas fa-upload"></i>
          Upload New
        </button>
      </div>

      {activeTab === 'images' && (
        <DiskImageList
          diskImages={diskImages}
          onSelect={setSelectedDiskImage}
          onDelete={handleDeleteDiskImage}
          onCarve={setCarvingDiskImage}
          loading={loading}
        />
      )}

      {activeTab === 'upload' && (
        <DiskImageUpload onUploadComplete={handleUploadComplete} />
      )}
    </div>
  );
};

export default ForensicTools;