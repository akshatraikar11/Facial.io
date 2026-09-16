import React from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Zap } from 'lucide-react';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['Up to 10 employees', 'Kiosk check-in', 'Basic attendance logs', 'Email support'],
    cta: null, // current plan — no button
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    features: ['Up to 100 employees', 'AI analytics assistant', 'Anomaly detection alerts', 'Advanced CSV export', 'Priority support'],
    cta: 'Upgrade to Pro',
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    features: ['Unlimited employees', 'Everything in Pro', 'Custom webhooks', 'Dedicated support', 'SLA guarantee'],
    cta: 'Upgrade to Enterprise',
    highlight: false,
  },
];

interface PricingModalProps {
  onClose: () => void;
}

const PricingModal = ({ onClose }: PricingModalProps) => {
  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Modal panel — stop click propagation so clicking inside doesn't close */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--md-sys-color-surface)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '860px',
          padding: '40px',
          position: 'relative',
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '20px', right: '20px',
            background: 'var(--md-sys-color-surface-variant)',
            border: 'none', borderRadius: '50%',
            width: '32px', height: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <span style={{
            fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--md-sys-color-primary)',
          }}>
            You've reached the free plan limit
          </span>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '8px 0 8px' }}>
            Upgrade to register more employees
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--md-sys-color-on-surface-variant)', margin: 0 }}>
            Free plan supports up to 10 employees. Upgrade anytime, cancel anytime.
          </p>
        </div>

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {PLANS.map(plan => (
            <div
              key={plan.id}
              style={{
                borderRadius: '16px',
                border: plan.highlight
                  ? '2px solid var(--md-sys-color-primary)'
                  : '1px solid var(--md-sys-color-outline-variant)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                background: plan.highlight
                  ? 'var(--md-sys-color-primary-container)'
                  : 'var(--md-sys-color-surface)',
              }}
            >
              {plan.highlight && (
                <span style={{
                  position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--md-sys-color-primary)', color: '#fff',
                  fontSize: '10px', fontWeight: 700, padding: '3px 12px',
                  borderRadius: '99px', letterSpacing: '0.06em',
                }}>
                  POPULAR
                </span>
              )}

              <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                color: 'var(--md-sys-color-on-surface-variant)' }}>
                {plan.name}
              </p>

              <p style={{ margin: '0 0 20px', fontSize: '32px', fontWeight: 700, letterSpacing: '-1px' }}>
                {plan.price === 0 ? 'Free' : `$${plan.price}`}
                {plan.price > 0 && (
                  <span style={{ fontSize: '13px', fontWeight: 400, color: '#888' }}>/mo</span>
                )}
              </p>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px' }}>
                    <Check size={13} style={{ color: '#22c55e', marginTop: '2px', flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.cta ? (
                <Link
                  to="/billing"
                  onClick={onClose}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px 16px', borderRadius: '10px', border: 'none',
                    background: plan.highlight ? 'var(--md-sys-color-primary)' : '#1e293b',
                    color: '#fff', fontWeight: 600, fontSize: '13px',
                    textDecoration: 'none', cursor: 'pointer',
                  }}
                >
                  <Zap size={13} /> {plan.cta}
                </Link>
              ) : (
                <div style={{
                  padding: '10px 16px', borderRadius: '10px', textAlign: 'center',
                  background: 'var(--md-sys-color-secondary-container)',
                  color: 'var(--md-sys-color-on-secondary-container)',
                  fontSize: '13px', fontWeight: 600,
                }}>
                  Current Plan
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
