// src/features/Auth/utils/__tests__/PasswordStrength.test.ts
//
// Tier 1 (pure, no mocking) unit tests for the shared password-strength/validation
// helpers. `RecoveryKeyForm.tsx` used to duplicate its own inline password validator
// with slightly different (stricter) criteria — see the "passwordabc1" case below,
// which pins the exact boundary that used to drift between the two.

import { describe, it, expect } from 'vitest';
import {
  calculatePasswordStrength,
  getPasswordRequirements,
  getPasswordStrength,
  getPasswordStrengthColors,
  validatePassword,
  validatePasswordConfirmation,
} from '../PasswordStrength';

describe('calculatePasswordStrength', () => {
  it('scores 0 for an empty password', () => {
    expect(calculatePasswordStrength('')).toBe(0);
  });

  it('scores 1 for exactly 8-11 chars with no other criteria', () => {
    expect(calculatePasswordStrength('aaaaaaaa')).toBe(1);
  });

  it('scores 2 for 12+ chars with no other criteria (length gives 2 points)', () => {
    expect(calculatePasswordStrength('aaaaaaaaaaaa')).toBe(2);
  });

  it('requires BOTH upper and lower case to earn the case-mix point', () => {
    expect(calculatePasswordStrength('aaaaaaaaaaaA')).toBe(3); // 12+len(2) + case-mix(1)
    expect(calculatePasswordStrength('AAAAAAAAAAAA')).toBe(2); // 12+len(2), no lowercase present
  });

  it('scores 5 for a long password hitting every criterion', () => {
    expect(calculatePasswordStrength('Aa1!Aa1!Aa1!')).toBe(5);
  });

  it('a 12-char lowercase+digit-only password scores 3 (length bonus, no case-mix/symbol)', () => {
    // This is the exact case that drifted between this shared validator and
    // RecoveryKeyForm's old inline validator (see RecoveryKeyForm.test.tsx).
    expect(calculatePasswordStrength('passwordabc1')).toBe(3);
  });
});

describe('getPasswordRequirements', () => {
  it('reports each requirement independently', () => {
    expect(getPasswordRequirements('Aa1!aaaaaaaa')).toEqual({
      minLength: true,
      recommendedLength: true,
      hasUppercase: true,
      hasLowercase: true,
      hasNumber: true,
      hasSymbol: true,
    });
  });

  it('reports all-false for an empty password', () => {
    expect(getPasswordRequirements('')).toEqual({
      minLength: false,
      recommendedLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSymbol: false,
    });
  });
});

describe('getPasswordStrength', () => {
  it('labels score <=2 as Weak/red', () => {
    const result = getPasswordStrength('aaaaaaaa');
    expect(result.score).toBe(1);
    expect(result.label).toBe('Weak');
    expect(result.color).toBe('red');
  });

  it('labels score 3 as Medium/yellow', () => {
    const result = getPasswordStrength('passwordabc1');
    expect(result.score).toBe(3);
    expect(result.label).toBe('Medium');
    expect(result.color).toBe('yellow');
  });

  it('labels score 4 as Good/blue', () => {
    // 12+len(2) + digit(1) + symbol(1) = 4, still no case-mix (all lowercase)
    const result = getPasswordStrength('password!bc1');
    expect(result.score).toBe(4);
    expect(result.label).toBe('Good');
    expect(result.color).toBe('blue');
  });

  it('labels score 5 as Strong/green', () => {
    const result = getPasswordStrength('Aa1!Aa1!Aa1!');
    expect(result.score).toBe(5);
    expect(result.label).toBe('Strong');
    expect(result.color).toBe('green');
  });

  it('produces feedback entries only for unmet requirements', () => {
    const result = getPasswordStrength('aaaaaaaa'); // 8 chars, lowercase only
    expect(result.feedback).toContain('Use at least 12 characters for better security');
    expect(result.feedback).toContain('Add uppercase letters (A-Z)');
    expect(result.feedback).toContain('Add numbers (0-9)');
    expect(result.feedback).toContain('Add special characters (!@#$%^&*)');
    expect(result.feedback).not.toContain('Add lowercase letters (a-z)');
  });
});

describe('getPasswordStrengthColors', () => {
  it('maps each score band to its Tailwind classes', () => {
    expect(getPasswordStrengthColors(1)).toEqual({
      bg: 'bg-red-500',
      text: 'text-red-600',
      border: 'border-red-200',
    });
    expect(getPasswordStrengthColors(3)).toEqual({
      bg: 'bg-yellow-500',
      text: 'text-yellow-600',
      border: 'border-yellow-200',
    });
    expect(getPasswordStrengthColors(4)).toEqual({
      bg: 'bg-blue-500',
      text: 'text-blue-600',
      border: 'border-blue-200',
    });
    expect(getPasswordStrengthColors(5)).toEqual({
      bg: 'bg-green-500',
      text: 'text-green-600',
      border: 'border-green-200',
    });
  });
});

describe('validatePassword', () => {
  it('rejects passwords shorter than minLength', () => {
    const result = validatePassword('short', 8, 3);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Password must be at least 8 characters');
  });

  it('rejects passwords meeting length but below minStrength', () => {
    const result = validatePassword('aaaaaaaa', 8, 3); // score 1
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too weak/);
  });

  it('accepts a password meeting both length and default minStrength', () => {
    expect(validatePassword('passwordabc1', 8, 3)).toEqual({ valid: true });
  });

  it('uses default minLength=8 and minStrength=3 when not provided', () => {
    expect(validatePassword('passwordabc1')).toEqual({ valid: true });
    expect(validatePassword('aaaaaaaa').valid).toBe(false);
  });
});

describe('validatePasswordConfirmation', () => {
  it('rejects mismatched passwords', () => {
    const result = validatePasswordConfirmation('abc123', 'abc124');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Passwords do not match');
  });

  it('accepts matching passwords', () => {
    expect(validatePasswordConfirmation('abc123', 'abc123')).toEqual({ valid: true });
  });
});
