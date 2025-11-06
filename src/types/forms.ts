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
