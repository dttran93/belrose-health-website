// src/utils/passwordStrength.ts
export interface PasswordStrength {
  score: number; // 0-5
  label: string; // "Weak", "Medium", "Strong"
  color: string; // Tailwind color class
  feedback: string[]; // What's missing
}

export interface PasswordRequirements {
  minLength: boolean;
  recommendedLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

/**
 * Calculate password strength score (0-5)
 */
export function calculatePasswordStrength(password: string): number {
  let strength = 0;

  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  return strength;
}

/**
 * Get password requirements checklist
 */
export function getPasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    recommendedLength: password.length >= 12,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[^a-zA-Z0-9]/.test(password),
  };
}

/**
 * Get detailed password strength info
 */
export function getPasswordStrength(password: string): PasswordStrength {
  const score = calculatePasswordStrength(password);
  const requirements = getPasswordRequirements(password);
  const feedback: string[] = [];

  // Generate feedback
  if (!requirements.minLength) {
    feedback.push('Add more characters (at least 8)');
  } else if (!requirements.recommendedLength) {
    feedback.push('Use at least 12 characters for better security');
  }

  if (!requirements.hasUppercase) {
    feedback.push('Add uppercase letters (A-Z)');
  }

  if (!requirements.hasLowercase) {
    feedback.push('Add lowercase letters (a-z)');
  }

  if (!requirements.hasNumber) {
    feedback.push('Add numbers (0-9)');
  }

  if (!requirements.hasSymbol) {
    feedback.push('Add special characters (!@#$%^&*)');
  }

  // Determine label and color
  let label: string;
  let color: string;

  if (score <= 2) {
    label = 'Weak';
    color = 'red';
  } else if (score === 3) {
    label = 'Medium';
    color = 'yellow';
  } else if (score === 4) {
    label = 'Good';
    color = 'blue';
  } else {
    label = 'Strong';
    color = 'green';
  }

  return {
    score,
    label,
    color,
    feedback,
  };
}

/**
 * Get Tailwind color classes for password strength
 */
export function getPasswordStrengthColors(score: number): {
  bg: string;
  text: string;
  border: string;
} {
  if (score <= 2) {
    return {
      bg: 'bg-red-500',
      text: 'text-red-600',
      border: 'border-red-200',
    };
  } else if (score === 3) {
    return {
      bg: 'bg-yellow-500',
      text: 'text-yellow-600',
      border: 'border-yellow-200',
    };
  } else if (score === 4) {
    return {
      bg: 'bg-blue-500',
      text: 'text-blue-600',
      border: 'border-blue-200',
    };
  } else {
    return {
      bg: 'bg-green-500',
      text: 'text-green-600',
      border: 'border-green-200',
    };
  }
}

/**
 * Validate password meets minimum requirements
 */
export function validatePassword(
  password: string,
  minLength: number = 8,
  minStrength: number = 3
): { valid: boolean; error?: string } {
  if (password.length < minLength) {
    return {
      valid: false,
      error: `Password must be at least ${minLength} characters`,
    };
  }

  const strength = calculatePasswordStrength(password);
  if (strength < minStrength) {
    return {
      valid: false,
      error: 'Password is too weak. Add uppercase, lowercase, numbers, and symbols.',
    };
  }

  return { valid: true };
}

/**
 * Validate password confirmation matches
 */
export function validatePasswordConfirmation(
  password: string,
  confirmPassword: string
): { valid: boolean; error?: string } {
  if (password !== confirmPassword) {
    return {
      valid: false,
      error: 'Passwords do not match',
    };
  }

  return { valid: true };
}
