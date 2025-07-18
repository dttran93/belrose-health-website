import React, { useState, useEffect } from 'react';
import DynamicFHIRField from './ui/DynamicFHIRField';
import { 
  BASE_FIELD_CONFIGS,
  FIELD_CATEGORIES, 
  FIELD_PRIORITY,
  FIELD_TYPES,
  getFieldConfigFromMapping,
  FHIR_RESOURCE_FIELD_MAPPINGS
} from '@/lib/fhirResourceMappings';

const DynamicFHIRForm = ({ fhirData, originalFile, onFHIRUpdate, onValidationChange }) => {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [showLowPriority, setShowLowPriority] = useState(false);

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
      console.log(`      🏷️ → DOCUMENT_INFO (document/metadata field)`);
      return FIELD_CATEGORIES.DOCUMENT_INFO;
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
      
      // For paths like "lensSpecification[].eye", we need to handle arrays
      const pathParts = path.split('[]');
      const arrayPath = pathParts[0]; // "lensSpecification"
      const remainingPath = pathParts[1]; // ".eye"
      
      console.log(`    🔄 Array path: "${arrayPath}", Remaining: "${remainingPath}"`);
      
      // Get the array directly (without auto-extracting first element)
      const arrayValue = obj[arrayPath]; // Direct property access for simple paths
      console.log(`    📋 Array value:`, arrayValue);
      
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
  const extractFieldsFromResource = (resource, resourceIndex = 0) => {
    const fields = [];
    const resourceType = resource.resourceType;
    
    console.log(`🗂️ Extracting fields from ${resourceType} using FHIR mappings...`);

    // SPECIAL DEBUG FOR VISION PRESCRIPTION
    if (resourceType === 'VisionPrescription') {
      console.log(`👁️ VisionPrescription DEBUG - Full resource structure:`, resource);
      console.log(`👁️ lensSpecification exists:`, !!resource.lensSpecification);
      console.log(`👁️ lensSpecification array length:`, resource.lensSpecification?.length);
      if (resource.lensSpecification) {
        resource.lensSpecification.forEach((lens, idx) => {
          console.log(`👁️ Lens ${idx}:`, lens);
          console.log(`👁️ Lens ${idx} keys:`, Object.keys(lens));
        });
      }
    }

    // Get all possible field paths for this resource type from our mappings
    const resourceMappings = Object.keys(FHIR_RESOURCE_FIELD_MAPPINGS)
      .filter(key => key.startsWith(`${resourceType}.`))
      .map(key => ({
        fullPath: key,
        fieldPath: key.replace(`${resourceType}.`, ''),
        config: FHIR_RESOURCE_FIELD_MAPPINGS[key]
      }));

    console.log(`  📋 Found ${resourceMappings.length} possible mappings for ${resourceType}:`);
    resourceMappings.forEach(mapping => {
      console.log(`    🗂️ ${mapping.fullPath}`);
    });

    // Also try the enhanced lookup function for array patterns
    const enhancedMappings = [];
    Object.keys(resource).forEach(topLevelKey => {
      const enhancedMapping = getFieldConfigFromMapping(resourceType, topLevelKey, resource[topLevelKey]);
      if (enhancedMapping) {
        enhancedMappings.push({
          fullPath: `${resourceType}.${topLevelKey}`,
          fieldPath: topLevelKey,
          config: enhancedMapping
        });
      }
    });

    if (enhancedMappings.length > 0) {
      console.log(`  🔍 Enhanced lookup found ${enhancedMappings.length} additional mappings:`);
      enhancedMappings.forEach(mapping => {
        console.log(`    🎯 ${mapping.fullPath}`);
      });
      resourceMappings.push(...enhancedMappings);
    }

    const allMappings = [...new Map(resourceMappings.map(m => [m.fullPath, m])).values()]; // Deduplicate

    allMappings.forEach(mapping => {
      // Check if this is an array path that needs multiple element extraction
      if (mapping.fieldPath.includes('[]')) {
        console.log(`🔄 Processing array path: ${mapping.fieldPath}`);
        
        // Extract all elements from the array, not just the first one
        const allValues = getAllValuesFromArrayPath(resource, mapping.fieldPath);
        
        if (allValues && allValues.length > 0) {
          console.log(`  ✅ Found ${allValues.length} values for ${mapping.fullPath}:`, allValues);
          
          // Create a field for each array element
          allValues.forEach((value, arrayIndex) => {
            if (value !== undefined && value !== null && value !== '') {
              console.log(`    📋 Creating field for array element ${arrayIndex}: "${value}"`);
              
              // Generate unique field key for each array element
              const fieldKey = `${resourceType.toLowerCase()}_${resourceIndex}_${mapping.fieldPath.replace(/[\[\]\.]/g, '_')}_${arrayIndex}`;
              
              // Create enhanced label that includes array context
              const enhancedLabel = generateArrayElementLabel(mapping.fieldPath, value, arrayIndex);
              
              const fieldConfig = {
                ...mapping.config,
                key: fieldKey,
                value: value,
                label: enhancedLabel,
                // SOLUTION 5: Simple dynamic grouping - append array index to existing group
                layout: mapping.config.layout?.group ? {
                  ...mapping.config.layout,
                  group: `${mapping.config.layout.group}_${arrayIndex}`
                } : mapping.config.layout,
                // Add helpful metadata
                _fhirPath: mapping.fullPath,
                _resourceType: resourceType,
                _resourceIndex: resourceIndex,
                _arrayIndex: arrayIndex,
                _isArrayElement: true
              };

              // Apply categorization and prioritization as before
              if (fieldConfig.category) {
                console.log(`      🏷️ Using mapping category: ${fieldConfig.category}`);
              } else {
                fieldConfig.category = categorizeFHIRField(resourceType, mapping.fieldPath);
                console.log(`      🏷️ No mapping category found, auto-categorized as: ${fieldConfig.category}`);
              }

              if (fieldConfig.priority) {
                console.log(`      🎯 Using mapping priority: ${fieldConfig.priority}`);
              } else {
                fieldConfig.priority = assignFieldPriority(resourceType, mapping.fieldPath, fieldConfig.required);
                console.log(`      🎯 No mapping priority found, auto-assigned priority: ${fieldConfig.priority}`);
              }

              console.log(`      🔧 Final array field config:`, fieldConfig);
              fields.push(fieldConfig);
            }
          });
        } else {
          console.log(`  ⚪ No values found for array path ${mapping.fullPath}`);
        }
      } else {
        // Regular single-value field extraction (existing logic)
        const value = getValueFromPath(resource, mapping.fieldPath);
        
        if (value !== undefined && value !== null && value !== '') {
          console.log(`  ✅ Found value for ${mapping.fullPath}: "${value}"`);
          console.log(`    📋 Mapping config:`, mapping.config);
          
          // Generate field key - make unique per resource instance
          const fieldKey = `${resourceType.toLowerCase()}_${resourceIndex}_${mapping.fieldPath.replace(/[\[\]\.]/g, '_')}`;
          
          const fieldConfig = {
            ...mapping.config,
            key: fieldKey,
            value: value,
            // Add helpful metadata
            _fhirPath: mapping.fullPath,
            _resourceType: resourceType,
            _resourceIndex: resourceIndex
          };

          // Apply categorization and prioritization (existing logic)
          if (fieldConfig.category) {
            console.log(`    🏷️ Using mapping category: ${fieldConfig.category}`);
          } else {
            fieldConfig.category = categorizeFHIRField(resourceType, mapping.fieldPath);
            console.log(`    🏷️ No mapping category found, auto-categorized as: ${fieldConfig.category}`);
          }

          if (fieldConfig.priority) {
            console.log(`    🎯 Using mapping priority: ${fieldConfig.priority}`);
          } else {
            fieldConfig.priority = assignFieldPriority(resourceType, mapping.fieldPath, fieldConfig.required);
            console.log(`    🎯 No mapping priority found, auto-assigned priority: ${fieldConfig.priority}`);
          }

          if (fieldConfig.label) {
            console.log(`    🏷️ Using mapping label: ${fieldConfig.label}`);
          } else {
            fieldConfig.label = generateFieldLabel(mapping.fieldPath);
            console.log(`    🏷️ No mapping label found, generated label: ${fieldConfig.label}`);
          }

          console.log(`    🔧 Final field config:`, fieldConfig);
          fields.push(fieldConfig);
        } else {
          console.log(`  ⚪ No value found for ${mapping.fullPath}`);
        }
      }
    });

    console.log(`  🎯 Extracted ${fields.length} fields from ${resourceType}`);
    return fields;
  };

  // Dynamic FHIR field generation
  const generateFieldConfigurations = (fhirData, originalFile) => {
    console.log('🔧 generateFieldConfigurations called with:', { 
      fhirData: !!fhirData, 
      fhirEntries: fhirData?.entry?.length || 0,
      originalFile: !!originalFile 
    });
    const fields = [];

    // Always add base document fields (these aren't in FHIR)
    console.log('📄 Adding base document fields...');
    fields.push({
      ...BASE_FIELD_CONFIGS.documentTitle,
      value: originalFile?.name || ''
    });

    fields.push({
      ...BASE_FIELD_CONFIGS.documentType,
      value: originalFile?.documentType || 'medical_record'
    });

    fields.push({
      ...BASE_FIELD_CONFIGS.documentDate,
      value: new Date().toISOString().split('T')[0]
    });

    console.log('✅ Added document fields:', fields.length);

    // Dynamic FHIR extraction - traverse all resources automatically
    if (fhirData?.entry) {
      console.log('🔍 Starting dynamic FHIR extraction for', fhirData.entry.length, 'entries');
      
      fhirData.entry.forEach((entry, entryIndex) => {
        const resource = entry.resource;
        if (!resource?.resourceType) {
          console.log(`⚠️ Entry ${entryIndex} has no resourceType, skipping:`, entry);
          return;
        }

        console.log(`🔬 Processing ${resource.resourceType} resource (entry ${entryIndex}):`);
        console.log(`    📋 Resource keys: [${Object.keys(resource).join(', ')}]`);
        console.log(`    📊 Resource data:`, resource);
        
        // Extract all fields from this resource using FHIR mappings
        const extractedFields = extractFieldsFromResource(resource, entryIndex);
        if (extractedFields.length > 0) {
          console.log(`    ✅ Added ${extractedFields.length} fields from ${resource.resourceType}`);
          fields.push(...extractedFields);
        } else {
          console.log(`    ⚠️ No fields extracted from ${resource.resourceType} - check your FHIR_RESOURCE_FIELD_MAPPINGS`);
        }
      });
      
      console.log('🎯 Dynamic FHIR extraction complete');
    } else {
      console.log('❌ No FHIR data provided - using document fields only');
    }

    // Add any missing base provider fields for manual entry
    console.log('🏥 Checking for provider fields...');
    const hasProviderFields = fields.some(f => f.key.includes('provider') || f._resourceType === 'Practitioner');
    if (!hasProviderFields) {
      console.log('📝 No provider fields found in FHIR, adding base provider fields for manual entry');
      fields.push(
        { ...BASE_FIELD_CONFIGS.providerFirstName, value: '' },
        { ...BASE_FIELD_CONFIGS.providerLastName, value: '' },
        { ...BASE_FIELD_CONFIGS.providerInstitution, value: '' }
      );
    } else {
      console.log('✅ Provider fields found in FHIR data, skipping manual entry fields');
    }

    // Clinical notes from extracted text
    console.log('📝 Adding clinical notes field with extracted text length:', 
      originalFile?.extractedText?.length || 0);
    fields.push({
      ...BASE_FIELD_CONFIGS.clinicalNotes,
      value: originalFile?.extractedText || ''
    });

    console.log('🎯 Total fields generated:', fields.length);
    console.log('📋 Field summary by category:');
    
    const fieldsByType = fields.reduce((acc, field) => {
      acc[field.category] = (acc[field.category] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(fieldsByType).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} fields`);
    });

    // FHIR extraction summary
    console.log('🗂️ FHIR Extraction Summary:');
    const resourceTypes = [...new Set(fields.filter(f => f._resourceType).map(f => f._resourceType))];
    console.log(`  📊 Resource types processed: [${resourceTypes.join(', ')}]`);
    
    resourceTypes.forEach(resourceType => {
      const count = fields.filter(f => f._resourceType === resourceType).length;
      console.log(`    ${resourceType}: ${count} fields extracted`);
    });

    const baseFieldCount = fields.filter(f => !f._resourceType).length;
    console.log(`  🏗️ Base/manual fields: ${baseFieldCount}`);
    console.log(`  🔬 FHIR-extracted fields: ${fields.length - baseFieldCount}`);

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
    
    // Show what's being hidden
    const hiddenFields = fields.filter(field => field.priority === FIELD_PRIORITY.LOW);
    if (hiddenFields.length > 0) {
      console.log('🔽 Hidden low priority fields:');
      hiddenFields.forEach(field => {
        console.log(`    📝 ${field.label} (${field._fhirPath || field.key})`);
      });
    }
    
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

  // Render fields with layout grouping and category styling (supports both pairs and groups)
  const renderFieldsWithLayout = (fields, category) => {
    console.log('🎨 Rendering', fields.length, 'fields with layout grouping...');
    
    const processedFields = new Set();
    const renderedFields = [];
    let groupedCount = 0;
    let singleCount = 0;
    const fieldCategoryClass = getFieldCategoryClass(category);

    // First, handle multi-field groups (3+ fields)
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
      if (groupFields.length > 1) {
        console.log(`🔗 Rendering group "${groupName}" with ${groupFields.length} fields`);
        
        // Sort by groupOrder
        const sortedFields = groupFields.sort((a, b) => 
          (a.layout?.groupOrder || 0) - (b.layout?.groupOrder || 0)
        );
        
        // Mark all as processed
        sortedFields.forEach(field => processedFields.add(field.key));
        groupedCount += sortedFields.length;
        
        console.log(`  🔗 Group order: ${sortedFields.map(f => `"${f.label}" (${f.layout?.width || 'auto'})`).join(' + ')}`);
        
        renderedFields.push(
          <div key={groupName} className={`flex gap-2 ${fieldCategoryClass}`}>
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
      }
    });

    // Then handle pairs (legacy groupWith system)
    fields.forEach(field => {
      if (processedFields.has(field.key)) return;

      // Check if this field has a layout partner (and not already in a group)
      if (!field.layout?.group) {
        const partner = fields.find(f => 
          !f.layout?.group && // Don't pair with group fields
          (field.layout?.groupWith === f.key || f.layout?.groupWith === field.key)
        );

        if (partner && !processedFields.has(partner.key)) {
          // Mark both fields as processed
          processedFields.add(field.key);
          processedFields.add(partner.key);
          groupedCount += 2;

          console.log(`🔗 Pairing fields: "${field.label}" + "${partner.label}" 
            (${field.layout?.width || '1/2'} + ${partner.layout?.width || '1/2'})`);

          // Render paired fields with category styling
          renderedFields.push(
            <div key={`${field.key}-${partner.key}`} className={`flex gap-3 ${fieldCategoryClass}`}>
              <div className={getLayoutWidthClass(field.layout?.width || '1/2')}>
                <DynamicFHIRField 
                  field={{ ...field, _categoryClass: fieldCategoryClass }}
                  value={formData[field.key] || ''} 
                  onChange={(value) => handleFieldChange(field.key, value)}
                  error={errors[field.key]}
                />
              </div>
              <div className={getLayoutWidthClass(partner.layout?.width || '1/2')}>
                <DynamicFHIRField 
                  field={{ ...partner, _categoryClass: fieldCategoryClass }}
                  value={formData[partner.key] || ''} 
                  onChange={(value) => handleFieldChange(partner.key, value)}
                  error={errors[partner.key]}
                />
              </div>
            </div>
          );
        } else if (!processedFields.has(field.key)) {
          // Single field
          processedFields.add(field.key);
          singleCount++;
          
          console.log(`📄 Rendering single field: "${field.label}" (${field.type}) ${field._fhirPath ? `[${field._fhirPath}]` : ''}`);
          
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
      }
    });

    const groupCount = Object.keys(groupedFields).length;
    console.log(`🎨 Layout rendering complete: ${groupCount} groups, ${groupedCount} grouped fields, ${singleCount} single fields`);
    return renderedFields;
  };

  // Helper to get category-specific styling
  const getCategoryStyles = (category) => {
    const categoryStyles = {
      [FIELD_CATEGORIES.DOCUMENT_INFO]: {
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
      [FIELD_CATEGORIES.DOCUMENT_INFO]: 'ring-blue-500/20 focus-within:ring-blue-500/40',
      [FIELD_CATEGORIES.PATIENT_INFO]: 'ring-green-500/20 focus-within:ring-green-500/40',
      [FIELD_CATEGORIES.PROVIDER_INFO]: 'ring-purple-500/20 focus-within:ring-purple-500/40',
      [FIELD_CATEGORIES.CLINICAL_DATA]: 'ring-orange-500/20 focus-within:ring-orange-500/40'
    };

    return fieldStyles[category] || 'ring-gray-500/20 focus-within:ring-gray-500/40';
  };

  // Get ordered categories
  const getCategoriesInOrder = (fieldsByCategory) => {
    const categoryOrder = [
      FIELD_CATEGORIES.DOCUMENT_INFO,
      FIELD_CATEGORIES.PATIENT_INFO,
      FIELD_CATEGORIES.PROVIDER_INFO,
      FIELD_CATEGORIES.CLINICAL_DATA
    ];
    
    return categoryOrder.filter(category => fieldsByCategory[category]);
  };

  // Initialize form data when component mounts or props change
  useEffect(() => {
    console.log('🚀 useEffect triggered - initializing form data');
    console.log('Props received:', { fhirData: !!fhirData, originalFile: !!originalFile });
    
    const fieldConfigs = generateFieldConfigurations(fhirData, originalFile);
    const initialData = {};
    
    console.log('🔧 Initializing form data for', fieldConfigs.length, 'fields...');
    
    fieldConfigs.forEach(field => {
      initialData[field.key] = field.value || '';
      if (field.value) {
        console.log(`  📝 ${field.key}: "${field.value}" ${field._fhirPath ? `[${field._fhirPath}]` : ''}`);
      }
    });
    
    console.log('💾 Setting form data with', Object.keys(initialData).length, 'fields');
    setFormData(initialData);
    setIsDirty(false);
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

  // Get field configurations
  const fieldConfigs = generateFieldConfigurations(fhirData, originalFile);
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