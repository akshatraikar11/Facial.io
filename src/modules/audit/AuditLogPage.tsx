import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@clerk/clerk-react';
import { ClipboardList, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { api } from '../../services/api';
import type { AuditLogEntry } from '../../types';

const useOrgId = () => {
  const { organization } = useOrganization();
  return (organization?.id as string) ?? '';
};

// ── Action colour coding ──────────────────────────────────────────────────

const actionMeta: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  'employee.created':     { bg: '#e6f4ea', color: '#137333', dot: '#34a853', label: 'Employee Created' },
  'employee.updated':     { bg: '#e8f0fe', color: '#0b57d0', dot: '#4285f4', label: 'Employee Updated' },
  'employee.deactivated': { bg: '#fef7e0', color: '#7d5700', dot: '#fbbc04', label: 'Employee Deactivated' },
  'employee.deleted':     { bg: '#fce8e6', color: '#c5221f', dot: '#ea4335', label: 'Employee Deleted' },
  'attendance.deleted':   { bg: '#fce8e6', color: '#c5221f', dot: '#ea4335', label: 'Log Deleted' },
  'attendance.cleared':   { bg: '#fce8e6', color: '#c5221f', dot: '#ea4335', label: 'Logs Cleared' },
  'plan.changed':         { bg: '#f3e8fd', color: '#7627bb', dot: '#9334e6', label: 'Plan Changed' },
  'location.created':     { bg: '#e6f4ea', color: '#137333', dot: '#34a853', label: 'Location Created' },
  'location.deleted':     { bg: '#fce8e6', color: '#c5221f', dot: '#ea4335', label: 'Location Deleted' },
  'shift.created':        { bg: '#e6f4ea', color: '#137333', dot: '#34a853', label: 'Shift Created' },
  'shift.deleted':        { bg: '#fce8e6', color: '#c5221f', dot: '#ea4335', label: 'Shift Deleted' },
};

const fallbackMeta = { bg: '#f1f3f4', color: '#3c4043', dot: '#9aa0a6', label: '' };

const ActionBadge = ({ action }: { action: string }) => {
  const m = actionMeta[action] ?? fallbackMeta;
  const label = m.label || action.replace('.', ' · ');
  return (
    <span style={{
      background: m.bg, color: m.color, fontSize: '11px', fontWeight: 600,
      padding: '3px 10px', borderRadius: '99px',
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%',
        background: m.dot, display: 'inline-block' }} />
      {label}
    </span>
  );
};

// ── Before/After diff viewer ───────────────────────────────────────────────

