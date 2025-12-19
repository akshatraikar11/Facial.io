import type { AttendanceLog } from '../types';

/**
 * Escape CSV field to handle commas, quotes, and newlines
 */
const escapeCSV = (field: string | null | undefined): string => {
  if (field === null || field === undefined) return '';
  const stringField = String(field);
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
};

/**
 * Export attendance data to CSV format
 */
export const exportToCSV = (
  attendanceLogs: AttendanceLog[],
  filename: string | null = null
): void => {
  if (!attendanceLogs || attendanceLogs.length === 0) {
    alert('No attendance data to export.');
    return;
  }

  // CSV headers
  const headers = ['Name', 'Date', 'Time', 'Status', 'Timestamp'];

  // Convert logs to CSV rows
  const rows = attendanceLogs.map(log => {
    return [
      escapeCSV(log.name || ''),
      escapeCSV(log.date || ''),
      escapeCSV(log.time || ''),
      escapeCSV(log.status || ''),
      escapeCSV(log.timestamp || '')
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Add BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Generate filename if not provided
  if (!filename) {
    const date = new Date().toISOString().slice(0, 10);
    filename = `attendance-${date}.csv`;
  }

  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export today's attendance
 */
export const exportTodayAttendance = (allLogs: AttendanceLog[]): void => {
  const today = new Date().toISOString().slice(0, 10);
  const todaysLogs = allLogs.filter(log => log.date === today);
  exportToCSV(todaysLogs, `attendance-today-${today}.csv`);
};

/**
 * Export all attendance data
 */
export const exportAllAttendance = (allLogs: AttendanceLog[]): void => {
  exportToCSV(allLogs, `attendance-all-${new Date().toISOString().slice(0, 10)}.csv`);
};

/**
 * Export attendance for a date range
 */
export const exportDateRange = (
  allLogs: AttendanceLog[],
  startDate: string,
  endDate: string
): void => {
  const filteredLogs = allLogs.filter(log => {
    return log.date >= startDate && log.date <= endDate;
  });
  exportToCSV(filteredLogs, `attendance-${startDate}-to-${endDate}.csv`);
};

/**
 * Export current week's attendance
 */
export const exportWeekAttendance = (allLogs: AttendanceLog[]): void => {
  const today = new Date();
  const dayOfWeek = today.getDay() || 7; // Sunday is 0, make it 7 for easier math if needed, or stick to 0-6

  // Calculate start of week (Monday)
  const startObj = new Date(today);
  const day = startObj.getDay();
  const diff = startObj.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  startObj.setDate(diff);

  const startStr = startObj.toISOString().slice(0, 10);
  const endStr = today.toISOString().slice(0, 10);

  exportDateRange(allLogs, startStr, endStr);
};

/**
 * Export current month's attendance
 */
export const exportMonthAttendance = (allLogs: AttendanceLog[]): void => {
  const today = new Date();
  const startObj = new Date(today.getFullYear(), today.getMonth(), 1);

  const startStr = startObj.toISOString().slice(0, 10);
  const endStr = today.toISOString().slice(0, 10);

  exportDateRange(allLogs, startStr, endStr);
};
