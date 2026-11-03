import React from 'react';

/**
 * SplashScreen — shown while face-api.js models are loading.
 * On error: shows a visible error card with a retry button instead of
 * staying stuck on a near-blank screen.
 */
const SplashScreen = ({ error, onRetry }: { error?: string | null; onRetry?: () => void }) => (
  <div className="full-screen-center">
    {error ? (
      <div style={{
        maxWidth: 360,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '32px 24px',
        background: 'var(--md-sys-color-surface)',
        borderRadius: 24,
        boxShadow: 'var(--md-sys-elevation-2)',
        border: '1px solid var(--md-sys-color-outline-variant)',
      }}>
        <span style={{ fontSize: 36 }}>⚠️</span>
        <p style={{
          margin: 0,
          fontWeight: 700,
          fontSize: 16,
          color: 'var(--md-sys-color-on-surface)',
        }}>
          Failed to load vision models
        </p>
        <p style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--md-sys-color-on-surface-variant)',
          lineHeight: 1.5,
        }}>
          {error}
        </p>
        <p style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--md-sys-color-on-surface-variant)',
        }}>
          Make sure the <code>/models</code> files are served correctly and refresh.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: 4,
              padding: '10px 24px',
              borderRadius: 999,
              background: 'var(--md-sys-color-primary)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 20px',
            borderRadius: 999,
            background: 'transparent',
            color: 'var(--md-sys-color-on-surface-variant)',
            border: '1px solid var(--md-sys-color-outline)',
            fontWeight: 500,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Refresh page
        </button>
      </div>
    ) : (
      <>
        <div className="loader-orbit">
          <span />
        </div>
        <p style={{
          margin: 0,
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.15em',
          color: 'var(--md-sys-color-on-surface-variant)',
          textTransform: 'uppercase',
        }}>
          Calibrating Vision Models…
        </p>
      </>
    )}
  </div>
);

export default SplashScreen;
