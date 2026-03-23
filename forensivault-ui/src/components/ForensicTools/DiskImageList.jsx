import React from 'react';

const DiskImageList = ({ diskImages, onSelect, onDelete, onCarve, loading }) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div className="loading-spinner"></div>
        <p>Loading disk images...</p>
      </div>
    );
  }

  if (!diskImages || diskImages.length === 0) {
    return (
      <div className="empty-state">
        <i className="fas fa-hdd"></i>
        <h3>No Disk Images</h3>
        <p>Upload a disk image to get started</p>
      </div>
    );
  }

  return (
    <div className="disk-image-list">
      {diskImages.map((image) => (
        <div key={image._id} className="disk-image-card">
          <div className="disk-image-icon">
            <i className="fas fa-hdd"></i>
          </div>

          <div className="disk-image-info">
            <h3 className="disk-image-name">{image.originalName}</h3>
            <div className="disk-image-meta">
              <span>
                <i className="fas fa-database"></i>
                {image.sizeFormatted || `${(image.size / (1024 * 1024)).toFixed(2)} MB`}
              </span>
              <span>
                <i className="fas fa-server"></i>
                {image.fileSystem || 'Unknown'}
              </span>
              <span>
                <i className="fas fa-calendar"></i>
                {formatDate(image.uploadedAt)}
              </span>
              {image.uploadedBy && (
                <span>
                  <i className="fas fa-user"></i>
                  {image.uploadedBy.fullName || image.uploadedBy.username}
                </span>
              )}
            </div>
          </div>

          <span className={`disk-image-status ${image.status}`}>
            {image.status}
          </span>

          <div className="disk-image-actions">
            {image.status === 'ready' && (
              <>
                <button
                  className="btn-explore"
                  onClick={() => onSelect(image)}
                >
                  <i className="fas fa-folder-open"></i>
                  Explore
                </button>
                <button
                  className="btn-explore"
                  style={{ background: '#7c3aed' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCarve && onCarve(image);
                  }}
                >
                  <i className="fas fa-cut"></i>
                  Carve
                </button>
              </>
            )}
            {image.status === 'processing' && (
              <button className="btn-explore" disabled>
                <i className="fas fa-spinner fa-spin"></i>
                Processing
              </button>
            )}
            {image.status === 'error' && (
              <button className="btn-explore" disabled style={{ background: '#fee2e2', color: '#991b1b' }}>
                <i className="fas fa-exclamation-triangle"></i>
                Error
              </button>
            )}
            <button
              className="btn-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(image);
              }}
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DiskImageList;