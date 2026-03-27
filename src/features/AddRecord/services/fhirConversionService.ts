import fhirpath from 'fhirpath';
import fhirpathR4Model from 'fhirpath/fhir-context/r4';

import type {
  ValidationResult,
  ValidationIssue,
  ValidationCheck,
  ValidationStatusUI,
  FHIRWithValidation,
} from './fhirConversionService.type';

import type { FHIRResource } from '@/types/fhir';
import { FHIRConversionRequest } from '@/types/sharedApi';

/**
 * Convert document text to FHIR format using AI
 */
export const convertToFHIR = async (documentText: string): Promise<FHIRWithValidation> => {
  try {
    const functionUrl = 'https://us-central1-belrose-757fe.cloudfunctions.net/convertToFHIR';

    console.log('🔄 Starting AI FHIR conversion...');

    const requestBody: FHIRConversionRequest = { documentText };

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const fhirData: FHIRResource = await response.json();
    console.log('✅ AI conversion completed');

    console.log('🔍 Validating FHIR structure...');
    const validationResult = validateStructure(fhirData);

    console.log(`📊 Validation: ${validationResult.isValid ? '✅ VALID' : '❌ INVALID'}`);

    if (validationResult.hasErrors) console.warn('⚠️ Errors:', validationResult.errors);
    if (validationResult.hasWarnings) console.warn('⚠️ Warnings:', validationResult.warnings);

    const result: FHIRWithValidation = {
      ...fhirData,
      _validation: {
        isValid: validationResult.isValid,
        hasErrors: validationResult.hasErrors,
        hasWarnings: validationResult.hasWarnings,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        info: validationResult.info,
        validatedAt: new Date().toISOString(),
        validatorVersion: 'fhirpath.js',
      },
    };

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to convert to FHIR: ${error.message}`);
    }
    throw new Error(`Failed to convert to FHIR: ${String(error)}`);
  }
};

/**
 * Structural validation — checks the AI returned something shaped like a valid
 * FHIR Bundle. Does not attempt to validate individual resource fields.
 */
const validateStructure = (fhirResource: FHIRResource): ValidationResult => {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  const checks: ValidationCheck[] = [
    {
      expression: 'resourceType',
      expected: 'Bundle',
      severity: 'error',
      message: 'AI response must be a FHIR Bundle',
    },
    {
      expression: 'entry.exists()',
      expected: true,
      severity: 'error',
      message: 'Bundle must contain at least one entry',
    },
    {
      expression: 'id.exists()',
      expected: true,
      severity: 'warning',
      message: 'Bundle should have an ID',
    },
    {
      expression: 'type.exists()',
      expected: true,
      severity: 'warning',
      message: 'Bundle should have a type',
    },
    {
      expression: 'entry.resource.resourceType.exists()',
      expected: true,
      severity: 'error',
      message: 'All entries must have a resourceType',
    },
  ];

  for (const check of checks) {
    try {
      const result = fhirpath.evaluate(fhirResource, check.expression, undefined, fhirpathR4Model);

      const passed =
        typeof check.expected === 'boolean'
          ? Array.isArray(result)
            ? result.length > 0
            : !!result
          : Array.isArray(result)
            ? result.includes(check.expected)
            : result === check.expected;

      if (!passed) {
        const issue: ValidationIssue = {
          message: check.message,
          severity: check.severity,
          location: check.expression,
        };
        if (check.severity === 'error') errors.push(issue);
        else if (check.severity === 'warning') warnings.push(issue);
        else info.push(issue);
      }
    } catch (err) {
      errors.push({
        message: `Validation check failed: ${check.message}`,
        severity: 'error',
        location: check.expression,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    errors,
    warnings,
    info,
  };
};

/**
 * Maps a validation result to UI display properties
 */
export const getValidationStatusForUI = (
  fhirData: FHIRWithValidation | null
): ValidationStatusUI => {
  const validation = fhirData?._validation;

  if (!validation) {
    return { status: 'unknown', color: 'gray', icon: '❓', message: 'No validation data' };
  }

  if (validation.isValid && !validation.hasWarnings) {
    return { status: 'valid', color: 'green', icon: '✅', message: 'Valid FHIR Bundle' };
  }

  if (validation.isValid && validation.hasWarnings) {
    return {
      status: 'valid-with-warnings',
      color: 'yellow',
      icon: '⚠️',
      message: `Valid FHIR (${validation.warnings.length} warnings)`,
      details: validation.warnings.map(w => w.message),
    };
  }

  return {
    status: 'invalid',
    color: 'red',
    icon: '❌',
    message: `Invalid FHIR (${validation.errors.length} errors)`,
    details: validation.errors.map(e => e.message),
  };
};
