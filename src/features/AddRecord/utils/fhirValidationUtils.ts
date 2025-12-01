//src/features/AddRecord/utils/fhirValidationUtils.ts
//Centralized util for fhir validation

import type { FHIRWithValidation } from '@/features/AddRecord/services/fhirConversionService.type';

export interface SimpleFHIRValidation {
  valid: boolean;
  error?: string;
  resourceType?: string;
  entryCount?: number;
  resourceTypes?: string[];
  isSingleResource?: boolean;
}

/**
 * Validates basic FHIR JSON structure
 *
 * This is a "quick check" validation - it doesn't validate against full FHIR specs,
 * but it checks if the JSON has the minimum required FHIR structure.
 *
 * Use this for: Real-time validation as users type JSON
 * Don't use this for: Final validation before saving (use the full FHIRPath validator instead)
 *
 * @param jsonString - The JSON string to validate
 * @returns SimpleFHIRValidation object with validation results
 */
export const validateBasicFhirStructure = (jsonString: string): SimpleFHIRValidation => {
  try {
    // Try to parse the JSON first
    const parsed = JSON.parse(jsonString);

    // Every FHIR resource must have a resourceType
    if (!parsed.resourceType) {
      return {
        valid: false,
        error: 'Missing resourceType field (required for all FHIR resources)',
      };
    }

    // Handle Bundle resources (which contain multiple resources)
    if (parsed.resourceType === 'Bundle') {
      // Bundles must have an entry array
      if (!parsed.entry || !Array.isArray(parsed.entry)) {
        return {
          valid: false,
          error: 'Bundle must have an entry array',
        };
      }

      // Extract all resource types from the bundle entries
      // The filter with type predicate ensures TypeScript knows these are strings
      const resourceTypes = parsed.entry
        .map((e: any) => e.resource?.resourceType)
        .filter((type: any): type is string => typeof type === 'string');

      //Remove Duplicates
      const uniqueResourceTypes: string[] = Array.from(new Set(resourceTypes));

      return {
        valid: true,
        resourceType: 'Bundle',
        entryCount: parsed.entry.length,
        resourceTypes: uniqueResourceTypes,
      };
    }
    // Handle single resources (Patient, Observation, etc.)
    else {
      return {
        valid: true,
        resourceType: parsed.resourceType,
        isSingleResource: true,
      };
    }
  } catch (error) {
    // If JSON.parse fails, we'll end up here
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      error: `Invalid JSON: ${errorMessage}`,
    };
  }
};

/**
 * Checks if a FHIRWithValidation object has validation metadata
 *
 * FHIRWithValidation objects come from the full FHIR conversion service
 * and include detailed validation results using FHIRPath.
 *
 * @param fhirData - FHIR data that might include validation metadata
 * @returns true if validation metadata exists
 */
export const hasValidationMetadata = (fhirData: any): fhirData is FHIRWithValidation => {
  return fhirData && '_validation' in fhirData;
};

/**
 * Gets a human-readable validation summary
 *
 * This converts the technical validation object into text users can understand.
 *
 * @param validation - SimpleFHIRValidation or FHIRWithValidation._validation
 * @returns A user-friendly string describing the validation status
 */
export const getValidationSummary = (
  validation: SimpleFHIRValidation | FHIRWithValidation['_validation']
): string => {
  // Handle SimpleFHIRValidation (from basic structure check)
  if ('valid' in validation) {
    if (!validation.valid) {
      return `Invalid FHIR: ${validation.error || 'Unknown error'}`;
    }
    if (validation.resourceType === 'Bundle' && validation.entryCount) {
      return `Valid FHIR Bundle with ${validation.entryCount} entries`;
    }
    return `Valid FHIR ${validation.resourceType || 'resource'}`;
  }

  // Handle FHIRWithValidation._validation (from full validation)
  if (!validation.isValid) {
    const errorCount = validation.errors?.length || 0;
    return `Invalid FHIR - ${errorCount} error${errorCount !== 1 ? 's' : ''}`;
  }

  if (validation.hasWarnings) {
    const warningCount = validation.warnings?.length || 0;
    return `Valid FHIR with ${warningCount} warning${warningCount !== 1 ? 's' : ''}`;
  }

  return 'Valid FHIR Resource';
};

/**
 * Determines if FHIR data is safe to use/save
 *
 * "Safe" means it passed validation OR only has warnings (not errors).
 * Warnings indicate potential issues but don't prevent the data from being used.
 *
 * @param fhirData - FHIR data with validation metadata
 * @returns true if the data is valid enough to use
 */
export const isFhirDataSafe = (fhirData: FHIRWithValidation): boolean => {
  if (!fhirData._validation) {
    // No validation data = assume it's safe (was validated elsewhere)
    return true;
  }

  // Safe if valid, even with warnings
  // NOT safe if it has errors
  return fhirData._validation.isValid && !fhirData._validation.hasErrors;
};

/**
 * Example usage in a component:
 *
 * ```typescript
 * import { validateBasicFhirStructure, getValidationSummary } from './fhirValidationUtils';
 *
 * const handleJsonInput = (jsonText: string) => {
 *   const validation = validateBasicFhirStructure(jsonText);
 *
 *   if (validation.valid) {
 *     console.log(getValidationSummary(validation)); // "Valid FHIR Bundle with 3 entries"
 *   } else {
 *     console.error(validation.error); // "Invalid JSON: Unexpected token..."
 *   }
 * };
 * ```
 */
