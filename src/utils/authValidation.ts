/**
 * Pure validation logic for user authentication, usernames, and passwords.
 * Decoupled from React and Supabase for deterministic testing.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface PasswordStrengthResult extends ValidationResult {
  strength: 'weak' | 'medium' | 'strong';
  score: number; // 0 to 4
}

/**
 * Validates a username according to Kith's requirements:
 * - 3 to 24 characters
 * - Lowercase alphanumeric characters, underscores, and dashes
 * - Must start with a letter or number
 * - Cannot have consecutive underscores/dashes
 */
export function validateUsername(username: string): ValidationResult {
  const trimmed = username.trim().toLowerCase();

  if (!trimmed) {
    return { valid: false, error: 'Username is required.' };
  }

  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters.' };
  }

  if (trimmed.length > 24) {
    return { valid: false, error: 'Username cannot exceed 24 characters.' };
  }

  if (!/^[a-z0-9]/.test(trimmed)) {
    return { valid: false, error: 'Username must start with a letter or number.' };
  }

  if (!/^[a-z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens.' };
  }

  if (/[_.-]{2,}/.test(trimmed)) {
    return { valid: false, error: 'Username cannot contain consecutive separators.' };
  }

  return { valid: true };
}

/**
 * Validates standard email address format.
 */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();

  if (!trimmed) {
    return { valid: false, error: 'Email address is required.' };
  }

  // RFC 5322 compliant simplified regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  return { valid: true };
}

/**
 * Validates password strength and minimum security requirements:
 * - Minimum 8 characters
 * - Must contain at least one letter and one number or symbol
 */
export function validatePassword(password: string): PasswordStrengthResult {
  if (!password) {
    return { valid: false, error: 'Password is required.', strength: 'weak', score: 0 };
  }

  if (password.length < 8) {
    return {
      valid: false,
      error: 'Password must be at least 8 characters long.',
      strength: 'weak',
      score: 1
    };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (score >= 4) {
    strength = 'strong';
  } else if (score >= 2) {
    strength = 'medium';
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigitOrSpecial = /[0-9]|[^a-zA-Z0-9]/.test(password);

  if (!hasLetter || !hasDigitOrSpecial) {
    return {
      valid: false,
      error: 'Password must contain both letters and numbers or symbols.',
      strength,
      score
    };
  }

  return {
    valid: true,
    strength,
    score
  };
}

/**
 * Validates that password and confirmPassword match exactly.
 */
export function validatePasswordMatch(password: string, confirmPassword: string): ValidationResult {
  if (!confirmPassword) {
    return { valid: false, error: 'Please confirm your password.' };
  }

  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match.' };
  }

  return { valid: true };
}

/**
 * Checks if a login identifier is an email or a username.
 */
export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes('@');
}
