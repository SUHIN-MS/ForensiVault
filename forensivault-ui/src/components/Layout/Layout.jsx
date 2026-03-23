import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import SearchModal from '../Common/SearchModal';
import './Layout.css';

const Layout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className={`layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar collapsed={sidebarCollapsed} />
      <div className="layout-main">
        <Topbar 
          onToggleSidebar={toggleSidebar} 
          onOpenSearch={() => setSearchOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main className="layout-content">
          <Outlet />
        </main>
      </div>
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

export default Layout;