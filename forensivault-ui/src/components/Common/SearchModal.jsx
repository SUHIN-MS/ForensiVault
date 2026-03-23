
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchAPI } from '../../services/api';
import StatusBadge from './StatusBadge';
import './SearchModal.css';

const SearchModal = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ cases: [], evidence: [] });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isOpen) {
          // This would need to be handled by parent
        } else {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const searchDebounce = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setLoading(true);
        try {
          const data = await searchAPI.search(query);
          setResults(data);
        } catch (err) {
          console.error('Search error:', err);
        }
        setLoading(false);
      } else {
        setResults({ cases: [], evidence: [] });
      }
    }, 300);

    return () => clearTimeout(searchDebounce);
  }, [query]);

  const handleResultClick = (type, id) => {
    onClose();
    setQuery('');
    navigate(`/${type}/${id}`);
  };

  if (!isOpen) return null;

  const totalResults = results.cases.length + results.evidence.length;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        {/* Search Input */}
        <div className="search-modal-header">
          <div className="search-input-wrapper">
            <i className="fas fa-search"></i>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search cases, evidence, files..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-modal-input"
            />
            {loading && <i className="fas fa-spinner fa-spin search-loading"></i>}
            <kbd className="search-esc">ESC</kbd>
          </div>
        </div>

        {/* Tabs */}
        {query.trim().length >= 2 && (
          <div className="search-modal-tabs">
            <button 
              className={`search-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All <span className="tab-count">{totalResults}</span>
            </button>
            <button 
              className={`search-tab ${activeTab === 'cases' ? 'active' : ''}`}
              onClick={() => setActiveTab('cases')}
            >
              Cases <span className="tab-count">{results.cases.length}</span>
            </button>
            <button 
              className={`search-tab ${activeTab === 'evidence' ? 'active' : ''}`}
              onClick={() => setActiveTab('evidence')}
            >
              Evidence <span className="tab-count">{results.evidence.length}</span>
            </button>
          </div>
        )}

        {/* Results */}
        <div className="search-modal-body">
          {query.trim().length < 2 ? (
            <div className="search-hint-box">
              <i className="fas fa-lightbulb"></i>
              <p>Type at least 2 characters to search</p>
              <div className="search-tips">
                <span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
                <span><kbd>Enter</kbd> to select</span>
                <span><kbd>ESC</kbd> to close</span>
              </div>
            </div>
          ) : totalResults === 0 && !loading ? (
            <div className="search-no-results">
              <i className="fas fa-search"></i>
              <p>No results found for "{query}"</p>
            </div>
          ) : (
            <div className="search-results">
              {/* Cases Results */}
              {(activeTab === 'all' || activeTab === 'cases') && results.cases.length > 0 && (
                <div className="search-result-section">
                  <div className="result-section-header">
                    <i className="fas fa-folder-open"></i>
                    <span>Cases</span>
                  </div>
                  {results.cases.map((caseItem) => (
                    <div
                      key={caseItem._id}
                      className="search-result-item"
                      onClick={() => handleResultClick('cases', caseItem._id)}
                    >
                      <div className="result-icon case-icon">
                        <i className="fas fa-folder"></i>
                      </div>
                      <div className="result-content">
                        <span className="result-title">{caseItem.title}</span>
                        <span className="result-subtitle">{caseItem.caseNumber}</span>
                      </div>
                      <StatusBadge status={caseItem.status} size="sm" />
                    </div>
                  ))}
                </div>
              )}

              {/* Evidence Results */}
              {(activeTab === 'all' || activeTab === 'evidence') && results.evidence.length > 0 && (
                <div className="search-result-section">
                  <div className="result-section-header">
                    <i className="fas fa-file-shield"></i>
                    <span>Evidence</span>
                  </div>
                  {results.evidence.map((evidence) => (
                    <div
                      key={evidence._id}
                      className="search-result-item"
                      onClick={() => handleResultClick('evidence', evidence._id)}
                    >
                      <div className="result-icon evidence-icon">
                        <i className={`fas fa-${getFileIcon(evidence.fileType)}`}></i>
                      </div>
                      <div className="result-content">
                        <span className="result-title">{evidence.originalName}</span>
                        <span className="result-subtitle">
                          {evidence.caseId?.caseNumber || 'No case assigned'}
                        </span>
                      </div>
                      <StatusBadge status={evidence.status} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const getFileIcon = (fileType) => {
  const icons = {
    document: 'file-alt',
    image: 'image',
    video: 'video',
    audio: 'music',
    other: 'file',
  };
  return icons[fileType] || 'file';
};

export default SearchModal;