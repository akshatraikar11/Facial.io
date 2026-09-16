import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { ArrowRight, BarChart2, Bell, Shield, Scan, Github, Linkedin } from 'lucide-react';
import FacialioLogo from '../components/Logo';

// Redirect to dashboard if signed in, otherwise go to sign-up
const CtaButton = ({ style, className, children }) => {
    const { isSignedIn } = useAuth();
    return (
        <Link to={isSignedIn ? '/dashboard' : '/sign-up'} style={style} className={className}>
            {children}
        </Link>
    );
};

// ── Public Navbar — original floating pill style ─────────────────────────────
const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/employees', label: 'Enroll Face' },
    { to: '/attendance', label: 'Attendance' },
    { to: '/dashboard', label: 'Console' },
];

const PublicNav = () => (
    <header style={{ padding: '0 24px' }}>
        <nav className="navbar">
            {/* Brand */}
            <Link to="/" className="navbar-brand">
                <FacialioLogo size={40} />
                <div className="brand-copy">
                    <span className="brand-title">Facial.io</span>
                    <span className="brand-subtitle">AI Attendance</span>
                </div>
            </Link>

            {/* Nav links */}
            <div className="navbar-links">
                {links.map(({ to, label, end }) => (
                    <NavLink
                        key={label}
                        to={to}
                        end={end}
                        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    >
                        {label}
                    </NavLink>
                ))}
            </div>
        </nav>
    </header>
);

// ── Footer ───────────────────────────────────────────────────────────────────
const Footer = () => (
    <footer style={{
        borderTop: '1px solid var(--md-sys-color-outline-variant)',
        background: 'var(--md-sys-color-surface)',
        marginTop: '80px',
    }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 40px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '48px', marginBottom: '48px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <FacialioLogo size={28} />
                        <span style={{ fontWeight: 700, fontSize: '16px' }}>Facial.io</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', lineHeight: 1.6, maxWidth: '260px', margin: 0 }}>
                        Multi-tenant face recognition attendance SaaS. Built for agencies, offices, and enterprises.
                    </p>
                </div>
                {[
                    {
                        title: 'Product',
                        links: [
                            { label: 'Dashboard', to: '/dashboard' },
                            { label: 'Kiosk',     to: '/kiosk' },
                            { label: 'AI Assistant', to: '/ai' },
                            { label: 'Billing',   to: '/billing' },
                        ],
                    },
                    {
                        title: 'Developers',
                        links: [
                            { label: 'API Docs',  href: 'http://localhost:3001/api/docs', external: true },
                            { label: 'Webhooks',  href: 'https://clerk.com/docs/webhooks/overview', external: true },
                            { label: 'SDKs',      href: 'https://github.com/clerkinc', external: true },
                            { label: 'Status',    href: 'https://status.clerk.com', external: true },
                        ],
                    },
                ].map(col => (
                    <div key={col.title}>
                        <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em',
                            textTransform: 'uppercase', color: 'var(--md-sys-color-on-surface)', margin: '0 0 16px' }}>
                            {col.title}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {col.links.map(link => (
                                link.to ? (
                                    <Link
                                        key={link.label}
                                        to={link.to}
                                        style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)',
                                            textDecoration: 'none', transition: 'color 0.15s' }}
                                        onMouseEnter={e => e.target.style.color = 'var(--md-sys-color-primary)'}
                                        onMouseLeave={e => e.target.style.color = 'var(--md-sys-color-on-surface-variant)'}
                                    >
                                        {link.label}
                                    </Link>
                                ) : (
                                    <a
                                        key={link.label}
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)',
                                            textDecoration: 'none', transition: 'color 0.15s' }}
                                        onMouseEnter={e => e.target.style.color = 'var(--md-sys-color-primary)'}
                                        onMouseLeave={e => e.target.style.color = 'var(--md-sys-color-on-surface-variant)'}
                                    >
                                        {link.label}
                                    </a>
                                )
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)',
                paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                    © 2026 Facial.io. All rights reserved.
                </p>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <a href="https://github.com/akshatraikar11" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}><Github size={18} /></a>
                    <a href="https://www.linkedin.com/in/akshat-raikar-47ba5421b/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}><Linkedin size={18} /></a>
                </div>
            </div>
        </div>
    </footer>
);

// ── Main Home Page ───────────────────────────────────────────────────────────
const Home = () => {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <PublicNav />

            <main style={{ flex: 1 }}>
                {/* Hero */}
                <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 40px 60px' }}>
                    <div className="hero-grid">
                        <div className="hero-content">
                            <span className="section-eyebrow">Enterprise Grade · Multi-tenant SaaS</span>
                            <h1 style={{ fontSize: '52px', lineHeight: '60px', fontWeight: 700, margin: '12px 0 20px' }}>
                                Facial recognition <br />
                                <span style={{ color: 'var(--md-sys-color-primary)' }}>made seamless.</span>
                            </h1>
                            <p className="hero-subtitle" style={{ maxWidth: '460px', marginBottom: '32px' }}>
                                Deploy face recognition attendance for any organization in minutes.
                                Multi-tenant, AI-powered, real-time.
                            </p>

                            <div className="hero-actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px' }}>
                                <CtaButton className="btn btn-primary btn-lg" style={{
                                    background: 'var(--md-sys-color-primary)', color: '#fff',
                                    padding: '12px 24px', borderRadius: '12px', fontWeight: 600,
                                    fontSize: '15px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px'
                                }}>
                                    Start Free <ArrowRight size={16} />
                                </CtaButton>
                                <Link to="/kiosk" style={{
                                    padding: '12px 24px', borderRadius: '12px', fontWeight: 600,
                                    fontSize: '15px', textDecoration: 'none', border: '1px solid var(--md-sys-color-outline)',
                                    color: 'var(--md-sys-color-on-surface)', display: 'flex', alignItems: 'center', gap: '8px'
                                }}>
                                    <Scan size={16} /> Try Kiosk
                                </Link>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {['99.9% Accuracy', 'Server-side Matching', 'End-to-end Encrypted', 'Free to start'].map((chip, i) => (
                                    <span key={chip} style={{
                                        fontSize: '12px', fontWeight: 600, padding: '5px 12px',
                                        borderRadius: '99px', background: ['#dbeafe','#dcfce7','#ede9fe','#fef3c7'][i],
                                        color: ['#1d4ed8','#15803d','#5b21b6','#92400e'][i]
                                    }}>{chip}</span>
                                ))}
                            </div>
                        </div>

                        <div className="hero-visual">
                            <div className="hero-visual__ring" />
                            <div className="hero-visual__card">
                                <div className="shimmer" style={{ width: '100%', height: 200, borderRadius: 16, background: '#e8f0fe', position: 'relative' }}>
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ width: 120, height: 120, border: '2px solid var(--md-sys-color-primary)', borderRadius: 12 }} />
                                    </div>
                                </div>
                                <div className="detected-row">
                                    <div className="avatar" />
                                    <div>
                                        <h4 className="detected-name">Verified User</h4>
                                        <p className="detected-meta">ID: 8492-AC · 98% Match</p>
                                    </div>
                                </div>
                                <div className="hero-pulse"><span /><span /><span /></div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Stats */}
                <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px 60px' }}>
                    <div className="stats-grid">
                        {[
                            { value: '< 50ms', label: 'Server-side match time' },
                            { value: '100%', label: 'Data isolation per org' },
                            { value: 'Free', label: 'To start — no card needed' },
                        ].map(s => (
                            <div key={s.label} className="stat-card">
                                <p className="stat-value">{s.value}</p>
                                <p className="stat-label">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Features */}
                <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px 60px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                        <span className="section-eyebrow">Features</span>
                        <h2 style={{ fontSize: '36px', fontWeight: 700, margin: '8px 0 0' }}>
                            Everything you need
                        </h2>
                    </div>
                    <div className="card-grid">
                        {[
                            { icon: <Scan size={22} />, title: 'Server-side Face Matching', desc: 'Pinecone vector similarity search — scales to thousands of employees per org with sub-50ms response.', color: '#dbeafe', iconColor: '#1d4ed8' },
                            { icon: <BarChart2 size={22} />, title: 'AI Analytics Assistant', desc: 'Ask "Who was absent this week?" in plain English. LangChain + Gemini RAG pipeline answers from real data.', color: '#dcfce7', iconColor: '#15803d' },
                            { icon: <Bell size={22} />, title: 'Real-time Check-ins', desc: 'Socket.io pushes every check-in to the dashboard instantly. No polling, no refresh needed.', color: '#ede9fe', iconColor: '#5b21b6' },
                            { icon: <Shield size={22} />, title: 'Multi-tenant Isolation', desc: 'Every org\'s data is scoped by orgId from the Clerk JWT. No cross-tenant data leakage possible.', color: '#fef3c7', iconColor: '#92400e' },
                        ].map(f => (
                            <div key={f.title} className="feature-card" style={{
                                background: 'var(--md-sys-color-surface)', borderRadius: '20px',
                                border: '1px solid var(--md-sys-color-outline-variant)', padding: '28px'
                            }}>
                                <div style={{ width: '44px', height: '44px', borderRadius: '12px',
                                    background: f.color, display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', color: f.iconColor, marginBottom: '16px' }}>
                                    {f.icon}
                                </div>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px' }}>{f.title}</h3>
                                <p style={{ fontSize: '13px', margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* How it works */}
                <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px 60px' }}>
                    <div className="workflow-card material-card">
                        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                            <span className="section-eyebrow">How it works</span>
                            <h2 style={{ fontSize: '32px', fontWeight: 700, margin: '8px 0 0' }}>Three steps to live</h2>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
                            {[
                                { n: '1', title: 'Create your org', desc: 'Sign up, create an organization. Invite your team admins.' },
                                { n: '2', title: 'Register employees', desc: 'Use the enrollment wizard to capture face descriptors. Stored securely in Pinecone.' },
                                { n: '3', title: 'Go live', desc: 'Point your kiosk at the check-in screen. Attendance marks itself as employees walk by.' },
                            ].map(step => (
                                <div key={step.n} style={{ textAlign: 'center' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%',
                                        background: 'var(--md-sys-color-primary-container)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                                        fontSize: '20px', fontWeight: 700, color: 'var(--md-sys-color-on-primary-container)' }}>
                                        {step.n}
                                    </div>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px' }}>{step.title}</h3>
                                    <p style={{ fontSize: '13px', margin: 0, lineHeight: 1.6 }}>{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA Banner */}
                <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px 80px' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, var(--md-sys-color-primary) 0%, #1a73e8 100%)',
                        borderRadius: '24px', padding: '56px 48px', textAlign: 'center', color: '#fff'
                    }}>
                        <h2 style={{ fontSize: '36px', fontWeight: 700, margin: '0 0 12px', color: '#fff' }}>
                            Ready to get started?
                        </h2>
                        <p style={{ fontSize: '16px', opacity: 0.85, margin: '0 0 32px', color: '#fff' }}>
                            Free plan includes 10 employees. No credit card required.
                        </p>
                        <CtaButton style={{
                            background: '#fff', color: 'var(--md-sys-color-primary)',
                            padding: '14px 32px', borderRadius: '12px', fontWeight: 700,
                            fontSize: '15px', textDecoration: 'none', display: 'inline-flex',
                            alignItems: 'center', gap: '8px'
                        }}>
                            Start for free <ArrowRight size={16} />
                        </CtaButton>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
};

export default Home;
