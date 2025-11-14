import fhirpath from 'fhirpath';
import fhirpathR4Model from 'fhirpath/fhir-context/r4';

import type {
  ValidationResult,
  ValidationIssue,
  ValidationCheck,
  ValidationStatusUI,
  FHIRWithValidation,
  FHIRResource,
  FHIRBundle,
  FHIRBundleEntry,
  FHIRPatient,
  FHIRObservation,
  FHIRPractitioner,
  ObservationStatus,
} from './fhirConversionService.type';

import { VALID_OBSERVATION_STATUSES } from './fhirConversionService.type';
import { PractitionerName } from './fhirConversionService.type';
import { FHIRConversionRequest } from '@/types/sharedApi';

/**
 * Convert document text to FHIR format using AI
 */
export const convertToFHIR = async (documentText: string): Promise<FHIRWithValidation> => {
  try {
    // Calls your Firebase Function instead of Anthropic directly
    const functionUrl = 'https://us-central1-belrose-757fe.cloudfunctions.net/convertToFHIR';

    console.log('🔄 Starting AI FHIR conversion...');

    const requestBody: FHIRConversionRequest = {
      documentText,
    };

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const fhirData: FHIRResource = await response.json();
    console.log('✅ AI conversion completed');

    // Step 2: Validate FHIR Data Structure using FHIRPath
    console.log('🔍 Validating FHIR structure with FHIRPath...');
    const validationResult = await validateWithFHIRPath(fhirData);

    console.log(`📊 Validation completed: ${validationResult.isValid ? '✅ VALID' : '❌ INVALID'}`);

    if (validationResult.hasErrors) {
      console.warn('⚠️ FHIR Validation Errors:', validationResult.errors);
      // You can choose whether to throw an error or just warn
      // For now, let's warn but continue (since AI-generated FHIR might have minor issues)
    }

    if (validationResult.hasWarnings) {
      console.warn('⚠️ FHIR Validation Warnings:', validationResult.warnings);
    }

    // ADD DEBUG LOGS HERE:
    console.log('🔍 Full FHIR validation result:', validationResult);
    console.log('🔍 FHIR data keys:', Object.keys(fhirData));
    console.log('🔍 About to return success...');

    // Step 3: Add validation metadata to the response
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

    console.log('✅ Returning FHIR result with validation metadata');
    return result;
  } catch (error) {
    console.error('💥 FHIR conversion error details:', error);
    if (error instanceof Error) {
      console.error('💥 Error stack:', error.stack);
      throw new Error(`Failed to convert to FHIR: ${error.message}`);
    } else {
      console.error('💥 Non-Error thrown:', error);
      throw new Error(`Failed to convert to FHIR: ${String(error)}`);
    }
  }
};

/**
 * Main validation function using FHIRPath
 */
const validateWithFHIRPath = async (fhirResource: FHIRResource): Promise<ValidationResult> => {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  try {
    // Basic structure validation using FHIRPath expressions
    const validationChecks: ValidationCheck[] = [
      // Check if it's a Bundle
      {
        expression: 'resourceType',
        expected: 'Bundle',
        severity: 'error',
        message: 'Resource must be a FHIR Bundle',
      },
      // Check if Bundle has entries
      {
        expression: 'entry.exists()',
        expected: true,
        severity: 'warning',
        message: 'Bundle should contain entries',
      },
      // Check if Bundle has an ID
      {
        expression: 'id.exists()',
        expected: true,
        severity: 'info',
        message: 'Bundle should have an ID',
      },
      // Check if Bundle has a type
      {
        expression: 'type.exists()',
        expected: true,
        severity: 'warning',
        message: 'Bundle should have a type',
      },
    ];

    // Run basic validation checks
    for (const check of validationChecks) {
      try {
        const result = fhirpath.evaluate(
          fhirResource,
          check.expression,
          undefined,
          fhirpathR4Model
        );

        let passed = false;
        if (typeof check.expected === 'boolean') {
          passed = Array.isArray(result) ? result.length > 0 : !!result;
        } else {
          passed = Array.isArray(result)
            ? result.includes(check.expected)
            : result === check.expected;
        }

        if (!passed) {
          const issue: ValidationIssue = {
            message: check.message,
            severity: check.severity,
            location: check.expression,
          };

          switch (check.severity) {
            case 'error':
              errors.push(issue);
              break;
            case 'warning':
              warnings.push(issue);
              break;
            case 'info':
              info.push(issue);
              break;
          }
        }
      } catch (error) {
        console.error(`Error running validation check: ${check.expression}`, error);
        errors.push({
          message: `Validation check failed: ${check.message}`,
          severity: 'error',
          location: check.expression,
        });
      }
    }

    // If it's a Bundle, validate each entry
    if (fhirResource.resourceType === 'Bundle') {
      const bundle = fhirResource as FHIRBundle;
      if (bundle.entry && Array.isArray(bundle.entry)) {
        bundle.entry.forEach((entry: FHIRBundleEntry, index: number) => {
          if (entry.resource) {
            validateResourceByType(entry.resource, `entry[${index}]`, errors, warnings, info);
          } else {
            warnings.push({
              message: `Bundle entry ${index} is missing resource`,
              severity: 'warning',
              location: `entry[${index}]`,
            });
          }
        });
      }
    } else {
      // Single resource validation
      validateResourceByType(fhirResource, 'resource', errors, warnings, info);
    }

    return {
      isValid: errors.length === 0,
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
      errors,
      warnings,
      info,
    };
  } catch (error) {
    console.error('❌ FHIRPath validation error:', error);
    errors.push({
      message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error',
    });

    return {
      isValid: false,
      hasErrors: true,
      hasWarnings: false,
      errors,
      warnings,
      info,
    };
  }
};

