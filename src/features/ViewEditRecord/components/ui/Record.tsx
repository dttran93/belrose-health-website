import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FHIRResourceCardProps, HealthRecordProps, EditFHIRFieldProps } from '@/features/ViewEditRecord/components/ui/Record.types';

// Smart input type detection utility
const getInputType = (value: any, label: string): string => {
  if (typeof value === 'boolean') return 'checkbox';
  if (typeof value === 'number') return 'number';
  
  const stringValue = String(value || '');
  
  // Large text detection
  if (stringValue.includes('\n') || stringValue.length > 100) return 'textarea';
  
  // Date detection
  if (stringValue.match(/^\d{4}-\d{2}-\d{2}$/)) return 'date';
  if (stringValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) return 'datetime-local';
  
  // Field name hints for dates
  const fieldNameLower = label.toLowerCase();
  if (fieldNameLower.includes('date') || 
      fieldNameLower.includes('birth') || 
      fieldNameLower.includes('time') ||
      fieldNameLower.includes('effective')) {
    const parsedDate = new Date(stringValue);
    if (!isNaN(parsedDate.getTime()) && stringValue.length > 8) {
      return stringValue.includes('T') ? 'datetime-local' : 'date';
    }
  }
  
  // Other type detection
  if (stringValue.includes('@') && stringValue.includes('.')) return 'email';
  if (stringValue.startsWith('http://') || stringValue.startsWith('https://')) return 'url';
  if (stringValue.match(/^\+?[\d\s\-\(\)]{10,}$/)) return 'tel';
  
  return 'text';
};

