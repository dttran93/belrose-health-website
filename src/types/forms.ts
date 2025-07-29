import { FIELD_TYPES, FIELD_CATEGORIES, FIELD_PRIORITY } from '@/lib/fhirConstants';

export interface FieldConfiguration {
  key: string;
  label: string;
  type: keyof typeof FIELD_TYPES;
  category: keyof typeof FIELD_CATEGORIES;
  priority: keyof typeof FIELD_PRIORITY;
  value: any;
  defaultValue?: any;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  validation?: FieldValidation;
  options?: SelectOption[];
  layoutWidth?: string;
  checkboxLabel?: string;
  fhirPath?: string;
}

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  custom?: (value: any) => string | null;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ValidationState {
  isValid: boolean;
  isDirty: boolean;
  hasErrors: boolean;
  errors: Record<string, string>;
  errorCount: number;
  changes?: Record<string, any>;
  formData?: Record<string, any>;
}

export interface FormState {
  formData: Record<string, any>;
  errors: Record<string, string>;
  isDirty: boolean;
  isValid: boolean;
  hasUnsavedChanges: boolean;
}