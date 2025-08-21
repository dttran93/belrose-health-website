import React, { useState, useCallback } from 'react';
import { Save, X, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FHIRResourceCardProps, HealthRecordProps } from '@/features/ViewEditRecord/components/ui/Record.types'

interface EditRecordProps {
  record: any; // Full record object including belroseFields
  fhirData: any;
  onSave?: (updatedRecord: any) => void; // Now saves the full record
  onCancel?: () => void;
  className?: string;
}

// Editable FHIR Field component - handles all data types recursively
const EditableFHIRField = ({ 
  label, 
  value, 
  onChange, 
  onDelete,
  depth = 0, 
  path = '',
  canDelete = false 
}: { 
  label: string; 
  value: any; 
  onChange: (newValue: any) => void;
  onDelete?: () => void;
  depth?: number;
  path?: string;
  canDelete?: boolean;
}) => {
  
  // Helper to update nested values
  const updateNestedValue = useCallback((key: string, newValue: any) => {
    if (Array.isArray(value)) {
      const newArray = [...value];
      newArray[parseInt(key)] = newValue;
      onChange(newArray);
    } else if (typeof value === 'object' && value !== null) {
      onChange({ ...value, [key]: newValue });
    }
  }, [value, onChange]);

  // Helper to delete nested values
  const deleteNestedValue = useCallback((key: string) => {
    if (Array.isArray(value)) {
      const newArray = value.filter((_, index) => index !== parseInt(key));
      onChange(newArray);
    } else if (typeof value === 'object' && value !== null) {
      const newObj = { ...value };
      delete newObj[key];
      onChange(newObj);
    }
  }, [value, onChange]);

  // Helper to add new items
  const addNewItem = useCallback(() => {
    if (Array.isArray(value)) {
      onChange([...value, '']);
    } else if (typeof value === 'object' && value !== null) {
      const newKey = `newField${Object.keys(value).length + 1}`;
      onChange({ ...value, [newKey]: '' });
    }
  }, [value, onChange]);

  // Render content based on data type
  const renderEditableContent = () => {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return (
        <input
          type="text"
          value=""
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="Enter value..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      );
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return (
          <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 italic">Empty array</span>
              <Button
                variant="outline"
                size="sm"
                onClick={addNewItem}
                className="px-2 py-1 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Item
              </Button>
            </div>
          </div>
        );
      }
      
      // Special case: single object in array - flatten it
      if (value.length === 1 && typeof value[0] === 'object' && value[0] !== null) {
        return (
          <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 font-medium">Single Item Array</span>
              <Button
                variant="outline"
                size="sm"
                onClick={addNewItem}
                className="px-2 py-1 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Item
              </Button>
            </div>
            <EditableFHIRField
              label="item"
              value={value[0]}
              onChange={(newValue) => updateNestedValue('0', newValue)}
              onDelete={() => deleteNestedValue('0')}
              depth={depth + 1}
              path={`${path}[0]`}
              canDelete={true}
            />
          </div>
        );
      }
      
      // Multiple items in array
      return (
        <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 font-medium">Array ({value.length} items)</span>
            <Button
              variant="outline"
              size="sm"
              onClick={addNewItem}
              className="px-2 py-1 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Item
            </Button>
          </div>
          <div className="space-y-2">
            {value.map((item, index) => (
              <div key={index} className="border-l-2 border-blue-200 pl-3">
                <EditableFHIRField
                  label={`[${index}]`}
                  value={item}
                  onChange={(newValue) => updateNestedValue(index.toString(), newValue)}
                  onDelete={() => deleteNestedValue(index.toString())}
                  depth={depth + 1}
                  path={`${path}[${index}]`}
                  canDelete={true}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    // Handle objects
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return (
          <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 italic">Empty object</span>
              <Button
                variant="outline"
                size="sm"
                onClick={addNewItem}
                className="px-2 py-1 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Field
              </Button>
            </div>
          </div>
        );
      }
      
      return (
        <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 font-medium">Object ({entries.length} fields)</span>
            <Button
              variant="outline"
              size="sm"
              onClick={addNewItem}
              className="px-2 py-1 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Field
            </Button>
          </div>
          <div className="space-y-3">
            {entries.map(([key, val]) => (
              <EditableFHIRField
                key={key}
                label={key}
                value={val}
                onChange={(newValue) => updateNestedValue(key, newValue)}
                onDelete={() => deleteNestedValue(key)}
                depth={depth + 1}
                path={path ? `${path}.${key}` : key}
                canDelete={true}
              />
            ))}
          </div>
        </div>
      );
    }
    
    // Handle primitive values (string, number, boolean)
    const primitiveValue = value != null ? String(value) : '';
    
    // Determine input type based on content and field name
    const getInputType = () => {
      if (typeof value === 'boolean') return 'checkbox';
      if (typeof value === 'number') return 'number';
      if (primitiveValue.includes('\n') || primitiveValue.length > 100) return 'textarea';
      
      // Date detection logic
      // 1. Check if value matches date formats
      if (primitiveValue.match(/^\d{4}-\d{2}-\d{2}$/)) return 'date'; // YYYY-MM-DD
      if (primitiveValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) return 'datetime-local'; // ISO datetime
      
      // 2. Check if field name suggests it's a date
      const fieldNameLower = label.toLowerCase();
      if (fieldNameLower.includes('date') || 
          fieldNameLower.includes('birth') || 
          fieldNameLower.includes('created') ||
          fieldNameLower.includes('updated') ||
          fieldNameLower.includes('completed') ||
          fieldNameLower.includes('time') ||
          fieldNameLower.includes('when') ||
          fieldNameLower.includes('effective')) {
        // Try to parse as date if it looks like one
        const parsedDate = new Date(primitiveValue);
        if (!isNaN(parsedDate.getTime()) && primitiveValue.length > 8) {
          return primitiveValue.includes('T') ? 'datetime-local' : 'date';
        }
      }
      
      // 3. Email detection
      if (primitiveValue.includes('@') && primitiveValue.includes('.')) return 'email';
      
      // 4. URL detection
      if (primitiveValue.startsWith('http://') || primitiveValue.startsWith('https://')) return 'url';
      
      // 5. Phone number detection (basic)
      if (primitiveValue.match(/^\+?[\d\s\-\(\)]{10,}$/)) return 'tel';
      
      return 'text';
    };

    const inputType = getInputType();

    if (inputType === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
        />
      );
    }

    if (inputType === 'textarea') {
      return (
        <textarea
          value={primitiveValue}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      );
    }

    if (inputType === 'date' || inputType === 'datetime-local') {
      // Handle date conversion for HTML input
      let dateValue: string = '';
      if (primitiveValue && primitiveValue !== 'undefined') {
        try {
          const date = new Date(primitiveValue);
          if (!isNaN(date.getTime())) {
            if (inputType === 'date') {
              dateValue = date.toISOString().split('T')[0]; // YYYY-MM-DD
            } else {
              // For datetime-local, we need YYYY-MM-DDTHH:mm format
              const isoString = date.toISOString();
              dateValue = isoString.slice(0, 16); // Remove seconds and timezone
            }
          }
        } catch (e) {
          console.warn('Could not parse date:', primitiveValue);
        }
      }
      
      return (
        <input
          type={inputType}
          value={dateValue}
          onChange={(e) => {
            // Convert back to original format when saving
            const newValue = e.target.value;
            if (newValue) {
              const date = new Date(newValue);
              if (!isNaN(date.getTime())) {
                // Keep original format if possible
                if (primitiveValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  onChange(date.toISOString().split('T')[0]);
                } else if (primitiveValue.includes('T')) {
                  onChange(date.toISOString());
                } else {
                  onChange(date.toLocaleDateString('en-CA')); // YYYY-MM-DD format
                }
              } else {
                onChange(newValue);
              }
            } else {
              onChange('');
            }
          }}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      );
    }
  };

  // Determine layout based on content type
  const willRenderAsBox = (content: any) => {
    if (content === null || content === undefined) return false;
    if (Array.isArray(content)) {
      if (content.length === 0) return true;
      if (content.length === 1 && typeof content[0] === 'object' && content[0] !== null) {
        return true;
      }
      return true;
    }
    if (typeof content === 'object') {
      return Object.keys(content).length > 0;
    }
    return false;
  };

  const shouldStackVertically = willRenderAsBox(value);

  return (
    <div className="py-1">
      {shouldStackVertically ? (
        // Vertical layout for nested content
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 capitalize">
              {label.replace(/([A-Z])/g, ' $1').trim()}:
            </span>
            {canDelete && onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Minus className="w-3 h-3" />
              </Button>
            )}
          </div>
          <div className="w-full">
            {renderEditableContent()}
          </div>
        </div>
      ) : (
        // Horizontal layout for primitive values
        <div className="flex items-start">
          <span className="text-sm font-medium text-gray-600 capitalize flex-shrink-0 min-w-0 mr-4">
            {label.replace(/([A-Z])/g, ' $1').trim()}:
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                {renderEditableContent()}
              </div>
              {canDelete && onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Minus className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Editable FHIR Resource Card Component
const EditableFHIRResourceCard: React.FC<{
  resource: any;
  index: number;
  onChange: (updatedResource: any) => void;
}> = ({ resource, index, onChange }) => {

  // Get all fields for editing
  const getDisplayFields = (resource: any) => {
    const fields: { [key: string]: any } = {};
    Object.keys(resource).forEach(key => {
      fields[key] = resource[key];
    });
    return fields;
  };

  const displayFields = getDisplayFields(resource);

  // Update a specific field in the resource
  const updateField = (fieldKey: string, newValue: any) => {
    const updatedResource = { ...resource, [fieldKey]: newValue };
    onChange(updatedResource);
  };

  // Delete a field from the resource
  const deleteField = (fieldKey: string) => {
    const updatedResource = { ...resource };
    delete updatedResource[fieldKey];
    onChange(updatedResource);
  };

  // Add a new field to the resource
  const addNewField = () => {
    const newFieldKey = `newField${Object.keys(resource).length + 1}`;
    const updatedResource = { ...resource, [newFieldKey]: '' };
    onChange(updatedResource);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">
            {resource.resourceType}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
            Resource {index + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={addNewField}
            className="px-2 py-1 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Field
          </Button>
        </div>
      </div>

      {/* Render editable fields */}
      <div className="border-t pt-4 space-y-4">
        {Object.entries(displayFields).map(([key, value]) => (
          <EditableFHIRField
            key={key}
            label={key}
            value={value}
            onChange={(newValue) => updateField(key, newValue)}
            onDelete={() => deleteField(key)}
            canDelete={key !== 'resourceType'} // Don't allow deleting resourceType
          />
        ))}
      </div>

      {/* Show message if no fields */}
      {Object.keys(displayFields).length === 0 && (
        <div className="border-t pt-4">
          <p className="text-sm text-gray-500 italic">No fields found</p>
          <Button
            variant="outline"
            size="sm"
            onClick={addNewField}
            className="mt-2 px-2 py-1 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add First Field
          </Button>
        </div>
      )}
    </div>
  );
};

// Main Editable Health Record Component
const EditRecord: React.FC<EditRecordProps> = ({ 
  fhirData, 
  onSave, 
  onCancel, 
  className = '' 
}) => {
  const [editedData, setEditedData] = useState(fhirData);
  const [hasChanges, setHasChanges] = useState(false);

  // Update a specific resource
  const updateResource = (index: number, updatedResource: any) => {
    const newData = { ...editedData };
    if (newData.entry && newData.entry[index]) {
      newData.entry[index].resource = updatedResource;
      setEditedData(newData);
      setHasChanges(true);
    }
  };

  // Handle save
  const handleSave = () => {
    if (onSave) {
      onSave(editedData);
    } else {
      console.log('Saved FHIR data:', editedData);
    }
    setHasChanges(false);
  };

  // Handle cancel
  const handleCancel = () => {
    setEditedData(fhirData);
    setHasChanges(false);
    if (onCancel) onCancel();
  };

  if (!editedData || !editedData.entry) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">No FHIR data available for editing.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Action Bar */}
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            Editing FHIR Bundle
          </span>
          {hasChanges && (
            <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded-full">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="px-4 py-2 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-4 py-2 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Individual editable resource cards */}
      <div className="space-y-4">
        {editedData.entry.map((entry: any, index: number) => (
          <EditableFHIRResourceCard
            key={index}
            resource={entry.resource}
            index={index}
            onChange={(updatedResource) => updateResource(index, updatedResource)}
          />
        ))}
      </div>
      
      {/* Complete bundle JSON for reference */}
      <details className="bg-gray-100 rounded-lg">
        <summary className="p-4 cursor-pointer font-medium text-gray-700 hover:text-gray-900">
          View Current JSON (Live Preview)
        </summary>
        <div className="px-4 pb-4">
          <pre className="text-sm text-gray-800 overflow-x-auto whitespace-pre-wrap bg-white p-4 rounded border max-h-96 overflow-y-auto">
            {JSON.stringify(editedData, null, 2)}
          </pre>
        </div>
      </details>
    </div>
  );
};

export default EditRecord;