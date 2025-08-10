// pages/EditFhir.jsx - Main page for FHIR editing
import React, { useState } from 'react';
import { useFhirRecordsList } from '@/features/ViewEditRecord/hooks/useFHIREditor';
import { useAuthContext } from '../components/auth/AuthContext'; // Your existing auth
import FhirEditor from '@/features/ViewEditRecord/components/FhirEditor';

const EditFhir = () => {
  const { user } = useAuthContext();
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  
  const { records, loading, error } = useFhirRecordsList(user?.uid);

  // If a record is selected, show the editor
  if (selectedRecordId) {
    return (
      <FhirEditor 
        fileId={selectedRecordId}
        onClose={() => setSelectedRecordId(null)}
      />
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600">Please log in to edit your FHIR records.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your FHIR records...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-red-800 font-medium mb-2">Error Loading Records</h3>
          <p className="text-red-600 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Edit FHIR Records</h1>
          </div>
        </header>

        {/* Empty State */}
        <main className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center">
            <div className="text-6xl mb-6">📄</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">
              No FHIR Records Found
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              You don't have any FHIR records yet. Upload some medical documents first to create FHIR records that you can edit.
            </p>
            <a 
              href="/add-record" 
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              📤 Upload Medical Documents
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit FHIR Records</h1>
              <p className="text-gray-600 mt-1">Select a record to view and edit its FHIR data</p>
            </div>
            <a 
              href="/add-record"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Upload More
            </a>
          </div>
        </div>
      </header>

      {/* Records Grid */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {records.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
              onSelect={() => setSelectedRecordId(record.id)}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

// Individual record card component
const RecordCard = ({ record, onSelect }) => {
  const { fileName, resourceType, createdAt, lastEditedAt, hasBeenEdited } = record;
  
  // Format date helper
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    // Handle Firestore timestamps or regular dates
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get resource type icon
  const getResourceIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'patient': return '👤';
      case 'observation': return '🔬';
      case 'condition': return '🩺';
      case 'medication': return '💊';
      case 'bundle': return '📦';
      default: return '📄';
    }
  };

  return (
    <div 
      className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all duration-200"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate mb-1">
            {fileName || 'Untitled Document'}
          </h3>
          <div className="flex items-center text-sm text-gray-500">
            <span className="mr-2">{getResourceIcon(resourceType)}</span>
            <span>{resourceType || 'Unknown Type'}</span>
          </div>
        </div>
      </div>
      
      <div className="space-y-2 text-xs text-gray-400 mb-4">
        <div className="flex items-center justify-between">
          <span>Created:</span>
          <span>{formatDate(createdAt)}</span>
        </div>
        {hasBeenEdited && lastEditedAt && (
          <div className="flex items-center justify-between text-blue-600">
            <span>✏️ Edited:</span>
            <span>{formatDate(lastEditedAt)}</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center space-x-2">
          {hasBeenEdited && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
              ✏️ Modified
            </span>
          )}
        </div>
        <span className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          Edit →
        </span>
      </div>
    </div>
  );
};

export default EditFhir;