import React from 'react';
import { FHIRResourceCardProps, HealthRecordProps } from '@/features/ViewEditRecord/components/ui/HealthRecord.types'

// Recursive field renderer that handles nested objects and arrays
const FHIRField = ({ label, value, depth = 0 }: { label: string; value: any; depth?: number }) => {
  if (value === null || value === undefined) return null;

  const renderNestedContent = (content: any, currentDepth: number) => {
    if (content === null || content === undefined) {
      return <span className="text-sm text-gray-500 italic">N/A</span>;
    }
    
    if (Array.isArray(content)) {
      if (content.length === 0) {
        return <span className="text-sm text-gray-500 italic">Empty array</span>;
      }
      
      // FLATTEN: If array has only 1 item and it's an object, render the object directly
      if (content.length === 1 && typeof content[0] === 'object' && content[0] !== null) {
        return renderNestedContent(content[0], currentDepth);
      }
      
      return (
        <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2 w-full">
          <div>
            {content.map((item, index) => (
              <div key={index} className="text-right">
                {renderNestedContent(item, currentDepth + 1)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    if (typeof content === 'object') {
      const entries = Object.entries(content);
      if (entries.length === 0) {
        return <span className="text-sm text-gray-500 italic">Empty object</span>;
      }
      
      return (
        <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2 w-full">
          <div className="">
            {entries.map(([key, val]) => (
              <FHIRField 
                key={key} 
                label={key} 
                value={val} 
                depth={currentDepth + 1}
              />
            ))}
          </div>
        </div>
      );
    }
    
    // Primitive values (string, number, boolean)
    return (
      <span className="text-sm text-gray-900">
        {String(content)}
      </span>
    );
  };

  // Check if content will render as a nested box (array or object)
  const willRenderAsBox = (content: any) => {
    if (content === null || content === undefined) return false;
    
    if (Array.isArray(content)) {
      if (content.length === 0) return false;
      // Check if it will flatten to an object
      if (content.length === 1 && typeof content[0] === 'object' && content[0] !== null) {
        return willRenderAsBox(content[0]);
      }
      return true; // Multi-item arrays render as boxes
    }
    
    if (typeof content === 'object') {
      const entries = Object.entries(content);
      return entries.length > 0; // Non-empty objects render as boxes
    }
    
    return false; // Primitive values don't render as boxes
  };

  const shouldStackVertically = willRenderAsBox(value);

  return (
    <div className="py-1">
      {shouldStackVertically ? (
        // Vertical layout for nested content
        <div>
          <span className="text-sm text-left font-medium text-gray-600 capitalize block mb-2">
            {label.replace(/([A-Z])/g, ' $1').trim()}:
          </span>
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
          <div className="ml-4 flex-1 min-w-0 text-right">
            {renderNestedContent(value, depth)}
          </div>
        </div>
      )}
    </div>
  );
};

// FHIR Resource Card Component
const FHIRResourceCard: React.FC<FHIRResourceCardProps> = ({ resource, index }) => {
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

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">
            {resource.resourceType}
          </h4>
        </div>
        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
          Resource {index + 1}
        </span>
      </div>

      {/* Render fields with nested support */}
      <div className="border-t pt-4">
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

// Main Health Record Component
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