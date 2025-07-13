import React, { useState, useEffect } from 'react';
import DynamicFHIRField from './ui/DynamicFHIRField';
import { getFieldConfigFromMapping, FHIR_RESOURCE_FIELD_MAPPINGS } from '@/lib/fhirResourceMappings';

const DynamicFHIRForm = ({ fhirData, originalFile, onFormUpdate, onValidationChange }) => {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  // Generate field configurations using the mapping system
  const generateFieldConfigurations = (fhirData, originalFile) => {
    const fields = [];

    console.log('🔍 DEBUG - generateFieldConfigurations called with:');
    console.log('  fhirData:', fhirData);
    console.log('  fhirData.entry:', fhirData?.entry);

    // Base document fields (always present)
    fields.push({
      key: 'documentTitle',
      type: 'text',
      label: 'Document Title',
      required: true,
      placeholder: 'Enter document title',
      value: originalFile?.name || ''
    });

    fields.push({
      key: 'documentType',
      type: 'select',
      label: 'Document Type',
      required: true,
      options: [
        { value: 'prescription', label: 'Prescription' },
        { value: 'vision_prescription', label: 'Vision Prescription' },
        { value: 'lab_result', label: 'Lab Result' },
        { value: 'medical_record', label: 'Medical Record' },
        { value: 'insurance_card', label: 'Insurance Card' },
        { value: 'visit_summary', label: 'Visit Summary' }
      ],
      value: originalFile?.documentType || 'medical_record'
    });

    fields.push({
      key: 'documentDate',
      type: 'date',
      label: 'Document Date',
      required: true,
      value: new Date().toISOString().split('T')[0]
    });

    // Process FHIR entries using the mapping system
    if (fhirData?.entry && Array.isArray(fhirData.entry)) {
      console.log('🚀 Processing FHIR entries using resource mappings...');

      fhirData.entry.forEach((entry, entryIndex) => {
        const resource = entry.resource;
        const resourceType = resource?.resourceType;

        if (!resource || !resourceType) {
          console.log(`❌ Skipping entry ${entryIndex} - no resource or resourceType`);
          return;
        }

        console.log(`📋 Processing ${resourceType} resource:`, resource);

        // Check if we have mappings for this resource type by looking for any mapping keys that start with the resource type
        const hasResourceMappings = Object.keys(FHIR_RESOURCE_FIELD_MAPPINGS).some(key => 
          key.startsWith(`${resourceType}.`)
        );

        if (!hasResourceMappings) {
          console.log(`⚠️ No mappings found for resource type: ${resourceType}`);
          // Fall back to basic field generation for unmapped resources
          const basicFields = generateBasicFieldsForResource(resource, resourceType, entryIndex);
          fields.push(...basicFields);
          return;
        }

        console.log(`✅ Found mappings for resource type: ${resourceType}`);

        // Generate fields for this resource using the mapping system
        const resourceFields = generateFieldsForResource(resource, resourceType, entryIndex);
        fields.push(...resourceFields);
      });
    }

    console.log('🎯 Final field configuration:', fields);
    console.log(`📊 Total fields generated: ${fields.length}`);

    return fields;
  };

  // Generate fields for a specific resource using mappings
  const generateFieldsForResource = (resource, resourceType, entryIndex) => {
    const fields = [];
    
    console.log(`🔧 Generating fields for ${resourceType}:`, resource);

    // Recursively walk through the resource structure
    const walkObject = (obj, currentPath = '', level = 0) => {
      if (level > 10 || !obj || typeof obj !== 'object') return;

      Object.keys(obj).forEach(key => {
        const value = obj[key];
        const fullPath = currentPath ? `${currentPath}.${key}` : key;

        // Handle arrays (like lensSpecification[])
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (item && typeof item === 'object') {
              const arrayPath = `${fullPath}[${index}]`;
              walkObject(item, arrayPath, level + 1);
            } else {
              // Primitive array item
              const fieldConfig = getFieldConfigForPath(resourceType, `${fullPath}[${index}]`, item, resource);
              if (fieldConfig) {
                console.log(`✅ Adding array field for ${resourceType}.${fullPath}[${index}]:`, fieldConfig);
                fields.push({
                  key: `${resourceType.toLowerCase()}_${entryIndex}_${fullPath}_${index}`,
                  ...fieldConfig,
                  value: item
                });
              }
            }
          });
        } else if (isPrimitiveValue(value)) {
          // This is a field we can render
          const fieldConfig = getFieldConfigForPath(resourceType, fullPath, value, resource);
          if (fieldConfig) {
            console.log(`✅ Adding field for ${resourceType}.${fullPath}:`, fieldConfig);
            fields.push({
              key: `${resourceType.toLowerCase()}_${entryIndex}_${fullPath.replace(/\[|\]/g, '_')}`,
              ...fieldConfig,
              value: value
            });
          } else {
            console.log(`❌ No mapping found for ${resourceType}.${fullPath}`);
          }
        } else if (typeof value === 'object') {
          // Recurse into nested objects
          walkObject(value, fullPath, level + 1);
        }
      });
    };

    walkObject(resource);
    return fields;
  };

  // Get field configuration for a FHIR path - FIXED VERSION
  const getFieldConfigForPath = (resourceType, fieldPath, value, fullResource) => {
    console.log(`🔍 Looking up config for: ${resourceType}.${fieldPath}`);
    
    // Try exact mapping first using the correct function signature
    let config = getFieldConfigFromMapping(resourceType, fieldPath, value);
    
    if (!config) {
      // Try with array notation normalized (e.g., lensSpecification[0] -> lensSpecification[])
      const normalizedPath = fieldPath.replace(/\[\d+\]/g, '[]');
      console.log(`🔍 Trying normalized path: ${resourceType}.${normalizedPath}`);
      config = getFieldConfigFromMapping(resourceType, normalizedPath, value);
    }

    if (!config) {
      // Try without array indices entirely for some fields
      const cleanPath = fieldPath.replace(/\[\d+\]/g, '');
      console.log(`🔍 Trying clean path: ${resourceType}.${cleanPath}`);
      config = getFieldConfigFromMapping(resourceType, cleanPath, value);
    }

    if (config) {
      console.log(`✅ Found config for ${resourceType}.${fieldPath}:`, config);
      return {
        type: config.type || 'text',
        label: config.label || generateLabelFromPath(fieldPath),
        required: config.required || false,
        options: config.options,
        step: config.step,
        min: config.min,
        max: config.max,
        unit: config.unit,
        help: config.help,
        readOnly: config.readOnly || false,
        placeholder: config.placeholder,
        rows: config.rows
      };
    }

    console.log(`❌ No config found for ${resourceType}.${fieldPath}`);
    return null;
  };

  // Generate basic fields for unmapped resources
  const generateBasicFieldsForResource = (resource, resourceType, entryIndex) => {
    const fields = [];
    
    console.log(`🔧 Generating basic fields for unmapped ${resourceType}:`, resource);

    // Just extract primitive values and create basic text fields
    const walkObjectBasic = (obj, currentPath = '', level = 0) => {
      if (level > 5 || !obj || typeof obj !== 'object') return;

      Object.keys(obj).forEach(key => {
        const value = obj[key];
        const fullPath = currentPath ? `${currentPath}.${key}` : key;

        if (isPrimitiveValue(value)) {
          fields.push({
            key: `${resourceType.toLowerCase()}_${entryIndex}_${fullPath.replace(/\[|\]/g, '_')}`,
            type: typeof value === 'number' ? 'number' : 'text',
            label: generateLabelFromPath(fullPath),
            value: value,
            readOnly: false
          });
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (isPrimitiveValue(item)) {
              fields.push({
                key: `${resourceType.toLowerCase()}_${entryIndex}_${fullPath}_${index}`,
                type: typeof item === 'number' ? 'number' : 'text',
                label: `${generateLabelFromPath(fullPath)} ${index + 1}`,
                value: item,
                readOnly: false
              });
            } else if (typeof item === 'object') {
              walkObjectBasic(item, `${fullPath}[${index}]`, level + 1);
            }
          });
        } else if (typeof value === 'object') {
          walkObjectBasic(value, fullPath, level + 1);
        }
      });
    };

    walkObjectBasic(resource);
    return fields;
  };

  // Check if a value is primitive (can be rendered as a field)
  const isPrimitiveValue = (value) => {
    return typeof value === 'string' || 
           typeof value === 'number' || 
           typeof value === 'boolean';
  };

  // Generate human-readable labels from FHIR paths
  const generateLabelFromPath = (fhirPath) => {
    const parts = fhirPath.split('.');
    const lastPart = parts[parts.length - 1];
    
    // Clean up array notation and camelCase
    return lastPart
      .replace(/\[\d+\]/g, '')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  // Initialize form data when component mounts or props change
  useEffect(() => {
    console.log('🔄 useEffect triggered - reinitializing form data');
    const fieldConfigs = generateFieldConfigurations(fhirData, originalFile);
    const initialData = {};
    
    fieldConfigs.forEach(field => {
      initialData[field.key] = field.value || '';
    });
    
    console.log('📝 Setting initial form data:', initialData);
    setFormData(initialData);
    setIsDirty(false);
  }, [fhirData, originalFile]);

  // Handle field changes
  const handleFieldChange = (fieldKey, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }));

    setIsDirty(true);

    if (errors[fieldKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }

    validateForm(fieldKey, value);
  };

  // Validate form
  const validateForm = (changedField = null, changedValue = null) => {
    const newErrors = {};
    const fieldConfigs = generateFieldConfigurations(fhirData, originalFile);
    
    const currentData = changedField 
      ? { ...formData, [changedField]: changedValue }
      : formData;
    
    fieldConfigs.forEach(field => {
      const value = currentData[field.key];
      
      if (field.required && (!value || value.toString().trim() === '')) {
        newErrors[field.key] = `${field.label} is required`;
      }
      
      if (value && value.toString().trim() !== '') {
        if (field.type === 'email' && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            newErrors[field.key] = 'Please enter a valid email address';
          }
        }
        
        if (field.type === 'number' && value) {
          const numValue = parseFloat(value);
          if (isNaN(numValue)) {
            newErrors[field.key] = 'Please enter a valid number';
          } else {
            if (field.min !== undefined && numValue < field.min) {
              newErrors[field.key] = `Value must be at least ${field.min}`;
            }
            if (field.max !== undefined && numValue > field.max) {
              newErrors[field.key] = `Value must not exceed ${field.max}`;
            }
          }
        }
        
        if (field.type === 'date' && value) {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            newErrors[field.key] = 'Please enter a valid date';
          }
        }
      }
    });

    setErrors(newErrors);
    
    const isValid = Object.keys(newErrors).length === 0;
    
    if (onValidationChange) {
      onValidationChange({
        isValid,
        errors: newErrors,
        isDirty,
        changes: formData
      });
    }

    return isValid;
  };

  useEffect(() => {
    if (isDirty) {
      validateForm();
    }
  }, [formData, isDirty]);

  useEffect(() => {
    if (isDirty && onFormUpdate) {
      onFormUpdate(formData);
    }
  }, [formData, isDirty, onFormUpdate]);

  const fieldConfigurations = generateFieldConfigurations(fhirData, originalFile);

  // Debug information for development
  const debugInfo = {
    fhirAvailable: !!fhirData,
    entryCount: fhirData?.entry?.length || 0,
    resourceTypes: fhirData?.entry ? [...new Set(fhirData.entry.map(e => e.resource?.resourceType))].filter(Boolean) : [],
    fieldsGenerated: fieldConfigurations.length,
    mappedFields: fieldConfigurations.filter(f => f.type !== 'text' || f.options || f.min !== undefined || f.max !== undefined).length,
    availableMappings: Object.keys(FHIR_RESOURCE_FIELD_MAPPINGS).length
  };

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
        <h4 className="text-sm font-medium text-green-800 mb-2">✅ Enhanced Mapping-Driven Form</h4>
        <div className="text-xs text-green-700 grid grid-cols-2 gap-2">
          <div>FHIR Data: {debugInfo.fhirAvailable ? '✅ Available' : '❌ Missing'}</div>
          <div>Entries: {debugInfo.entryCount}</div>
          <div>Resource Types: {debugInfo.resourceTypes.join(', ') || 'None'}</div>
          <div>Fields Generated: {debugInfo.fieldsGenerated}</div>
          <div>Mapped Fields: {debugInfo.mappedFields}</div>
          <div>Available Mappings: {debugInfo.availableMappings}</div>
        </div>
      </div>

      {fieldConfigurations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fieldConfigurations.map((fieldConfig) => (
            <div 
              key={fieldConfig.key} 
              className={fieldConfig.type === 'textarea' ? 'md:col-span-2' : ''}
            >
              <DynamicFHIRField
                field={fieldConfig}
                value={formData[fieldConfig.key] || ''}
                onChange={(value) => handleFieldChange(fieldConfig.key, value)}
                error={errors[fieldConfig.key]}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 border border-gray-200 bg-gray-50 rounded">
          <p className="text-gray-600 text-sm">No structured data available. Please check the FHIR data.</p>
        </div>
      )}
      
      {Object.keys(errors).length > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600 font-medium">
            Please fix the following errors:
          </p>
          <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
            {Object.values(errors).map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DynamicFHIRForm;