const DiffViewer = ({ before, after }: {
  before: Record<string, unknown> | null;
  after:  Record<string, unknown> | null;
}) => {
  if (!before && !after) return null;

  const keys = Array.from(new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])).filter((k) => !['__v', 'updatedAt', 'createdAt', 'orgId'].includes(k));

  const changed = keys.filter(
    (k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]),
  );

  if (!before) {
    // Create — show after values
    return (
      <div style={{ fontSize: '11px', fontFamily: 'monospace',
        background: '#f8f9fa', borderRadius: '8px', padding: '10px 14px',
        maxHeight: '140px', overflowY: 'auto' }}>
        {keys.slice(0, 12).map((k) => (
          <div key={k} style={{ color: '#137333' }}>
            + {k}: {JSON.stringify(after?.[k])}
          </div>
        ))}
      </div>
    );
  }

  if (!after) {
    // Delete — show before values
    return (
      <div style={{ fontSize: '11px', fontFamily: 'monospace',
        background: '#f8f9fa', borderRadius: '8px', padding: '10px 14px',
        maxHeight: '140px', overflowY: 'auto' }}>
        {keys.slice(0, 12).map((k) => (
          <div key={k} style={{ color: '#c5221f' }}>
            - {k}: {JSON.stringify(before?.[k])}
          </div>
        ))}
      </div>
    );
  }

  // Update — show only changed fields
  if (changed.length === 0) return (
    <p style={{ fontSize: '11px', color: '#9aa0a6', margin: 0 }}>No field changes recorded.</p>
  );

  return (
    <div style={{ fontSize: '11px', fontFamily: 'monospace',
      background: '#f8f9fa', borderRadius: '8px', padding: '10px 14px',
      maxHeight: '160px', overflowY: 'auto' }}>
      {changed.map((k) => (
        <div key={k} style={{ marginBottom: '4px' }}>
          <span style={{ color: '#c5221f', display: 'block' }}>
            - {k}: {JSON.stringify(before?.[k])}
          </span>
          <span style={{ color: '#137333', display: 'block' }}>
            + {k}: {JSON.stringify(after?.[k])}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const ACTION_OPTIONS = [
  'employee.created', 'employee.updated', 'employee.deactivated', 'employee.deleted',
  'attendance.deleted', 'attendance.cleared',
  'location.created', 'location.deleted',
  'shift.created', 'shift.deleted',
  'plan.changed',
];

const ENTITY_OPTIONS = ['employee', 'attendance', 'location', 'shift', 'plan'];

const AuditLogPage = () => {
  const orgId = useOrgId();
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const offset = page * PAGE_SIZE;

  const { data, isLoading } = useQuery<{ entries: AuditLogEntry[]; total: number }>({
    queryKey: ['audit', orgId, page, actionFilter, entityFilter],
    queryFn: async () =>
      (await api.get('/audit', {
        params: {
          limit: PAGE_SIZE,
          offset,
          ...(actionFilter ? { action: actionFilter } : {}),
          ...(entityFilter ? { entityType: entityFilter } : {}),
        },
      })).data,
    enabled: !!orgId,
  });

  const entries = data?.entries ?? [];
  const total   = data?.total   ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const clearFilters = () => {
    setActionFilter('');
    setEntityFilter('');
    setPage(0);
  };

  const hasFilters = !!(actionFilter || entityFilter);

  return (
    <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Audit Log</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--md-sys-color-on-surface-variant)' }}>
            Immutable record of every admin action with before/after state.
          </p>
        </div>
        {total > 0 && (
          <span style={{ fontSize: '13px', color: '#5f6368',
            background: '#f1f3f4', padding: '6px 14px',
            borderRadius: '10px', fontWeight: 500 }}>
            {total.toLocaleString()} entries
          </span>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px',
        alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px',
          background: '#fff', border: '1px solid #dadce0', borderRadius: '10px',
          padding: '6px 12px', fontSize: '13px' }}>
          <Filter size={13} color="#5f6368" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
            style={{ border: 'none', outline: 'none', fontSize: '13px',
              color: '#3c4043', background: 'transparent', cursor: 'pointer' }}
          >
            <option value="">All actions</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {actionMeta[a]?.label ?? a}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px',
          background: '#fff', border: '1px solid #dadce0', borderRadius: '10px',
          padding: '6px 12px', fontSize: '13px' }}>
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }}
            style={{ border: 'none', outline: 'none', fontSize: '13px',
              color: '#3c4043', background: 'transparent', cursor: 'pointer' }}
          >
            <option value="">All entity types</option>
            {ENTITY_OPTIONS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            style={{ display: 'flex', alignItems: 'center', gap: '5px',
              background: 'none', border: '1px solid #dadce0', borderRadius: '10px',
              padding: '6px 12px', fontSize: '13px', cursor: 'pointer', color: '#5f6368' }}
          >
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--md-sys-color-surface)', borderRadius: '16px',
        border: '1px solid var(--md-sys-color-outline-variant)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--md-sys-color-surface-variant)' }}>
              {['Timestamp', 'Action', 'Entity', 'Performed By', 'Details'].map((h) => (
                <th key={h} style={{
                  padding: '12px 18px', textAlign: 'left',
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
                <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
                  Loading audit log...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '48px', textAlign: 'center' }}>
                  <ClipboardList size={36} color="#dadce0"
                    style={{ display: 'block', margin: '0 auto 10px' }} />
                  <p style={{ margin: 0, color: '#9aa0a6', fontSize: '14px' }}>
                    {hasFilters
                      ? 'No entries match the current filters.'
                      : 'No admin actions recorded yet. Actions will appear here as you manage the system.'}
                  </p>
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const isExpanded = expandedId === entry._id;
                const ts = new Date(entry.createdAt);
                const hasDiff = entry.before || entry.after;

                return (
                  <React.Fragment key={entry._id}>
                    <tr
                      onClick={() => hasDiff && setExpandedId(isExpanded ? null : entry._id)}
                      style={{
                        borderTop: '1px solid var(--md-sys-color-outline-variant)',
                        cursor: hasDiff ? 'pointer' : 'default',
                        background: isExpanded ? '#fafbff' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isExpanded)
                          (e.currentTarget as HTMLTableRowElement).style.background = '#f8f9fa';
                      }}
                      onMouseLeave={(e) => {
                        if (!isExpanded)
                          (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                      }}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: '13px 18px', whiteSpace: 'nowrap' }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#1f1f1f' }}>
                          {ts.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p style={{ margin: 0, fontSize: '11px', color: '#9aa0a6', marginTop: '1px' }}>
                          {ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      </td>

                      {/* Action badge */}
                      <td style={{ padding: '13px 18px' }}>
                        <ActionBadge action={entry.action} />
                      </td>

                      {/* Entity */}
                      <td style={{ padding: '13px 18px' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#3c4043' }}>
                          {entry.entityType}
                        </p>
                        {entry.entityId && (
                          <p style={{ margin: 0, fontSize: '10px', color: '#9aa0a6',
                            fontFamily: 'monospace', marginTop: '2px' }}>
                            {entry.entityId.slice(-8)}
                          </p>
                        )}
                      </td>

                      {/* Performed by */}
                      <td style={{ padding: '13px 18px' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#1f1f1f',
                          whiteSpace: 'nowrap', overflow: 'hidden',
                          textOverflow: 'ellipsis', maxWidth: '200px' }}>
                          {entry.userEmail}
                        </p>
                      </td>

                      {/* Expand toggle */}
                      <td style={{ padding: '13px 18px' }}>
                        {hasDiff ? (
                          <span style={{ fontSize: '11px', color: '#0b57d0',
                            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {isExpanded ? 'Hide diff ▲' : 'View diff ▼'}
                          </span>
                        ) : (
                          entry.metadata ? (
                            <span style={{ fontSize: '11px', color: '#9aa0a6', fontFamily: 'monospace' }}>
                              {JSON.stringify(entry.metadata).slice(0, 40)}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#dadce0' }}>—</span>
                          )
                        )}
                      </td>
                    </tr>

                    {/* Expanded diff row */}
                    {isExpanded && (
                      <tr style={{ background: '#fafbff',
                        borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
                        <td colSpan={5} style={{ padding: '0 18px 16px 18px' }}>
                          <DiffViewer before={entry.before} after={entry.after} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginTop: '16px' }}>
          <span style={{ fontSize: '13px', color: '#5f6368' }}>
            Page {page + 1} of {totalPages} · {total} total entries
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '7px 14px', borderRadius: '8px',
                border: '1px solid #dadce0', background: '#fff',
                fontSize: '13px', fontWeight: 500, cursor: page === 0 ? 'not-allowed' : 'pointer',
                color: page === 0 ? '#dadce0' : '#3c4043',
              }}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '7px 14px', borderRadius: '8px',
                border: '1px solid #dadce0', background: '#fff',
                fontSize: '13px', fontWeight: 500,
                cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                color: page >= totalPages - 1 ? '#dadce0' : '#3c4043',
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;
