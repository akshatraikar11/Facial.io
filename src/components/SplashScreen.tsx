import React from 'react';

/**
 * SplashScreen — shown while face-api.js models are loading.
 * Matches the original: spinning ring with gradient dot + "CALIBRATING VISION MODELS..."
 */
const SplashScreen = ({ error }: { error?: string | null }) => (
  <div className="full-screen-center">
    <div className="loader-orbit">
      <span />
    </div>
    {error ? (
      <span className="error-chip">{error}</span>
    ) : (
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
    )}
  </div>
);

export default SplashScreen;
