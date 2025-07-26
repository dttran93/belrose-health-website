// src/features/AddRecord/hooks/useFHIRFormState.js

import { useState, useEffect, useCallback, useRef } from 'react';

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

  // Use refs to track if we've already called validation callbacks to prevent loops
  const hasCalledInitialValidation = useRef(false);
  const lastValidationState = useRef(null);

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
    hasCalledInitialValidation.current = false; // Reset validation flag
    
    console.log('✅ Form data initialized with', Object.keys(initialData).length, 'fields');
  }, [fieldConfigs]);

  /**
   * Call validation callback only when needed, with loop prevention
   */
  const callValidationCallback = useCallback((validationState) => {
    if (!onValidationChange) return;

    // Prevent calling with the same state repeatedly
    const stateString = JSON.stringify(validationState);
    if (lastValidationState.current === stateString) {
      return;
    }

    lastValidationState.current = stateString;
    console.log('📊 Calling validation callback:', validationState);
    onValidationChange(validationState);
  }, [onValidationChange]);

  /**
   * Set initial validation state when form is ready
   */
  useEffect(() => {
    if (fieldConfigs.length > 0 && !hasCalledInitialValidation.current) {
      hasCalledInitialValidation.current = true;
      
      const initialValidationState = {
        isValid: true,
        isDirty: false,
        hasErrors: false,
        errors: {},
        errorCount: 0,
        changes: {},
        formData: {}
      };

      console.log('🎯 Setting initial validation state');
      callValidationCallback(initialValidationState);
    }
  }, [fieldConfigs.length, callValidationCallback]);

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
        
      case 'tel':
        // Basic phone validation - at least 10 digits
        const phoneRegex = /\d{10,}/;
        if (!phoneRegex.test(value.replace(/\D/g, ''))) {
          return 'Please enter a valid phone number';
        }
        break;
        
      case 'url':
        try {
          new URL(value);
        } catch {
          return 'Please enter a valid URL';
        }
        break;
        
      case 'number':
        if (isNaN(value)) {
          return 'Please enter a valid number';
        }
        if (field.min !== undefined && parseFloat(value) < field.min) {
          return `Value must be at least ${field.min}`;
        }
        if (field.max !== undefined && parseFloat(value) > field.max) {
          return `Value must be no more than ${field.max}`;
        }
        break;
        
      case 'date':
        const dateValue = new Date(value);
        if (isNaN(dateValue.getTime())) {
          return 'Please enter a valid date';
        }
        break;
    }
    
    // Length validation
    if (field.minLength && value.length < field.minLength) {
      return `Must be at least ${field.minLength} characters`;
    }
    if (field.maxLength && value.length > field.maxLength) {
      return `Must be no more than ${field.maxLength} characters`;
    }
    
    // Pattern validation
    if (field.pattern) {
      const regex = new RegExp(field.pattern);
      if (!regex.test(value)) {
        return field.patternMessage || 'Invalid format';
      }
    }
    
    return null;
  }, []);

  /**
   * Validate all fields in the form
   */
  const validateAllFields = useCallback(() => {
    console.log('🧪 Validating all fields...');
    
    const newErrors = {};
    
    fieldConfigs.forEach(field => {
      const value = formData[field.key];
      const error = validateField(field, value);
      
      if (error) {
        newErrors[field.key] = error;
      }
    });
    
    setErrors(newErrors);
    
    const hasErrors = Object.keys(newErrors).length > 0;
    setIsValid(!hasErrors);
    
    console.log(`📋 Validation completed: ${hasErrors ? 'INVALID' : 'VALID'}`);
    console.log('Errors:', newErrors);
    
    // Call validation callback after updating state
    const validationState = {
      isValid: !hasErrors,
      isDirty,
      hasErrors,
      errors: newErrors,
      errorCount: Object.keys(newErrors).length,
      changes: isDirty ? formData : {},
      formData: formData
    };
    
    callValidationCallback(validationState);
    
    return !hasErrors;
  }, [fieldConfigs, formData, validateField, isDirty, callValidationCallback]);

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
        
        // Call validation callback with updated errors
        const hasErrors = Object.keys(newErrors).length > 0;
        const validationState = {
          isValid: !hasErrors,
          isDirty: true,
          hasErrors,
          errors: newErrors,
          errorCount: Object.keys(newErrors).length,
          changes: formData,
          formData: { ...formData, [fieldKey]: value }
        };
        
        callValidationCallback(validationState);
        
        return newErrors;
      });
    }
  }, [fieldConfigs, validateField, onFHIRUpdate, formData, callValidationCallback]);

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
    hasCalledInitialValidation.current = false;
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
      isValid,
      isDirty
    };
  }, [formData, errors, fieldConfigs.length, isValid, isDirty]);

  return {
    // Form data
    formData,
    errors,
    isDirty,
    isValid,
    errorCount: Object.keys(errors).length,
    
    // UI state
    expandedSections,
    setExpandedSections,
    showLowPriority,
    setShowLowPriority,
    
    // Actions
    handleFieldChange,
    validateAllFields,
    resetForm,
    
    // Utilities
    getFormSummary,
    validateField
  };
};