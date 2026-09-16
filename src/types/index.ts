// ── Core domain types — mirror the NestJS schemas ─────────────────────────

export interface Organization {
  orgId: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
}

export interface Employee {
  _id: string;
  orgId: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  pineconeId: string | null;
  isActive: boolean;
  createdAt: string;
  // Multi-location
  defaultLocationId: string | null;
  // Face quality
  faceQualityScore: number | null;
  faceQualityLabel: 'good' | 'fair' | 'poor' | null;
  // Contact
  phone: string | null;
}

/** Legacy alias — used by validation.ts */
export type User = Employee;

export interface AttendanceLog {
  _id: string;
  orgId: string;
  employeeId: string;
  name: string;
  date: string;    // YYYY-MM-DD
  time: string;    // HH:MM
  status: 'present' | 'late' | 'absent';
  checkInAt: string;
  /** Legacy alias — some utilities reference timestamp instead of checkInAt */
  timestamp?: string;
  // Multi-location
  locationId: string | null;
  locationName: string | null;
  // Shift awareness
  shiftId: string | null;
  shiftName: string | null;
}

export interface Location {
  _id: string;
  orgId: string;
  locationId: string; // slug e.g. "main-gate"
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Shift {
  _id: string;
  orgId: string;
  name: string;           // e.g. "Morning Shift"
  startTime: string;      // HH:MM
  endTime: string;        // HH:MM
  gracePeriodMinutes: number;
  isActive: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  _id: string;
  orgId: string;
  userId: string;
  userEmail: string;
  action: string;         // e.g. "employee.created"
  entityType: string;     // e.g. "employee"
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AttendanceStats {
  presentToday: number;
  totalEmployees: number;
  attendanceRate: number;
  lateToday: number;
  absentToday?: number;
  weeklyTrend: Array<{ date: string; present: number; late: number }>;
}

export interface FaceMatchResult {
  matched: boolean;
  employeeId: string | null;
  name: string | null;
  confidence: number;
  message: string;
}

export interface Plan {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  price: number;
  features: string[];
  limits: { employees: number; locations: number };
}

// ── Validation utility types ────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  message: string;
}

export interface DuplicateCheckResult {
  exists: boolean;
  message: string;
}

export interface FormValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}
