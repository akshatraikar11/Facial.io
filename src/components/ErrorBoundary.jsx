import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Button from './ui/Button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  // eslint-disable-next-line no-unused-vars
  static getDerivedStateFromError(_) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console or error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div className="full-screen-center" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ maxWidth: '600px' }}>
            <div style={{
              fontSize: '4rem',
              marginBottom: '1rem',
              color: 'var(--md-sys-color-error)'
            }}>
              <AlertTriangle size={64} />
            </div>
            <h1 style={{
              fontSize: '2rem',
              marginBottom: '1rem',
              color: 'var(--md-sys-color-on-surface)'
            }}>
              Something went wrong
            </h1>
            <p style={{
              marginBottom: '2rem',
              color: 'var(--md-sys-color-on-surface-variant)'
            }}>
              An unexpected error occurred. Please try refreshing the page or return to the home page.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details style={{
                marginBottom: '2rem',
                textAlign: 'left',
                padding: '1rem',
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                borderRadius: '8px',
                fontSize: '0.875rem'
              }}>
                <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                  Error Details (Development Only)
                </summary>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--md-sys-color-error)'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Button variant="primary" onClick={this.handleReset}>
                <RefreshCw size={18} />
                Try Again
              </Button>
              <Button variant="outline" onClick={this.handleGoHome}>
                <Home size={18} />
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
