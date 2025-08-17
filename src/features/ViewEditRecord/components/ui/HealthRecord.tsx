import React from 'react';
import { FHIRResourceCardProps, HealthRecordProps } from '@/features/ViewEditRecord/components/ui/HealthRecord.types'

// Helper function to render field values
const renderFieldValue = (value: any): string => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(item => renderFieldValue(item)).join(', ');
    }
    return JSON.stringify(value);
  }
  return String(value);
};

// Generic field renderer
const FHIRField = ({ label, value }: { label: string; value: any }) => {
  if (value === null || value === undefined) return null;
  
  return (
    <div className="flex justify-between items-start py-1">
      <span className="text-sm font-medium text-gray-600 capitalize">
        {label.replace(/([A-Z])/g, ' $1').trim()}:
      </span>
      <span className="text-sm text-gray-900 text-right max-w-xs">
        {renderFieldValue(value)}
      </span>
    </div>
  );
};

// Generic FHIR Resource Card Component
const FHIRResourceCard: React.FC<FHIRResourceCardProps> = ({ resource, index }) => {
  // Extract key fields to display (you can customize this per resource type)
  const getDisplayFields = (resource: any) => {
    const fields: { [key: string]: any } = {};
    
    // Get all top-level fields except metadata
    Object.keys(resource).forEach(key => {
        fields[key] = resource[key];
    });
    
    return fields;
  };

  const displayFields = getDisplayFields(resource);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">
            {resource.resourceType}
          </h4>
          {resource.id && (
            <p className="text-sm text-gray-600">ID: {resource.id}</p>
          )}
        </div>
        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
          Resource {index + 1}
        </span>
      </div>

      {/* Render fields */}
      <div className="space-y-2 border-t pt-4">
        {Object.entries(displayFields).map(([key, value]) => (
          <FHIRField key={key} label={key} value={value} />
        ))}
      </div>

      {/* Show if no displayable fields */}
      {Object.keys(displayFields).length === 0 && (
        <p className="text-sm text-gray-500 italic border-t pt-4">
          No displayable fields found
        </p>
      )}
    </div>
  );
};

// Main FHIR Cards Display Component
const HealthRecord: React.FC<HealthRecordProps> = ({ fhirData, className }) => {
  if (!fhirData || !fhirData.entry) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">No FHIR data available for this record.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Individual resource cards */}
      <div className="space-y-4">
        {fhirData.entry.map((entry, index) => (
          <FHIRResourceCard 
            key={index} 
            resource={entry.resource} 
            index={index}
          />
        ))}
      </div>
      
      {/* Complete bundle JSON for testing */}
      <details className="bg-gray-100 rounded-lg">
        <summary className="p-4 cursor-pointer font-medium text-gray-700 hover:text-gray-900">
          View Complete Bundle JSON
        </summary>
        <div className="px-4 pb-4">
          <pre className="text-sm text-gray-800 overflow-x-auto whitespace-pre-wrap bg-white p-4 rounded border max-h-96 overflow-y-auto">
            {JSON.stringify(fhirData, null, 2)}
          </pre>
        </div>
      </details>
    </div>
  );
};

export default HealthRecord;