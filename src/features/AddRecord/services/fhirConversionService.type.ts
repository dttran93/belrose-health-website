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

export interface FHIRResource {
  resourceType: string;
  id?: string;
  [key: string]: any;
}

export interface FHIRBundle extends FHIRResource {
  resourceType: 'Bundle';
  type?: string;
  entry?: FHIRBundleEntry[];
}

export interface FHIRBundleEntry {
  resource: FHIRResource;
  fullUrl?: string;
  request?: {
    method: string;
    url: string;
  };
}

export interface FHIRPatient extends FHIRResource {
  resourceType: 'Patient';
  name?: PatientName[];
  birthDate?: string;
  gender?: string;
  identifier?: PatientIdentifier[];
}

export interface PatientName {
  use?: string;
  family?: string;
  given?: string[];
  text?: string;
}

export interface PatientIdentifier {
  system?: string;
  value?: string;
  type?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
}

export interface FHIRObservation extends FHIRResource {
  resourceType: 'Observation';
  status: ObservationStatus;
  code: CodeableConcept;
  subject?: Reference;
  value?: any;
  valueQuantity?: Quantity;
  valueString?: string;
  component?: ObservationComponent[];
  dataAbsentReason?: CodeableConcept;
}

export type ObservationStatus = 
  | 'registered' 
  | 'preliminary' 
  | 'final' 
  | 'amended' 
  | 'corrected' 
  | 'cancelled' 
  | 'entered-in-error' 
  | 'unknown';

export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface Coding {
  system?: string;
  code?: string;
  display?: string;
}

export interface Reference {
  reference?: string;
  display?: string;
}

export interface Quantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
}

export interface ObservationComponent {
  code: CodeableConcept;
  value?: any;
  valueQuantity?: Quantity;
  valueString?: string;
}

export interface FHIRPractitioner extends FHIRResource {
  resourceType: 'Practitioner';
  name?: PractitionerName[];
  identifier?: PractitionerIdentifier[];
}

export interface PractitionerName {
  use?: string;
  family?: string;
  given?: string[];
  text?: string;
}

export interface PractitionerIdentifier {
  system?: string;
  value?: string;
  type?: CodeableConcept;
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

export interface FHIRWithValidation extends FHIRResource {
  _validation: ValidationMetadata;
}

/**
 * Constants for validation
 */
export const VALID_OBSERVATION_STATUSES = [
  'registered',
  'preliminary', 
  'final',
  'amended',
  'corrected',
  'cancelled',
  'entered-in-error',
  'unknown'
] as const;

export const VALIDATION_SEVERITY_LEVELS = ['error', 'warning', 'info'] as const;

export type ValidationSeverity = typeof VALIDATION_SEVERITY_LEVELS[number];