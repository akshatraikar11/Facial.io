import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@clerk/clerk-react';
import { Clock, Plus, Trash2, X, Info } from 'lucide-react';
import { api } from '../../services/api';
import type { Shift } from '../../types';

const useOrgId = () => {
  const { organization } = useOrganization();
  return (organization?.id as string) ?? '';
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  border: '1px solid var(--md-sys-color-outline-variant)',
  fontSize: '14px', background: 'var(--md-sys-color-surface)',
  color: 'var(--md-sys-color-on-surface)', boxSizing: 'border-box',
};

/** Format "09:00" → "9:00 AM", "18:00" → "6:00 PM" */
const fmt12 = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
};

const ShiftsPage = () => {
  const orgId = useOrgId();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [grace, setGrace] = useState(15);
  const [error, setError] = useState<string | null>(null);

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ['shifts', orgId],
    queryFn: async () => (await api.get('/shifts')).data,
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post('/shifts', {
        name: name.trim(),
        startTime,
        endTime,
        gracePeriodMinutes: grace,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] });
      setShowForm(false);
      setName(''); setStartTime('09:00'); setEndTime('17:00'); setGrace(15);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: (shiftId: string) => api.delete(`/shifts/${shiftId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div style={{ padding: '32px', maxWidth: '860px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Shifts</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--md-sys-color-on-surface-variant)' }}>
            Define work shifts so check-ins are automatically marked present or late.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(null); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--md-sys-color-primary)', color: '#fff',
            border: 'none', borderRadius: '10px', padding: '10px 18px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={16} /> Add Shift
        </button>
      </div>

      {/* Info banner */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start',
        background: '#e8f0fe', borderRadius: '12px', padding: '12px 16px',
        marginBottom: '24px', fontSize: '13px', color: '#0b57d0' }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
        <span>
          When an employee checks in, the system finds the closest shift and marks them
          <strong> late</strong> if they arrive after the start time + grace period.
          Shift name appears on every attendance log.
        </span>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px',
          background: 'var(--md-sys-color-error-container)',
          color: 'var(--md-sys-color-on-error-container)',
          fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none',
            border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '16px' }}>×</button>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div style={{ background: 'var(--md-sys-color-surface-variant)', borderRadius: '16px',
          padding: '24px', marginBottom: '24px',
          border: '1px solid var(--md-sys-color-outline-variant)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>New Shift</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              placeholder="Shift name (e.g. Morning Shift)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#5f6368',
                  display: 'block', marginBottom: '6px' }}>Start Time</label>
                <input type="time" value={startTime}
                  onChange={(e) => setStartTime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#5f6368',
                  display: 'block', marginBottom: '6px' }}>End Time</label>
                <input type="time" value={endTime}
                  onChange={(e) => setEndTime(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#5f6368',
                display: 'block', marginBottom: '6px' }}>
                Grace Period: <strong>{grace} min</strong>
              </label>
              <input type="range" min={0} max={60} value={grace}
                onChange={(e) => setGrace(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: '11px', color: '#9aa0a6', marginTop: '2px' }}>
                <span>0 min (strict)</span><span>60 min</span>
              </div>
            </div>
            <button
              onClick={() => create.mutate()}
              disabled={!name.trim() || create.isPending}
              style={{ padding: '11px', borderRadius: '10px', border: 'none',
                background: name.trim() ? 'var(--md-sys-color-primary)' : '#ccc',
                color: '#fff', cursor: name.trim() ? 'pointer' : 'not-allowed',
                fontWeight: 600, fontSize: '14px' }}
            >
              {create.isPending ? 'Saving...' : 'Save Shift'}
            </button>
          </div>
        </div>
      )}

      {/* Shifts table */}
      <div style={{ background: 'var(--md-sys-color-surface)', borderRadius: '16px',
        border: '1px solid var(--md-sys-color-outline-variant)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--md-sys-color-surface-variant)' }}>
              {['Shift Name', 'Start', 'End', 'Grace Period', 'Late After', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '12px 20px', textAlign: 'left',
                  fontSize: '12px', fontWeight: 600,
                  color: 'var(--md-sys-color-on-surface-variant)',
                  textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                Loading...
              </td></tr>
            ) : shifts.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '48px', textAlign: 'center' }}>
                  <Clock size={32} color="#ccc" style={{ marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>
                    No shifts yet. Add one to enable automatic late detection.
                  </p>
                </td>
              </tr>
            ) : (
              shifts.map((shift) => {
                const [sh, sm] = shift.startTime.split(':').map(Number);
                const lateH = Math.floor((sh * 60 + sm + shift.gracePeriodMinutes) / 60);
                const lateM = (sh * 60 + sm + shift.gracePeriodMinutes) % 60;
                const lateTime = `${String(lateH).padStart(2, '0')}:${String(lateM).padStart(2, '0')}`;

                return (
                  <tr key={shift._id}
                    style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={14} color="#0b57d0" />
                        {shift.name}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontWeight: 600, color: '#137333' }}>
                        {fmt12(shift.startTime)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#5f6368' }}>
                      {fmt12(shift.endTime)}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: '12px', background: '#fef7e0',
                        color: '#7d5700', padding: '3px 10px', borderRadius: '99px',
                        fontWeight: 600 }}>
                        +{shift.gracePeriodMinutes} min
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: '12px', background: '#fce8e6',
                        color: '#c5221f', padding: '3px 10px', borderRadius: '99px',
                        fontWeight: 600 }}>
                        After {fmt12(lateTime)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove shift "${shift.name}"?`)) {
                            remove.mutate(shift._id);
                          }
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--md-sys-color-error)', padding: '4px' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ShiftsPage;
