import type { FHIRResource } from '@/types/fhir';

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationIssue {
  message: string;
  severity: 'error' | 'warning' | 'info';
  location?: string;
}

export interface ValidationResult {
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

export interface ValidationMetadata {
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  validatedAt: string;
  validatorVersion: string;
}

export interface ValidationCheck {
  expression: string;
  expected: any;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface FHIRPathValidationContext {
  resource: FHIRResource;
  location: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

export interface ValidationStatusUI {
  status: 'valid' | 'valid-with-warnings' | 'invalid' | 'unknown';
  color: 'green' | 'yellow' | 'red' | 'gray';
  icon: string;
  message: string;
  details?: string[];
}

export type FHIRWithValidation = FHIRResource & {
  _validation: ValidationMetadata;
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const VALID_OBSERVATION_STATUSES = [
  'registered',
  'preliminary',
  'final',
  'amended',
  'corrected',
  'cancelled',
  'entered-in-error',
  'unknown',
] as const;

export const VALIDATION_SEVERITY_LEVELS = ['error', 'warning', 'info'] as const;

export type ValidationSeverity = (typeof VALIDATION_SEVERITY_LEVELS)[number];
