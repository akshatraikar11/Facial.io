import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { LayoutDashboard, Users, Scan, CreditCard, Sparkles, LogOut, MapPin, Clock, ClipboardList } from 'lucide-react';
import FacialioLogo from './Logo';

const NAV = [
  { path: '/dashboard', label: 'Monitor',      icon: LayoutDashboard },
  { path: '/employees', label: 'People',        icon: Users },
  { path: '/locations', label: 'Locations',     icon: MapPin },
  { path: '/shifts',    label: 'Shifts',        icon: Clock },
  { path: '/billing',   label: 'Billing',       icon: CreditCard },
  { path: '/ai',        label: 'AI Assistant',  icon: Sparkles },
  { path: '/audit',     label: 'Audit Log',     icon: ClipboardList },
];

const Navbar = () => {
  const { pathname } = useLocation();
  const { signOut } = useClerk();

  return (
    <nav style={{
      width: '220px',
      background: '#ffffff',
      borderRight: '1px solid #e8eaed',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 12px',
      flexShrink: 0,
      gap: 0,
    }}>

      {/* Brand */}
      <div style={{ padding: '4px 12px 28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <FacialioLogo size={36} />
        <span style={{ fontSize: '16px', fontWeight: 700, color: '#1f1f1f', letterSpacing: '-0.3px' }}>
          Facial.io
        </span>
      </div>

      {/* Nav items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
        {NAV.map(({ path, label, icon: Icon }) => {
          const active = pathname === path || pathname.startsWith(path + '/');
          return (
            <Link key={path} to={path} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: active ? 600 : 400,
                background: active ? '#e8f0fe' : 'transparent',
                color: active ? '#0b57d0' : '#444746',
                transition: 'background 0.15s, color 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLDivElement).style.background = '#f1f3f4';
                  (e.currentTarget as HTMLDivElement).style.color = '#1f1f1f';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  (e.currentTarget as HTMLDivElement).style.color = '#444746';
                }
              }}
              >
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Bottom: sign out */}
      <div style={{ borderTop: '1px solid #e8eaed', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => signOut({ redirectUrl: '/' })}
          onKeyDown={(e) => e.key === 'Enter' && signOut({ redirectUrl: '/' })}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
            borderRadius: '10px', fontSize: '14px', color: '#444746', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#fef2f2'; (e.currentTarget as HTMLDivElement).style.color = '#b91c1c'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; (e.currentTarget as HTMLDivElement).style.color = '#444746'; }}
        >
          <LogOut size={17} strokeWidth={1.8} />
          Sign out
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
