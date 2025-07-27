// FIXED VERSION: useFHIRFormState.js with infinite loop prevention

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/**
 * Custom hook to manage FHIR form state
 * Handles form data, errors, validation, and change tracking
 * 
 * @param {Array} fieldConfigs - Array of field configuration objects
 * @param {Function} onFHIRUpdate - Callback when form data changes (optional)
 * @param {Function} onValidationChange - Callback when validation state changes (optional)
 * @param {Object} fhirData - Original FHIR data for reference
 * @returns {Object} Form state and handlers
 */
export const useFHIRFormState = (fieldConfigs = [], onFHIRUpdate, onValidationChange, fhirData) => {
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
  const isInitializing = useRef(false);

  // CRITICAL FIX 1: Create stable reference for fieldConfigs comparison
  const stableFieldConfigsRef = useRef([]);
  const fieldConfigsHash = useMemo(() => {
    if (!fieldConfigs || fieldConfigs.length === 0) return '';
    // Create a simple hash based on field keys and values
    return fieldConfigs.map(f => `${f.key}:${f.value || ''}`).join('|');
  }, [fieldConfigs]);

  // CRITICAL FIX 2: Memoize callbacks to prevent re-creation
  const memoizedOnFHIRUpdate = useCallback((data) => {
    if (onFHIRUpdate && !isInitializing.current) {
      console.log('📤 Calling onFHIRUpdate with data:', Object.keys(data).length, 'fields');
      onFHIRUpdate(data);
    }
  }, [onFHIRUpdate]);

  /**
   * Call validation callback only when needed, with loop prevention
   */
  const callValidationCallback = useCallback((validationState) => {
    if (!onValidationChange || isInitializing.current) return;

    // CRITICAL FIX 3: Use shallow comparison instead of JSON.stringify
    const currentStateKey = `${validationState.isValid}-${validationState.isDirty}-${validationState.hasErrors}-${validationState.errorCount}`;
    
    if (lastValidationState.current === currentStateKey) {
      return; // Skip if state hasn't actually changed
    }

    lastValidationState.current = currentStateKey;
    console.log('📊 Calling validation callback:', {
      isValid: validationState.isValid,
      isDirty: validationState.isDirty,
      errorCount: validationState.errorCount
    });
    
    onValidationChange(validationState);
  }, [onValidationChange]);

  /**
   * Initialize form data when field configurations change
   */
  useEffect(() => {
    // CRITICAL FIX 4: Only initialize if configs actually changed
    if (fieldConfigsHash === stableFieldConfigsRef.current.hash) {
      console.log('🔄 Field configs unchanged, skipping initialization');
      return;
    }

    console.log('🔄 Initializing form data with', fieldConfigs.length, 'field configurations');
    
    isInitializing.current = true; // Prevent callbacks during initialization
    
    const initialData = {};
    fieldConfigs.forEach(field => {
      // Use the field's default value, or empty string as fallback
      initialData[field.key] = field.value || field.defaultValue || '';
    });
    
    // Update stable reference
    stableFieldConfigsRef.current = {
      hash: fieldConfigsHash,
      configs: [...fieldConfigs]
    };
    
    setFormData(initialData);
    setIsDirty(false);
    setErrors({}); // Clear any existing errors when reinitializing
    setIsValid(true);
    hasCalledInitialValidation.current = false; // Reset validation flag
    
    console.log('✅ Form data initialized with', Object.keys(initialData).length, 'fields');
    
    // Allow callbacks after a brief delay
    setTimeout(() => {
      isInitializing.current = false;
    }, 100);
  }, [fieldConfigsHash, fieldConfigs]);

  /**
   * Set initial validation state when form is ready
   */
  useEffect(() => {
    if (fieldConfigs.length > 0 && 
        !hasCalledInitialValidation.current && 
        !isInitializing.current) {
      
      hasCalledInitialValidation.current = true;
      
      const initialValidationState = {
        isValid: true,
        isDirty: false,
        hasErrors: false,
        errors: {},
        errorCount: 0,
        changes: {},
        formData: formData
      };

      console.log('🔬 Setting initial validation state');
      callValidationCallback(initialValidationState);
    }
  }, [fieldConfigs.length, formData, callValidationCallback]);

  /**
   * Validate a single field
   * @param {Object} field - Field configuration
   * @param {*} value - Field value to validate
   * @returns {string|null} Error message or null if valid
   */
  const validateField = useCallback((field, value) => {
    console.log(`🔍 Validating field ${field.key}:`, { 
      value: typeof value === 'string' ? value.substring(0, 50) : value, 
      required: field.required, 
      type: field.type 
    });
    
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
          return `${field.label || field.key} must be a valid email address`;
        }
        break;
        
      case 'number':
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          return `${field.label || field.key} must be a valid number`;
        }
        
        // Check min/max constraints
        if (field.min !== undefined && numValue < field.min) {
          return `${field.label || field.key} must be at least ${field.min}`;
        }
        if (field.max !== undefined && numValue > field.max) {
          return `${field.label || field.key} must be no more than ${field.max}`;
        }
        break;
        
      case 'date':
      case 'datetime-local':
        if (!Date.parse(value)) {
          return `${field.label || field.key} must be a valid date`;
        }
        break;
        
      case 'url':
        try {
          new URL(value);
        } catch {
          return `${field.label || field.key} must be a valid URL`;
        }
        break;
    }
    
    return null; // Field is valid
  }, []);

  /**
   * Validate all fields in the form
   */
  const validateAllFields = useCallback(() => {
    if (isInitializing.current) return true;
    
    console.log('🧪 Validating all fields...');
    
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
    
    console.log(`🧪 Validation complete: ${hasErrors ? 'INVALID' : 'VALID'}`);
    console.log('Errors:', newErrors);
    
    // CRITICAL FIX 5: Only call validation callback if not initializing
    if (!isInitializing.current) {
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
    }
    
    return !hasErrors;
  }, [fieldConfigs, formData, validateField, isDirty, callValidationCallback]);

  /**
   * Handle field value changes
   */
  const handleFieldChange = useCallback((fieldKey, value) => {
    if (isInitializing.current) return;
    
    console.log(`✏️ Field changed: ${fieldKey} = "${typeof value === 'string' ? value.substring(0, 50) : value}"`);
    
    // Find the field configuration
    const field = fieldConfigs.find(f => f.key === fieldKey);
    
    setFormData(prev => {
      const newData = {
        ...prev,
        [fieldKey]: value
      };
      
      // CRITICAL FIX: Don't call onFHIRUpdate on every field change
      // Only call it when explicitly saving via saveFHIRData()
      // This prevents the FHIR data from being corrupted with flat form data
      
      return newData;
    });

    setIsDirty(true);

    // Validate the changed field immediately
    if (field && !isInitializing.current) {
      const error = validateField(field, value);
      
      setErrors(prev => {
        const newErrors = { ...prev };
        
        if (error) {
          newErrors[fieldKey] = error;
        } else {
          delete newErrors[fieldKey]; // Clear error if field is now valid
        }
        
        console.log(`🧹 ${error ? 'Set' : 'Cleared'} error for field: ${fieldKey}`);
        
        // Call validation callback with updated errors - but only if not initializing
        if (!isInitializing.current) {
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
          
          // Debounce validation callback
          setTimeout(() => {
            if (!isInitializing.current) {
              callValidationCallback(validationState);
            }
          }, 100);
        }
        
        return newErrors;
      });
    }
  }, [fieldConfigs, validateField, formData, callValidationCallback]);

  /**
   * Handle field blur events
   */
  const handleFieldBlur = useCallback((fieldKey) => {
    if (isInitializing.current) return;
    
    console.log(`👁️ Field blurred: ${fieldKey}`);
    
    // Re-validate the field on blur
    const field = fieldConfigs.find(f => f.key === fieldKey);
    if (field) {
      const value = formData[fieldKey];
      const error = validateField(field, value);
      
      setErrors(prev => {
        const newErrors = { ...prev };
        
        if (error) {
          newErrors[fieldKey] = error;
        } else {
          delete newErrors[fieldKey];
        }
        
        return newErrors;
      });
    }
  }, [fieldConfigs, formData, validateField]);

  /**
   * Manual save functionality - returns FHIR data
   */
  const saveFHIRData = useCallback(() => {
    if (!isValid || !isDirty) {
      console.log('⚠️ Cannot save: form invalid or not dirty');
      return false;
    }
    
    console.log('💾 Saving FHIR data...');
    
    try {
      // Import your existing form-to-FHIR converter
      import('@/features/AddRecord/utils/formtoFhirConverter').then(({ convertFormDataToFHIR }) => {
        // Convert form data back to proper FHIR structure using your existing converter
        const reconstructedFHIR = convertFormDataToFHIR(formData, fieldConfigs, fhirData);
        
        if (!reconstructedFHIR) {
          console.error('❌ Failed to reconstruct FHIR data from form');
          return false;
        }
        
        console.log('✅ Successfully reconstructed FHIR data:', {
          entries: reconstructedFHIR.entry?.length || 0,
          resourceTypes: reconstructedFHIR.entry?.map(e => e.resource?.resourceType) || []
        });
        
        // Call the update callback with reconstructed FHIR data
        memoizedOnFHIRUpdate(reconstructedFHIR);
        
        // Mark as clean
        setIsDirty(false);
        
        console.log('✅ FHIR data saved successfully');
      }).catch(error => {
        console.error('❌ Error importing or using convertFormDataToFHIR:', error);
      });
      
      return true;
    } catch (error) {
      console.error('❌ Error saving FHIR data:', error);
      return false;
    }
  }, [isValid, isDirty, formData, fieldConfigs, memoizedOnFHIRUpdate, fhirData]);

  /**
   * Discard unsaved changes
   */
  const discardChanges = useCallback(() => {
    console.log('🗑️ Discarding unsaved changes');
    
    // Reset to initial field values
    const initialData = {};
    fieldConfigs.forEach(field => {
      initialData[field.key] = field.value || field.defaultValue || '';
    });
    
    setFormData(initialData);
    setIsDirty(false);
    setErrors({});
    setIsValid(true);
  }, [fieldConfigs]);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    console.log('🔄 Resetting form to initial state');
    
    isInitializing.current = true;
    
    const initialData = {};
    fieldConfigs.forEach(field => {
      initialData[field.key] = field.value || field.defaultValue || '';
    });
    
    setFormData(initialData);
    setErrors({});
    setIsDirty(false);
    setIsValid(true);
    hasCalledInitialValidation.current = false;
    
    setTimeout(() => {
      isInitializing.current = false;
    }, 100);
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

  // CRITICAL FIX 7: Compute hasUnsavedChanges efficiently
  const hasUnsavedChanges = useMemo(() => {
    return isDirty && Object.keys(formData).length > 0;
  }, [isDirty, formData]);

  return {
    // Form data
    formData,
    errors,
    isDirty,
    isValid,
    hasUnsavedChanges,
    errorCount: Object.keys(errors).length,
    
    // UI state
    expandedSections,
    setExpandedSections,
    showLowPriority,
    setShowLowPriority,
    
    // Actions
    handleFieldChange,
    handleFieldBlur,
    validateAllFields,
    resetForm,
    saveFHIRData,
    discardChanges,
    
    // Utilities
    getFormSummary,
    validateField
  };
};