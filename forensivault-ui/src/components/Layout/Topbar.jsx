import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import './Topbar.css';

const Topbar = ({ onToggleSidebar, onOpenSearch, sidebarCollapsed }) => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-toggle" onClick={onToggleSidebar}>
          <i className={`fas fa-${sidebarCollapsed ? 'bars' : 'times'}`}></i>
        </button>
        <div className="topbar-greeting">
          <span className="greeting-text">{getGreeting()},</span>
          <span className="greeting-name">{user?.fullName || user?.username}</span>
        </div>
      </div>

      <div className="topbar-right">
        {/* Search Button */}
        <button className="topbar-btn search-btn" onClick={onOpenSearch}>
          <i className="fas fa-search"></i>
          <span className="search-hint">Search...</span>
          <kbd className="search-kbd">⌘K</kbd>
        </button>

        {/* Theme Toggle */}
        <button className="topbar-btn" onClick={toggleTheme} title="Toggle theme">
          <i className={`fas fa-${theme === 'light' ? 'moon' : 'sun'}`}></i>
        </button>

        {/* Notifications */}
        <button className="topbar-btn" title="Notifications">
          <i className="fas fa-bell"></i>
          <span className="notification-badge">3</span>
        </button>

        {/* User Menu */}
        <div className="topbar-user">
          <div className="user-avatar">
            <i className="fas fa-user"></i>
          </div>
          <div className="user-info">
            <span className="user-name">{user?.username}</span>
            <span className="user-role">{user?.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;