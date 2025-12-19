import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';

const ProtectedAdminRoute = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();

        try {
            const response = await fetch('/api/auth/verify-pin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pin })
            });

            const data = await response.json();

            if (response.ok) {
                setIsAuthenticated(true);
                setError('');
            } else {
                setError(data.message || 'Incorrect PIN');
                setPin('');
            }
        } catch {
            setError('Connection error. Please try again.');
        }
    };

    if (isAuthenticated) {
        return <>{children}</>;
    }

    return (
        <section className="full-screen-center" style={{ background: 'transparent' }}>
            <Card variant="surface" style={{ maxWidth: '400px', width: '100%', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div
                        style={{
                            width: '48px',
                            height: '48px',
                            background: 'var(--md-sys-color-secondary-container)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px',
                            color: 'var(--md-sys-color-on-secondary-container)'
                        }}
                    >
                        <Lock size={24} />
                    </div>
                    <h3>Admin Access</h3>
                    <p>Please enter the admin PIN to continue.</p>
                </div>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <input
                            type="password"
                            className="input-field"
                            placeholder="Enter PIN"
                            value={pin}
                            onChange={(e) => {
                                setPin(e.target.value);
                                setError('');
                            }}
                            autoFocus
                            maxLength={4}
                            style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '24px' }}
                        />
                        {error && (
                            <p style={{ color: 'var(--md-sys-color-error)', fontSize: '14px', marginTop: '8px', textAlign: 'center' }}>
                                {error}
                            </p>
                        )}
                    </div>
                    <Button type="submit" variant="primary" size="lg" style={{ width: '100%' }}>
                        Unlock
                    </Button>
                </form>
            </Card>
        </section>
    );
};

export default ProtectedAdminRoute;
