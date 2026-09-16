import type { ValidationResult, DuplicateCheckResult, FormValidationResult, User } from '../types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate email format */
export const validateEmail = (email: string): ValidationResult => {
  if (!email?.trim()) return { valid: false, message: 'Email is required' };
  if (!EMAIL_REGEX.test(email.trim())) return { valid: false, message: 'Please enter a valid email address' };
  return { valid: true, message: '' };
};

/** Validate display name */
export const validateName = (name: string): ValidationResult => {
  if (!name?.trim()) return { valid: false, message: 'Name is required' };
  if (name.trim().length < 2) return { valid: false, message: 'Name must be at least 2 characters' };
  if (name.trim().length > 100) return { valid: false, message: 'Name must be less than 100 characters' };
  return { valid: true, message: '' };
};

/**
 * Check for a duplicate email against existing users.
 * Uses _id (MongoDB) — not the legacy id field — matching the Employee type.
 */
export const checkDuplicateEmail = (
  email: string,
  existingUsers: User[],
  excludeUserId: string | null = null,
): DuplicateCheckResult => {
  const normalized = email.trim().toLowerCase();
  const duplicate = existingUsers.find((u) => {
    if (excludeUserId && u._id === excludeUserId) return false;
    return u.email?.toLowerCase() === normalized;
  });
  return duplicate
    ? { exists: true,  message: `Email "${email}" is already registered for ${duplicate.name}` }
    : { exists: false, message: '' };
};

/**
 * Check for a duplicate name against existing users.
 * Uses _id (MongoDB) — not the legacy id field.
 */
export const checkDuplicateName = (
  name: string,
  existingUsers: User[],
  excludeUserId: string | null = null,
): DuplicateCheckResult => {
  const normalized = name.trim().toLowerCase();
  const duplicate = existingUsers.find((u) => {
    if (excludeUserId && u._id === excludeUserId) return false;
    return u.name?.toLowerCase() === normalized;
  });
  return duplicate
    ? { exists: true,  message: `Name "${name}" is already registered` }
    : { exists: false, message: '' };
};

/** Validate a face-api.js descriptor for correctness */
export const validateFaceDescriptor = (descriptor: Float32Array | number[]): ValidationResult => {
  if (!descriptor) return { valid: false, message: 'Face descriptor is missing' };
  const arr = Array.isArray(descriptor) ? descriptor : Array.from(descriptor);
  if (arr.length === 0) return { valid: false, message: 'Face descriptor is empty' };
  if (arr.some((v) => !isFinite(v))) return { valid: false, message: 'Face descriptor contains invalid values' };
  return { valid: true, message: '' };
};

/** Full form validation for employee registration */
export const validateRegistrationForm = (
  formData: { name: string; email: string },
  existingUsers: User[] = [],
): FormValidationResult => {
  const errors: Record<string, string> = {};

  const nameResult = validateName(formData.name);
  if (!nameResult.valid) {
    errors['name'] = nameResult.message;
  } else {
    const dupName = checkDuplicateName(formData.name, existingUsers);
    if (dupName.exists) errors['name'] = dupName.message;
  }

  const emailResult = validateEmail(formData.email);
  if (!emailResult.valid) {
    errors['email'] = emailResult.message;
  } else {
    const dupEmail = checkDuplicateEmail(formData.email, existingUsers);
    if (dupEmail.exists) errors['email'] = dupEmail.message;
  }

  return { valid: Object.keys(errors).length === 0, errors };
};
