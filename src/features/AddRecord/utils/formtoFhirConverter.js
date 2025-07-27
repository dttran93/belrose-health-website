/**
 * Convert form data back to FHIR Bundle structure
 */
export const convertFormDataToFHIR = (formData, fieldConfigs, originalFhirData) => {
  console.log('🔄 Converting form data back to FHIR structure...');
  console.log('📊 Form data keys:', Object.keys(formData));
  console.log('📊 Field configs count:', fieldConfigs.length);
  
  // Start with a deep copy of the original FHIR structure
  let fhirBundle;
  try {
    fhirBundle = JSON.parse(JSON.stringify(originalFhirData));
    console.log('📋 Starting with original FHIR structure:', {
      entries: fhirBundle.entry?.length || 0,
      resourceTypes: fhirBundle.entry?.map(e => e.resource?.resourceType) || []
    });
  } catch (error) {
    console.error('❌ Error copying original FHIR data:', error);
    return null;
  }

  // Group form data by resource
  const formDataByResource = {};
  for (const [fieldKey, value] of Object.entries(formData)) {
    const fieldConfig = fieldConfigs.find(f => f.key === fieldKey);
    if (fieldConfig && fieldConfig._resourceType && fieldConfig._resourceIndex !== undefined) {
      const resourceKey = `${fieldConfig._resourceType}_${fieldConfig._resourceIndex}`;
      
      if (!formDataByResource[resourceKey]) {
        formDataByResource[resourceKey] = [];
      }
      
      formDataByResource[resourceKey].push({
        fieldKey,
        fhirPath: fieldConfig.fhirPath,
        value,
        _arrayIndex: fieldConfig._arrayIndex,
        _isArrayElement: fieldConfig._isArrayElement
      });
    }
  }

  console.log('📊 Grouped form data by resource:', Object.keys(formDataByResource));

  // Update each resource
  Object.entries(formDataByResource).forEach(([resourceKey, fields]) => {
    const [resourceType, resourceIndex] = resourceKey.split('_');
    const index = parseInt(resourceIndex);
    
    console.log(`📝 Updating ${resourceType} resource at index ${index}`);
    console.log(`📊 Fields to update:`, fields.map(f => f.fieldKey));
    
    // Find the resource in the bundle
    if (fhirBundle.entry && fhirBundle.entry[index] && 
        fhirBundle.entry[index].resource && 
        fhirBundle.entry[index].resource.resourceType === resourceType) {
      
      console.log(`📍 Found ${resourceType} at entry index ${index}`);
      updateResourceWithFormData(fhirBundle.entry[index].resource, fields);
    } else {
      console.log(`❌ Could not find ${resourceType} resource at index ${index}`);
    }
  });

  console.log('✅ FHIR conversion complete');
  return fhirBundle;
};

/**
 * Update a single FHIR resource with form data
 */
const updateResourceWithFormData = (resource, fields) => {
  console.log('📝 Updating resource with', fields.length, 'fields');
  
  // Group fields by their FHIR path to handle arrays properly
  const fieldsByPath = {};
  fields.forEach(field => {
    const basePath = field.fhirPath.replace(/\[\]/g, ''); // Remove array notation for grouping
    if (!fieldsByPath[basePath]) {
      fieldsByPath[basePath] = [];
    }
    fieldsByPath[basePath].push(field);
  });

  // Process each unique path
  Object.entries(fieldsByPath).forEach(([basePath, pathFields]) => {
    console.log(`📝 Processing path group: ${basePath} with ${pathFields.length} fields`);
    
    // Check if this is an array path
    const isArrayPath = pathFields[0].fhirPath.includes('[]');
    
    if (isArrayPath) {
      updateArrayPath(resource, pathFields);
    } else {
      // Single value field - just take the first one
      const field = pathFields[0];
      console.log(`📝 Processing field: ${field.fieldKey} -> ${field.fhirPath} = "${field.value}"`);
      setValueAtFHIRPath(resource, field.fhirPath, field.value, field);
    }
  });
};

/**
 * FIXED: Handle array path updates properly
 */
const updateArrayPath = (resource, pathFields) => {
  console.log('🔄 Updating array path with', pathFields.length, 'fields');
  
  // Group by array index to rebuild array elements properly
  const fieldsByArrayIndex = {};
  pathFields.forEach(field => {
    const arrayIndex = field._arrayIndex !== undefined ? field._arrayIndex : 0;
    if (!fieldsByArrayIndex[arrayIndex]) {
      fieldsByArrayIndex[arrayIndex] = [];
    }
    fieldsByArrayIndex[arrayIndex].push(field);
  });

  // Get the base array path (without the property after [])
  const firstField = pathFields[0];
  const arrayPathParts = firstField.fhirPath.split('[]');
  const arrayPath = arrayPathParts[0]; // e.g., "name", "identifier", "lensSpecification"
  
  console.log(`🔧 Rebuilding array at path: ${arrayPath}`);
  
  // Get existing array or create new one
  let currentArray = getValueAtPath(resource, arrayPath);
  if (!Array.isArray(currentArray)) {
    currentArray = [];
    setValueAtPath(resource, arrayPath, currentArray);
  }

  // Update each array element
  Object.entries(fieldsByArrayIndex).forEach(([arrayIndex, indexFields]) => {
    const index = parseInt(arrayIndex);
    
    // Ensure array has enough elements
    while (currentArray.length <= index) {
      currentArray.push({});
    }
    
    // Get or create the array element
    let arrayElement = currentArray[index];
    if (typeof arrayElement !== 'object' || arrayElement === null) {
      arrayElement = {};
      currentArray[index] = arrayElement;
    }

    console.log(`🔧 Updating array element ${index} with ${indexFields.length} fields`);
    
    // Update properties in this array element
    indexFields.forEach(field => {
      const remainingPath = field.fhirPath.split('[]')[1];
      if (remainingPath) {
        const propertyPath = remainingPath.startsWith('.') ? remainingPath.slice(1) : remainingPath;
        console.log(`  📝 Setting ${propertyPath} = "${field.value}" in array element ${index}`);
        setValueAtPath(arrayElement, propertyPath, field.value);
      }
    });
  });
  
  console.log(`✅ Array update complete for ${arrayPath}, final array:`, currentArray);
};

