import FhirMappingService from '@/features/AddRecord/services/fhirMappingService';
import {
  getValueFromPath,
  getAllValuesFromArrayPath,
  generateFieldLabel,
  generateArrayElementLabel,
  categorizeFHIRField,
  assignFieldPriority
} from '@/features/AddRecord/services/fhirFieldProcessors';

/**
 * FHIR Field Extraction Service
 * Handles the complex logic of extracting form fields from FHIR resources
 * using database mappings and fallback logic
 */

/**
 * Extract all mappable fields from a single FHIR resource
 * @param {Object} resource - The FHIR resource object
 * @param {number} resourceIndex - Index of this resource in the bundle (for unique keys)
 * @returns {Array} Array of field configuration objects
 */
export const extractFieldsFromResource = async (resource, resourceIndex = 0) => {
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
    const enhancedMappings = await getEnhancedMappings(resource, resourceType, resourceMappings);
    
    if (enhancedMappings.length > 0) {
      console.log(`  🔍 Enhanced lookup found ${enhancedMappings.length} additional mappings`);
      resourceMappings.push(...enhancedMappings);
    }

    // Process each mapping
    for (const mapping of resourceMappings) {
      try {
        const extractedFields = await processMapping(mapping, resource, resourceType, resourceIndex);
        if (extractedFields.length > 0) {
          fields.push(...extractedFields);
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

/**
 * Get enhanced mappings for top-level keys not found in database
 * @param {Object} resource - The FHIR resource
 * @param {string} resourceType - The resource type
 * @param {Array} existingMappings - Already found mappings
 * @returns {Array} Additional mappings found
 */
const getEnhancedMappings = async (resource, resourceType, existingMappings) => {
  const enhancedMappings = [];
  
  for (const topLevelKey of Object.keys(resource)) {
    try {
      const enhancedMapping = await FhirMappingService.getMappingForPath(resourceType, topLevelKey);
      if (enhancedMapping && !existingMappings.find(m => m.fhirPath === topLevelKey)) {
        enhancedMappings.push(enhancedMapping);
      }
    } catch (error) {
      console.log(`    ⚠️ Error in enhanced lookup for ${topLevelKey}:`, error);
    }
  }
  
  return enhancedMappings;
};

/**
 * Process a single mapping - handles both array and single value fields
 * @param {Object} mapping - The field mapping from database
 * @param {Object} resource - The FHIR resource
 * @param {string} resourceType - The resource type
 * @param {number} resourceIndex - Index of this resource
 * @returns {Array} Array of field configs (multiple for arrays, single for regular fields)
 */
const processMapping = async (mapping, resource, resourceType, resourceIndex) => {
  const fields = [];
  
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
          
          const fieldConfig = createArrayElementField(
            mapping, 
            value, 
            arrayIndex, 
            resourceType, 
            resourceIndex
          );
          
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
      
      const fieldConfig = createSingleValueField(
        mapping, 
        value, 
        resourceType, 
        resourceIndex
      );
      
      fields.push(fieldConfig);
    } else {
      console.log(`  ⚪ No value found for ${mapping.fhirPath}`);
    }
  }
  
  return fields;
};

/**
 * Create field configuration for array element
 * @param {Object} mapping - The field mapping
 * @param {*} value - The extracted value
 * @param {number} arrayIndex - Index within the array
 * @param {string} resourceType - The resource type
 * @param {number} resourceIndex - Index of the resource
 * @returns {Object} Field configuration object
 */
const createArrayElementField = (mapping, value, arrayIndex, resourceType, resourceIndex) => {
  // Generate unique field key for each array element
  const fieldKey = `${resourceType.toLowerCase()}_${resourceIndex}_${mapping.fhirPath.replace(/[\[\]\.]/g, '_')}_${arrayIndex}`;
  
  // Create enhanced label that includes array context
  const enhancedLabel = generateArrayElementLabel(mapping.fhirPath, value, arrayIndex);
  
  const fieldConfig = {
    ...mapping,
    key: fieldKey,
    value: value,
    label: enhancedLabel,
    // Simple dynamic grouping - append array index to existing group
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

  // Apply categorization and prioritization fallbacks
  applyFallbackClassification(fieldConfig, resourceType, mapping.fhirPath);

  console.log(`      🔧 Final array field config:`, fieldConfig);
  return fieldConfig;
};

/**
 * Create field configuration for single value
 * @param {Object} mapping - The field mapping
 * @param {*} value - The extracted value
 * @param {string} resourceType - The resource type
 * @param {number} resourceIndex - Index of the resource
 * @returns {Object} Field configuration object
 */
const createSingleValueField = (mapping, value, resourceType, resourceIndex) => {
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

  // Apply categorization and prioritization fallbacks
  applyFallbackClassification(fieldConfig, resourceType, mapping.fhirPath);

  if (!fieldConfig.label) {
    fieldConfig.label = generateFieldLabel(mapping.fhirPath);
    console.log(`    🏷️ Generated label: ${fieldConfig.label}`);
  }

  console.log(`    🔧 Final field config:`, fieldConfig);
  return fieldConfig;
};

/**
 * Apply fallback categorization and prioritization when not in database mapping
 * @param {Object} fieldConfig - The field configuration to modify
 * @param {string} resourceType - The resource type
 * @param {string} fhirPath - The FHIR path
 */
const applyFallbackClassification = (fieldConfig, resourceType, fhirPath) => {
  // Apply categorization fallback
  if (!fieldConfig.category) {
    fieldConfig.category = categorizeFHIRField(resourceType, fhirPath);
    console.log(`    🏷️ Auto-categorized as: ${fieldConfig.category}`);
  }

  // Apply prioritization fallback
  if (!fieldConfig.priority) {
    fieldConfig.priority = assignFieldPriority(resourceType, fhirPath);
    console.log(`    🎯 Auto-assigned priority: ${fieldConfig.priority}`);
  }
};

/**
 * Main function to generate field configurations from FHIR data
 * @param {Object} fhirData - The FHIR Bundle
 * @param {Object} originalFile - Original file (for future use)
 * @returns {Array} Array of field configuration objects
 */
export const generateFieldConfigurations = async (fhirData, originalFile) => {
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