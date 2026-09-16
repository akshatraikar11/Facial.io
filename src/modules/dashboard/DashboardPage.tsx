import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@clerk/clerk-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Users, UserCheck, TrendingUp, RefreshCw, Download, MapPin } from 'lucide-react';
import { api } from '../../services/api';
import { useSocket } from '../../shared/hooks/useSocket';
import { exportTodayAttendance, exportWeekAttendance, exportMonthAttendance, exportPayrollSummary } from '../../utils/export';
import type { AttendanceStats, AttendanceLog, Location } from '../../types';

const useOrgId = () => {
  const { organization } = useOrganization();
  return (organization?.id as string) ?? '';
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Deterministic hue from a name string — safe for empty/undefined names */
const nameHue = (name: string | undefined): number =>
  name && name.length > 0 ? (name.charCodeAt(0) * 37) % 360 : 200;

// ── Sub-components ─────────────────────────────────────────────────────────

const StatCard = ({
  icon, label, value, sub, color, bg,
}: {
  icon: React.ReactNode; label: string; value: string;
  sub: string; color: string; bg: string;
}) => (
  <div style={{
    background: '#ffffff', borderRadius: '20px', border: '1px solid #e8eaed',
    padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '13px', fontWeight: 500, color: '#5f6368', letterSpacing: '0.1px' }}>
        {label}
      </span>
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </div>
    </div>
    <div>
      <p style={{ margin: 0, fontSize: '34px', fontWeight: 700, letterSpacing: '-1.5px',
        lineHeight: 1, color: '#1f1f1f' }}>{value}</p>
      <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#9aa0a6', fontWeight: 500 }}>{sub}</p>
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; color: string; dot: string }> = {
    present: { bg: '#e6f4ea', color: '#137333', dot: '#34a853' },
    late:    { bg: '#fef7e0', color: '#7d5700', dot: '#fbbc04' },
    absent:  { bg: '#fce8e6', color: '#c5221f', dot: '#ea4335' },
  };
  const s = map[status] ?? { bg: '#f1f3f4', color: '#3c4043', dot: '#9aa0a6' };
  return (
    <span style={{
      background: s.bg, color: s.color, fontSize: '11px', fontWeight: 600,
      padding: '3px 10px', borderRadius: '99px', textTransform: 'capitalize',
      display: 'inline-flex', alignItems: 'center', gap: '5px',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {status}
    </span>
  );
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px',
      padding: '10px 14px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#1f1f1f' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ margin: '2px 0', color: p.color, fontWeight: 500 }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────

const DashboardPage = () => {
  const orgId = useOrgId();
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');
  const [locationFilter, setLocationFilter] = useState<string>('');

  // Fetch available locations for the filter dropdown
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations', orgId],
    queryFn: async () => (await api.get('/locations')).data,
    enabled: !!orgId,
  });

  // Date range → query params for the API
  const dateParams = (() => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (dateRange === 'today') return { date: fmt(now) };
    if (dateRange === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - 6);
      return { startDate: fmt(start), endDate: fmt(now) };
    }
    const start = new Date(now); start.setDate(now.getDate() - 29);
    return { startDate: fmt(start), endDate: fmt(now) };
  })();

  const { data: stats, isLoading: statsLoading, refetch, isFetching } =
    useQuery<AttendanceStats>({
      queryKey: ['attendance-stats', orgId],
      queryFn: async () => (await api.get('/attendance/stats')).data,
      enabled: !!orgId,
      refetchInterval: 60_000,
    });

  // Logs are fetched scoped to the selected date range + location
  const { data: initialLogs = [] } = useQuery<AttendanceLog[]>({
    queryKey: ['attendance-logs', orgId, dateRange, locationFilter],
    queryFn: async () =>
      (await api.get('/attendance', { params: { ...dateParams, ...(locationFilter ? { locationId: locationFilter } : {}) } })).data,
    enabled: !!orgId,
  });

  const [liveLogs, setLiveLogs] = useState<AttendanceLog[]>([]);
  React.useEffect(() => { setLiveLogs(initialLogs); }, [initialLogs]);

  // Stable callback — useSocket uses callbackRef internally
  const handleNewCheckIn = useCallback((log: AttendanceLog) => {
    setLiveLogs((prev) => [log, ...prev]);
  }, []);
  useSocket(orgId, handleNewCheckIn);

  const trend = stats?.weeklyTrend ?? [];
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const handleExport = () => {
    const logs = liveLogs.length > 0 ? liveLogs : [];
    if (dateRange === 'today')  exportTodayAttendance(logs);
    else if (dateRange === 'week')  exportWeekAttendance(logs);
    else exportMonthAttendance(logs);
  };

  const handlePayrollExport = () => {
    const logs = liveLogs.length > 0 ? liveLogs : [];
    if (dateRange === 'today') exportPayrollSummary(logs, 'daily');
    else if (dateRange === 'week') exportPayrollSummary(logs, 'weekly');
    else exportPayrollSummary(logs, 'monthly');
  };

  return (
    <div style={{ padding: '32px 36px', maxWidth: '1200px', margin: '0 auto',
      display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: 600, color: '#9aa0a6',
            letterSpacing: '0.08em', textTransform: 'uppercase' }}>{today}</p>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: '#1f1f1f', letterSpacing: '-0.5px' }}>
            Dashboard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#5f6368' }}>
            Real-time activity and system overview.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => refetch()} style={{ display: 'flex', alignItems: 'center', gap: '6px',
            background: '#fff', border: '1px solid #dadce0', borderRadius: '10px', padding: '9px 16px',
            cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: '#3c4043' }}>
            <RefreshCw size={14} style={{ animation: isFetching ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
          <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '6px',
            background: '#0b57d0', border: 'none', borderRadius: '10px', padding: '9px 16px',
            cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#fff' }}>
            <Download size={14} />
            Export
          </button>
          <button onClick={handlePayrollExport} style={{ display: 'flex', alignItems: 'center', gap: '6px',
            background: '#137333', border: 'none', borderRadius: '10px', padding: '9px 16px',
            cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#fff' }}>
            <Download size={14} />
            Payroll CSV
          </button>

          {/* Date range pills — wired to real API query */}
          <div style={{ display: 'flex', background: '#f1f3f4', borderRadius: '10px',
            padding: '3px', gap: '2px', marginLeft: '4px' }}>
            {(['today', 'week', 'month'] as const).map((r) => (
              <button key={r} onClick={() => setDateRange(r)} style={{
                padding: '6px 14px', borderRadius: '8px', border: 'none',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                background: dateRange === r ? '#fff' : 'transparent',
                color: dateRange === r ? '#0b57d0' : '#5f6368',
                boxShadow: dateRange === r ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s', textTransform: 'capitalize',
              }}>
                {r === 'today' ? 'Today' : r === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>

          {/* Location filter */}
          {locations.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px',
              background: '#fff', border: '1px solid #dadce0', borderRadius: '10px',
              padding: '6px 12px', fontSize: '13px' }}>
              <MapPin size={13} color="#5f6368" />
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '13px',
                  color: '#3c4043', background: 'transparent', cursor: 'pointer' }}
              >
                <option value="">All locations</option>
                {locations.map((loc) => (
                  <option key={loc.locationId} value={loc.locationId}>{loc.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <StatCard icon={<UserCheck size={18} />} label="Present Today"
          value={statsLoading ? '—' : `${stats?.presentToday ?? 0}`}
          sub={`of ${stats?.totalEmployees ?? 0} employees`}
          color="#0b57d0" bg="#e8f0fe" />
        <StatCard icon={<TrendingUp size={18} />} label="Attendance Rate"
          value={statsLoading ? '—' : `${stats?.attendanceRate ?? 0}%`}
          sub="Daily average" color="#137333" bg="#e6f4ea" />
        <StatCard icon={<Users size={18} />} label="Total Faces"
          value={statsLoading ? '—' : `${stats?.totalEmployees ?? 0}`}
          sub="Registered profiles" color="#7627bb" bg="#f3e8fd" />
      </div>

      {/* Chart + Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '20px' }}>

        {/* Weekly trend chart */}
        <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e8eaed',
          padding: '24px 24px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: '#1f1f1f' }}>Weekly Trend</h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9aa0a6' }}>
                Attendance over the last 7 days
              </p>
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '12px', fontWeight: 500 }}>
              {[{ label: 'Present', color: '#0b57d0' }, { label: 'Late', color: '#fbbc04' }].map((l) => (
                <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#5f6368' }}>
                  <span style={{ width: 10, height: 3, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trend} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0b57d0" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#0b57d0" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbc04" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#fbbc04" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9aa0a6' }}
                tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9aa0a6' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="present" stroke="#0b57d0" fill="url(#presentGrad)"
                strokeWidth={2.5} dot={false} name="Present" />
              <Area type="monotone" dataKey="late" stroke="#fbbc04" fill="url(#lateGrad)"
                strokeWidth={2.5} dot={false} name="Late" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Live check-in feed */}
        <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e8eaed',
          overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #f1f3f4',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: '#1f1f1f' }}>
              Recent Check-ins
            </h3>
            <span style={{ fontSize: '11px', color: '#137333', fontWeight: 700,
              background: '#e6f4ea', padding: '3px 10px', borderRadius: '99px',
              display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34a853',
                display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
              {liveLogs.length} today
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '320px' }}>
            {liveLogs.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🕐</div>
                <p style={{ margin: 0, fontSize: '13px', color: '#9aa0a6', fontWeight: 500 }}>
                  No activity recorded yet.
                </p>
              </div>
            ) : (
              liveLogs.slice(0, 20).map((log, i) => {
                const hue = nameHue(log.name);
                return (
                  <div key={log._id ?? i} style={{ display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 20px',
                    borderBottom: i < Math.min(liveLogs.length, 20) - 1 ? '1px solid #f8f9fa' : 'none' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '12px', flexShrink: 0,
                      background: `hsl(${hue}, 65%, 90%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '15px', fontWeight: 700,
                      color: `hsl(${hue}, 60%, 35%)`,
                    }}>
                      {(log.name ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: '#1f1f1f',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.name}
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#9aa0a6', marginTop: '1px' }}>
                        {log.time}{log.locationName ? ` · ${log.locationName}` : ''}
                        {log.shiftName ? ` · ${log.shiftName}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={log.status} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
