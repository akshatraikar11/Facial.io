import type { AttendanceLog } from '../types';

// ── CSV helpers ───────────────────────────────────────────────────────────

const escapeCSV = (field: string | null | undefined): string => {
  if (field === null || field === undefined) return '';
  const s = String(field);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const download = (content: string, filename: string) => {
  const BOM = '\uFEFF'; // Excel UTF-8 compatibility
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.visibility = 'hidden';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ── Raw attendance export (existing behaviour, preserved) ─────────────────

export const exportToCSV = (logs: AttendanceLog[], filename?: string | null): void => {
  if (!logs?.length) { alert('No attendance data to export.'); return; }

  const headers = ['Name', 'Date', 'Time', 'Status', 'Timestamp'];
  const rows = logs.map(l => [
    escapeCSV(l.name),
    escapeCSV(l.date),
    escapeCSV(l.time),
    escapeCSV(l.status),
    escapeCSV(l.checkInAt ?? l.timestamp ?? ''),
  ].join(','));

  download(
    [headers.join(','), ...rows].join('\n'),
    filename ?? `attendance-${new Date().toISOString().slice(0, 10)}.csv`,
  );
};

export const exportTodayAttendance   = (logs: AttendanceLog[]) => {
  const today = new Date().toISOString().slice(0, 10);
  exportToCSV(logs.filter(l => l.date === today), `attendance-today-${today}.csv`);
};

export const exportAllAttendance     = (logs: AttendanceLog[]) =>
  exportToCSV(logs, `attendance-all-${new Date().toISOString().slice(0, 10)}.csv`);

export const exportDateRange         = (logs: AttendanceLog[], start: string, end: string) =>
  exportToCSV(logs.filter(l => l.date >= start && l.date <= end), `attendance-${start}-to-${end}.csv`);

export const exportWeekAttendance = (logs: AttendanceLog[]) => {
  const today = new Date();
  const d = new Date(today);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  exportDateRange(logs, d.toISOString().slice(0, 10), today.toISOString().slice(0, 10));
};

export const exportMonthAttendance = (logs: AttendanceLog[]) => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  exportDateRange(logs, start, today.toISOString().slice(0, 10));
};

// ── Payroll summary export ─────────────────────────────────────────────────
//
// Produces one row per employee with:
//   Present days | Late days | Absent days | Total days | Attendance %
//
// This maps directly to what payroll software needs:
//   - Deduction = absent days × daily_rate
//   - Late penalty = late days × penalty_rate
//
// Usage: exportPayrollSummary(logs, 'monthly') from DashboardPage export button

export type PayrollPeriod = 'daily' | 'weekly' | 'monthly';

interface PayrollRow {
  name: string;
  present: number;
  late: number;
  absent: number;
  totalDays: number;
  attendancePct: string;
}

const buildPayrollSummary = (logs: AttendanceLog[]): PayrollRow[] => {
  // Group by employee name
  const map = new Map<string, { present: number; late: number; absent: number; days: Set<string> }>();

  for (const log of logs) {
    const key = log.name ?? 'Unknown';
    if (!map.has(key)) map.set(key, { present: 0, late: 0, absent: 0, days: new Set() });
    const entry = map.get(key)!;
    entry.days.add(log.date);
    if (log.status === 'present') entry.present++;
    else if (log.status === 'late') entry.late++;
    else if (log.status === 'absent') entry.absent++;
  }

  return Array.from(map.entries())
    .map(([name, e]) => {
      const totalDays = e.days.size;
      const worked = e.present + e.late;
      const attendancePct = totalDays > 0
        ? `${((worked / totalDays) * 100).toFixed(1)}%`
        : '0%';
      return { name, present: e.present, late: e.late, absent: e.absent, totalDays, attendancePct };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const exportPayrollSummary = (logs: AttendanceLog[], period: PayrollPeriod): void => {
  if (!logs?.length) { alert('No attendance data to export.'); return; }

  const today = new Date();
  let filtered = logs;
  let label = '';

  if (period === 'daily') {
    const d = today.toISOString().slice(0, 10);
    filtered = logs.filter(l => l.date === d);
    label = `daily-${d}`;
  } else if (period === 'weekly') {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    const s = start.toISOString().slice(0, 10);
    const e = today.toISOString().slice(0, 10);
    filtered = logs.filter(l => l.date >= s && l.date <= e);
    label = `weekly-${s}-to-${e}`;
  } else {
    const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const end = today.toISOString().slice(0, 10);
    filtered = logs.filter(l => l.date >= start && l.date <= end);
    label = `monthly-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  }

  const rows = buildPayrollSummary(filtered);
  if (!rows.length) { alert('No data for the selected period.'); return; }

  // Two sections in one file:
  // Section 1 — period metadata
  // Section 2 — per-employee summary
  const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
  const generatedAt = today.toLocaleString();

  const meta = [
    `Payroll Summary Report,${periodLabel}`,
    `Generated,${generatedAt}`,
    `Total Employees,${rows.length}`,
    `Total Logs,${filtered.length}`,
    '',
  ];

  const headers = [
    'Employee Name',
    'Days Present',
    'Days Late',
    'Days Absent',
    'Total Working Days',
    'Attendance %',
  ].join(',');

  const dataRows = rows.map(r => [
    escapeCSV(r.name),
    r.present,
    r.late,
    r.absent,
    r.totalDays,
    r.attendancePct,
  ].join(','));

  // Footer totals row
  const totals = [
    'TOTAL',
    rows.reduce((s, r) => s + r.present, 0),
    rows.reduce((s, r) => s + r.late, 0),
    rows.reduce((s, r) => s + r.absent, 0),
    rows.reduce((s, r) => s + r.totalDays, 0),
    '',
  ].join(',');

  const content = [...meta, headers, ...dataRows, totals].join('\n');
  download(content, `payroll-summary-${label}.csv`);
};
