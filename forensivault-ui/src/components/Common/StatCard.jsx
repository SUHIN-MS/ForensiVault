import React from 'react';
import './StatCard.css';

const StatCard = ({ title, value, icon, change, changeType = 'neutral', color = 'primary' }) => {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-icon">
        <i className={`fas ${icon}`}></i>
      </div>
      <div className="stat-content">
        <span className="stat-title">{title}</span>
        <span className="stat-value">{value}</span>
        {change !== undefined && (
          <span className={`stat-change change-${changeType}`}>
            <i className={`fas fa-${changeType === 'up' ? 'arrow-up' : changeType === 'down' ? 'arrow-down' : 'minus'}`}></i>
            {change}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatCard;