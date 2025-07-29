// ============================================================================
// FIELD TYPE DEFINITIONS
// ============================================================================

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
} as const;

// TypeScript magic: Create a union type from the object values
export type FieldType = typeof FIELD_TYPES[keyof typeof FIELD_TYPES];
// This creates: 'text' | 'number' | 'select' | 'checkbox' | ... etc.

// ============================================================================
// FIELD CATEGORY DEFINITIONS  
// ============================================================================

// Field Categories - for organizing form sections
export const FIELD_CATEGORIES = {
  PATIENT_INFO: 'Patient',
  PROVIDER_INFO: 'Provider',
  CLINICAL_DATA: 'Clinical',
  ADMINISTRATIVE: 'Admin',
} as const;

// TypeScript magic: Create union types from the object
export type FieldCategory = typeof FIELD_CATEGORIES[keyof typeof FIELD_CATEGORIES];
export type FieldCategoryKey = keyof typeof FIELD_CATEGORIES;
// FieldCategory creates: 'Patient' | 'Provider' | 'Clinical' | 'Admin'
// FieldCategoryKey creates: 'PATIENT_INFO' | 'PROVIDER_INFO' | 'CLINICAL_DATA' | 'ADMINISTRATIVE'

// ============================================================================
// FIELD PRIORITY DEFINITIONS
// ============================================================================

// Field Priority - for form field ordering and validation
export const FIELD_PRIORITY = {
  REQUIRED: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
  OPTIONAL: 5
} as const;

// TypeScript magic: Create union types from priority values
export type FieldPriority = typeof FIELD_PRIORITY[keyof typeof FIELD_PRIORITY];
export type FieldPriorityKey = keyof typeof FIELD_PRIORITY;
// FieldPriority creates: 1 | 2 | 3 | 4 | 5
// FieldPriorityKey creates: 'REQUIRED' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OPTIONAL'

// ============================================================================
// DISPLAY LABEL MAPPINGS
// ============================================================================

// Category Display Names - for UI labels
export const CATEGORY_LABELS: Record<FieldCategory, string> = {
  [FIELD_CATEGORIES.PATIENT_INFO]: 'Patient',
  [FIELD_CATEGORIES.PROVIDER_INFO]: 'Provider',
  [FIELD_CATEGORIES.CLINICAL_DATA]: 'Clinical',
  [FIELD_CATEGORIES.ADMINISTRATIVE]: 'Administrative',
};

// Priority Display Names - for UI
export const PRIORITY_LABELS: Record<FieldPriority, string> = {
  [FIELD_PRIORITY.REQUIRED]: 'Required',
  [FIELD_PRIORITY.HIGH]: 'High Priority',
  [FIELD_PRIORITY.MEDIUM]: 'Medium Priority',
  [FIELD_PRIORITY.LOW]: 'Low Priority',
  [FIELD_PRIORITY.OPTIONAL]: 'Optional'
};

// Field Type Display Names - for admin interfaces
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
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

// ============================================================================
// HELPER FUNCTIONS WITH TYPE SAFETY
// ============================================================================

/**
 * Get the display label for a field type
 * @param fieldType - The field type to get the label for
 * @returns The human-readable label or the original field type if not found
 */
export const getFieldTypeLabel = (fieldType: FieldType): string => {
  return FIELD_TYPE_LABELS[fieldType] || fieldType;
};

/**
 * Get the display label for a category
 * @param category - The category to get the label for  
 * @returns The human-readable label or the original category if not found
 */
export const getCategoryLabel = (category: FieldCategory): string => {
  return CATEGORY_LABELS[category] || category;
};

/**
 * Get the display label for a priority level
 * @param priority - The priority level to get the label for
 * @returns The human-readable label or a default priority string
 */
export const getPriorityLabel = (priority: FieldPriority): string => {
  return PRIORITY_LABELS[priority] || `Priority ${priority}`;
};

// ============================================================================
// VALIDATION HELPERS WITH TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a value is a valid field type
 * @param fieldType - Value to check
 * @returns True if the value is a valid field type
 */
export const isValidFieldType = (fieldType: any): fieldType is FieldType => {
  return Object.values(FIELD_TYPES).includes(fieldType as FieldType);
};

/**
 * Type guard to check if a value is a valid category
 * @param category - Value to check
 * @returns True if the value is a valid category
 */
export const isValidCategory = (category: any): category is FieldCategory => {
  return Object.values(FIELD_CATEGORIES).includes(category as FieldCategory);
};

/**
 * Type guard to check if a value is a valid priority
 * @param priority - Value to check
 * @returns True if the value is a valid priority
 */
export const isValidPriority = (priority: any): priority is FieldPriority => {
  return Object.values(FIELD_PRIORITY).includes(priority as FieldPriority);
};

// ============================================================================
// ADDITIONAL TYPE-SAFE UTILITIES
// ============================================================================

/**
 * Get all available field types as an array
 * @returns Array of all field type values
 */
export const getAllFieldTypes = (): FieldType[] => {
  return Object.values(FIELD_TYPES);
};

/**
 * Get all available categories as an array
 * @returns Array of all category values
 */
export const getAllCategories = (): FieldCategory[] => {
  return Object.values(FIELD_CATEGORIES);
};

/**
 * Get all available priorities as an array
 * @returns Array of all priority values
 */
export const getAllPriorities = (): FieldPriority[] => {
  return Object.values(FIELD_PRIORITY);
};

/**
 * Get category keys in a specific order for consistent UI display
 * @returns Array of category keys in display order
 */
export const getCategoryKeysInOrder = (): FieldCategoryKey[] => {
  return [
    'ADMINISTRATIVE',
    'PATIENT_INFO', 
    'PROVIDER_INFO',
    'CLINICAL_DATA'
  ];
};

/**
 * Check if a priority level indicates a required field
 * @param priority - The priority level to check
 * @returns True if the priority indicates a required field
 */
export const isPriorityRequired = (priority: FieldPriority): boolean => {
  return priority === FIELD_PRIORITY.REQUIRED;
};

/**
 * Check if a priority level indicates a high importance field
 * @param priority - The priority level to check
 * @returns True if the priority is high or required
 */
export const isPriorityHigh = (priority: FieldPriority): boolean => {
  return priority === FIELD_PRIORITY.REQUIRED || priority === FIELD_PRIORITY.HIGH;
};

/**
 * Get priority level as a numeric value for sorting
 * @param priority - The priority to convert
 * @returns Numeric value for sorting (lower = higher priority)
 */
export const getPriorityWeight = (priority: FieldPriority): number => {
  return priority;
};

// ============================================================================
// ADVANCED TYPE UTILITIES FOR YOUR FORMS
// ============================================================================

/**
 * Utility type for creating field configuration objects
 * This ensures all required properties are included and properly typed
 */
export interface FieldTypeConfig {
  type: FieldType;
  category: FieldCategory;
  priority: FieldPriority;
  label: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
}

/**
 * Helper to create a type-safe field configuration
 * @param config - The field configuration object
 * @returns The same configuration with full type safety
 */
export const createFieldConfig = (config: FieldTypeConfig): FieldTypeConfig => {
  // Validate the configuration at runtime
  if (!isValidFieldType(config.type)) {
    throw new Error(`Invalid field type: ${config.type}`);
  }
  if (!isValidCategory(config.category)) {
    throw new Error(`Invalid category: ${config.category}`);
  }
  if (!isValidPriority(config.priority)) {
    throw new Error(`Invalid priority: ${config.priority}`);
  }
  
  return config;
};