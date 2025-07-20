import React, { useState, useEffect } from 'react';
import DynamicFHIRField from './ui/DynamicFHIRField';
import { 
  FIELD_CATEGORIES, 
  FIELD_PRIORITY,
  FIELD_TYPES,
} from '@/lib/fhirConstants';
import FhirMappingService from '@/components/AddRecord/services/fhirMappingService';

// No base fields needed - everything comes from FHIR data or database mappings

const DynamicFHIRForm = ({ fhirData, originalFile, onFHIRUpdate, onValidationChange }) => {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [showLowPriority, setShowLowPriority] = useState(false);
  const [fieldConfigs, setFieldConfigs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Helper to safely get nested values from objects using dot notation
  const getValueFromPath = (obj, path) => {
    try {
      console.log(`    🔍 Extracting path "${path}" from:`, obj);
      
      // SPECIAL HANDLING FOR ARRAY PATHS with [] notation FIRST
      if (path.includes('[]')) {
        console.log(`    🔄 Detected array path with [] notation: "${path}"`);
        
        // For paths like "lensSpecification[].eye", we need to handle arrays
        const pathParts = path.split('[]');
        const arrayPath = pathParts[0]; // "lensSpecification"
        const remainingPath = pathParts[1]; // ".eye"
        
        console.log(`    🔄 Array path: "${arrayPath}", Remaining: "${remainingPath}"`);
        
        // Get the array first
        const arrayValue = obj[arrayPath];
        console.log(`    📋 Array value:`, arrayValue);
        
        if (!Array.isArray(arrayValue) || arrayValue.length === 0) {
          console.log(`    ⚪ No array found or empty array at "${arrayPath}"`);
          return undefined;
        }
        
        // For now, take the first element (we can enhance this later for multiple elements)
        const firstElement = arrayValue[0];
        console.log(`    📍 First array element:`, firstElement);
        
        if (remainingPath) {
          // Remove leading dot and get the property
          const property = remainingPath.startsWith('.') ? remainingPath.slice(1) : remainingPath;
          const finalValue = getNestedValue(firstElement, property);
          console.log(`    ✅ Final value from array element: "${finalValue}"`);
          return finalValue;
        }
        
        return firstElement;
      }
      
      // Regular path handling (no arrays)
      return getNestedValue(obj, path);
      
    } catch (error) {
      console.log(`    ❌ Error extracting path "${path}":`, error);
      return undefined;
    }
  };

  // Helper function to get nested values without array notation
  const getNestedValue = (obj, path) => {
    if (!path) return obj;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        console.log(`    ⚪ Path stopped at key "${key}" - value is null/undefined`);
        return undefined;
      }
      
      // Handle numeric array indices
      if (/^\d+$/.test(key)) {
        current = current[parseInt(key)];
        console.log(`    📍 Array index [${key}]:`, current);
      } else {
        current = current[key];
        console.log(`    📍 Property "${key}":`, current);
      }
    }
    
    // Handle arrays - join them or take first element
    if (Array.isArray(current)) {
      if (current.length === 0) {
        console.log(`    📋 Empty array found`);
        return undefined;
      }
      
      // For arrays of strings, join them
      if (typeof current[0] === 'string') {
        const joined = current.join(' ');
        console.log(`    📋 Joined string array: "${joined}"`);
        return joined;
      }
      
      // For arrays of objects, take the first one for now
      console.log(`    📋 Taking first element from object array:`, current[0]);
      return current[0];
    }
    
    return current;
  };

  // Auto-categorization function - FALLBACK ONLY when no mapping category exists
  const categorizeFHIRField = (resourceType, fieldPath) => {
    console.log(`      🤖 Auto-categorizing ${resourceType}.${fieldPath}`);
    
    if (resourceType === 'Patient') {
      console.log(`      🏷️ → PATIENT_INFO (patient resource)`);
      return FIELD_CATEGORIES.PATIENT_INFO;
    }
    
    if (resourceType === 'Practitioner' || resourceType === 'Organization') {
      console.log(`      🏷️ → PROVIDER_INFO (${resourceType.toLowerCase()} resource)`);
      return FIELD_CATEGORIES.PROVIDER_INFO;
    }
    
    if (resourceType === 'DocumentReference' || 
        fieldPath.includes('id') || 
        fieldPath.includes('status') ||
        fieldPath.includes('date')) {
      console.log(`      🏷️ → ADMINISTRATIVE (document/metadata field)`);
      return FIELD_CATEGORIES.ADMINISTRATIVE;
    }
    
    console.log(`      🏷️ → CLINICAL_DATA (default)`);
    return FIELD_CATEGORIES.CLINICAL_DATA;
  };

  // Auto-prioritization function - FALLBACK ONLY when no mapping priority exists
  const assignFieldPriority = (resourceType, fieldPath, isRequired = false) => {
    console.log(`      🤖 Auto-prioritizing ${resourceType}.${fieldPath} (required: ${isRequired})`);
    
    if (isRequired) {
      console.log(`      🎯 → REQUIRED (field marked as required)`);
      return FIELD_PRIORITY.REQUIRED;
    }
    
    // System-generated IDs and references are low priority
    if (fieldPath.includes('.id') || 
        fieldPath.includes('.reference') ||
        fieldPath.includes('system')) {
      console.log(`      🎯 → LOW (system field)`);
      return FIELD_PRIORITY.LOW;
    }
    
    // Patient demographics are high priority
    if (resourceType === 'Patient' && 
        (fieldPath.includes('name') || 
         fieldPath.includes('birthDate') || 
         fieldPath.includes('gender'))) {
      console.log(`      🎯 → HIGH (patient demographic)`);
      return FIELD_PRIORITY.HIGH;
    }
    
    // Provider names are high priority
    if (resourceType === 'Practitioner' && fieldPath.includes('name')) {
      console.log(`      🎯 → HIGH (provider name)`);
      return FIELD_PRIORITY.HIGH;
    }
    
    // Core observation values are high priority
    if (resourceType === 'Observation' && 
        (fieldPath.includes('value') || fieldPath.includes('code.text'))) {
      console.log(`      🎯 → HIGH (observation value)`);
      return FIELD_PRIORITY.HIGH;
    }
    
    // Address fields are typically low priority
    if (fieldPath.includes('address')) {
      console.log(`      🎯 → LOW (address field)`);
      return FIELD_PRIORITY.LOW;
    }
    
    console.log(`      🎯 → MEDIUM (default)`);
    return FIELD_PRIORITY.MEDIUM;
  };

  // New function to extract all values from array paths
