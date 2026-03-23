import React, { useState, useEffect } from 'react';
import { diskImageAPI, casesAPI } from '../../services/api';

const FileExplorer = ({ diskImage, onBack }) => {
  const [tree, setTree] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [loading, setLoading] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [addToEvidence, setAddToEvidence] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(new Set(['/']));

  useEffect(() => {
    loadFileTree();
    loadFiles('/');
    loadCases();
  }, [diskImage]);

  const loadFileTree = async () => {
    try {
      const response = await diskImageAPI.getFileTree(diskImage._id, 5);
      setTree(response.tree);
    } catch (err) {
      console.error('Error loading file tree:', err);
    }
  };

  const loadFiles = async (directory) => {
    setLoading(true);
    try {
      const response = await diskImageAPI.browseFiles(diskImage._id, directory, false);
      setFiles(response.files || []);
      setCurrentPath(directory);
    } catch (err) {
      console.error('Error loading files:', err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCases = async () => {
    try {
      const response = await casesAPI.getAll({ limit: 100 });
      setCases(response.cases || []);
    } catch (err) {
      console.error('Error loading cases:', err);
    }
  };

  const loadPreview = async (file) => {
    setSelectedFile(file);
    setLoadingPreview(true);
    
    try {
      const response = await diskImageAPI.getFilePreview(diskImage._id, file.path);
      setPreview(response);
    } catch (err) {
      console.error('Error loading preview:', err);
      setPreview({ type: 'error', message: err.message });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleTreeNodeClick = (node) => {
    if (node.type === 'directory') {
      const newExpanded = new Set(expandedNodes);
      if (newExpanded.has(node.path)) {
        newExpanded.delete(node.path);
      } else {
        newExpanded.add(node.path);
      }
      setExpandedNodes(newExpanded);
      loadFiles(node.path);
    } else {
      loadPreview(node);
    }
  };

  const handleFileClick = (file) => {
    if (file.isDirectory) {
      loadFiles(file.path);
    } else {
      loadPreview(file);
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) return;
    
    setExtracting(true);
    try {
      const response = await diskImageAPI.extractFile(
        diskImage._id,
        selectedFile.path,
        addToEvidence,
        selectedCase || null
      );
      
      alert(addToEvidence 
        ? 'File extracted and added to evidence!' 
        : 'File extracted successfully!');
      
      setShowExtractModal(false);
      setAddToEvidence(false);
      setSelectedCase('');
    } catch (err) {
      alert('Extraction failed: ' + err.message);
    } finally {
      setExtracting(false);
    }
  };

  const getFileIcon = (file) => {
    if (file.isDirectory) return 'folder';
    
    const category = file.category || 'other';
    const icons = {
      documents: 'document',
      images: 'image',
      videos: 'video',
      audio: 'audio',
      other: 'other',
    };
    return icons[category] || 'other';
  };

  const getBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Root', path: '/' }];
    
    let currentPathBuild = '';
    parts.forEach((part) => {
      currentPathBuild += '/' + part;
      breadcrumbs.push({ name: part, path: currentPathBuild });
    });
    
    return breadcrumbs;
  };

  const renderTreeNode = (node, level = 0) => {
    if (!node) return null;
    
    const isExpanded = expandedNodes.has(node.path);
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <div key={node.path} className="tree-node">
        <div
          className={`tree-node-content ${selectedFile?.path === node.path ? 'selected' : ''}`}
          style={{ paddingLeft: `${level * 16}px` }}
          onClick={() => handleTreeNodeClick(node)}
        >
          <span className="tree-toggle">
            {node.type === 'directory' && hasChildren && (
              <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}></i>
            )}
          </span>
          <i className={`tree-icon ${node.type === 'directory' ? 'folder fas fa-folder' : 'file fas fa-file'}`}></i>
          <span className="tree-name">{node.name}</span>
        </div>
        
        {isExpanded && hasChildren && (
          <div className="tree-children">
            {node.children.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredFiles = searchQuery
    ? files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  return (
    <div className="file-explorer">
      {/* Tree Panel */}
      <div className="file-tree-panel">
        <div className="panel-header">
          <i className="fas fa-sitemap"></i>
          File Tree
        </div>
        <div className="file-tree">
          {tree ? renderTreeNode(tree) : (
            <div className="loading-spinner" style={{ margin: '20px auto' }}></div>
          )}
        </div>
      </div>

      {/* File List Panel */}
      <div className="file-list-panel">
        <div className="panel-header" style={{ justifyContent: 'flex-start', gap: '12px' }}>
          <button 
            onClick={onBack}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px 8px',
              borderRadius: '4px'
            }}
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <span>{diskImage.originalName}</span>
        </div>
        
        <div className="breadcrumb">
          {getBreadcrumbs().map((crumb, idx, arr) => (
            <React.Fragment key={crumb.path}>
              <span
                className={`breadcrumb-item ${idx === arr.length - 1 ? 'active' : ''}`}
                onClick={() => loadFiles(crumb.path)}
              >
                {crumb.name}
              </span>
              {idx < arr.length - 1 && (
                <span className="breadcrumb-separator">/</span>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="file-list-toolbar">
          <div className="search-wrapper">
            <i className="fas fa-search"></i>
            <input
              type="text"
              className="search-input"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="file-list">
          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner"></div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-folder-open"></i>
              <p>No files in this directory</p>
            </div>
          ) : (
            filteredFiles.map((file) => (
              <div
                key={file.path}
                className={`file-list-item ${selectedFile?.path === file.path ? 'selected' : ''}`}
                onClick={() => handleFileClick(file)}
              >
                <div className={`file-icon ${getFileIcon(file)}`}>
                  <i className={`fas fa-${file.isDirectory ? 'folder' : 'file'}`}></i>
                </div>
                <div className="file-details">
                  <div className="file-name">{file.name}</div>
                  <div className="file-meta">
                    {!file.isDirectory && <span>{file.sizeFormatted}</span>}
                    {file.modified && (
                      <span>{new Date(file.modified).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Preview Panel */}
      <div className="file-preview-panel">
        <div className="panel-header">
          <i className="fas fa-eye"></i>
          Preview
        </div>

        <div className="preview-content">
          {loadingPreview ? (
            <div className="no-preview">
              <div className="loading-spinner"></div>
              <p>Loading preview...</p>
            </div>
          ) : !selectedFile ? (
            <div className="no-preview">
              <i className="fas fa-hand-pointer"></i>
              <p>Select a file to preview</p>
            </div>
          ) : preview?.type === 'directory' ? (
            <div className="no-preview">
              <i className="fas fa-folder"></i>
              <p>This is a directory</p>
            </div>
          ) : (
            <>
              <div className="file-info-grid">
                <div className="info-item">
                  <span className="info-label">Name</span>
                  <span className="info-value">{selectedFile.name}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Size</span>
                  <span className="info-value">{selectedFile.sizeFormatted || preview?.fileInfo?.sizeFormatted}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Path</span>
                  <span className="info-value">{selectedFile.path}</span>
                </div>
                {preview?.fileInfo?.modified && (
                  <div className="info-item">
                    <span className="info-label">Modified</span>
                    <span className="info-value">
                      {new Date(preview.fileInfo.modified).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {preview?.type === 'text' && preview.content && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#64748b' }}>
                    Content Preview
                  </div>
                  <div className="text-preview">
                    {preview.content.substring(0, 2000)}
                    {preview.content.length > 2000 && '\n\n... [truncated]'}
                  </div>
                </div>
              )}

              {preview?.type === 'image' && preview.base64 && (
                <div className="image-preview" style={{ marginTop: '16px' }}>
                  <img 
                    src={`data:${preview.mimeType};base64,${preview.base64}`} 
                    alt={selectedFile.name}
                  />
                </div>
              )}

              {preview?.type === 'binary' && preview.hexDump && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#64748b' }}>
                    Hex Dump
                  </div>
                  <div className="hex-preview">
                    {preview.hexDump}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {selectedFile && !selectedFile.isDirectory && (
          <div className="preview-actions">
            <button className="btn-extract" onClick={() => setShowExtractModal(true)}>
              <i className="fas fa-download"></i>
              Extract
            </button>
            <button 
              className="btn-add-evidence" 
              onClick={() => {
                setAddToEvidence(true);
                setShowExtractModal(true);
              }}
            >
              <i className="fas fa-plus"></i>
              Add to Evidence
            </button>
          </div>
        )}
      </div>

      {/* Extract Modal */}
      {showExtractModal && (
        <div className="extract-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{addToEvidence ? 'Add to Evidence' : 'Extract File'}</h2>
              <button className="modal-close" onClick={() => {
                setShowExtractModal(false);
                setAddToEvidence(false);
              }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              <p style={{ marginBottom: '16px', color: '#64748b' }}>
                {addToEvidence 
                  ? 'This will extract the file and add it as evidence to ForensiVault.'
                  : 'This will extract the file from the disk image.'}
              </p>
              
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: '500', marginBottom: '4px', display: 'block' }}>
                  File
                </label>
                <div style={{ 
                  padding: '12px', 
                  background: '#f1f5f9', 
                  borderRadius: '8px',
                  fontSize: '14px'
                }}>
                  {selectedFile?.name}
                </div>
              </div>

              {addToEvidence && (
                <div className="form-group">
                  <label style={{ fontWeight: '500', marginBottom: '4px', display: 'block' }}>
                    Link to Case (Optional)
                  </label>
                  <select
                    value={selectedCase}
                    onChange={(e) => setSelectedCase(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  >
                    <option value="">Select a case...</option>
                    {cases.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.caseNumber} - {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => {
                setShowExtractModal(false);
                setAddToEvidence(false);
              }}>
                Cancel
              </button>
              <button 
                className="btn-confirm" 
                onClick={handleExtract}
                disabled={extracting}
              >
                {extracting ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i>
                    {addToEvidence ? 'Add to Evidence' : 'Extract'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;