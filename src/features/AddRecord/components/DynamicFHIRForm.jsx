import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DynamicFHIRField from './ui/DynamicFHIRField';
import { FIELD_CATEGORIES, FIELD_PRIORITY } from '@/lib/fhirConstants'
import { useFHIRFormState } from '@/features/AddRecord/hooks/useFHIRFormState';
import { generateFieldConfigurations } from '@/features/AddRecord/utils/fhirFieldExtraction';
import {
  getFieldsByCategory,
  filterFieldsByPriority,
  getCategoriesInOrder
} from '@/features/AddRecord/services/fhirFieldProcessors';

const DynamicFHIRForm = ({ 
  fhirData, 
  originalFile, 
  onFHIRUpdate, 
  onValidationChange,
  showSaveButton = true,
  autoSaveOnBlur = false 
}) => {
  // Simple local state for field configurations and loading
  const [fieldConfigs, setFieldConfigs] = useState([]);
  const [loading, setLoading] = useState(false);

  // CRITICAL FIX 1: Memoize fieldConfigs to prevent infinite loops
  const memoizedFieldConfigs = useMemo(() => {
    // Deep clone to ensure stability and prevent mutations
    return fieldConfigs.map(config => ({ ...config }));
  }, [fieldConfigs]);

  // CRITICAL FIX 2: Memoize callbacks to prevent re-creation on every render
  const memoizedOnFHIRUpdate = useCallback((data) => {
    if (onFHIRUpdate) {
      onFHIRUpdate(data);
    }
  }, [onFHIRUpdate]);

  const memoizedOnValidationChange = useCallback((validationState) => {
    if (onValidationChange) {
      onValidationChange(validationState);
    }
  }, [onValidationChange]);

  // Manual save form state - NO automatic onFHIRUpdate calls
  const {
    formData,
    errors,
    isDirty,
    isValid,
    hasUnsavedChanges,
    showLowPriority,
    setShowLowPriority,
    handleFieldChange,
    handleFieldBlur,
    validateAllFields,
    getFormSummary,
    errorCount,
    saveFHIRData,
    discardChanges
  } = useFHIRFormState(
    memoizedFieldConfigs, // Use memoized version
    memoizedOnFHIRUpdate,  // Use memoized callback
    memoizedOnValidationChange, // Use memoized callback
    fhirData
  );

  // CRITICAL FIX 3: Memoize the initialization effect dependencies
  const fhirDataString = useMemo(() => {
    if (!fhirData) return null;
    // Create a stable string representation for comparison
    return JSON.stringify({
      entryLength: fhirData.entry?.length || 0,
      resourceType: fhirData.resourceType,
      id: fhirData.id
    });
  }, [fhirData]);

  const originalFileString = useMemo(() => {
    if (!originalFile) return null;
    // Create a stable string representation for comparison
    return `${originalFile.name}-${originalFile.size}-${originalFile.lastModified}`;
  }, [originalFile]);

  // Initialize field configurations when FHIR data changes
  useEffect(() => {
    const initializeForm = async () => {
      console.log('🚀 DynamicFHIRForm: Initializing form data (manual save mode)');
      console.log('FHIR data provided:', !!fhirData);
      console.log('FHIR entries:', fhirData?.entry?.length || 0);
      
      setLoading(true);
      
      try {
        const fieldConfigurations = await generateFieldConfigurations(fhirData, originalFile);
        console.log('✅ Generated field configurations:', fieldConfigurations.length);
        
        // CRITICAL FIX 4: Only update if configurations actually changed
        setFieldConfigs(prev => {
          const prevLength = prev.length;
          const newLength = fieldConfigurations.length;
          
          // Quick comparison to avoid unnecessary updates
          if (prevLength === newLength && prevLength > 0) {
            console.log('🔄 Field configurations unchanged, skipping update');
            return prev;
          }
          
          console.log('📝 Updating field configurations:', { prevLength, newLength });
          return fieldConfigurations;
        });
      } catch (error) {
        console.error('❌ Error initializing form:', error);
        setFieldConfigs([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (fhirData || originalFile) {
      initializeForm();
    } else {
      console.log('⚠️ No FHIR data or original file provided');
      setFieldConfigs([]);
      setLoading(false);
    }
  }, [fhirDataString, originalFileString]); // Use memoized strings instead of objects

  // Handle manual save
  const handleSave = useCallback(() => {
    console.log('💾 Save button clicked');
    
    if (!isValid) {
      console.log('❌ Cannot save - form has validation errors');
      return;
    }
    
    if (!hasUnsavedChanges) {
      console.log('ℹ️ No changes to save');
      return;
    }
    
    const success = saveFHIRData();
    if (success) {
      console.log('✅ Form saved successfully');
    } else {
      console.log('❌ Save failed');
    }
  }, [isValid, hasUnsavedChanges, saveFHIRData]);

  // Handle field blur with optional auto-save
  const handleFieldBlurWithAutoSave = useCallback((fieldKey) => {
    handleFieldBlur(fieldKey);
    
    if (autoSaveOnBlur && isValid && hasUnsavedChanges) {
      console.log('💾 Auto-saving on blur');
      saveFHIRData();
    }
  }, [handleFieldBlur, autoSaveOnBlur, isValid, hasUnsavedChanges, saveFHIRData]);

  // Helper to get CSS classes for layout widths (enhanced for groups)
  const getLayoutWidthClass = useCallback((width) => {
    const widthMap = {
      '1/2': 'w-1/2',
      '1/3': 'w-1/3', 
      '2/3': 'w-2/3',
      '1/4': 'w-1/4',
      '2/4': 'w-2/4',
      '3/4': 'w-3/4',
      '1/5': 'w-1/5',
      '2/5': 'w-2/5',
      '3/5': 'w-3/5',
      '4/5': 'w-4/5',
      '1/6': 'w-1/6',
      '5/6': 'w-5/6',
      'full': 'w-full',
      'auto': 'w-auto'
    };
    
    return widthMap[width] || 'flex-1';
  }, []);

  // Helper to get category-specific styling
  const getCategoryStyles = useCallback((category) => {
    const categoryStyles = {
      [FIELD_CATEGORIES.ADMINISTRATIVE]: {
        containerClass: 'border-blue-200 bg-blue-50',
        headerClass: 'text-blue-900 border-blue-200',
        accentClass: 'border-l-4 border-l-blue-500'
      },
      [FIELD_CATEGORIES.PATIENT_INFO]: {
        containerClass: 'border-green-200 bg-green-50',
        headerClass: 'text-green-900 border-green-200',
        accentClass: 'border-l-4 border-l-green-500'
      },
      [FIELD_CATEGORIES.PROVIDER_INFO]: {
        containerClass: 'border-purple-200 bg-purple-50',
        headerClass: 'text-purple-900 border-purple-200',
        accentClass: 'border-l-4 border-l-purple-500'
      },
      [FIELD_CATEGORIES.CLINICAL_DATA]: {
        containerClass: 'border-orange-200 bg-orange-50',
        headerClass: 'text-orange-900 border-orange-200',
        accentClass: 'border-l-4 border-l-orange-500'
      }
    };

    return categoryStyles[category] || {
      containerClass: 'border-gray-200 bg-gray-50',
      headerClass: 'text-gray-900 border-gray-200',
      accentClass: 'border-l-4 border-l-gray-500'
    };
  }, []);

  // Helper to get field-level category styling for individual fields
  const getFieldCategoryClass = useCallback((category) => {
    const fieldStyles = {
      [FIELD_CATEGORIES.ADMINISTRATIVE]: 'ring-blue-500/20 focus-within:ring-blue-500/40',
      [FIELD_CATEGORIES.PATIENT_INFO]: 'ring-green-500/20 focus-within:ring-green-500/40',
      [FIELD_CATEGORIES.PROVIDER_INFO]: 'ring-purple-500/20 focus-within:ring-purple-500/40',
      [FIELD_CATEGORIES.CLINICAL_DATA]: 'ring-orange-500/20 focus-within:ring-orange-500/40'
    };

    return fieldStyles[category] || 'ring-gray-500/20 focus-within:ring-gray-500/40';
  }, []);

  // CRITICAL FIX 5: Memoize expensive field processing
  const processedFields = useMemo(() => {
    if (memoizedFieldConfigs.length === 0) {
      return {
        filteredFields: [],
        fieldsByCategory: {},
        orderedCategories: [],
        lowPriorityCount: 0
      };
    }

    const filteredFields = filterFieldsByPriority(memoizedFieldConfigs, showLowPriority);
    const fieldsByCategory = getFieldsByCategory(filteredFields);
    const orderedCategories = getCategoriesInOrder();
    const lowPriorityCount = memoizedFieldConfigs.filter(field => 
      field.priority === FIELD_PRIORITY.LOW
    ).length;

    return {
      filteredFields,
      fieldsByCategory,
      orderedCategories,
      lowPriorityCount
    };
  }, [memoizedFieldConfigs, showLowPriority]);

  // Render fields with layout grouping and category styling
  const renderFieldsWithLayout = useCallback((fields, category) => {
    console.log('🎨 Rendering', fields.length, 'fields with layout grouping...');
    
    const processedFields = new Set();
    const renderedFields = [];
    let groupedCount = 0;
    let singleCount = 0;
    const fieldCategoryClass = getFieldCategoryClass(category);

    // Handle multi-field groups
    const groupedFields = {};
    fields.forEach(field => {
      if (field.layout?.group) {
        if (!groupedFields[field.layout.group]) {
          groupedFields[field.layout.group] = [];
        }
        groupedFields[field.layout.group].push(field);
      }
    });

    // Sort grouped fields by groupOrder and render
    Object.entries(groupedFields).forEach(([groupName, groupFields]) => {
      console.log(`🔗 Rendering group "${groupName}" with ${groupFields.length} fields`);
      
      // Sort by groupOrder
      const sortedFields = groupFields.sort((a, b) => 
        (a.layout?.groupOrder || 0) - (b.layout?.groupOrder || 0)
      );
      
      // Mark all as processed
      sortedFields.forEach(field => processedFields.add(field.key));
      groupedCount += sortedFields.length;
      
      renderedFields.push(
        <div key={groupName} className={`flex gap-4 items-end ${fieldCategoryClass}`}>
          {sortedFields.map(field => (
            <div key={field.key} className={getLayoutWidthClass(field.layout?.width || `1/${sortedFields.length}`)}>
              <DynamicFHIRField 
                field={{ ...field, _categoryClass: fieldCategoryClass }}
                value={formData[field.key] || ''} 
                onChange={(value) => handleFieldChange(field.key, value)}
                onBlur={() => handleFieldBlurWithAutoSave(field.key)}
                error={errors[field.key]}
              />
            </div>
          ))}
        </div>
      );
    });

    // Handle remaining single fields (no groups)
    fields.forEach(field => {
      if (!processedFields.has(field.key)) {
        // Single field
        processedFields.add(field.key);
        singleCount++;
        
        renderedFields.push(
          <div key={field.key} className={fieldCategoryClass}>
            <DynamicFHIRField 
              field={{ ...field, _categoryClass: fieldCategoryClass }}
              value={formData[field.key] || ''} 
              onChange={(value) => handleFieldChange(field.key, value)}
              onBlur={() => handleFieldBlurWithAutoSave(field.key)}
              error={errors[field.key]}
            />
          </div>
        );
      }
    });

    const groupCount = Object.keys(groupedFields).length;
    console.log(`🎨 Layout rendering complete: ${groupCount} groups, ${groupedCount} grouped fields, ${singleCount} single fields`);
    return renderedFields;
  }, [formData, errors, handleFieldChange, handleFieldBlurWithAutoSave, getFieldCategoryClass, getLayoutWidthClass]);

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Generating form fields...</span>
        </div>
      </div>
    );
  }

  // Show message if no fields were generated
  if (memoizedFieldConfigs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="mb-4">
          <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-lg font-medium mb-2">No form fields available</p>
        <p className="text-sm">
          {!fhirData ? 'No FHIR data provided' : 'Could not extract fields from the provided data'}
        </p>
      </div>
    );
  }

  const { filteredFields, fieldsByCategory, orderedCategories, lowPriorityCount } = processedFields;

  // CRITICAL FIX 6: Only log essential information, reduce console spam
  console.log('📊 Form summary:', {
    totalFields: memoizedFieldConfigs.length,
    filteredFields: filteredFields.length,
    categories: orderedCategories.length,
    isDirty,
    isValid
  });

  return (
    <div className="space-y-6">
      {/* Manual Save Controls */}
      {showSaveButton && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            {/* Status Information */}
            <div className="flex items-center space-x-6">
              <div className="text-sm text-gray-700">
                <span className="font-medium">{getFormSummary().filledFields}</span> of{' '}
                <span className="font-medium">{getFormSummary().totalFields}</span> fields completed
                <span className="text-gray-500 ml-2">
                  ({getFormSummary().completionPercentage}%)
                </span>
              </div>
              
              {/* Status Indicators */}
              <div className="flex items-center space-x-4 text-sm">
                {hasUnsavedChanges && (
                  <div className="flex items-center text-amber-600">
                    <div className="w-2 h-2 bg-amber-500 rounded-full mr-2"></div>
                    Unsaved changes
                  </div>
                )}
                
                {!hasUnsavedChanges && isDirty === false && (
                  <div className="flex items-center text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Saved
                  </div>
                )}
                
                {errorCount > 0 && (
                  <div className="flex items-center text-red-600">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errorCount} error{errorCount !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
            
            {/* Save Controls */}
            <div className="flex items-center space-x-3">
              {hasUnsavedChanges && (
                <button
                  type="button"
                  onClick={discardChanges}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Discard Changes
                </button>
              )}
              
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasUnsavedChanges || !isValid}
                className={`
                  px-4 py-2 text-sm font-medium rounded-md transition-colors
                  ${hasUnsavedChanges && isValid
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                {hasUnsavedChanges ? 'Save Changes' : 'No Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Status Summary */}
      {(isDirty || errorCount > 0) && (
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="flex items-center justify-between text-sm">
            <div className="space-x-4">
              {isDirty && (
                <span className="text-blue-600">
                  ✏️ Unsaved changes
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-red-600">
                  ⚠️ {errorCount} validation {errorCount === 1 ? 'error' : 'errors'}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={validateAllFields}
              className="text-gray-600 hover:text-gray-800 text-xs"
            >
              Validate All
            </button>
          </div>
        </div>
      )}

      {/* Render fields by category with original styling */}
      {orderedCategories.map(category => {
        const categoryFields = fieldsByCategory[category];
        if (!categoryFields || categoryFields.length === 0) return null;
        
        const categoryStyles = getCategoryStyles(category);
        
        return (
          <div key={category} className={`border rounded-lg p-4 ${categoryStyles.containerClass} ${categoryStyles.accentClass}`}>
            <h3 className={`text-lg font-semibold mb-4 border-b pb-2 ${categoryStyles.headerClass}`}>
              {FIELD_CATEGORIES[category] || category}
            </h3>
            <div className="space-y-4">
              {renderFieldsWithLayout(categoryFields, category)}
            </div>
          </div>
        );
      })}

      {/* Show/Hide Low Priority Fields Button */}
      {lowPriorityCount > 0 && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <button
            type="button"
            onClick={() => setShowLowPriority(!showLowPriority)}
            className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <span>
              {showLowPriority ? 'Hide' : 'Show'} Additional Fields ({lowPriorityCount})
            </span>
            <span className="ml-2">
              {showLowPriority ? '↑' : '↓'}
            </span>
          </button>
          
          {showLowPriority && (
            <div className="mt-4 space-y-4">
              {memoizedFieldConfigs
                .filter(field => field.priority === FIELD_PRIORITY.LOW)
                .map(field => {
                  const fieldCategoryClass = getFieldCategoryClass(field.category);
                  return (
                    <div key={field.key} className={fieldCategoryClass}>
                      <DynamicFHIRField 
                        field={{ ...field, _categoryClass: fieldCategoryClass }}
                        value={formData[field.key] || ''} 
                        onChange={(value) => handleFieldChange(field.key, value)}
                        onBlur={() => handleFieldBlurWithAutoSave(field.key)}
                        error={errors[field.key]}
                      />
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Unsaved Changes Warning */}
      {hasUnsavedChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-amber-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">You have unsaved changes</p>
              <p className="text-sm text-amber-700 mt-1">
                Make sure to save your changes before navigating away from this page.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Debug Information (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-100 border border-gray-300 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Debug Information</h4>
          <div className="text-xs text-gray-600 space-y-1">
            <div><strong>Total Fields:</strong> {memoizedFieldConfigs.length}</div>
            <div><strong>Form Data Keys:</strong> {Object.keys(formData).length}</div>
            <div><strong>Errors:</strong> {Object.keys(errors).length}</div>
            <div><strong>Is Dirty:</strong> {isDirty ? 'Yes' : 'No'}</div>
            <div><strong>Is Valid:</strong> {isValid ? 'Yes' : 'No'}</div>
            <div><strong>Has Unsaved Changes:</strong> {hasUnsavedChanges ? 'Yes' : 'No'}</div>
            <div><strong>Can Save:</strong> {(hasUnsavedChanges && isValid) ? 'Yes' : 'No'}</div>
            <div><strong>FHIR Entries:</strong> {fhirData?.entry?.length || 0}</div>
            <div><strong>Save Mode:</strong> Manual Save Only</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamicFHIRForm;