import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to manage FHIR form state
 * Handles form data, errors, validation, and change tracking
 * 
 * @param {Array} fieldConfigs - Array of field configuration objects
 * @param {Function} onFHIRUpdate - Callback when form data changes (optional)
 * @param {Function} onValidationChange - Callback when validation state changes (optional)
 * @returns {Object} Form state and handlers
 */
export const useFHIRFormState = (fieldConfigs = [], onFHIRUpdate, onValidationChange) => {
  // Core form state
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [isValid, setIsValid] = useState(true);
  
  // UI state for form sections
  const [expandedSections, setExpandedSections] = useState({});
  const [showLowPriority, setShowLowPriority] = useState(false);

  /**
   * Initialize form data when field configurations change
   */
  useEffect(() => {
    console.log('🔄 Initializing form data with', fieldConfigs.length, 'field configurations');
    
    const initialData = {};
    fieldConfigs.forEach(field => {
      // Use the field's default value, or empty string as fallback
      initialData[field.key] = field.value || field.defaultValue || '';
    });
    
    setFormData(initialData);
    setIsDirty(false);
    setErrors({}); // Clear any existing errors when reinitializing
    
    console.log('✅ Form data initialized with', Object.keys(initialData).length, 'fields');
  }, [fieldConfigs]);

  /**
   * Validate a single field
   * @param {Object} field - Field configuration
   * @param {*} value - Field value to validate
   * @returns {string|null} Error message or null if valid
   */
  const validateField = useCallback((field, value) => {
    console.log(`🔍 Validating field ${field.key}:`, { value, required: field.required, type: field.type });
    
    // Required field validation
    if (field.required && (!value || value.toString().trim() === '')) {
      return `${field.label || field.key} is required`;
    }
    
    // Skip further validation if field is empty and not required
    if (!value || value.toString().trim() === '') {
      return null;
    }
    
    // Type-specific validation
    switch (field.type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Please enter a valid email address';
        }
        break;
        
      case 'phone':
        // Basic phone validation - at least 10 digits
        const phoneRegex = /\d{10,}/;
        if (!phoneRegex.test(value.replace(/\D/g, ''))) {
          return 'Please enter a valid phone number';
        }
        break;
        
      case 'date':
        // Validate date format and reasonableness
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return 'Please enter a valid date';
        }
        // Check if date is in reasonable range (not too far in future/past)
        const now = new Date();
        const hundredYearsAgo = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
        const tenYearsFromNow = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
        
        if (date < hundredYearsAgo || date > tenYearsFromNow) {
          return 'Date seems unreasonable - please check';
        }
        break;
        
      case 'number':
        if (isNaN(Number(value))) {
          return 'Please enter a valid number';
        }
        break;
        
      case 'select':
        // Validate that selection is from allowed options
        if (field.options && !field.options.some(option => option.value === value)) {
          return 'Please select a valid option';
        }
        break;
    }
    
    // Custom validation if provided
    if (field.validate && typeof field.validate === 'function') {
      try {
        const customValidationResult = field.validate(value, formData);
        if (customValidationResult !== true && customValidationResult) {
          return customValidationResult; // Return custom error message
        }
      } catch (error) {
        console.error(`Custom validation error for ${field.key}:`, error);
        return 'Validation error occurred';
      }
    }
    
    return null; // No errors
  }, [formData]);

  /**
   * Validate all fields and update error state
   */
  const validateAllFields = useCallback(() => {
    console.log('🔍 Validating all fields...');
    
    const newErrors = {};
    let hasErrors = false;
    
    fieldConfigs.forEach(field => {
      const value = formData[field.key];
      const error = validateField(field, value);
      
      if (error) {
        newErrors[field.key] = error;
        hasErrors = true;
      }
    });
    
    setErrors(newErrors);
    setIsValid(!hasErrors);
    
    console.log(`✅ Validation complete: ${hasErrors ? 'INVALID' : 'VALID'}`);
    console.log('Errors:', newErrors);
    
    // Notify parent component of validation changes
    if (onValidationChange) {
      onValidationChange({
        isValid: !hasErrors,
        errors: newErrors,
        errorCount: Object.keys(newErrors).length
      });
    }
    
    return !hasErrors;
  }, [fieldConfigs, formData, validateField, onValidationChange]);

  /**
   * Handle field value changes
   */
  const handleFieldChange = useCallback((fieldKey, value) => {
    console.log(`✏️ Field changed: ${fieldKey} = "${value}"`);
    
    // Find the field configuration
    const field = fieldConfigs.find(f => f.key === fieldKey);
    
    setFormData(prev => {
      const newData = {
        ...prev,
        [fieldKey]: value
      };
      
      // Notify parent component of data changes
      if (onFHIRUpdate) {
        onFHIRUpdate(newData);
      }
      
      return newData;
    });

    setIsDirty(true);

    // Validate the changed field immediately
    if (field) {
      const error = validateField(field, value);
      
      setErrors(prev => {
        const newErrors = { ...prev };
        
        if (error) {
          newErrors[fieldKey] = error;
        } else {
          delete newErrors[fieldKey]; // Clear error if field is now valid
        }
        
        console.log(`🧹 ${error ? 'Set' : 'Cleared'} error for field: ${fieldKey}`);
        return newErrors;
      });
    }
  }, [fieldConfigs, validateField, onFHIRUpdate]);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    console.log('🔄 Resetting form to initial state');
    
    const initialData = {};
    fieldConfigs.forEach(field => {
      initialData[field.key] = field.value || field.defaultValue || '';
    });
    
    setFormData(initialData);
    setErrors({});
    setIsDirty(false);
    setIsValid(true);
  }, [fieldConfigs]);

  /**
   * Get form summary for debugging/status
   */
  const getFormSummary = useCallback(() => {
    const totalFields = fieldConfigs.length;
    const filledFields = Object.values(formData).filter(value => 
      value !== null && value !== undefined && value.toString().trim() !== ''
    ).length;
    const errorCount = Object.keys(errors).length;
    
    return {
      totalFields,
      filledFields,
      errorCount,
      completionPercentage: totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0,
      isDirty,
      isValid
    };
  }, [fieldConfigs.length, formData, errors, isDirty, isValid]);

  /**
   * Toggle section expansion
   */
  const toggleSection = useCallback((sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  }, []);

  /**
   * Update form data programmatically (useful for bulk updates)
   */
  const updateFormData = useCallback((updates) => {
    console.log('🔄 Bulk updating form data:', Object.keys(updates));
    
    setFormData(prev => {
      const newData = { ...prev, ...updates };
      
      if (onFHIRUpdate) {
        onFHIRUpdate(newData);
      }
      
      return newData;
    });
    
    setIsDirty(true);
  }, [onFHIRUpdate]);

  // Return all form state and handlers
  return {
    // Core form state
    formData,
    setFormData,
    errors,
    isDirty,
    isValid,
    
    // UI state
    expandedSections,
    showLowPriority,
    setShowLowPriority,
    
    // Form actions
    handleFieldChange,
    validateAllFields,
    resetForm,
    updateFormData,
    toggleSection,
    
    // Utilities
    getFormSummary,
    validateField,
    
    // Computed values
    hasErrors: Object.keys(errors).length > 0,
    errorCount: Object.keys(errors).length,
    filledFieldCount: Object.values(formData).filter(value => 
      value !== null && value !== undefined && value.toString().trim() !== ''
    ).length
  };
};