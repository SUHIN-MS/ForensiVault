import React, { useState, useEffect } from 'react';
import { getAnalystData } from './api';

const AnalystDashboard = ({ onLogout }) => {
  const [analystData, setAnalystData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const data = await getAnalystData(token);
        setAnalystData(data);
      } catch (error) {
        console.error("Failed to fetch analyst data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="dashboard-loading">Loading Analyst Dashboard...</div>;

  return (
    <div className="dashboard analyst-dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Analyst Dashboard</h1>
          <p className="user-welcome">Digital Forensics Analysis & Examination</p>
        </div>
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </header>
      
      <div className="dashboard-content">
        <div className="dashboard-stats">
          <div className="stat-card">
            <h3>Active Analysis</h3>
            <p className="stat-number">{analystData?.activeAnalysis || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Completed Today</h3>
            <p className="stat-number">{analystData?.completedToday || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Pending Review</h3>
            <p className="stat-number">{analystData?.pendingReview || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Average Time</h3>
            <p className="stat-number">{analystData?.averageTime || "4.2h"}</p>
          </div>
        </div>

        <div className="analyst-features">
          <h2>Analysis Tools</h2>
          <div className="features-grid">
            <div className="feature-card analyst-feature">
              <h3>Evidence Analysis</h3>
              <p>Analyze digital evidence, artifacts, and forensic data</p>
              <button className="feature-btn">Start Analysis</button>
            </div>
            <div className="feature-card analyst-feature">
              <h3>Forensic Tools</h3>
              <p>Access specialized forensic analysis tools and utilities</p>
              <button className="feature-btn">Open Tools</button>
            </div>
            <div className="feature-card analyst-feature">
              <h3>Generate Reports</h3>
              <p>Create detailed forensic analysis and examination reports</p>
              <button className="feature-btn">Create Report</button>
            </div>
            <div className="feature-card analyst-feature">
              <h3>Data Visualization</h3>
              <p>Visualize evidence relationships and analysis results</p>
              <button className="feature-btn">View Visualizations</button>
            </div>
            <div className="feature-card analyst-feature">
              <h3>Timeline Analysis</h3>
              <p>Create and analyze event timelines from evidence</p>
              <button className="feature-btn">Timeline Tools</button>
            </div>
            <div className="feature-card analyst-feature">
              <h3>Malware Analysis</h3>
              <p>Examine and analyze malicious software and code</p>
              <button className="feature-btn">Malware Tools</button>
            </div>
          </div>
        </div>

        <div className="analysis-queue">
          <h3>Analysis Queue</h3>
          <div className="queue-list">
            {analystData?.analysisQueue?.map((item, index) => (
              <div key={index} className="queue-item">
                <span className="case-id">{item.caseId}</span>
                <span className="evidence-type">{item.evidenceType}</span>
                <span className={`priority ${item.priority}`}>{item.priority}</span>
                <span className="assigned-by">{item.assignedBy}</span>
                <button className="action-btn">Start Analysis</button>
              </div>
            )) || (
              <div className="queue-item">
                <span className="evidence-type">No items in analysis queue</span>
              </div>
            )}
          </div>
        </div>

        <div className="tool-status">
          <h3>Forensic Tools Status</h3>
          <div className="tools-grid">
            <div className="tool-status-item">
              <span className="tool-name">Memory Analyzer</span>
              <span className="tool-status available">Available</span>
            </div>
            <div className="tool-status-item">
              <span className="tool-name">Network Analyzer</span>
              <span className="tool-status available">Available</span>
            </div>
            <div className="tool-status-item">
              <span className="tool-name">File Carver</span>
              <span className="tool-status in-use">In Use</span>
            </div>
            <div className="tool-status-item">
              <span className="tool-name">Registry Analyzer</span>
              <span className="tool-status available">Available</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalystDashboard;