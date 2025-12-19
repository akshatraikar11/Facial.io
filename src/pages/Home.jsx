import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const Home = () => {
    return (
        <div className="home">
            <section className="hero">
                <div className="hero-grid">
                    <div className="hero-content">
                        <span className="section-eyebrow">Enterprise Grade Security</span>
                        <h1>
                            Facial recognition <br />
                            <span style={{ color: 'var(--md-sys-color-primary)' }}>made seamless.</span>
                        </h1>
                        <p className="hero-subtitle">
                            Deploy Google-caliber identity verification in minutes. Secure your facility with
                            privacy-first, on-device biometric intelligence.
                        </p>

                        <div className="hero-actions">
                            <Link to="/register" className="btn btn-primary btn-lg">
                                Start Enrollment
                                <ArrowRight size={18} style={{ marginLeft: 8 }} />
                            </Link>
                            <Link to="/attendance" className="btn btn-outlined btn-lg">
                                Live Attendance
                            </Link>
                        </div>

                        <div className="hero-chips">
                            <span className="google-chip blue">99.9% Accuracy</span>
                            <span className="google-chip green">Local Processing</span>
                            <span className="google-chip red">Encrypted</span>
                        </div>
                    </div>

                    <div className="hero-visual">
                        <div className="hero-visual__ring" />
                        <div className="hero-visual__card">
                            <div className="shimmer" style={{ width: '100%', height: 200, borderRadius: 16, background: '#eee' }}>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ width: 120, height: 120, border: '2px solid var(--md-sys-color-primary)', borderRadius: 12 }}></div>
                                </div>
                            </div>
                            <div className="detected-row">
                                <div className="avatar" />
                                <div>
                                    <h4 className="detected-name">Verified User</h4>
                                    <p className="detected-meta">ID: 8492-AC • 98% Match</p>
                                </div>
                            </div>
                            <div className="hero-pulse">
                                <span />
                                <span />
                                <span />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="stats-grid">
                <div className="stat-card">
                    <p className="stat-value">0.2s</p>
                    <p className="stat-label">Inference Time</p>
                </div>
                <div className="stat-card">
                    <p className="stat-value">100%</p>
                    <p className="stat-label">Privacy First</p>
                </div>
                <div className="stat-card">
                    <p className="stat-value">Local</p>
                    <p className="stat-label">No Cloud API</p>
                </div>
            </section>

            <section className="feature-section">
                <div className="card-grid">
                    <div className="feature-card feature-card--blue">
                        <span className="feature-dot" />
                        <h3>Real-time Sync</h3>
                        <p>Instant attendance logging across all connected devices in your network.</p>
                    </div>
                    <div className="feature-card feature-card--green">
                        <span className="feature-dot" />
                        <h3>Anti-Spoofing</h3>
                        <p>Advanced liveness detection prevents photo and video playback attacks.</p>
                    </div>
                    <div className="feature-card feature-card--yellow">
                        <span className="feature-dot" />
                        <h3>Easy Export</h3>
                        <p>Download attendance reports in CSV/PDF formats for HR compliance.</p>
                    </div>
                </div>
            </section>

            <section className="workflow-section">
                <div className="workflow-card material-card">
                    <h3 style={{ marginBottom: '24px' }}>How it works</h3>

                    <div className="workflow-steps">
                        <div className="workflow-row">
                            <div className="step-circle">1</div>
                            <span className="step-text">Register faces using the secure enrollment wizard.</span>
                        </div>
                        <div className="workflow-row">
                            <div className="step-circle">2</div>
                            <span className="step-text">Set up the kiosk device at your entry point.</span>
                        </div>
                        <div className="workflow-row">
                            <div className="step-circle">3</div>
                            <span className="step-text">Employees just walk by to mark attendance.</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