// Recursive field renderer that handles nested objects and arrays
const FHIRField: React.FC<EditFHIRFieldProps> = ({ 
  label, 
  value, 
  depth = 0, 
  editable = false,
  onChange,
  onDelete,
  canDelete = false,
  path = ''
}) => {
    
  // Helper to update nested values
  const updateNestedValue = (key: string, newValue: any) => {
    if (!onChange) return;
    
    if (Array.isArray(value)) {
      const newArray = [...value];
      newArray[parseInt(key)] = newValue;
      onChange(newArray);
    } else if (typeof value === 'object' && value !== null) {
      onChange({ ...value, [key]: newValue });
    }
  };

  // Helper to delete nested values
  const deleteNestedValue = (key: string) => {
    if (!onChange) return;
    
    if (Array.isArray(value)) {
      const newArray = value.filter((_, index) => index !== parseInt(key));
      onChange(newArray);
    } else if (typeof value === 'object' && value !== null) {
      const newObj = { ...value };
      delete newObj[key];
      onChange(newObj);
    }
  };

  // Helper to add new items
  const addNewItem = () => {
    if (!onChange) return;
    
    if (Array.isArray(value)) {
      onChange([...value, '']);
    } else if (typeof value === 'object' && value !== null) {
      const newKey = `newField${Object.keys(value).length + 1}`;
      onChange({ ...value, [newKey]: '' });
    }
  };

  const renderNestedContent = (content: any, currentDepth: number) => {
    if (content === null || content === undefined) {
      if (editable) {
        return (
          <input
            type="text"
            value=""
            onChange={(e) => onChange?.(e.target.value || null)}
            placeholder="Enter value..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      }
      return <span className="text-sm text-gray-500 italic">N/A</span>;
    }
    
    if (Array.isArray(content)) {
      if (content.length === 0) {
        if (editable) {
          return (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2 w-full">
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
        return <span className="text-sm text-gray-500 italic">Empty array</span>;
      }
      
      // FLATTEN: If array has only 1 item and it's an object, render the object directly
      if (content.length === 1 && typeof content[0] === 'object' && content[0] !== null) {
        return (
          <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2 w-full">
            {editable && (
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
            )}
            <FHIRField
              label="item"
              value={content[0]}
              depth={currentDepth + 1}
              editable={editable}
              onChange={editable ? (newValue) => updateNestedValue('0', newValue) : undefined}
              onDelete={editable ? () => deleteNestedValue('0') : undefined}
              canDelete={editable}
              path={`${path}[0]`}
            />
          </div>
        );
      }
      
      return (
        <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2 w-full">
          {editable && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 font-medium">Array ({content.length} items)</span>
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
          )}
          <div className="space-y-2">
            {content.map((item, index) => (
              <div key={index}>
                <FHIRField
                  label={`[${index}]`}
                  value={item}
                  depth={currentDepth + 1}
                  editable={editable}
                  onChange={editable ? (newValue) => updateNestedValue(index.toString(), newValue) : undefined}
                  onDelete={editable ? () => deleteNestedValue(index.toString()) : undefined}
                  canDelete={editable}
                  path={`${path}[${index}]`}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    if (typeof content === 'object') {
      const entries = Object.entries(content);
      if (entries.length === 0) {
        if (editable) {
          return (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2 w-full">
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
        return <span className="text-sm text-gray-500 italic">Empty object</span>;
      }
      
      return (
        <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2 w-full">
          {editable && (
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
          )}
          <div className="">
            {entries.map(([key, val]) => (
              <FHIRField 
                key={key} 
                label={key} 
                value={val} 
                depth={currentDepth + 1}
                editable={editable}
                onChange={editable ? (newValue) => updateNestedValue(key, newValue) : undefined}
                onDelete={editable ? () => deleteNestedValue(key) : undefined}
                canDelete={editable && key !== 'resourceType'} // Protect resourceType
                path={path ? `${path}.${key}` : key}
              />
            ))}
          </div>
        </div>
      );
    }
    
    // Primitive values (string, number, boolean)
    if (editable) {
      const inputType = getInputType(content, label);
      const primitiveValue = content != null ? String(content) : '';

      if (inputType === 'checkbox') {
        return (
          <input
            type="checkbox"
            checked={Boolean(content)}
            onChange={(e) => onChange?.(e.target.checked)}
            className="bg-background rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
          />
        );
      }

      if (inputType === 'textarea') {
        return (
          <textarea
            value={primitiveValue}
            onChange={(e) => onChange?.(e.target.value)}
            rows={3}
            className="bg-background w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        );
      }

      if (inputType === 'date' || inputType === 'datetime-local') {
        let dateValue = '';
        if (primitiveValue && primitiveValue !== 'undefined') {
          try {
            const date = new Date(primitiveValue);
            if (!isNaN(date.getTime())) {
              if (inputType === 'date') {
                dateValue = date.toISOString().split('T')[0] ?? '';
              } else {
                const isoString = date.toISOString();
                dateValue = isoString.slice(0, 16) ?? '';
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
              const newValue = e.target.value;
              if (newValue) {
                const date = new Date(newValue);
                if (!isNaN(date.getTime())) {
                  if (primitiveValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    onChange?.(date.toISOString().split('T')[0]);
                  } else if (primitiveValue.includes('T')) {
                    onChange?.(date.toISOString());
                  } else {
                    onChange?.(date.toLocaleDateString('en-CA'));
                  }
                } else {
                  onChange?.(newValue);
                }
              } else {
                onChange?.('');
              }
            }}
            className="bg-background w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      }

      // Default text input
      return (
        <input
          type={inputType}
          value={primitiveValue}
          onChange={(e) => onChange?.(e.target.value)}
          className="bg-background w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      );
    } else {
      // View mode - original display logic
      return (
        <span className="text-sm text-gray-900">
          {String(content)}
        </span>
      );
    }
  };

  // Check if content will render as a nested box (array or object)
  const willRenderAsBox = (content: any) => {
    if (content === null || content === undefined) return false;
    
    if (Array.isArray(content)) {
      if (content.length === 0) return editable; // Show box in edit mode for adding items
      if (content.length === 1 && typeof content[0] === 'object' && content[0] !== null) {
        return true;
      }
      return true;
    }
    
    if (typeof content === 'object') {
      const entries = Object.entries(content);
      return entries.length > 0 || editable; // Show box in edit mode for adding fields
    }
    
    return false;
  };

  const shouldStackVertically = willRenderAsBox(value);

  return (
    <div className={`py-1 ${editable ? 'hover:bg-gray-50 rounded transition-colors duration-150' : ''}`}>
      {shouldStackVertically ? (
        // Vertical layout for nested content
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-left font-medium text-gray-600 capitalize">
              {label.replace(/([A-Z])/g, ' $1').trim()}:
            </span>
            {canDelete && onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-none bg-transparent rounded-full"
              >
                <Minus className="w-2 h-2" />
              </Button>
            )}
          </div>
          <div className="w-full">
            {renderNestedContent(value, depth)}
          </div>
        </div>
      ) : (
        // Horizontal layout for primitive values
        <div className="flex items-start">
          <span className="text-sm font-medium text-gray-600 capitalize flex-shrink-0">
            {label.replace(/([A-Z])/g, ' $1').trim()}:
          </span>
          <div className="ml-4 flex-1 min-w-0">
            <div className={editable ? "flex items-center gap-2" : "text-right"}>
              <div className="flex-1">
                {renderNestedContent(value, depth)}
              </div>
              {canDelete && onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-none bg-transparent rounded-full"
                >
                  <Minus className="w-2 h-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// FHIR Resource Card Component
const FHIRResourceCard: React.FC<FHIRResourceCardProps> = ({ 
  resource, 
  index, 
  editable = false, 
  onChange 
}) => {
  // Extract all fields except common metadata fields for cleaner display
  const getDisplayFields = (resource: any) => {
    const fields: { [key: string]: any } = {};
    
    // Get all fields
    Object.keys(resource).forEach(key => {
      fields[key] = resource[key];
    });
    
    return fields;
  };

  const displayFields = getDisplayFields(resource);

  // Update a specific field in the resource
  const updateField = (fieldKey: string, newValue: any) => {
    if (!onChange) return;
    const updatedResource = { ...resource, [fieldKey]: newValue };
    onChange(updatedResource);
  };

  // Delete a field from the resource
  const deleteField = (fieldKey: string) => {
    if (!onChange) return;
    const updatedResource = { ...resource };
    delete updatedResource[fieldKey];
    onChange(updatedResource);
  };

  // Add a new field to the resource
  const addNewField = () => {
    if (!onChange) return;
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
          {editable && (
            <Button
              variant="outline"
              size="sm"
              onClick={addNewField}
              className="px-2 py-1 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Field
            </Button>
          )}
        </div>
      </div>

      {/* Render fields with nested support */}
      <div className="border-t pt-4">
        {Object.entries(displayFields).map(([key, value]) => (
          <FHIRField 
            key={key} 
            label={key} 
            value={value} 
            editable={editable}
            onChange={editable ? (newValue) => updateField(key, newValue) : undefined}
            onDelete={editable ? () => deleteField(key) : undefined}
            canDelete={editable && key !== 'resourceType'}
            path={key}
          />
        ))}
      </div>

      {/* Show if no displayable fields */}
      {Object.keys(displayFields).length === 0 && (
        <div className="border-t pt-4">
          <p className="text-sm text-gray-500 italic">
            No displayable fields found
          </p>
          {editable && (
            <Button
              variant="outline"
              size="sm"
              onClick={addNewField}
              className="mt-2 px-2 py-1 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add First Field
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// Main Health Record Component
const HealthRecord: React.FC<HealthRecordProps> = ({ 
  fhirData, 
  className,
  editable = false,
  onSave,
  onCancel,
  onFhirChange,
}) => {
  const [editedData, setEditedData] = useState(fhirData);
  const [hasChanges, setHasChanges] = useState(false);

    // ADD THESE DEBUG LOGS
  console.log('🔍 HealthRecord render:', { 
    editable, 
    hasOnSave: !!onSave,
    hasOnCancel: !!onCancel 
  });


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
        <p className="text-yellow-800">No FHIR data available for this record.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Individual resource cards */}
      <div className="space-y-4">
        {editedData.entry.map((entry, index) => (
          <FHIRResourceCard 
            key={index}
            resource={entry.resource}
            index={index}
            editable={editable}
            onChange={editable ? (updatedResource) => updateResource(index, updatedResource) : undefined}
          />
        ))}
      </div>
      
      {/* Complete bundle JSON for testing */}
      <details className="bg-gray-100 rounded-lg">
        <summary className="p-4 cursor-pointer font-medium text-gray-700 hover:text-gray-900">
          {editable ? 'View Current JSON (Live Preview)' : 'View Complete Bundle JSON'}
        </summary>
        <div className="px-4 pb-4">
          <pre className="text-sm text-gray-800 overflow-x-auto whitespace-pre-wrap bg-white p-4 rounded border max-h-96 overflow-y-auto">
            {JSON.stringify(editable ? editedData : fhirData, null, 2)}
          </pre>
        </div>
      </details>
    </div>
  );
};

export default HealthRecord;