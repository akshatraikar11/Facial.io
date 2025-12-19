import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/register', label: 'Enroll Face' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/dashboard', label: 'Console' },
];

const Navbar = () => {
  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        <svg fill="none" height={48} viewBox="0 0 40 48" width={40}>
          <g fill="#155eef">
            <path d="m0 4h10v10h-10z" />
            <path d="m20 4h10v10h-10z" opacity={0.6} />
            <path d="m10 14h10v10h-10z" opacity={0.6} />
            <path d="m20 14h10v10h-10z" opacity={0.45} />
            <path d="m30 14h10v10h-10z" opacity={0.3} />
            <path d="m0 24h10v10h-10z" opacity={0.6} />
            <path d="m10 24h10v10h-10z" opacity={0.45} />
            <path d="m20 24h10v10h-10z" opacity={0.3} />
            <path d="m30 24h10v10h-10z" opacity={0.15} />
            <path d="m10 34h10v10h-10z" opacity={0.3} />
            <path d="m20 34h10v10h-10z" opacity={0.15} />
          </g>
        </svg>

        <div className="brand-copy">
          <span className="brand-title">Facial.io</span>
          <span className="brand-subtitle">AI attendance</span>
        </div>
        <Badge variant="soft" size="sm">
          <Sparkles size={18} />
          Beta
        </Badge>
      </Link>
      <nav className="navbar-links">
        {links.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
};

export default Navbar;
