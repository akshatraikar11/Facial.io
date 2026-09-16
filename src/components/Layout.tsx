import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';

/**
 * Layout wraps all authenticated app routes.
 * Routes outside <Layout> (/sign-in, /sign-up, /kiosk) never render here,
 * so the only path that genuinely needs the sidebar hidden is the landing
 * page ('/').
 */
const HIDE_SIDEBAR = ['/'];

const Layout = () => {
  const { pathname } = useLocation();
  const showSidebar = !HIDE_SIDEBAR.includes(pathname);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {showSidebar && <Navbar />}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
