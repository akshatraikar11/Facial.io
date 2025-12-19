export interface User {
  id: string;
  name: string;
  email: string;
  descriptors: number[][]; // Array of face descriptors (arrays of numbers)

  createdAt: string;
  updatedAt?: string;
}

export interface AttendanceLog {
  id: string;
  userId: string;
  name: string;
  date: string;
  time: string;
  status: string;
  timestamp: string;
}

export interface FaceApiContextType {
  modelsLoaded: boolean;
  loading: boolean;
  error: string | null;
}

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
