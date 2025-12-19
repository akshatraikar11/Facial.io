import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { useFaceApi } from './FaceApiContext';

const Layout = () => {
    const { loading, error } = useFaceApi();

    if (loading) {
        return (
            <div className="full-screen-center">
                <div className="loader-orbit">
                    <span />
                </div>
                <p className="eyebrow-text">Calibrating vision models…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="full-screen-center">
                <div className="error-chip">Model load failed</div>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="app-shell">
            <div className="app-shell__glow" aria-hidden="true" />
            <Navbar />
            <main className="app-shell__content" aria-live="polite">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;

