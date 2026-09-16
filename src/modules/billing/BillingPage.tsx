import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useOrganization } from '@clerk/clerk-react';
import { Check, Zap, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import type { Plan } from '../../types';

const useOrgId = () => {
  const { organization } = useOrganization();
  return (organization?.id as string) ?? '';
};

const BillingPage = () => {
  const orgId = useOrgId();
  // Track which plan's button is loading individually
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: async () => (await api.get('/billing/plans')).data,
  });

  const { data: org } = useQuery<{ plan: string }>({
    queryKey: ['org-me'],
    queryFn: async () => (await api.get('/organizations/me')).data,
    enabled: !!orgId,
  });

  const checkout = useMutation({
    mutationFn: (plan: 'pro' | 'enterprise') =>
      api.post<{ url: string }>('/billing/checkout', { plan }).then((r) => r.data),
    onMutate: (plan) => { setPendingPlan(plan); setCheckoutError(null); },
    onSuccess: (data) => { window.location.href = data.url; },
    onError: (err: Error) => { setCheckoutError(err.message); setPendingPlan(null); },
    onSettled: () => setPendingPlan(null),
  });

  const portal = useMutation({
    mutationFn: () => api.post<{ url: string }>('/billing/portal').then((r) => r.data),
    onMutate: () => setPortalError(null),
    onSuccess: (data) => { window.location.href = data.url; },
    onError: (err: Error) => setPortalError(err.message),
  });

  const currentPlan = org?.plan ?? 'free';

  return (
    <div style={{ padding: '32px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Billing</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--md-sys-color-on-surface-variant)' }}>
          Current plan: <strong style={{ textTransform: 'capitalize' }}>{currentPlan}</strong>
        </p>
      </div>

      {/* Manage subscription button */}
      {currentPlan !== 'free' && (
        <div style={{ marginBottom: '28px' }}>
          <button
            onClick={() => portal.mutate()}
            disabled={portal.isPending}
            style={{
              padding: '10px 20px', borderRadius: '10px',
              border: '1px solid var(--md-sys-color-outline)',
              background: 'transparent', cursor: portal.isPending ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: '14px', opacity: portal.isPending ? 0.7 : 1,
            }}
          >
            {portal.isPending ? 'Opening portal...' : 'Manage Subscription →'}
          </button>
          {portalError && (
            <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--md-sys-color-error)',
              display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} /> {portalError}
            </p>
          )}
        </div>
      )}

      {/* Global checkout error */}
      {checkoutError && (
        <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px',
          background: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)',
          fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> {checkoutError}
        </div>
      )}

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isPro = plan.id === 'pro';
          const isThisPending = pendingPlan === plan.id;

          return (
            <div key={plan.id} style={{
              background: 'var(--md-sys-color-surface)', borderRadius: '20px',
              border: isPro
                ? '2px solid var(--md-sys-color-primary)'
                : '1px solid var(--md-sys-color-outline-variant)',
              padding: '28px', position: 'relative', display: 'flex', flexDirection: 'column',
            }}>
              {isPro && (
                <span style={{
                  position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--md-sys-color-primary)', color: '#fff',
                  fontSize: '11px', fontWeight: 700, padding: '3px 14px',
                  borderRadius: '99px', letterSpacing: '0.04em',
                }}>
                  POPULAR
                </span>
              )}

              <div style={{ marginBottom: '20px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600,
                  color: 'var(--md-sys-color-on-surface-variant)', textTransform: 'uppercase',
                  letterSpacing: '0.06em' }}>
                  {plan.name}
                </p>
                <p style={{ margin: 0, fontSize: '36px', fontWeight: 700, letterSpacing: '-1px' }}>
                  {plan.price === 0 ? 'Free' : `$${plan.price}`}
                  {plan.price > 0 && (
                    <span style={{ fontSize: '14px', fontWeight: 400, color: '#888' }}>/mo</span>
                  )}
                </p>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', flex: 1 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px',
                    marginBottom: '8px', fontSize: '13px' }}>
                    <Check size={14} style={{ color: '#22c55e', marginTop: '2px', flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div style={{ padding: '10px', borderRadius: '10px', textAlign: 'center',
                  background: 'var(--md-sys-color-secondary-container)', fontSize: '13px', fontWeight: 600,
                  color: 'var(--md-sys-color-on-secondary-container)' }}>
                  Current Plan
                </div>
              ) : plan.id !== 'free' && (
                <button
                  onClick={() => checkout.mutate(plan.id as 'pro' | 'enterprise')}
                  disabled={!!pendingPlan}
                  style={{
                    padding: '10px', borderRadius: '10px', border: 'none',
                    cursor: pendingPlan ? 'not-allowed' : 'pointer',
                    background: isPro ? 'var(--md-sys-color-primary)' : '#1e293b',
                    color: '#fff', fontWeight: 600, fontSize: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    opacity: pendingPlan && !isThisPending ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <Zap size={14} />
                  {isThisPending ? 'Redirecting...' : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BillingPage;
