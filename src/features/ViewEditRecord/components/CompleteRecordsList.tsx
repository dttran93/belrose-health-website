// src/features/ViewEditRecord/components/PatientRecordsList.tsx
import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  Upload, 
  FileText,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { HealthRecordCard, HealthRecord } from './ui/HealthRecordCard';
import { useFhirRecordsList } from '@/features/ViewEditRecord/hooks/useFHIREditor';
import { useAuthContext } from '@/components/auth/AuthContext';

interface PatientRecordsListProps {
  onViewRecord?: (record: HealthRecord) => void;
  onEditRecord?: (record: HealthRecord) => void;
  onDownloadRecord?: (record: HealthRecord) => void;
  onShareRecord?: (record: HealthRecord) => void;
  onDeleteRecord?: (record: HealthRecord) => void;
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
  const { records, loading, error } = useFhirRecordsList(user?.uid);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter and search records
  const filteredRecords = records.filter(record => {
    const fileName = record.fileName || '';
    const matchesSearch = fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (record.documentType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (record.resourceType || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || 
                         record.documentType === filterType || 
                         record.resourceType === filterType;
    
    return matchesSearch && matchesFilter;
  });

  // Sort records by date (newest first)
  const sortedRecords = filteredRecords.sort((a, b) => {
    const dateA = a.createdAt;
    const dateB = b.createdAt;
    
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    
    // Handle Firestore timestamps
    const getTime = (timestamp: any) => {
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().getTime();
      }
      return new Date(timestamp).getTime();
    };
    
    return getTime(dateB) - getTime(dateA);
  });

  // Get unique document types for filter dropdown
  const documentTypes = Array.from(
    new Set([
      ...records.map(record => record.documentType).filter(Boolean),
      ...records.map(record => record.resourceType).filter(Boolean)
    ])
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
              <h3 className="text-red-800 font-medium mb-2">Error Loading Records</h3>
              <p className="text-red-600 text-sm">{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authentication required
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600">Please log in to view your health records.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Health Records</h1>
              <p className="text-gray-600 mt-1">
                {records.length} record{records.length !== 1 ? 's' : ''} in your account
              </p>
            </div>
            {onAddNewRecord && (
              <button 
                onClick={onAddNewRecord}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Add New Record
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Filters and View Controls */}
            <div className="flex items-center gap-4">
              {/* Filter by document type */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                {documentTypes.map(type => (
                  <option key={type} value={type}>
                    {type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
                  title="Grid View"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-gray-600">
            Showing {filteredRecords.length} of {records.length} records
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        </div>

        {/* Records Display */}
        {sortedRecords.length === 0 ? (
          // Empty State
          <div className="text-center py-12">
            {records.length === 0 ? (
              // No records at all
              <>
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Health Records Yet</h3>
                <p className="text-gray-500 mb-6">Upload your first medical document to get started</p>
                {onAddNewRecord && (
                  <button 
                    onClick={onAddNewRecord}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Upload First Record
                  </button>
                )}
              </>
            ) : (
              // No records match filter/search
              <>
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Records Found</h3>
                <p className="text-gray-500">Try adjusting your search or filter criteria</p>
              </>
            )}
          </div>
        ) : (
          // Records Grid/List
          <div className={
            viewMode === 'grid' 
              ? 'grid gap-6 md:grid-cols-2 lg:grid-cols-3' 
              : 'space-y-4'
          }>
            {sortedRecords.map((record) => (
              <HealthRecordCard
                key={record.id}
                record={record}
                onView={onViewRecord}
                onEdit={onEditRecord}
                onDownload={onDownloadRecord}
                onShare={onShareRecord}
                onDelete={onDeleteRecord}
                className={viewMode === 'list' ? 'max-w-none' : ''}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientRecordsList;