import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';

import type {
  FieldConfiguration,
  FormErrors,
  FormData,
  ValidationState,
  FormSummary,
  ExpandedSections,
  StableFieldConfigsRef,
  FHIRFormStateHookParams,
  FHIRFormStateHookReturn,
  FieldType
} from './useFHIRFormState.type';

import type { FHIRWithValidation } from '../../AddRecord/services/fhirConversionService.type';

/**
 * Custom hook to manage FHIR form state
 * Handles form data, errors, validation, and change tracking
 */
export const useFHIRFormState = ({
  fieldConfigs = [],
  onFHIRUpdate,
  onValidationChange,
  fhirData
}: FHIRFormStateHookParams): FHIRFormStateHookReturn => {
  // Core form state
  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isValid, setIsValid] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // UI state for form sections
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({});
  const [showLowPriority, setShowLowPriority] = useState<boolean>(false);

  // Refs for tracking state and preventing loops
  const hasCalledInitialValidation = useRef<boolean>(false);
  const lastValidationState = useRef<string | null>(null);
  const isInitializing = useRef<boolean>(false);
  const stableFieldConfigsRef = useRef<StableFieldConfigsRef>({ hash: '', configs: [] });

  // Memoize fieldConfigs hash for comparison
  const fieldConfigsHash = useMemo(() => {
    if (!fieldConfigs || fieldConfigs.length === 0) return '';
    return fieldConfigs.map(f => `${f.key}:${f.value || ''}`).join('|');
  }, [fieldConfigs]);

  // Memoized callbacks
  const memoizedOnFHIRUpdate = useCallback((data: FHIRWithValidation) => {
    if (onFHIRUpdate && !isInitializing.current) {
      console.log('📤 Calling onFHIRUpdate with data:', Object.keys(data).length, 'fields');
      onFHIRUpdate(data);
    }
  }, [onFHIRUpdate]);

  /**
   * Call validation callback only when needed, with loop prevention
   */
  const callValidationCallback = useCallback((validationState: ValidationState) => {
    if (!onValidationChange || isInitializing.current) return;

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
    if (fieldConfigsHash === stableFieldConfigsRef.current.hash) {
      console.log('🔄 Field configs unchanged, skipping initialization');
      return;
    }

    console.log('🔄 Initializing form data with', fieldConfigs.length, 'field configurations');
    
    isInitializing.current = true;
    
    const initialData: FormData = {};
    fieldConfigs.forEach(field => {
      initialData[field.key] = field.value || field.defaultValue || '';
    });
    
    stableFieldConfigsRef.current = {
      hash: fieldConfigsHash,
      configs: [...fieldConfigs]
    };
    
    setFormData(initialData);
    setIsDirty(false);
    setErrors({});
    setIsValid(true);
    hasCalledInitialValidation.current = false;
    
    console.log('✅ Form data initialized with', Object.keys(initialData).length, 'fields');
    
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
      
      const initialValidationState: ValidationState = {
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
   */
  const validateField = useCallback((field: FieldConfiguration, value: any): string | null => {
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
    
    return null;
  }, []);

  /**
   * Validate all fields in the form
   */
  const validateAllFields = useCallback((): boolean => {
    if (isInitializing.current) return true;
    
    console.log('🧪 Validating all fields...');
    
    const newErrors: FormErrors = {};
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
    
    if (!isInitializing.current) {
      const validationState: ValidationState = {
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
   * Handle field value changes with flushSync for immediate state updates
   */
  const handleFieldChange = useCallback((fieldKey: string, value: any): void => {
    if (isInitializing.current) return;
    
    console.log(`✏️ Field changed: ${fieldKey} = "${typeof value === 'string' ? value.substring(0, 50) : value}"`);
    
    const field = fieldConfigs.find(f => f.key === fieldKey);
    
    // Use flushSync to force synchronous state updates
    flushSync(() => {
      setFormData(prev => ({ ...prev, [fieldKey]: value }));
      setIsDirty(true);
      
      // Validate the changed field immediately
      if (field && !isInitializing.current) {
        const error = validateField(field, value);
        
        setErrors(prev => {
          const newErrors = { ...prev };
          
          if (error) {
            newErrors[fieldKey] = error;
          } else {
            delete newErrors[fieldKey];
          }
          
          console.log(`🧹 ${error ? 'Set' : 'Cleared'} error for field: ${fieldKey}`);
          
          const hasErrors = Object.keys(newErrors).length > 0;
          setIsValid(!hasErrors);
          
          return newErrors;
        });
      }
    });

    // Now call validation callback with the updated state
    if (field && !isInitializing.current) {
      // Get the current state (which is now updated due to flushSync)
      const currentErrors = Object.keys(errors).length > 0;
      
      const validationState: ValidationState = {
        isValid: !currentErrors,
        isDirty: true,
        hasErrors: currentErrors,
        errors: errors,
        errorCount: Object.keys(errors).length,
        changes: formData,
        formData: { ...formData, [fieldKey]: value },
        hasUnsavedChanges: true
      };
      
      // Small delay to ensure all state updates are complete
      setTimeout(() => {
        if (!isInitializing.current) {
          callValidationCallback(validationState);
        }
      }, 0);
    }
  }, [fieldConfigs, validateField, callValidationCallback, formData, errors]);

  /**
   * Handle field blur events
   */
  const handleFieldBlur = useCallback((fieldKey: string): void => {
    if (isInitializing.current) return;
    
    console.log(`👁️ Field blurred: ${fieldKey}`);
    
    const field = fieldConfigs.find(f => f.key === fieldKey);
    if (field) {
      const value = formData[field.key];
      const error = validateField(field, value);
      
      flushSync(() => {
        setErrors(prev => {
          const newErrors = { ...prev };
          
          if (error) {
            newErrors[fieldKey] = error;
          } else {
            delete newErrors[fieldKey];
          }
          
          return newErrors;
        });
      });
    }
  }, [fieldConfigs, formData, validateField]);

  /**
   * Manual save functionality with flushSync and proper async handling
   */
  const saveFHIRData = useCallback(async (): Promise<boolean> => {
    // Use flushSync to ensure we have the most current state
    let currentFormData: FormData;
    let currentIsDirty: boolean;
    let currentErrors: FormErrors;
    
    flushSync(() => {
      setIsSaving(true);
    });
    
    // Now read the current state
    currentFormData = formData;
    currentIsDirty = isDirty;
    currentErrors = errors;
    
    console.log('💾 Saving FHIR data...');
    console.log('📊 Current state:', { 
      isDirty: currentIsDirty, 
      isValid: Object.keys(currentErrors).length === 0, 
      formDataKeys: Object.keys(currentFormData).length 
    });
    
    // Check if we have changes and data
    if (!currentIsDirty) {
      console.log('⚠️ Cannot save: no changes made');
      flushSync(() => setIsSaving(false));
      return false;
    }
    
    if (Object.keys(currentFormData).length === 0) {
      console.log('⚠️ Cannot save: no form data');
      flushSync(() => setIsSaving(false));
      return false;
    }
    
    if (Object.keys(currentErrors).length > 0) {
      console.log('⚠️ Cannot save: form has validation errors');
      flushSync(() => setIsSaving(false));
      return false;
    }
    
    try {
      // Use async/await for proper timing
      const { convertFormDataToFHIR } = await import('@/features/ViewEditRecord/utils/formtoFhirConverter');
      
      // DEBUG: Log field configs to check for missing metadata
      console.log('🔍 Checking field configs for missing metadata...');
      const fieldsWithoutMetadata = fieldConfigs.filter(f => 
        !f._resourceType || f._resourceIndex === undefined
      );
      
      if (fieldsWithoutMetadata.length > 0) {
        console.warn('⚠️ Found fields without resource metadata:', 
          fieldsWithoutMetadata.map(f => ({ key: f.key, _resourceType: f._resourceType, _resourceIndex: f._resourceIndex }))
        );
      }
      
      // Convert form data back to proper FHIR structure
      const reconstructedFHIR = convertFormDataToFHIR(currentFormData, fieldConfigs, fhirData);
      
      if (!reconstructedFHIR) {
        console.error('❌ Failed to reconstruct FHIR data from form');
        flushSync(() => setIsSaving(false));
        return false;
      }
      
      console.log('✅ Successfully reconstructed FHIR data:', {
        entries: reconstructedFHIR.entry?.length || 0,
        resourceTypes: reconstructedFHIR.entry?.map((e: any) => e.resource?.resourceType) || []
      });
      
      // DEBUG: Compare original vs reconstructed to see what changed
      console.log('🔍 Comparing original vs reconstructed FHIR data...');
      if (fhirData?.entry && reconstructedFHIR?.entry) {
        fhirData.entry.forEach((originalEntry: any, index: number) => {
          const reconstructedEntry = reconstructedFHIR.entry?.[index];
          if (originalEntry?.resource && reconstructedEntry?.resource) {
            const original = JSON.stringify(originalEntry.resource, null, 2);
            const reconstructed = JSON.stringify(reconstructedEntry.resource, null, 2);
            if (original !== reconstructed) {
              console.log(`📝 Resource ${index} (${originalEntry.resource.resourceType}) was modified`);
              // Log specific field that changed for the field we're tracking
              if (originalEntry.resource.resourceType === 'Patient' && 
                  originalEntry.resource.name?.[0]?.given !== reconstructedEntry.resource.name?.[0]?.given) {
                console.log(`🎯 Patient name.given changed: "${originalEntry.resource.name?.[0]?.given}" → "${reconstructedEntry.resource.name?.[0]?.given}"`);
              }
            }
          }
        });
      }
      
      // Call the update callback with reconstructed FHIR data
      memoizedOnFHIRUpdate(reconstructedFHIR);
      
      // Mark as clean AFTER successful conversion
      flushSync(() => {
        setIsDirty(false);
        setIsSaving(false);
      });
      
      console.log('✅ FHIR data saved successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Error saving FHIR data:', error);
      flushSync(() => setIsSaving(false));
      return false;
    }
  }, [formData, isDirty, errors, fieldConfigs, fhirData, memoizedOnFHIRUpdate]);

  /**
   * Discard unsaved changes
   */
  const discardChanges = useCallback((): void => {
    console.log('🗑️ Discarding unsaved changes');
    
    const initialData: FormData = {};
    fieldConfigs.forEach(field => {
      initialData[field.key] = field.value || field.defaultValue || '';
    });
    
    flushSync(() => {
      setFormData(initialData);
      setIsDirty(false);
      setErrors({});
      setIsValid(true);
    });
  }, [fieldConfigs]);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback((): void => {
    console.log('🔄 Resetting form to initial state');
    
    isInitializing.current = true;
    
    const initialData: FormData = {};
    fieldConfigs.forEach(field => {
      initialData[field.key] = field.value || field.defaultValue || '';
    });
    
    flushSync(() => {
      setFormData(initialData);
      setErrors({});
      setIsDirty(false);
      setIsValid(true);
    });
    
    hasCalledInitialValidation.current = false;
    
    setTimeout(() => {
      isInitializing.current = false;
    }, 100);
  }, [fieldConfigs]);

  /**
   * Get form summary for debugging/status
   */
  const getFormSummary = useCallback((): FormSummary => {
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

  // Compute hasUnsavedChanges efficiently
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
    isSaving,
    
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