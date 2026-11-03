// ── Server-side types — match NestJS schemas exactly ─────────────────────────

export interface Employee {
  _id: string;
  orgId: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  department: string | null;
  managerEmail: string | null;
  descriptor: number[];
  pineconeId: string | null;
  isActive: boolean;
  defaultLocationId: string | null;
  faceQualityScore: number | null;
  faceQualityLabel: 'good' | 'fair' | 'poor' | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceLog {
  _id: string;
  orgId: string;
  employeeId: string;
  name: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
  status: 'present' | 'late' | 'absent';
  checkInAt: string;  // ISO timestamp
  locationId: string | null;
  locationName: string | null;
  shiftId: string | null;
  shiftName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceStats {
  totalToday: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  totalEmployees: number;
  attendanceRate: number;
  weeklyData: { date: string; present: number; late: number; absent: number }[];
}

export interface Location {
  _id: string;
  orgId: string;
  name: string;
  slug: string;
  address?: string;
  createdAt: string;
}

export interface Shift {
  _id: string;
  orgId: string;
  name: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  gracePeriodMinutes: number;
  createdAt: string;
}

// ── Legacy local-storage types — used only by src/utils/storage.ts (Dexie) ──
// Kept for backward compat with db.ts; not used by any active page.

export interface LocalUser {
  id: string;
  name: string;
  email: string;
  descriptors: number[][];
  createdAt: string;
  updatedAt?: string;
}

export interface FaceApiContextType {
  modelsLoaded: boolean;
  loading: boolean;
  error: string | null;
  retry: () => void;
}
