// src/lib/fhirConstants.js
// Field Types - these define what UI components to render
export const FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  SELECT: 'select',
  CHECKBOX: 'checkbox',
  TEXTAREA: 'textarea',
  EMAIL: 'email',
  PHONE: 'tel',
  URL: 'url',
  DATE: 'date',
  DATETIME: 'datetime-local',
  TIME: 'time'
};

// Field Categories - for organizing form sections
export const FIELD_CATEGORIES = {
  PATIENT_INFO: 'Patient',
  PROVIDER_INFO: 'Provider', 
  CLINICAL_DATA: 'Clinical',
  ADMINISTRATIVE: 'Admin',
};

// Field Priority - for form field ordering and validation
export const FIELD_PRIORITY = {
  REQUIRED: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
  OPTIONAL: 5
};

// Category Display Names - for UI labels
export const CATEGORY_LABELS = {
  [FIELD_CATEGORIES.PATIENT_INFO]: 'Patient',
  [FIELD_CATEGORIES.PROVIDER_INFO]: 'Provider',
  [FIELD_CATEGORIES.CLINICAL_DATA]: 'Clinical',
  [FIELD_CATEGORIES.ADMINISTRATIVE]: 'Administrative',
};

// Priority Display Names - for UI
export const PRIORITY_LABELS = {
  [FIELD_PRIORITY.REQUIRED]: 'Required',
  [FIELD_PRIORITY.HIGH]: 'High Priority',
  [FIELD_PRIORITY.MEDIUM]: 'Medium Priority', 
  [FIELD_PRIORITY.LOW]: 'Low Priority',
  [FIELD_PRIORITY.OPTIONAL]: 'Optional'
};

// Field Type Display Names - for admin interfaces
export const FIELD_TYPE_LABELS = {
  [FIELD_TYPES.TEXT]: 'Text Input',
  [FIELD_TYPES.NUMBER]: 'Number Input',
  [FIELD_TYPES.SELECT]: 'Dropdown Select',
  [FIELD_TYPES.CHECKBOX]: 'Checkbox',
  [FIELD_TYPES.TEXTAREA]: 'Text Area',
  [FIELD_TYPES.EMAIL]: 'Email Input',
  [FIELD_TYPES.PHONE]: 'Phone Input',
  [FIELD_TYPES.URL]: 'URL Input',
  [FIELD_TYPES.DATE]: 'Date Picker',
  [FIELD_TYPES.DATETIME]: 'Date & Time Picker',
  [FIELD_TYPES.TIME]: 'Time Picker'
};

// Helper functions for working with constants
export const getFieldTypeLabel = (fieldType) => {
  return FIELD_TYPE_LABELS[fieldType] || fieldType;
};

export const getCategoryLabel = (category) => {
  return CATEGORY_LABELS[category] || category;
};

export const getPriorityLabel = (priority) => {
  return PRIORITY_LABELS[priority] || `Priority ${priority}`;
};

// Validation helpers
export const isValidFieldType = (fieldType) => {
  return Object.values(FIELD_TYPES).includes(fieldType);
};

export const isValidCategory = (category) => {
  return Object.values(FIELD_CATEGORIES).includes(category);
};

export const isValidPriority = (priority) => {
  return Object.values(FIELD_PRIORITY).includes(priority);
};