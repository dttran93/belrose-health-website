import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Dynamic field component that renders different input types based on field configuration
 * This replaces the static form fields with a flexible system that adapts to FHIR data
 */

// Base field wrapper with label and error handling
const FieldWrapper = ({ field, error, children }) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium text-gray-700">
      {field.label}
      {field.required && <span className="text-red-500 ml-1">*</span>}
      {field.unit && (
        <span className="text-gray-500 text-xs ml-1">({field.unit})</span>
      )}
    </label>
    {children}
    {error && (
      <div className="flex items-center text-red-600 text-sm mt-1">
        <AlertCircle className="w-4 h-4 mr-1" />
        {error}
      </div>
    )}
    {field.help && (
      <p className="text-xs text-gray-500">{field.help}</p>
    )}
  </div>
);

// Text input field
const TextInput = ({ field, value, onChange, error }) => (
  <FieldWrapper field={field} error={error}>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      readOnly={field.readOnly}
      className={`
        w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
        ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}
        ${field.readOnly ? 'bg-gray-50 text-gray-600' : ''}
      `}
    />
  </FieldWrapper>
);

// Number input field
const NumberInput = ({ field, value, onChange, error }) => (
  <FieldWrapper field={field} error={error}>
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        step={field.step || "0.01"}
        min={field.min}
        max={field.max}
        readOnly={field.readOnly}
        className={`
          w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
          ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}
          ${field.readOnly ? 'bg-gray-50 text-gray-600' : ''}
          ${field.unit ? 'pr-12' : ''}
        `}
      />
      {field.unit && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <span className="text-gray-500 text-sm">{field.unit}</span>
        </div>
      )}
    </div>
  </FieldWrapper>
);

// Date input field
const DateInput = ({ field, value, onChange, error }) => (
  <FieldWrapper field={field} error={error}>
    <input
      type={field.type} // 'date' or 'datetime-local'
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={field.readOnly}
      className={`
        w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
        ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}
        ${field.readOnly ? 'bg-gray-50 text-gray-600' : ''}
      `}
    />
  </FieldWrapper>
);

// Select dropdown field
const SelectInput = ({ field, value, onChange, error }) => (
  <FieldWrapper field={field} error={error}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={field.readOnly}
      className={`
        w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
        ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}
        ${field.readOnly ? 'bg-gray-50 text-gray-600' : ''}
      `}
    >
      <option value="">Select {field.label}</option>
      {field.options?.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </FieldWrapper>
);

// Textarea field
const TextAreaInput = ({ field, value, onChange, error }) => (
  <FieldWrapper field={field} error={error}>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      rows={field.rows || 4}
      readOnly={field.readOnly}
      className={`
        w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
        ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}
        ${field.readOnly ? 'bg-gray-50 text-gray-600' : ''}
      `}
    />
  </FieldWrapper>
);

// Email input field
const EmailInput = ({ field, value, onChange, error }) => (
  <FieldWrapper field={field} error={error}>
    <input
      type="email"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || "email@example.com"}
      readOnly={field.readOnly}
      className={`
        w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
        ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}
        ${field.readOnly ? 'bg-gray-50 text-gray-600' : ''}
      `}
    />
  </FieldWrapper>
);

// Phone input field
const PhoneInput = ({ field, value, onChange, error }) => (
  <FieldWrapper field={field} error={error}>
    <input
      type="tel"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || "Phone number"}
      readOnly={field.readOnly}
      className={`
        w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
        ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}
        ${field.readOnly ? 'bg-gray-50 text-gray-600' : ''}
      `}
    />
  </FieldWrapper>
);

// Checkbox input field
const CheckboxInput = ({ field, value, onChange, error }) => (
  <FieldWrapper field={field} error={error}>
    <label className="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        checked={value === true || value === 'true'}
        onChange={(e) => onChange(e.target.checked)}
        disabled={field.readOnly}
        className={`
          w-4 h-4 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500
          ${error ? 'border-red-300' : ''}
          ${field.readOnly ? 'opacity-50' : ''}
        `}
      />
      <span className="text-sm text-gray-700">
        {field.checkboxLabel || `Enable ${field.label}`}
      </span>
    </label>
  </FieldWrapper>
);

// URL input field
const UrlInput = ({ field, value, onChange, error }) => (
  <FieldWrapper field={field} error={error}>
    <input
      type="url"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || "https://example.com"}
      readOnly={field.readOnly}
      className={`
        w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
        ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}
        ${field.readOnly ? 'bg-gray-50 text-gray-600' : ''}
      `}
    />
  </FieldWrapper>
);

// Main DynamicFHIRForm component that chooses the right input type
const DynamicFHIRForm = ({ field, value, onChange, error }) => {
  // Add safety check for field parameter
  if (!field) {
    console.error('DynamicFHIRField: field prop is required');
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded">
        <p className="text-red-600 text-sm">Error: Field configuration is missing</p>
      </div>
    );
  }

  if (!field.type) {
    console.error('DynamicFHIRField: field.type is required', field);
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded">
        <p className="text-red-600 text-sm">Error: Field type is missing for field: {field.label || 'Unknown'}</p>
      </div>
    );
  }

  // Handle different field types
  switch (field.type) {
    case 'text':
      return <TextInput field={field} value={value} onChange={onChange} error={error} />;
      
    case 'number':
      return <NumberInput field={field} value={value} onChange={onChange} error={error} />;
      
    case 'date':
    case 'datetime-local':
      return <DateInput field={field} value={value} onChange={onChange} error={error} />;
      
    case 'select':
      return <SelectInput field={field} value={value} onChange={onChange} error={error} />;
      
    case 'textarea':
      return <TextAreaInput field={field} value={value} onChange={onChange} error={error} />;
      
    case 'email':
      return <EmailInput field={field} value={value} onChange={onChange} error={error} />;
      
    case 'tel':
      return <PhoneInput field={field} value={value} onChange={onChange} error={error} />;
      
    case 'checkbox':
      return <CheckboxInput field={field} value={value} onChange={onChange} error={error} />;
      
    case 'url':
      return <UrlInput field={field} value={value} onChange={onChange} error={error} />;
      
    default:
      console.warn(`Unknown field type: ${field.type}, falling back to text input`);
      return <TextInput field={field} value={value} onChange={onChange} error={error} />;
  }
};

export default DynamicFHIRForm;