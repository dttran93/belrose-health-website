import React, { useState, useEffect } from 'react';
import DynamicFHIRField from './ui/DynamicFHIRField';
import { FIELD_CATEGORIES, FIELD_PRIORITY } from '@/lib/fhirConstants'
import { useFHIRFormState } from '@/features/AddRecord/hooks/useFHIRFormState';
import { generateFieldConfigurations } from '@/features/AddRecord/utils/fhirFieldExtraction';
import {
  getFieldsByCategory,
  filterFieldsByPriority,
  getCategoriesInOrder
} from '@/features/AddRecord/services/fhirFieldProcessors';

const DynamicFHIRForm = ({ fhirData, originalFile, onFHIRUpdate, onValidationChange }) => {
  // Simple local state for field configurations and loading
  const [fieldConfigs, setFieldConfigs] = useState([]);
  const [loading, setLoading] = useState(false);

  // All form state management is handled by our custom hook
  const {
    formData,
    errors,
    isDirty,
    isValid,
    showLowPriority,
    setShowLowPriority,
    handleFieldChange,
    validateAllFields,
    getFormSummary,
    errorCount
  } = useFHIRFormState(fieldConfigs, onFHIRUpdate, onValidationChange);

  // Initialize field configurations when FHIR data changes
  useEffect(() => {
    const initializeForm = async () => {
      console.log('🚀 useEffect triggered - initializing form data');
      setLoading(true);
      
      try {
        const fieldConfigurations = await generateFieldConfigurations(fhirData, originalFile);
        setFieldConfigs(fieldConfigurations);
      } catch (error) {
        console.error('Error initializing form:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (fhirData || originalFile) {
      initializeForm();
    }
  }, [fhirData, originalFile]);

  // Helper to get CSS classes for layout widths (enhanced for groups)
  const getLayoutWidthClass = (width) => {
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
  };

  // Helper to get category-specific styling
  const getCategoryStyles = (category) => {
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
  };

  // Helper to get field-level category styling for individual fields
  const getFieldCategoryClass = (category) => {
    const fieldStyles = {
      [FIELD_CATEGORIES.ADMINISTRATIVE]: 'ring-blue-500/20 focus-within:ring-blue-500/40',
      [FIELD_CATEGORIES.PATIENT_INFO]: 'ring-green-500/20 focus-within:ring-green-500/40',
      [FIELD_CATEGORIES.PROVIDER_INFO]: 'ring-purple-500/20 focus-within:ring-purple-500/40',
      [FIELD_CATEGORIES.CLINICAL_DATA]: 'ring-orange-500/20 focus-within:ring-orange-500/40'
    };

    return fieldStyles[category] || 'ring-gray-500/20 focus-within:ring-gray-500/40';
  };

  // Render fields with layout grouping and category styling
  const renderFieldsWithLayout = (fields, category) => {
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
              error={errors[field.key]}
            />
          </div>
        );
      }
    });

    const groupCount = Object.keys(groupedFields).length;
    console.log(`🎨 Layout rendering complete: ${groupCount} groups, ${groupedCount} grouped fields, ${singleCount} single fields`);
    return renderedFields;
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading form fields...</div>
      </div>
    );
  }

  // Process field configurations for display
  const filteredFields = filterFieldsByPriority(fieldConfigs, showLowPriority);
  const fieldsByCategory = getFieldsByCategory(filteredFields);
  const orderedCategories = getCategoriesInOrder(fieldsByCategory);

  // Count low priority fields for the toggle button
  const lowPriorityCount = fieldConfigs.filter(field => 
    field.priority === FIELD_PRIORITY.LOW
  ).length;

  console.log('📊 Form rendering summary:');
  console.log(`  Total fields: ${fieldConfigs.length}`);
  console.log(`  Filtered fields: ${filteredFields.length}`);
  console.log(`  Low priority fields: ${lowPriorityCount}`);
  console.log(`  Categories: ${orderedCategories.join(', ')}`);
  console.log(`  Form dirty: ${isDirty}`);
  console.log(`  Form valid: ${isValid}`);
  console.log(`  Show low priority: ${showLowPriority}`);

  return (
    <div className="space-y-6">
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

      {/* Render fields by category */}
      {orderedCategories.map(category => {
        const categoryStyles = getCategoryStyles(category);
        
        return (
          <div key={category} className={`border rounded-lg p-4 ${categoryStyles.containerClass} ${categoryStyles.accentClass}`}>
            <h3 className={`text-lg font-semibold mb-4 border-b pb-2 ${categoryStyles.headerClass}`}>
              {category}
            </h3>
            <div className="space-y-4">
              {renderFieldsWithLayout(fieldsByCategory[category], category)}
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
              {fieldConfigs
                .filter(field => field.priority === FIELD_PRIORITY.LOW)
                .map(field => {
                  const fieldCategoryClass = getFieldCategoryClass(field.category);
                  return (
                    <div key={field.key} className={fieldCategoryClass}>
                      <DynamicFHIRField 
                        field={{ ...field, _categoryClass: fieldCategoryClass }}
                        value={formData[field.key] || ''} 
                        onChange={(value) => handleFieldChange(field.key, value)}
                        error={errors[field.key]}
                      />
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DynamicFHIRForm;