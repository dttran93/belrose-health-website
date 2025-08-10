import type { FHIRWithValidation } from '../../AddRecord/services/fhirConversionService.type';

export interface FieldConfiguration {
  key: string;
  label?: string;
  type: FieldType;
  value?: any;
  defaultValue?: any;
  required?: boolean;
  min?: number;
  max?: number;
  _resourceType?: string;
  _resourceIndex?: number;
  [key: string]: any; // Allow additional properties
}

export type FieldType = 
  | 'text'
  | 'email' 
  | 'number'
  | 'date'
  | 'datetime-local'
  | 'url'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'tel';

export interface FormErrors {
  [fieldKey: string]: string;
}

export interface FormData {
  [fieldKey: string]: any;
}

export interface ValidationState {
  isValid: boolean;
  isDirty: boolean;
  hasErrors: boolean;
  errors: FormErrors;
  errorCount: number;
  changes?: FormData;
  formData: FormData;
  hasUnsavedChanges?: boolean;
}

export interface FormSummary {
  totalFields: number;
  filledFields: number;
  errorCount: number;
  completionPercentage: number;
  isValid: boolean;
  isDirty: boolean;
}

export interface ExpandedSections {
  [sectionKey: string]: boolean;
}

export interface StableFieldConfigsRef {
  hash: string;
  configs: FieldConfiguration[];
}

export interface FHIRFormStateHookParams {
  fieldConfigs?: FieldConfiguration[];
  onFHIRUpdate?: (data: FHIRWithValidation) => void;
  onValidationChange?: (validationState: ValidationState) => void;
  fhirData?: FHIRWithValidation;
}

export interface FHIRFormStateHookReturn {
  // Form data
  formData: FormData;
  errors: FormErrors;
  isDirty: boolean;
  isValid: boolean;
  hasUnsavedChanges: boolean;
  errorCount: number;
  isSaving: boolean;
  
  // UI state
  expandedSections: ExpandedSections;
  setExpandedSections: React.Dispatch<React.SetStateAction<ExpandedSections>>;
  showLowPriority: boolean;
  setShowLowPriority: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Actions
  handleFieldChange: (fieldKey: string, value: any) => void;
  handleFieldBlur: (fieldKey: string) => void;
  validateAllFields: () => boolean;
  resetForm: () => void;
  saveFHIRData: () => Promise<boolean>;
  discardChanges: () => void;
  
  // Utilities
  getFormSummary: () => FormSummary;
  validateField: (field: FieldConfiguration, value: any) => string | null;
}

/**
 * Type for form data converter function
 */
export interface FormDataConverter {
  convertFormDataToFHIR: (
    formData: FormData, 
    fieldConfigs: FieldConfiguration[], 
    originalFhirData?: FHIRWithValidation
  ) => FHIRWithValidation | null;
}