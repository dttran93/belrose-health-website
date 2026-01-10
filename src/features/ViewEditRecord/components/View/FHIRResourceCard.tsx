import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FHIRResourceCardProps } from './Record.types';
import FHIRField from './FHIRField';

const FHIRResourceCard: React.FC<FHIRResourceCardProps> = ({
  resource,
  index,
  editable = false,
  onChange,
}) => {
  const updateField = (fieldKey: string, newValue: any) => {
    if (!onChange) return;
    onChange({ ...resource, [fieldKey]: newValue });
  };

  const deleteField = (fieldKey: string) => {
    if (!onChange) return;
    const newResource = { ...resource };
    delete newResource[fieldKey];
    onChange(newResource);
  };

  const addNewField = () => {
    if (!onChange) return;
    const newFieldKey = `newField${Object.keys(resource).length + 1}`;
    onChange({ ...resource, [newFieldKey]: '' });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <h4 className="text-lg font-semibold text-gray-900">{resource.resourceType}</h4>
        {editable && (
          <Button variant="outline" size="sm" onClick={addNewField} className="px-2 py-1 text-xs">
            <Plus className="w-3 h-3 mr-1" />
            Add Field
          </Button>
        )}
      </div>

      <div className="border-t pt-4">
        {Object.entries(resource).map(([key, value]) => (
          <FHIRField
            key={key}
            label={key}
            value={value}
            editable={editable}
            onChange={editable ? newValue => updateField(key, newValue) : undefined}
            onDelete={editable ? () => deleteField(key) : undefined}
            canDelete={editable && key !== 'resourceType'}
            path={key}
          />
        ))}

        {Object.keys(resource).length === 0 && editable && (
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
    </div>
  );
};

export default FHIRResourceCard;