/**
 * FIXED: Set value at FHIR path with proper array handling
 */
const setValueAtFHIRPath = (resource, fhirPath, value, fieldConfig = {}) => {
  try {
    console.log(`🔧 Setting FHIR path: ${fhirPath} = "${value}"`);
    console.log(`📋 Field config metadata:`, {
      _arrayIndex: fieldConfig._arrayIndex,
      _isArrayElement: fieldConfig._isArrayElement,
      key: fieldConfig.fieldKey
    });

    // Handle simple paths (no arrays)
    if (!fhirPath.includes('[]')) {
      console.log(`  ✅ Set simple path: ${fhirPath} = "${value}"`);
      setValueAtPath(resource, fhirPath, value);
      return;
    }

    // Parse complex array paths
    const pathParts = parseFHIRPath(fhirPath);
    console.log(`  📊 Parsed FHIR path "${fhirPath}":`, pathParts);

    if (pathParts.length === 1 && pathParts[0].isArray) {
      // Simple array assignment like "identifier[]"
      const arrayPath = pathParts[0].path;
      
      // FIXED: Don't convert objects to strings
      let arrayValue;
      if (typeof value === 'object' && value !== null) {
        arrayValue = [value]; // Wrap object in array
      } else if (typeof value === 'string' && value.startsWith('[object Object]')) {
        // Skip corrupted string values
        console.log(`  ⚠️ Skipping corrupted string value for ${arrayPath}`);
        return;
      } else {
        arrayValue = [value];
      }
      
      console.log(`  ✅ Set array value: ${arrayPath} =`, arrayValue);
      setValueAtPath(resource, arrayPath, arrayValue);
      return;
    }

    // Handle nested array paths like "name[].family"
    if (pathParts.length >= 2) {
      const arrayPart = pathParts[0];
      const propertyPart = pathParts[1];
      
      if (arrayPart.isArray) {
        // Get the array index from field config or default to 0
        const arrayIndex = fieldConfig._arrayIndex !== undefined ? fieldConfig._arrayIndex : 0;
        console.log(`  🎯 Using _arrayIndex from field config: ${arrayIndex}`);
        
        // Navigate to the array
        let currentArray = getValueAtPath(resource, arrayPart.path);
        if (!Array.isArray(currentArray)) {
          currentArray = [];
          setValueAtPath(resource, arrayPart.path, currentArray);
        }
        
        // Ensure array has the required element
        while (currentArray.length <= arrayIndex) {
          currentArray.push({});
        }
        
        console.log(`  📁 Navigated to array ${arrayPart.path}[${arrayIndex}]`);
        
        // FIXED: Check if array element is an object
        const arrayElement = currentArray[arrayIndex];
        if (typeof arrayElement !== 'object' || arrayElement === null) {
          console.log(`  🔧 Array element at index ${arrayIndex} is not an object, creating new object`);
          currentArray[arrayIndex] = {};
        }
        
        // Handle nested array in property (like "name[].prefix[]")
        if (propertyPart.isArray) {
          console.log(`  🔄 Setting nested array property: ${propertyPart.path}[]`);
          setValueAtPath(currentArray[arrayIndex], propertyPart.path, [value]);
        } else {
          console.log(`  ✅ Set property: ${propertyPart.path} = "${value}"`);
          setValueAtPath(currentArray[arrayIndex], propertyPart.path, value);
        }
      }
    }
  } catch (error) {
    console.log(`❌ Error setting value for ${fhirPath}:`, error);
  }
};

/**
 * Parse FHIR path into components
 */
const parseFHIRPath = (fhirPath) => {
  const parts = [];
  const segments = fhirPath.split('[]');
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    if (i === 0) {
      // First segment is always the base path
      parts.push({
        path: segment,
        isArray: segments.length > 1 // It's an array if there are more segments
      });
    } else if (segment.trim() !== '') {
      // Remove leading dot and add as property
      const propertyPath = segment.startsWith('.') ? segment.slice(1) : segment;
      const isLastSegment = i === segments.length - 1;
      const hasNextArrayNotation = !isLastSegment || (isLastSegment && segment.endsWith('[]'));
      
      parts.push({
        path: propertyPath.replace(/\[\]$/, ''), // Remove trailing []
        isArray: hasNextArrayNotation || propertyPath.endsWith('[]')
      });
    }
  }
  
  return parts;
};

/**
 * Get value at a simple path (no arrays)
 */
const getValueAtPath = (obj, path) => {
  if (!path) return obj;
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
};

/**
 * Set value at a simple path (no arrays)
 */
const setValueAtPath = (obj, path, value) => {
  if (!path) return;
  
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
  
  const finalKey = keys[keys.length - 1];
  current[finalKey] = value;
};