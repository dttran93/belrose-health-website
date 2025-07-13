import React, { useState, useEffect } from 'react';
import DynamicFHIRField from './ui/DynamicFHIRField';

const DynamicFHIRForm = ({ fhirData, originalFile, onFHIRUpdate, onValidationChange }) => {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  // Generate field configurations from FHIR data and original file
  const generateFieldConfigurations = (fhirData, originalFile) => {
    const fields = [];

    // Base document fields
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

    // Extract patient information from FHIR if available
    if (fhirData?.entry) {
      const patient = fhirData.entry.find(e => e.resource?.resourceType === 'Patient')?.resource;
      
      if (patient) {
        // Patient name
        const patientName = patient.name?.[0] 
          ? `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim()
          : '';

        fields.push({
          key: 'patientName',
          type: 'text',
          label: 'Patient Name',
          required: true,
          value: patientName
        });

        // Patient birth date
        if (patient.birthDate) {
          fields.push({
            key: 'patientBirthDate',
            type: 'date',
            label: 'Patient Birth Date',
            value: patient.birthDate
          });
        }

        // Patient ID
        if (patient.identifier?.[0]?.value) {
          fields.push({
            key: 'patientId',
            type: 'text',
            label: 'Patient ID',
            value: patient.identifier[0].value
          });
        }
      }

      // Extract practitioner/provider information
      const practitioner = fhirData.entry.find(e => e.resource?.resourceType === 'Practitioner')?.resource;
      if (practitioner) {
        const providerName = practitioner.name?.[0]
          ? `${practitioner.name[0].given?.join(' ') || ''} ${practitioner.name[0].family || ''}`.trim()
          : '';

        fields.push({
          key: 'providerName',
          type: 'text',
          label: 'Provider Name',
          value: providerName
        });
      } else {
        // Add empty provider field if not found in FHIR
        fields.push({
          key: 'providerName',
          type: 'text',
          label: 'Provider Name',
          placeholder: 'Enter provider name',
          value: ''
        });
      }

      // Extract observations
      const observations = fhirData.entry.filter(e => e.resource?.resourceType === 'Observation');
      observations.forEach((obs, index) => {
        const resource = obs.resource;
        const fieldKey = `observation_${index}`;

        // Create field based on observation type
        if (resource.component && resource.component.length > 0) {
          // Multi-component observation (like vision prescription)
          resource.component.forEach((comp, compIndex) => {
            const compKey = `${fieldKey}_component_${compIndex}`;
            const label = comp.code?.text || `Measurement ${compIndex + 1}`;
            const value = comp.valueQuantity 
              ? comp.valueQuantity.value 
              : comp.valueString || '';
            const unit = comp.valueQuantity?.unit || '';

            fields.push({
              key: compKey,
              type: comp.valueQuantity ? 'number' : 'text',
              label: label,
              value: value,
              unit: unit,
              step: comp.valueQuantity ? '0.01' : undefined
            });
          });
        } else {
          // Single value observation
          const label = resource.code?.text || resource.code?.coding?.[0]?.display || `Observation ${index + 1}`;
          const value = resource.valueQuantity?.value || resource.valueString || '';
          const unit = resource.valueQuantity?.unit || '';

          fields.push({
            key: fieldKey,
            type: resource.valueQuantity ? 'number' : 'text',
            label: label,
            value: value,
            unit: unit,
            step: resource.valueQuantity ? '0.01' : undefined
          });
        }
      });
    }

    // Provider institution fields
    fields.push({
      key: 'providerInstitution',
      type: 'text',
      label: 'Provider Institution',
      placeholder: 'Enter institution name',
      value: ''
    });

    fields.push({
      key: 'providerAddress',
      type: 'textarea',
      label: 'Provider Address',
      placeholder: 'Enter provider address',
      rows: 2,
      value: ''
    });

    // Clinical notes from extracted text
    fields.push({
      key: 'clinicalNotes',
      type: 'textarea',
      label: 'Clinical Notes',
      placeholder: 'Additional notes or observations',
      rows: 4,
      value: originalFile?.extractedText || ''
    });

    return fields;
  };

  // Initialize form data when component mounts or props change
  useEffect(() => {
    const fieldConfigs = generateFieldConfigurations(fhirData, originalFile);
    const initialData = {};
    
    fieldConfigs.forEach(field => {
      initialData[field.key] = field.value || '';
    });
    
    setFormData(initialData);
    setIsDirty(false);
  }, [fhirData, originalFile]);

  // Handle field changes
  const handleFieldChange = (fieldKey, value) => {
    // Update form data first
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }));

    // Mark form as dirty
    setIsDirty(true);

    // Clear any existing error for this field
    if (errors[fieldKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }

    // Trigger validation
    validateForm(fieldKey, value);
  };

  // Validate form
  const validateForm = (changedField = null, changedValue = null) => {
    const newErrors = {};
    const fieldConfigs = generateFieldConfigurations(fhirData, originalFile);
    
    // Get current form data, including any just-changed value
    const currentData = changedField 
      ? { ...formData, [changedField]: changedValue }
      : formData;
    
    fieldConfigs.forEach(field => {
      const value = currentData[field.key];
      
      // Required field validation
      if (field.required && (!value || value.toString().trim() === '')) {
        newErrors[field.key] = `${field.label} is required`;
      }
      
      // Type-specific validation
      if (value && value.toString().trim() !== '') {
        if (field.type === 'email' && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            newErrors[field.key] = 'Please enter a valid email address';
          }
        }
        
        if (field.type === 'number' && value) {
          if (isNaN(value)) {
            newErrors[field.key] = 'Please enter a valid number';
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
    
    // Notify parent component of validation changes
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

  // Trigger validation when form data changes
  useEffect(() => {
    if (isDirty) {
      validateForm();
    }
  }, [formData, isDirty]);

  // Notify parent component when form data changes (using useEffect)
  useEffect(() => {
    if (isDirty && onFHIRUpdate) {
      onFHIRUpdate(formData);
    }
  }, [formData, isDirty, onFHIRUpdate]);

  // Generate field configurations for rendering
  const fieldConfigurations = generateFieldConfigurations(fhirData, originalFile);

  return (
    <div className="space-y-4">
      {fieldConfigurations.map((fieldConfig) => (
        <DynamicFHIRField
          key={fieldConfig.key}
          field={fieldConfig}
          value={formData[fieldConfig.key] || ''}
          onChange={(value) => handleFieldChange(fieldConfig.key, value)}
          error={errors[fieldConfig.key]}
        />
      ))}
      
      {/* Show validation summary if there are errors */}
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