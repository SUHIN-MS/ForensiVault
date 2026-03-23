import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const Sidebar = ({ collapsed }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const menuItems = [
    {
      path: '/dashboard',
      icon: 'fas fa-home',
      label: 'Dashboard',
      roles: ['admin', 'officer', 'analyst'],
    },
    {
      path: '/cases',
      icon: 'fas fa-folder-open',
      label: 'Cases',
      roles: ['admin', 'officer', 'analyst'],
    },
    {
      path: '/evidence',
      icon: 'fas fa-file-shield',
      label: 'Evidence',
      roles: ['admin', 'officer', 'analyst'],
    },
    {
      path: '/forensic-tools',
      icon: 'fas fa-microscope',
      label: 'Forensic Tools',
      roles: ['admin', 'analyst'],
    },
    {
      path: '/users',
      icon: 'fas fa-users-gear',
      label: 'User Management',
      roles: ['admin'],
    },
    {
      path: '/logs',
      icon: 'fas fa-clock-rotate-left',
      label: 'Activity Logs',
      roles: ['admin'],
    },
  ];

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.role)
  );

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin': return 'role-admin';
      case 'analyst': return 'role-analyst';
      case 'officer': return 'role-officer';
      default: return '';
    }
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <i className="fas fa-shield-halved"></i>
        </div>
        {!collapsed && (
          <div className="logo-text">
            <span className="logo-title">ForensiVault</span>
            <span className="logo-subtitle">Evidence System</span>
          </div>
        )}
      </div>

      {/* User Profile */}
      <div className="sidebar-profile">
        <div className="profile-avatar">
          <i className="fas fa-user"></i>
        </div>
        {!collapsed && (
          <div className="profile-info">
            <span className="profile-name">{user?.fullName || user?.username}</span>
            <span className={`profile-role ${getRoleBadgeClass(user?.role)}`}>
              {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section">
          {!collapsed && <span className="nav-section-title">Menu</span>}
          <ul className="nav-list">
            {filteredMenuItems.map((item) => (
              <li key={item.path}>
                <NavLink 
                  to={item.path} 
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  title={collapsed ? item.label : ''}
                >
                  <i className={item.icon}></i>
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Logout */}
      <div className="sidebar-footer">
        <button className="logout-btn" onClick={logout} title={collapsed ? 'Logout' : ''}>
          <i className="fas fa-sign-out-alt"></i>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;