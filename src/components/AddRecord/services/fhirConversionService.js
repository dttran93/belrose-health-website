import fhirpath from 'fhirpath';
import fhirpathR4Model from 'fhirpath/fhir-context/r4';

export const convertToFHIR = async (documentText, documentType = 'medical_record') => {
  try {
    // Calls your Firebase Function instead of Anthropic directly
    const functionUrl = 'https://us-central1-belrose-757fe.cloudfunctions.net/convertToFHIR';
    
    console.log('🔄 Starting AI FHIR conversion...');
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentText,
        documentType
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const fhirData = await response.json();
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

    // Step 3: Add validation metadata to the response
    return {
      ...fhirData,
      _validation: {
        isValid: validationResult.isValid,
        hasErrors: validationResult.hasErrors,
        hasWarnings: validationResult.hasWarnings,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        info: validationResult.info,
        validatedAt: new Date().toISOString(),
        validatorVersion: 'fhirpath.js'
      }
    };

  } catch (error) {
    console.error('❌ FHIR conversion/validation error:', error);
    throw new Error(`Failed to convert to FHIR: ${error.message}`);
  }
};

// Main validation function using FHIRPath
const validateWithFHIRPath = async (fhirResource) => {
  const errors = [];
  const warnings = [];
  const info = [];

  try {
    // Basic structure validation using FHIRPath expressions
    const validationChecks = [
      // Check if it's a Bundle
      {
        expression: "resourceType",
        expected: "Bundle",
        severity: "error",
        message: "Resource must be a FHIR Bundle"
      },
      // Check if Bundle has entries
      {
        expression: "entry.exists()",
        expected: true,
        severity: "warning", 
        message: "Bundle should contain entries"
      },
      // Check if Bundle has an ID
      {
        expression: "id.exists()",
        expected: true,
        severity: "info",
        message: "Bundle should have an ID"
      },
      // Validate that entries have resources
      {
        expression: "entry.all(resource.exists())",
        expected: true,
        severity: "error",
        message: "All Bundle entries must contain a resource"
      },
      // Check for Patient resources
      {
        expression: "entry.resource.where(resourceType = 'Patient').exists()",
        expected: true,
        severity: "info",
        message: "Bundle typically contains Patient information"
      },
      // Validate Patient resources have names
      {
        expression: "entry.resource.where(resourceType = 'Patient').all(name.exists())",
        expected: true,
        severity: "warning",
        message: "Patient resources should have names"
      },
      // Validate Observation resources have codes
      {
        expression: "entry.resource.where(resourceType = 'Observation').all(code.exists())",
        expected: true,
        severity: "error",
        message: "Observation resources must have codes"
      },
      // Validate Observation resources have values or components
      {
        expression: "entry.resource.where(resourceType = 'Observation').all((value.exists() or component.exists()))",
        expected: true,
        severity: "warning",
        message: "Observation resources should have values or components"
      }
    ];

    // Run each validation check
    for (const check of validationChecks) {
      try {
        const result = fhirpath.evaluate(fhirResource, check.expression, null, fhirpathR4Model);
        
        let isValid = false;
        if (typeof check.expected === 'boolean') {
          isValid = Boolean(result && result.length > 0) === check.expected;
        } else if (typeof check.expected === 'string') {
          isValid = result && result[0] === check.expected;
        }

        if (!isValid) {
          const issue = {
            message: check.message,
            expression: check.expression,
            severity: check.severity,
            location: 'root'
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
      } catch (pathError) {
        errors.push({
          message: `FHIRPath evaluation error: ${pathError.message}`,
          expression: check.expression,
          severity: 'error',
          location: 'root'
        });
      }
    }

    // Additional deep validation for specific resource types
    if (fhirResource.entry) {
      for (let i = 0; i < fhirResource.entry.length; i++) {
        const entry = fhirResource.entry[i];
        const entryValidation = validateEntry(entry, i);
        
        errors.push(...entryValidation.errors);
        warnings.push(...entryValidation.warnings);
        info.push(...entryValidation.info);
      }
    }

  } catch (error) {
    errors.push({
      message: `Validation system error: ${error.message}`,
      expression: 'global',
      severity: 'error',
      location: 'root'
    });
  }

  return {
    isValid: errors.length === 0,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    errors: errors,
    warnings: warnings,
    info: info,
    totalIssues: errors.length + warnings.length + info.length
  };
};

// Validate individual Bundle entries
const validateEntry = (entry, index) => {
  const errors = [];
  const warnings = [];
  const info = [];
  const location = `entry[${index}]`;

  try {
    if (!entry.resource) {
      errors.push({
        message: 'Bundle entry must contain a resource',
        severity: 'error',
        location: location
      });
      return { errors, warnings, info };
    }

    const resource = entry.resource;
    const resourceType = resource.resourceType;

    // Resource type specific validation
    switch (resourceType) {
      case 'Patient':
        validatePatientResource(resource, location, errors, warnings, info);
        break;
      case 'Observation':
        validateObservationResource(resource, location, errors, warnings, info);
        break;
      case 'Practitioner':
        validatePractitionerResource(resource, location, errors, warnings, info);
        break;
      default:
        info.push({
          message: `Encountered resource type: ${resourceType}`,
          severity: 'info',
          location: location
        });
    }

  } catch (error) {
    errors.push({
      message: `Error validating entry: ${error.message}`,
      severity: 'error',
      location: location
    });
  }

  return { errors, warnings, info };
};

// Patient resource validation
const validatePatientResource = (patient, location, errors, warnings, info) => {
  // Patient must have an identifier or name
  if (!patient.identifier && !patient.name) {
    errors.push({
      message: 'Patient must have either an identifier or name',
      severity: 'error',
      location: `${location}.resource`
    });
  }

  // Name validation
  if (patient.name) {
    patient.name.forEach((name, index) => {
      if (!name.family && !name.given) {
        warnings.push({
          message: 'Patient name should have either family or given name',
          severity: 'warning',
          location: `${location}.resource.name[${index}]`
        });
      }
    });
  }

  // Birth date format validation
  if (patient.birthDate && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(patient.birthDate)) {
    errors.push({
      message: 'Patient birthDate must be in YYYY, YYYY-MM, or YYYY-MM-DD format',
      severity: 'error',
      location: `${location}.resource.birthDate`
    });
  }
};

// Observation resource validation
const validateObservationResource = (observation, location, errors, warnings, info) => {
  // Must have a code
  if (!observation.code) {
    errors.push({
      message: 'Observation must have a code',
      severity: 'error',
      location: `${location}.resource`
    });
  }

  // Must have status
  if (!observation.status) {
    errors.push({
      message: 'Observation must have a status',
      severity: 'error',
      location: `${location}.resource`
    });
  } else {
    const validStatuses = ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'];
    if (!validStatuses.includes(observation.status)) {
      errors.push({
        message: `Observation status '${observation.status}' is not valid`,
        severity: 'error',
        location: `${location}.resource.status`
      });
    }
  }

  // Should have a value or component
  if (!observation.value && !observation.valueQuantity && !observation.valueString && 
      !observation.component && !observation.dataAbsentReason) {
    warnings.push({
      message: 'Observation should have a value, component, or dataAbsentReason',
      severity: 'warning',
      location: `${location}.resource`
    });
  }
};

// Practitioner resource validation
const validatePractitionerResource = (practitioner, location, errors, warnings, info) => {
  // Should have a name
  if (!practitioner.name || practitioner.name.length === 0) {
    warnings.push({
      message: 'Practitioner should have a name',
      severity: 'warning',
      location: `${location}.resource`
    });
  }

  // Check name structure
  if (practitioner.name) {
    practitioner.name.forEach((name, index) => {
      if (!name.family && !name.given && !name.text) {
        warnings.push({
          message: 'Practitioner name should have family, given, or text',
          severity: 'warning',
          location: `${location}.resource.name[${index}]`
        });
      }
    });
  }
};

// Utility function to get validation status for UI display (unchanged)
export const getValidationStatusForUI = (fhirData) => {
  const validation = fhirData?._validation;
  
  if (!validation) {
    return {
      status: 'unknown',
      color: 'gray',
      icon: '❓',
      message: 'No validation data available'
    };
  }

  if (validation.isValid && !validation.hasWarnings) {
    return {
      status: 'valid',
      color: 'green',
      icon: '✅',
      message: 'Valid FHIR Resource'
    };
  }

  if (validation.isValid && validation.hasWarnings) {
    return {
      status: 'valid-with-warnings',
      color: 'yellow',
      icon: '⚠️',
      message: `Valid FHIR (${validation.warnings.length} warnings)`,
      details: validation.warnings.map(w => w.message)
    };
  }

  if (validation.hasErrors) {
    return {
      status: 'invalid',
      color: 'red',
      icon: '❌',
      message: `Invalid FHIR (${validation.errors.length} errors)`,
      details: validation.errors.map(e => e.message)
    };
  }

  return {
    status: 'unknown',
    color: 'gray',
    icon: '❓',
    message: 'Validation status unclear'
  };
};

// Utility function to validate existing FHIR data (for testing)
export const validateExistingFHIR = async (fhirResource) => {
  try {
    console.log('🔍 Validating existing FHIR resource...');
    
    const validationResult = await validateWithFHIRPath(fhirResource);
    
    console.log(`📊 Validation result: ${validationResult.isValid ? '✅ VALID' : '❌ INVALID'}`);
    
    return {
      isValid: validationResult.isValid,
      summary: validationResult,
      validatedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Validation error:', error);
    return {
      isValid: false,
      error: error.message,
      validatedAt: new Date().toISOString()
    };
  }
};

// Helper function to run custom FHIRPath expressions for advanced validation
export const runFHIRPathQuery = (fhirResource, expression) => {
  try {
    return fhirpath.evaluate(fhirResource, expression, null, fhirpathR4Model);
  } catch (error) {
    console.error('FHIRPath query error:', error);
    throw new Error(`FHIRPath query failed: ${error.message}`);
  }
};