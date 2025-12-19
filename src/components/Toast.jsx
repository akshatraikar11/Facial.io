import React, { useEffect } from 'react';

const Toast = ({ message, type = 'info', onClose, duration = 3000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const getBackgroundColor = () => {
        switch (type) {
            case 'success': return 'var(--google-green)';
            case 'error': return 'var(--google-red)';
            case 'warning': return 'var(--google-yellow)';
            default: return 'var(--google-blue)';
        }
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--md-sys-color-on-surface)', // Dark background for contrast
            color: 'var(--md-sys-color-surface)',
            padding: '14px 24px',
            borderRadius: '4px', // Material Snackbar radius
            boxShadow: 'var(--md-sys-elevation-3)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 1000,
            minWidth: '300px',
            justifyContent: 'space-between',
            animation: 'slideUp 0.3s ease-out'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: getBackgroundColor()
                }}></div>
                <span style={{ fontSize: '14px', fontWeight: 400 }}>{message}</span>
            </div>
            <button
                onClick={onClose}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--google-blue)',
                    fontWeight: 500,
                    fontSize: '14px',
                    padding: '0',
                    cursor: 'pointer',
                    marginLeft: '16px'
                }}
            >
                DISMISS
            </button>
            <style>{`
                @keyframes slideUp {
                    from { transform: translate(-50%, 100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default Toast;
