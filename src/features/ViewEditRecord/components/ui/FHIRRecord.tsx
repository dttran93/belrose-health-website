import React, { useState, useEffect } from 'react';
import { FHIRRecordProps } from './Record.types';
import FHIRResourceCard from './FHIRResourceCard';

const FHIRRecord: React.FC<FHIRRecordProps> = ({
  fhirData,
  className,
  editable = false,
  onFhirChanged,
  onDataChange,
}) => {
  //Update in case it's a single resource versus a bundle.
  const initialData = fhirData?.entry
    ? fhirData
    : { resourceType: 'Bundle', type: 'collection', entry: [{ resource: fhirData }] };

  const [editedData, setEditedData] = useState(initialData);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setEditedData(initialData);
    setHasChanges(false);
  }, [fhirData]);

  useEffect(() => {
    if (onFhirChanged) onFhirChanged(hasChanges);
  }, [hasChanges, onFhirChanged]);

  useEffect(() => {
    if (onDataChange) onDataChange(editedData);
  }, [editedData, onDataChange]);

  const updateResource = (index: number, updatedResource: any) => {
    const newData = { ...editedData };
    if (newData.entry && newData.entry[index]) {
      newData.entry[index].resource = updatedResource;
      setEditedData(newData);
      setHasChanges(true);
    }
  };

  if (!editedData?.entry) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">No FHIR data available for this record.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {editedData.entry.map((entry: any, index: number) => (
        <FHIRResourceCard
          key={index}
          resource={entry.resource}
          index={index}
          editable={editable}
          onChange={
            editable ? updatedResource => updateResource(index, updatedResource) : undefined
          }
        />
      ))}

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

export default FHIRRecord;
