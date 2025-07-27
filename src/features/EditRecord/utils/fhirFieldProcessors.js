import { FIELD_CATEGORIES, FIELD_PRIORITY } from '@/lib/fhirConstants';

/**
 * FHIR Data Extraction Utilities
 * These functions handle the complex logic of extracting values from FHIR resources
 */

// Helper to safely get nested values from objects using dot notation
export const getValueFromPath = (obj, path) => {
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
      
      // FIXED: Return the actual element, not stringified
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
export const getNestedValue = (obj, path) => {
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
  
  // FIXED: Handle arrays more carefully - preserve object structure
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
    
    // FIXED: For arrays of objects, return the actual object, not converted to string
    if (typeof current[0] === 'object') {
      console.log(`    📋 Taking first element from object array:`, current[0]);
      return current[0]; // Return the actual object
    }
    
    // For other array types, take the first element
    console.log(`    📋 Taking first element from array:`, current[0]);
    return current[0];
  }
  
  return current;
};

// Extract all values from array paths (for handling multiple array elements)
export const getAllValuesFromArrayPath = (obj, path) => {
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
        // FIXED: Push the actual element, not stringified
        console.log(`    ✅ Adding array element ${index}:`, element);
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

/**
 * FIXED: Special handler for preserving object structure in form values
 */
export const preserveObjectStructure = (value) => {
  // If it's an object or array, return it as-is for proper FHIR conversion
  if (typeof value === 'object' && value !== null) {
    return value;
  }
  
  // For primitive values, return as-is
  return value;
};

/**
 * Field Label Generation Utilities
 */

// Generate human-readable labels from FHIR field paths
export const generateFieldLabel = (fieldPath) => {
  return fieldPath
    .split('.')
    .pop()
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/\[\]/g, '');
};

// Generate labels for array elements with context
export const generateArrayElementLabel = (fieldPath, value, arrayIndex) => {
  // Just use the base label since grouping provides the context
  return generateFieldLabel(fieldPath.replace('[]', ''));
};

/**
 * Field Categorization and Prioritization Logic
 * These are fallback functions when no database mapping exists
 */

// Auto-categorization function - FALLBACK ONLY when no mapping category exists
export const categorizeFHIRField = (resourceType, fieldPath) => {
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
export const assignFieldPriority = (resourceType, fieldPath, isRequired = false) => {
  console.log(`      🤖 Auto-prioritizing ${resourceType}.${fieldPath} (required: ${isRequired})`);

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

/**
 * Field Organization Utilities
 */

// Group fields by category
export const getFieldsByCategory = (fields) => {
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
export const filterFieldsByPriority = (fields, showLowPriority = false) => {
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

// Get ordered categories for consistent display
export const getCategoriesInOrder = () => {
  const categoryOrder = [
    FIELD_CATEGORIES.ADMINISTRATIVE,
    FIELD_CATEGORIES.PATIENT_INFO,
    FIELD_CATEGORIES.PROVIDER_INFO,
    FIELD_CATEGORIES.CLINICAL_DATA
  ];
  
  return categoryOrder;
};

// Utility function to check if a field is required
export const isFieldRequired = (field) => {
  return field.priority === FIELD_PRIORITY.REQUIRED;
};