import React, { useState, useEffect } from 'react';
import { getOfficerData } from './api';

const OfficerDashboard = ({ onLogout }) => {
  const [officerData, setOfficerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const data = await getOfficerData(token);
        setOfficerData(data);
      } catch (error) {
        console.error("Failed to fetch officer data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="dashboard-loading">Loading Officer Dashboard...</div>;

  return (
    <div className="dashboard officer-dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Officer Dashboard</h1>
          <p className="user-welcome">Evidence Collection & Case Management</p>
        </div>
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </header>
      
      <div className="dashboard-content">
        <div className="dashboard-stats">
          <div className="stat-card">
            <h3>My Cases</h3>
            <p className="stat-number">{officerData?.myCases || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Pending Evidence</h3>
            <p className="stat-number">{officerData?.pendingEvidence || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Completed Today</h3>
            <p className="stat-number">{officerData?.completedToday || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Urgent Cases</h3>
            <p className="stat-number">{officerData?.urgentCases || 0}</p>
          </div>
        </div>

        <div className="officer-features">
          <h2>Officer Functions</h2>
          <div className="features-grid">
            <div className="feature-card officer-feature">
              <h3>Upload Evidence</h3>
              <p>Upload new digital evidence to active cases with metadata</p>
              <button className="feature-btn">Upload Evidence</button>
            </div>
            <div className="feature-card officer-feature">
              <h3>Case Management</h3>
              <p>Create, update, and manage investigation cases</p>
              <button className="feature-btn">Manage Cases</button>
            </div>
            <div className="feature-card officer-feature">
              <h3>Evidence Tracking</h3>
              <p>Track evidence chain of custody and status</p>
              <button className="feature-btn">Track Evidence</button>
            </div>
            <div className="feature-card officer-feature">
              <h3>My Reports</h3>
              <p>View and generate investigation reports</p>
              <button className="feature-btn">View Reports</button>
            </div>
            <div className="feature-card officer-feature">
              <h3>Evidence Search</h3>
              <p>Search through collected evidence and cases</p>
              <button className="feature-btn">Search Evidence</button>
            </div>
            <div className="feature-card officer-feature">
              <h3>Assign to Analyst</h3>
              <p>Assign evidence to forensic analysts for examination</p>
              <button className="feature-btn">Assign Analysis</button>
            </div>
          </div>
        </div>

        <div className="recent-activity">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            {officerData?.recentActivity?.map((activity, index) => (
              <div key={index} className="activity-item">
                <span className="activity-time">{activity.time}</span>
                <span className="activity-desc">{activity.description}</span>
                <span className={`case-status ${activity.status}`}>{activity.status}</span>
              </div>
            )) || (
              <div className="activity-item">
                <span className="activity-desc">No recent activity</span>
              </div>
            )}
          </div>
        </div>

        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <div className="actions-grid">
            <button className="quick-action-btn">New Case</button>
            <button className="quick-action-btn">Upload Evidence</button>
            <button className="quick-action-btn">Generate Report</button>
            <button className="quick-action-btn">Request Analysis</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficerDashboard;