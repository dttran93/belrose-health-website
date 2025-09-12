import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import useFileManager from '@/features/AddRecord/hooks/useFileManager';
import { 
  Search, 
  Filter, 
  Upload, 
  FileText,
  Loader2,
  AlertCircle,
  List,
  Eye,
  ArrowLeft
} from 'lucide-react';
import { HealthRecordCard } from '@/features/ViewEditRecord/components/ui/RecordCard';
import HealthRecordFull from '@/features/ViewEditRecord/components/RecordFull';
import { useCompleteRecords } from '@/features/ViewEditRecord/hooks/useAllUserRecords';
import { useAuthContext } from '@/components/auth/AuthContext';
import { FileObject } from '@/types/core';

interface PatientRecordsListProps {
  onViewRecord?: (record: FileObject) => void;
  onEditRecord?: (record: FileObject) => void;
  onDownloadRecord?: (record: FileObject) => void;
  onShareRecord?: (record: FileObject) => void;
  onDeleteRecord?: (record: FileObject) => void;
  onAddNewRecord?: () => void;
}

export const PatientRecordsList: React.FC<PatientRecordsListProps> = ({
  onViewRecord,
  onEditRecord,
  onDownloadRecord,
  onShareRecord,
  onDeleteRecord,
  onAddNewRecord
}) => {
  const { user } = useAuthContext();
  const { records, loading, error } = useCompleteRecords(user?.uid);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');
  const [selectedRecord, setSelectedRecord] = useState<FileObject | null>(null);
  const [editMode, setEditMode] = useState(false);

  const { updateFirestoreRecord, deleteFileFromFirebase } = useFileManager();

  const handleEditRecord = (record: FileObject) => {
    setSelectedRecord(record);
    setViewMode('detailed');
    setEditMode(true);

    if(onEditRecord) {
      onEditRecord(record);
    }
  }
  useEffect(() => {
    if (selectedRecord && selectedRecord.id) {
      const updatedRecord = records.find(r => r.id === selectedRecord.id);
      if(updatedRecord) {
        setSelectedRecord(updatedRecord);
      }
    }
  }, [records, selectedRecord]);

  const handleSaveRecord = async (updatedRecord: FileObject) => {
    try {
      if(!updatedRecord.id) {
        throw new Error('Cannot save record - no document ID found')
      }

      //Update the record in Firestore with both FHIR data and belroseFields
      await updateFirestoreRecord(updatedRecord.id, {
        fhirData: updatedRecord.fhirData,
        belroseFields: updatedRecord.belroseFields,
        lastModified: new Date().toISOString()
      });

      console.log('Record saved successfully');
      toast.success(`💾 Record saved for ${updatedRecord.belroseFields?.title}`, {
        description: 'Record updates saved to cloud storage',
        duration: 4000,
      }) 

      } catch (error) {
        console.error('Failed to save record: ', error);
        toast.error(`Failed to save ${updatedRecord.belroseFields?.title}`, {
          description: error instanceof Error ? error.message : 'Unknown error occurred',
          duration: 4000,
        })
      }
    }

  //Handle Delete record
  const handleDeleteRecord = async (record: FileObject) => {
    if (!confirm(`Are you sure you want to delete "${record.belroseFields?.title}"? This cannot be undone.`)) {
      return;
    }  
    
    try {
        if(!record.id) {
          throw new Error('Cannot save record - no document ID found')
        }

        await deleteFileFromFirebase(record.id);
        console.log('Record deleted successfully');
        toast.success(`💾 Deleted for ${record.belroseFields?.title}`, {
          description: 'Entry deleted from record',
          duration: 4000,
        })
        setViewMode('summary');
        setEditMode(false); 
      } catch (error) {
        console.error('Failed to delete record: ', error);
        toast.error(`Failed to delete ${record.belroseFields?.title}`, {
          description: error instanceof Error ? error.message : 'Unknown error occurred',
          duration: 4000,
      })}
    };

  // Handle view record - switch to detailed view
  const handleViewRecord = (record: FileObject) => {
    setSelectedRecord(record);
    setViewMode('detailed');
    
    // Call the original onViewRecord if provided (for any external logic)
    if (onViewRecord) {
      onViewRecord(record);
    }
  };

  // Handle back to summary
  const handleBackToSummary = () => {
    setViewMode('summary');
    setSelectedRecord(null);
  };

  // Filter and search records
  const filteredRecords = records.filter(record => {
    const fileName = record.name || '';
    const matchesSearch = fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (record.sourceType || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || 
                         record.sourceType === filterType;
    
    return matchesSearch && matchesFilter;
  });

  // Sort records by date (newest first)
  const sortedRecords = filteredRecords.sort((a, b) => {
    const dateA = a.lastModified;
    const dateB = b.lastModified;
    
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    
    return dateB - dateA;
  });

  // Get unique document types for filter dropdown
  const sourceTypes = Array.from(
    new Set(records.map(record => record.sourceType).filter(Boolean))
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading your health records...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Records</h3>
              <p className="text-red-600 text-sm mt-1">{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (records.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="text-6xl mb-6">📄</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            No Health Records Found
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Start building your comprehensive health record by uploading your medical documents.
          </p>
          <button
            onClick={onAddNewRecord}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-5 h-5 mr-2" />
            Upload Your First Record
          </button>
        </div>
      </div>
    );
  }

  // If we're in detailed view, show the full record component
  if (viewMode === 'detailed' && selectedRecord) {
    return (
      <HealthRecordFull 
        record={selectedRecord}
        onBack={() => {handleBackToSummary(); setEditMode(false);}}
        onEdit={onEditRecord}
        onDownload={onDownloadRecord}
        onShare={onShareRecord}
        onDelete={handleDeleteRecord}
        onSave={handleSaveRecord}
        initialEditMode={editMode}
      />
    );
  }

  // Summary view (list of cards)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Your Health Records</h1>
              <p className="text-gray-600 mt-1">
                {records.length} record{records.length !== 1 ? 's' : ''} in your comprehensive health record
              </p>
            </div>
            <button
              onClick={onAddNewRecord}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4 mr-2" />
              Add Record
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-4 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-background border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-background border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            {sourceTypes.map(type => (
              <option key={type} value={type}>
                {(type || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        {/* Results Summary */}
        <div className="mt-4">
          <p className="text-gray-600">
            Showing {filteredRecords.length} of {records.length} records
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        </div>
      </div>

      {/* Records List */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {sortedRecords.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No records match your search criteria.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedRecords.map((record) => (
              <HealthRecordCard
                key={record.id}
                record={record}
                onView={handleViewRecord}
                onEdit={handleEditRecord}
                onDelete={handleDeleteRecord}
                className="max-w-none" // Full width for list view
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientRecordsList;