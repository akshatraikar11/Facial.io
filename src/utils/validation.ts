import type { ValidationResult, DuplicateCheckResult, FormValidationResult, User } from '../types';

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email format
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email || !email.trim()) {
    return { valid: false, message: 'Email is required' };
  }
  
  if (!EMAIL_REGEX.test(email.trim())) {
    return { valid: false, message: 'Please enter a valid email address' };
  }
  
  return { valid: true, message: '' };
};

/**
 * Validate name
 */
export const validateName = (name: string): ValidationResult => {
  if (!name || !name.trim()) {
    return { valid: false, message: 'Name is required' };
  }
  
  if (name.trim().length < 2) {
    return { valid: false, message: 'Name must be at least 2 characters' };
  }
  
  if (name.trim().length > 100) {
    return { valid: false, message: 'Name must be less than 100 characters' };
  }
  
  return { valid: true, message: '' };
};

/**
 * Check if email already exists
 */
export const checkDuplicateEmail = (
  email: string, 
  existingUsers: User[], 
  excludeUserId: string | null = null
): DuplicateCheckResult => {
  const normalizedEmail = email.trim().toLowerCase();
  const duplicate = existingUsers.find(user => {
    if (excludeUserId && user.id === excludeUserId) return false;
    return user.email?.toLowerCase() === normalizedEmail;
  });
  
  if (duplicate) {
    return { 
      exists: true, 
      message: `Email "${email}" is already registered for ${duplicate.name}` 
    };
  }
  
  return { exists: false, message: '' };
};

/**
 * Check if name already exists
 */
export const checkDuplicateName = (
  name: string, 
  existingUsers: User[], 
  excludeUserId: string | null = null
): DuplicateCheckResult => {
  const normalizedName = name.trim().toLowerCase();
  const duplicate = existingUsers.find(user => {
    if (excludeUserId && user.id === excludeUserId) return false;
    return user.name?.toLowerCase() === normalizedName;
  });
  
  if (duplicate) {
    return { 
      exists: true, 
      message: `Name "${name}" is already registered` 
    };
  }
  
  return { exists: false, message: '' };
};

/**
 * Validate face descriptor quality
 */
export const validateFaceDescriptor = (descriptor: Float32Array | number[]): ValidationResult => {
  if (!descriptor) {
    return { valid: false, message: 'Face descriptor is missing' };
  }
  
  const array = Array.isArray(descriptor) ? descriptor : Array.from(descriptor);
  
  if (array.length === 0) {
    return { valid: false, message: 'Face descriptor is empty' };
  }
  
  // Check for NaN or invalid values
  const hasInvalidValues = array.some(val => !isFinite(val));
  if (hasInvalidValues) {
    return { valid: false, message: 'Face descriptor contains invalid values' };
  }
  
  return { valid: true, message: '' };
};

/**
 * Validate registration form
 */
export const validateRegistrationForm = (
  formData: { name: string; email: string }, 
  existingUsers: User[] = []
): FormValidationResult => {
  const errors: Record<string, string> = {};
  
  const nameValidation = validateName(formData.name);
  if (!nameValidation.valid) {
    errors.name = nameValidation.message;
  } else {
    const duplicateName = checkDuplicateName(formData.name, existingUsers);
    if (duplicateName.exists) {
      errors.name = duplicateName.message;
    }
  }
  
  const emailValidation = validateEmail(formData.email);
  if (!emailValidation.valid) {
    errors.email = emailValidation.message;
  } else {
    const duplicateEmail = checkDuplicateEmail(formData.email, existingUsers);
    if (duplicateEmail.exists) {
      errors.email = duplicateEmail.message;
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};
