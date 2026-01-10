import React from 'react';
import { Button } from '@/components/ui/Button';
import { Plus, Minus } from 'lucide-react';
import { EditFHIRFieldProps } from './Record.types';

const getInputType = (value: any, label: string): string => {
  if (typeof value === 'boolean') return 'checkbox';
  if (typeof value === 'number') return 'number';

  const stringValue = String(value || '');
  if (stringValue.includes('\n') || stringValue.length > 100) return 'textarea';
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return 'date';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(stringValue)) return 'datetime-local';

  const fieldNameLower = label.toLowerCase();
  if (['date', 'birth', 'time', 'effective'].some(k => fieldNameLower.includes(k))) {
    const parsedDate = new Date(stringValue);
    if (!isNaN(parsedDate.getTime()) && stringValue.length > 8) {
      return stringValue.includes('T') ? 'datetime-local' : 'date';
    }
  }

  if (stringValue.includes('@') && stringValue.includes('.')) return 'email';
  if (stringValue.startsWith('http://') || stringValue.startsWith('https://')) return 'url';
  if (/^\+?[\d\s\-\(\)]{10,}$/.test(stringValue)) return 'tel';

  return 'text';
};

const FHIRField: React.FC<EditFHIRFieldProps> = ({
  label,
  value,
  depth = 0,
  editable = false,
  onChange,
  onDelete,
  canDelete = false,
  path = '',
}) => {
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
            onChange={e => onChange?.(e.target.value || null)}
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

      return (
        <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2 w-full">
          {editable && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 font-medium">
                Array ({content.length} items)
              </span>
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
              <FHIRField
                key={index}
                label={`[${index}]`}
                value={item}
                depth={currentDepth + 1}
                editable={editable}
                onChange={
                  editable ? newValue => updateNestedValue(index.toString(), newValue) : undefined
                }
                onDelete={editable ? () => deleteNestedValue(index.toString()) : undefined}
                canDelete={editable}
                path={`${path}[${index}]`}
              />
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
              <span className="text-xs text-gray-600 font-medium">
                Object ({entries.length} fields)
              </span>
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
                onChange={editable ? newValue => updateNestedValue(key, newValue) : undefined}
                onDelete={editable ? () => deleteNestedValue(key) : undefined}
                canDelete={editable && key !== 'resourceType'}
                path={path ? `${path}.${key}` : key}
              />
            ))}
          </div>
        </div>
      );
    }

    // Primitive values
    if (editable) {
      const inputType = getInputType(content, label);
      const primitiveValue = content != null ? String(content) : '';

      if (inputType === 'checkbox') {
        return (
          <input
            type="checkbox"
            checked={Boolean(content)}
            onChange={e => onChange?.(e.target.checked)}
            className="bg-background rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
          />
        );
      }

      if (inputType === 'textarea') {
        return (
          <textarea
            value={primitiveValue}
            onChange={e => onChange?.(e.target.value)}
            rows={3}
            className="bg-background w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        );
      }

      return (
        <input
          type={inputType}
          value={primitiveValue}
          onChange={e => onChange?.(e.target.value)}
          className="bg-background w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      );
    }

    return <span className="text-sm text-gray-900">{String(content)}</span>;
  };

  return (
    <div
      className={`py-1 ${
        editable ? 'hover:bg-gray-50 rounded transition-colors duration-150' : ''
      }`}
    >
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
      <div>{renderNestedContent(value, depth)}</div>
    </div>
  );
};

export default FHIRField;