const getAllValuesFromArrayPath = (obj, path) => {
  try {
    console.log(`    🔄 Extracting all values from array path "${path}"`);
    
    if (!path.includes('[]')) {
      // Not an array path, return single value as array
      const value = getValueFromPath(obj, path);
      return value !== undefined ? [value] : [];
    }
    
    const pathParts = path.split('[]');
    const arrayPath = pathParts[0]; // "serviceType.coding"
    const remainingPath = pathParts[1]; // ".system"
    
    console.log(`    🔄 Array path: "${arrayPath}", Remaining: "${remainingPath}"`);
    
    const pathSegments = arrayPath.split('.');
    let arrayValue = obj;
    for (const segment of pathSegments) {
      arrayValue = arrayValue[segment];
      if (!arrayValue) break;
    }
    
    if (!Array.isArray(arrayValue) || arrayValue.length === 0) {
      console.log(`    ⚪ No array found or empty array at "${arrayPath}"`);
      return [];
    }
    
    // Extract the property from each array element
    const values = [];
    arrayValue.forEach((element, index) => {
      console.log(`    📍 Processing array element ${index}:`, element);
      
      if (remainingPath && remainingPath.trim() !== '') {
        // Remove leading dot and get the property
        const property = remainingPath.startsWith('.') ? remainingPath.slice(1) : remainingPath;
        const elementValue = getNestedValue(element, property);
        console.log(`    ✅ Extracted "${property}" from element ${index}: "${elementValue}"`);
        values.push(elementValue);
      } else {
        values.push(element);
      }
    });
    
    console.log(`    🎯 Total values extracted: ${values.length}`, values);
    return values;
    
  } catch (error) {
    console.log(`    ❌ Error extracting array path "${path}":`, error);
    return [];
  }
};

  // Simple label generation for array elements - no special handling needed
  const generateArrayElementLabel = (fieldPath, value, arrayIndex) => {
    // Just use the base label since grouping provides the context
    return generateFieldLabel(fieldPath.replace('[]', ''));
  };

  // Keep the existing generateFieldLabel function for non-array fields
  const generateFieldLabel = (fieldPath) => {
    return fieldPath
      .split('.')
      .pop()
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/\[\]/g, '');
  };

  // Helper function to extract all mappable fields from a FHIR resource
  const extractFieldsFromResource = async (resource, resourceIndex = 0) => {
    const fields = [];
    const resourceType = resource.resourceType;
    
    console.log(`🗂️ Extracting fields from ${resourceType} using FHIR mappings...`);

    try {
      // Get all possible field paths for this resource type from database
      const resourceMappings = await FhirMappingService.getMappingsForResource(resourceType);
      console.log(`  📋 Found ${resourceMappings.length} mappings for ${resourceType}`);

      if (resourceMappings.length === 0) {
        console.log(`  ⚠️ No mappings found for ${resourceType} in database`);
        return fields;
      }

      // Also try enhanced lookup for top-level keys not in mappings
      const enhancedMappings = [];
      for (const topLevelKey of Object.keys(resource)) {
        try {
          const enhancedMapping = await FhirMappingService.getMappingForPath(resourceType, topLevelKey);
          if (enhancedMapping && !resourceMappings.find(m => m.fhirPath === topLevelKey)) {
            enhancedMappings.push(enhancedMapping);
          }
        } catch (error) {
          console.log(`    ⚠️ Error in enhanced lookup for ${topLevelKey}:`, error);
        }
      }

      if (enhancedMappings.length > 0) {
        console.log(`  🔍 Enhanced lookup found ${enhancedMappings.length} additional mappings`);
        resourceMappings.push(...enhancedMappings);
      }

      // Process each mapping
      for (const mapping of resourceMappings) {
        try {
          // Check if this is an array path that needs multiple element extraction
          if (mapping.fhirPath.includes('[]')) {
            console.log(`🔄 Processing array path: ${mapping.fhirPath}`);
            
            // Extract all elements from the array, not just the first one
            const allValues = getAllValuesFromArrayPath(resource, mapping.fhirPath);
            
            if (allValues && allValues.length > 0) {
              console.log(`  ✅ Found ${allValues.length} values for ${mapping.fhirPath}:`, allValues);
              
              // Create a field for each array element
              allValues.forEach((value, arrayIndex) => {
                if (value !== undefined && value !== null && value !== '') {
                  console.log(`    📋 Creating field for array element ${arrayIndex}: "${value}"`);
                  
                  // Generate unique field key for each array element
                  const fieldKey = `${resourceType.toLowerCase()}_${resourceIndex}_${mapping.fhirPath.replace(/[\[\]\.]/g, '_')}_${arrayIndex}`;
                  
                  // Create enhanced label that includes array context
                  const enhancedLabel = generateArrayElementLabel(mapping.fhirPath, value, arrayIndex);
                  
                  const fieldConfig = {
                    ...mapping,
                    key: fieldKey,
                    value: value,
                    label: enhancedLabel,
                    // SOLUTION 5: Simple dynamic grouping - append array index to existing group
                    layout: mapping.layout?.group ? {
                      ...mapping.layout,
                      group: `${mapping.layout.group}_${arrayIndex}`
                    } : mapping.layout,
                    // Add helpful metadata
                    _fhirPath: `${resourceType}.${mapping.fhirPath}`,
                    _resourceType: resourceType,
                    _resourceIndex: resourceIndex,
                    _arrayIndex: arrayIndex,
                    _isArrayElement: true
                  };

                  console.log(`🔧 Final field config for ${mapping.fhirPath}:`, {
                    key: fieldConfig.key,
                    type: fieldConfig.type,
                    label: fieldConfig.label,
                    value: fieldConfig.value
                  });

                  // Apply categorization and prioritization as before
                  if (!fieldConfig.category) {
                    fieldConfig.category = categorizeFHIRField(resourceType, mapping.fhirPath);
                    console.log(`      🏷️ Auto-categorized as: ${fieldConfig.category}`);
                  }

                  if (!fieldConfig.priority) {
                    fieldConfig.priority = assignFieldPriority(resourceType, mapping.fhirPath, fieldConfig.required);
                    console.log(`      🎯 Auto-assigned priority: ${fieldConfig.priority}`);
                  }

                  console.log(`      🔧 Final array field config:`, fieldConfig);
                  fields.push(fieldConfig);
                }
              });
            } else {
              console.log(`  ⚪ No values found for array path ${mapping.fhirPath}`);
            }
          } else {
            // Regular single-value field extraction
            const value = getValueFromPath(resource, mapping.fhirPath);
            
            if (value !== undefined && value !== null && value !== '') {
              console.log(`  ✅ Found value for ${mapping.fhirPath}: "${value}"`);
              
              // Generate field key - make unique per resource instance
              const fieldKey = `${resourceType.toLowerCase()}_${resourceIndex}_${mapping.fhirPath.replace(/[\[\]\.]/g, '_')}`;
              
              const fieldConfig = {
                ...mapping,
                key: fieldKey,
                value: value,
                // Add helpful metadata
                _fhirPath: `${resourceType}.${mapping.fhirPath}`,
                _resourceType: resourceType,
                _resourceIndex: resourceIndex
              };

              // Apply categorization and prioritization (existing logic)
              if (!fieldConfig.category) {
                fieldConfig.category = categorizeFHIRField(resourceType, mapping.fhirPath);
                console.log(`    🏷️ Auto-categorized as: ${fieldConfig.category}`);
              }

              if (!fieldConfig.priority) {
                fieldConfig.priority = assignFieldPriority(resourceType, mapping.fhirPath, fieldConfig.required);
                console.log(`    🎯 Auto-assigned priority: ${fieldConfig.priority}`);
              }

              if (!fieldConfig.label) {
                fieldConfig.label = generateFieldLabel(mapping.fhirPath);
                console.log(`    🏷️ Generated label: ${fieldConfig.label}`);
              }

              console.log(`    🔧 Final field config:`, fieldConfig);
              fields.push(fieldConfig);
            } else {
              console.log(`  ⚪ No value found for ${mapping.fhirPath}`);
            }
          }
        } catch (error) {
          console.error(`Error processing mapping ${mapping.fhirPath}:`, error);
        }
      }

    } catch (error) {
      console.error(`Error extracting fields from ${resourceType}:`, error);
    }

    console.log(`  🎯 Extracted ${fields.length} fields from ${resourceType}`);
    return fields;
  };

  // Dynamic FHIR field generation
  const generateFieldConfigurations = async (fhirData, originalFile) => {
    console.log('🔧 generateFieldConfigurations called with:', { 
      fhirData: !!fhirData, 
      fhirEntries: fhirData?.entry?.length || 0,
      originalFile: !!originalFile 
    });
    const fields = [];

    // Only process FHIR data - no base fields needed
    if (fhirData?.entry) {
      console.log('🔍 Starting dynamic FHIR extraction for', fhirData.entry.length, 'entries');
      
      for (let entryIndex = 0; entryIndex < fhirData.entry.length; entryIndex++) {
        const entry = fhirData.entry[entryIndex];
        const resource = entry.resource;
        
        if (!resource?.resourceType) {
          console.log(`⚠️ Entry ${entryIndex} has no resourceType, skipping:`, entry);
          continue;
        }

        console.log(`🔬 Processing ${resource.resourceType} resource (entry ${entryIndex}):`);
        console.log(`    📋 Resource keys: [${Object.keys(resource).join(', ')}]`);
        
        try {
          // Extract all fields from this resource using FHIR mappings
          const extractedFields = await extractFieldsFromResource(resource, entryIndex);
          if (extractedFields.length > 0) {
            console.log(`    ✅ Added ${extractedFields.length} fields from ${resource.resourceType}`);
            fields.push(...extractedFields);
          } else {
            console.log(`    ⚠️ No fields extracted from ${resource.resourceType} - check your database mappings`);
          }
        } catch (error) {
          console.error(`Error extracting fields from ${resource.resourceType}:`, error);
        }
      }
      
      console.log('🎯 Dynamic FHIR extraction complete');
    } else {
      console.log('❌ No FHIR data provided - no fields to generate');
    }

    console.log('🎯 Total fields generated:', fields.length);
    return fields;
  };

  // Group fields by category
  const getFieldsByCategory = (fields) => {
    console.log('📂 Grouping', fields.length, 'fields by category...');
    const grouped = fields.reduce((acc, field) => {
      const category = field.category || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(field);
      return acc;
    }, {});
    
    console.log('📊 Fields grouped by category:', Object.keys(grouped).map(cat => 
      `${cat}: ${grouped[cat].length}`
    ).join(', '));
    
    return grouped;
  };

  // Filter fields by priority
  const filterFieldsByPriority = (fields) => {
    console.log('🎯 Filtering fields by priority. Show low priority:', showLowPriority);
    
    if (showLowPriority) {
      console.log('✅ Showing all', fields.length, 'fields');
      return fields; // Show all fields
    }
    
    const filtered = fields.filter(field => 
      field.priority === FIELD_PRIORITY.REQUIRED || 
      field.priority === FIELD_PRIORITY.HIGH || 
      field.priority === FIELD_PRIORITY.MEDIUM
    );
    
    console.log(`🔽 Filtered to ${filtered.length} fields (hiding ${fields.length - filtered.length} low priority fields)`);
    return filtered;
  };

  // Helper to get CSS classes for layout widths (enhanced for groups)
  const getLayoutWidthClass = (width) => {
    const widthMap = {
      '1/2': 'w-1/2',
      '1/3': 'w-1/3', 
      '2/3': 'w-2/3',
      '1/4': 'w-1/4',
      '2/4': 'w-2/4', // Same as 1/2 but more explicit
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

  // Get ordered categories
  const getCategoriesInOrder = (fieldsByCategory) => {
    const categoryOrder = [
      FIELD_CATEGORIES.ADMINISTRATIVE,
      FIELD_CATEGORIES.PATIENT_INFO,
      FIELD_CATEGORIES.PROVIDER_INFO,
      FIELD_CATEGORIES.CLINICAL_DATA
    ];
    
    return categoryOrder.filter(category => fieldsByCategory[category]);
  };

  // Initialize form data when component mounts or props change
  useEffect(() => {
    const initializeForm = async () => {
      console.log('🚀 useEffect triggered - initializing form data');
      setLoading(true);
      
      try {
        const fieldConfigurations = await generateFieldConfigurations(fhirData, originalFile);
        setFieldConfigs(fieldConfigurations);
        
        const initialData = {};
        fieldConfigurations.forEach(field => {
          initialData[field.key] = field.value || '';
        });
        
        setFormData(initialData);
        setIsDirty(false);
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

  // Handle field changes
  const handleFieldChange = (fieldKey, value) => {
    console.log(`✏️ Field changed: ${fieldKey} = "${value}"`);
    
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }));

    setIsDirty(true);

    // Clear any existing error for this field
    if (errors[fieldKey]) {
      console.log(`🧹 Clearing error for field: ${fieldKey}`);
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading form fields...</div>
      </div>
    );
  }

  // Get field configurations
  const filteredFields = filterFieldsByPriority(fieldConfigs);
  const fieldsByCategory = getFieldsByCategory(filteredFields);
  const orderedCategories = getCategoriesInOrder(fieldsByCategory);

  // Count low priority fields
  const lowPriorityCount = fieldConfigs.filter(field => 
    field.priority === FIELD_PRIORITY.LOW
  ).length;

  console.log('📊 Form rendering summary:');
  console.log(`  Total fields: ${fieldConfigs.length}`);
  console.log(`  Filtered fields: ${filteredFields.length}`);
  console.log(`  Low priority fields: ${lowPriorityCount}`);
  console.log(`  Categories: ${orderedCategories.join(', ')}`);
  console.log(`  Form dirty: ${isDirty}`);
  console.log(`  Show low priority: ${showLowPriority}`);

  return (
    <div className="space-y-6">
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

      {/* Form Status */}
      {isDirty && (
        <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
          Form has unsaved changes
        </div>
      )}
    </div>
  );
};

export default DynamicFHIRForm;