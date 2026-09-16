import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@clerk/clerk-react';
import { UserPlus, Trash2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import type { Employee } from '../../types';
import RegisterFaceModal from './RegisterFaceModal';
import { qualityColor } from '../../utils/faceQuality';
import type { QualityLabel } from '../../utils/faceQuality';

const useOrgId = () => {
  const { organization } = useOrganization();
  return (organization?.id as string) ?? '';
};

const EmployeesPage = () => {
  const orgId = useOrgId();
  const qc = useQueryClient();
  const [showRegister, setShowRegister] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const { data: employees = [], isLoading, isError } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: async () => (await api.get('/employees')).data,
    enabled: !!orgId,
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => {
      setDeactivateError(null);
      qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: Error) => {
      setDeactivateError(err.message ?? 'Failed to deactivate employee. Please try again.');
    },
  });

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Employees</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--md-sys-color-on-surface-variant)' }}>
            {isLoading ? 'Loading...' : `${employees.length} registered face${employees.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowRegister(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--md-sys-color-primary)', color: '#fff',
            border: 'none', borderRadius: '10px', padding: '10px 18px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <UserPlus size={16} /> Register Employee
        </button>
      </div>

      {/* Deactivate error banner */}
      {deactivateError && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '10px',
          background: 'var(--md-sys-color-error-container)',
          color: 'var(--md-sys-color-on-error-container)',
          fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <AlertCircle size={15} />
          {deactivateError}
          <button
            onClick={() => setDeactivateError(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none',
              cursor: 'pointer', fontWeight: 700, fontSize: '16px',
              color: 'var(--md-sys-color-on-error-container)' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--md-sys-color-surface)', borderRadius: '16px',
        border: '1px solid var(--md-sys-color-outline-variant)', overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--md-sys-color-surface-variant)' }}>
              {['Name', 'Email', 'Role', 'Face Quality', 'Face Enrolled', 'Actions'].map((h) => (
                <th key={h} style={{
                  padding: '12px 20px', textAlign: 'left',
                  fontSize: '12px', fontWeight: 600,
                  color: 'var(--md-sys-color-on-surface-variant)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                  Loading employees...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center',
                  color: 'var(--md-sys-color-error)' }}>
                  Failed to load employees. Check your connection and try again.
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                  No employees yet. Register one to get started.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp._id} style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                        background: 'var(--md-sys-color-primary-container)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '13px', fontWeight: 700,
                        color: 'var(--md-sys-color-on-primary-container)',
                      }}>
                        {(emp.name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      {emp.name}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '13px',
                    color: 'var(--md-sys-color-on-surface-variant)' }}>
                    {emp.email}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '99px',
                      background: emp.role === 'admin' ? '#ede9fe' : '#f1f5f9',
                      color: emp.role === 'admin' ? '#5b21b6' : '#475569',
                    }}>
                      {emp.role}
                    </span>
                  </td>
                  {/* Face Quality cell */}
                  <td style={{ padding: '14px 20px' }}>
                    {emp.faceQualityLabel ? (() => {
                      const qc = qualityColor[emp.faceQualityLabel as QualityLabel];
                      return (
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '99px',
                          background: qc.bg, color: qc.color,
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%',
                            background: qc.dot, display: 'inline-block' }} />
                          {emp.faceQualityLabel.charAt(0).toUpperCase() + emp.faceQualityLabel.slice(1)}
                          {emp.faceQualityScore != null ? ` · ${emp.faceQualityScore}` : ''}
                        </span>
                      );
                    })() : (
                      <span style={{ fontSize: '11px', color: '#9aa0a6' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '99px',
                      background: emp.pineconeId ? '#dcfce7' : '#fef9c3',
                      color: emp.pineconeId ? '#15803d' : '#92400e',
                    }}>
                      {emp.pineconeId ? '✓ Enrolled' : '⏳ Pending'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <button
                      onClick={() => {
                        if (window.confirm(`Deactivate ${emp.name}? They will no longer be able to check in.`)) {
                          deactivate.mutate(emp._id);
                        }
                      }}
                      disabled={deactivate.isPending}
                      title="Deactivate employee"
                      style={{
                        background: 'none', border: 'none', cursor: deactivate.isPending ? 'not-allowed' : 'pointer',
                        color: 'var(--md-sys-color-error)', padding: '4px', opacity: deactivate.isPending ? 0.5 : 1,
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showRegister && (
        <RegisterFaceModal
          onClose={() => setShowRegister(false)}
          onSuccess={() => {
            setShowRegister(false);
            qc.invalidateQueries({ queryKey: ['employees'] });
          }}
        />
      )}
    </div>
  );
};

export default EmployeesPage;