/**
 * Validate specific resource types
 */
const validateResourceByType = (
  resource: FHIRResource,
  location: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  info: ValidationIssue[]
): void => {
  switch (resource.resourceType) {
    case 'Patient':
      validatePatientResource(resource as FHIRPatient, location, errors, warnings, info);
      break;
    case 'Observation':
      validateObservationResource(resource as FHIRObservation, location, errors, warnings, info);
      break;
    case 'Practitioner':
      validatePractitionerResource(resource as FHIRPractitioner, location, errors, warnings, info);
      break;
    default:
      info.push({
        message: `Resource type ${resource.resourceType} validation not implemented`,
        severity: 'info',
        location: `${location}.resource`,
      });
  }
};

/**
 * Patient resource validation
 */
const validatePatientResource = (
  patient: FHIRPatient,
  location: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  info: ValidationIssue[]
): void => {
  // Should have a name
  if (!patient.name || patient.name.length === 0) {
    warnings.push({
      message: 'Patient should have a name',
      severity: 'warning',
      location: `${location}.resource`,
    });
  }

  // Check birthDate format if present
  if (patient.birthDate && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(patient.birthDate)) {
    errors.push({
      message: 'Patient birthDate must be in YYYY, YYYY-MM, or YYYY-MM-DD format',
      severity: 'error',
      location: `${location}.resource.birthDate`,
    });
  }
};

/**
 * Observation resource validation
 */
const validateObservationResource = (
  observation: FHIRObservation,
  location: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  info: ValidationIssue[]
): void => {
  // Must have a code
  if (!observation.code) {
    errors.push({
      message: 'Observation must have a code',
      severity: 'error',
      location: `${location}.resource`,
    });
  }

  // Must have status
  if (!observation.status) {
    errors.push({
      message: 'Observation must have a status',
      severity: 'error',
      location: `${location}.resource`,
    });
  } else {
    if (!VALID_OBSERVATION_STATUSES.includes(observation.status as ObservationStatus)) {
      errors.push({
        message: `Observation status '${observation.status}' is not valid`,
        severity: 'error',
        location: `${location}.resource.status`,
      });
    }
  }

  // Should have a value or component
  if (
    !observation.value &&
    !observation.valueQuantity &&
    !observation.valueString &&
    !observation.component &&
    !observation.dataAbsentReason
  ) {
    warnings.push({
      message: 'Observation should have a value, component, or dataAbsentReason',
      severity: 'warning',
      location: `${location}.resource`,
    });
  }
};

/**
 * Practitioner resource validation
 */
const validatePractitionerResource = (
  practitioner: FHIRPractitioner,
  location: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  info: ValidationIssue[]
): void => {
  // Should have a name
  if (!practitioner.name || practitioner.name.length === 0) {
    warnings.push({
      message: 'Practitioner should have a name',
      severity: 'warning',
      location: `${location}.resource`,
    });
  }

  // Check name structure
  if (practitioner.name) {
    practitioner.name.forEach((name: PractitionerName, index: number) => {
      if (!name.family && !name.given && !name.text) {
        warnings.push({
          message: 'Practitioner name should have family, given, or text',
          severity: 'warning',
          location: `${location}.resource.name[${index}]`,
        });
      }
    });
  }
};

/**
 * Utility function to get validation status for UI display
 */
export const getValidationStatusForUI = (
  fhirData: FHIRWithValidation | null
): ValidationStatusUI => {
  const validation = fhirData?._validation;

  if (!validation) {
    return {
      status: 'unknown',
      color: 'gray',
      icon: '❓',
      message: 'No validation data available',
    };
  }

  if (validation.isValid && !validation.hasWarnings) {
    return {
      status: 'valid',
      color: 'green',
      icon: '✅',
      message: 'Valid FHIR Resource',
    };
  }

  if (validation.isValid && validation.hasWarnings) {
    return {
      status: 'valid-with-warnings',
      color: 'yellow',
      icon: '⚠️',
      message: `Valid FHIR (${validation.warnings.length} warnings)`,
      details: validation.warnings.map((w: ValidationIssue) => w.message),
    };
  }

  if (validation.hasErrors) {
    return {
      status: 'invalid',
      color: 'red',
      icon: '❌',
      message: `Invalid FHIR (${validation.errors.length} errors)`,
      details: validation.errors.map((e: ValidationIssue) => e.message),
    };
  }

  return {
    status: 'unknown',
    color: 'gray',
    icon: '❓',
    message: 'Validation status unclear',
  };
};
