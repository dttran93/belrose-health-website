// components/FhirEditor.js - Pure editing component
import React, { useState, useCallback } from 'react';
import { useFhirEditor, useFhirEditSaver } from '@/features/ViewEditRecord/hooks/useFHIREditor';
import { useAuthContext } from '@/components/auth/AuthContext';

const FhirEditor = ({ fileId, onClose }) => {
  const { user } = useAuthContext();
  const [autoSave, setAutoSave] = useState(true);
  const [lastSaveTime, setLastSaveTime] = useState(null);

  // Read FHIR data from existing Firestore document
  const { 
    fhirData, 
    originalFhir, 
    loading, 
    error: loadError, 
    hasChanges 
  } = useFhirEditor(user?.uid, fileId);

  // Save edits back to existing document
  const { saveFhirEdits, saving, error: saveError } = useFhirEditSaver();

  // Handle field updates
  const updateFhirField = useCallback(async (fieldPath, newValue) => {
    if (!fhirData || !user?.uid) return;

    // Create updated FHIR object
    const updatedFhir = { ...fhirData };
    setNestedValue(updatedFhir, fieldPath, newValue);

    // Auto-save if enabled
    if (autoSave) {
      try {
        await saveFhirEdits(user.uid, fileId, updatedFhir, `Updated ${fieldPath}`);
        setLastSaveTime(new Date());
      } catch (err) {
        console.error('Failed to save edit:', err);
      }
    }
  }, [fhirData, user?.uid, fileId, saveFhirEdits, autoSave]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Loading FHIR data...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Error Loading FHIR Data</h3>
        <p className="text-red-600 text-sm mt-1">{loadError.message}</p>
        <button 
          onClick={onClose}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm"
        >
          Back to List
        </button>
      </div>
    );
  }

  if (!fhirData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">No FHIR data found for this record</p>
        <button 
          onClick={onClose}
          className="mt-2 px-3 py-1 bg-yellow-600 text-white rounded text-sm"
        >
          Back to List
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Edit FHIR {fhirData.resourceType}
            </h2>
            <div className="flex items-center mt-2 space-x-4">
              <StatusIndicator 
                hasChanges={hasChanges}
                saving={saving}
                lastSaveTime={lastSaveTime}
              />
              {saveError && (
                <span className="text-red-600 text-sm">
                  Save failed: {saveError.message}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Auto-save</span>
            </label>
            
            <button
              onClick={onClose}
              className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Form Fields */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <FhirFieldRenderer
          fhirData={fhirData}
          onFieldUpdate={updateFhirField}
          disabled={saving}
        />
      </div>
    </div>
  );
};

// Status indicator component
const StatusIndicator = ({ hasChanges, saving, lastSaveTime }) => {
  if (saving) {
    return (
      <div className="flex items-center text-blue-600">
        <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 mr-2"></div>
        <span className="text-sm">Saving...</span>
      </div>
    );
  }

  if (hasChanges) {
    return (
      <div className="flex items-center text-amber-600">
        <div className="w-2 h-2 bg-amber-500 rounded-full mr-2"></div>
        <span className="text-sm">Unsaved changes</span>
      </div>
    );
  }

  return (
    <div className="flex items-center text-green-600">
      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
      <span className="text-sm">
        {lastSaveTime ? `Saved at ${lastSaveTime.toLocaleTimeString()}` : 'All changes saved'}
      </span>
    </div>
  );
};

// Simple field renderer (you can reuse your existing DynamicFHIRField components)
const FhirFieldRenderer = ({ fhirData, onFieldUpdate, disabled }) => {
  const renderField = (key, value, path = '') => {
    const fieldPath = path ? `${path}.${key}` : key;

    // Skip meta fields and complex objects for now
    if (key.startsWith('_') || typeof value === 'object') {
      return null;
    }

    return (
      <div key={fieldPath} className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {formatFieldLabel(key)}
        </label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onFieldUpdate?.(fieldPath, e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {Object.entries(fhirData).map(([key, value]) => 
        renderField(key, value)
      )}
    </div>
  );
};

// Utilities
const setNestedValue = (obj, path, value) => {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
};

const formatFieldLabel = (fieldName) => {
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

export default FhirEditor;