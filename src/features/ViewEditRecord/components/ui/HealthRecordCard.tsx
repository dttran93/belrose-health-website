// src/features/ViewEditRecord/components/ui/HealthRecordCard.tsx
import React from 'react';
import { 
  Calendar, 
  FileText, 
  User, 
  Building, 
  Clock, 
  Edit, 
  Eye, 
  AlertCircle, 
  CheckCircle,
  MoreVertical,
  Download,
  Share,
  Trash2
} from 'lucide-react';

// Interface that matches your useFhirRecordsList hook return type
export interface HealthRecord {
  id: string;
  fileName: string; // This comes from your hook
  resourceType: string; // This comes from your hook
  createdAt: any; // Firestore timestamp
  lastEditedAt?: any; // Firestore timestamp
  hasBeenEdited: boolean; // This comes from your hook (editedByUser)
  // Optional fields that might be in your full Firestore document
  name?: string;
  documentType?: string;
  status?: string;
  uploadedAt?: any;
  editedByUser?: boolean;
  extractedText?: string;
  fhirData?: any;
  _metadata?: {
    fileName?: string;
    fileId?: string;
    userId?: string;
  };
}

interface HealthRecordCardProps {
  record: HealthRecord;
  onView?: (record: HealthRecord) => void;
  onEdit?: (record: HealthRecord) => void;
  onDownload?: (record: HealthRecord) => void;
  onShare?: (record: HealthRecord) => void;
  onDelete?: (record: HealthRecord) => void;
  className?: string;
  showActions?: boolean;
  showMenu?: boolean;
}

// Helper functions
const formatDate = (timestamp: any): string => {
  if (!timestamp) return 'Unknown Date';
  
  // Handle Firestore timestamps
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
  
  // Handle regular dates
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const getDocumentTypeColor = (type?: string): string => {
  const colors: Record<string, string> = {
    emergency_visit: 'bg-red-100 text-red-800 border-red-200',
    routine_checkup: 'bg-green-100 text-green-800 border-green-200',
    lab_results: 'bg-blue-100 text-blue-800 border-blue-200',
    specialist_consult: 'bg-purple-100 text-purple-800 border-purple-200',
    medical_record: 'bg-blue-100 text-blue-800 border-blue-200',
    vision_prescription: 'bg-orange-100 text-orange-800 border-orange-200'
  };
  return colors[type || 'medical_record'] || 'bg-gray-100 text-gray-800 border-gray-200';
};

const formatDocumentType = (type?: string): string => {
  if (!type) return 'Medical Record';
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getStatusColor = (status?: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-500';
    case 'processing': return 'bg-yellow-500';
    case 'error': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

const getFileExtension = (fileName?: string): string => {
  if (!fileName) return 'Unknown';
  const extension = fileName.split('.').pop()?.toUpperCase();
  return extension || 'Unknown';
};

// Dropdown menu component
const CardMenu: React.FC<{
  record: HealthRecord;
  onDownload?: (record: HealthRecord) => void;
  onShare?: (record: HealthRecord) => void;
  onDelete?: (record: HealthRecord) => void;
}> = ({ record, onDownload, onShare, onDelete }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]">
            {onDownload && (
              <button
                onClick={() => {
                  onDownload(record);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            )}
            {onShare && (
              <button
                onClick={() => {
                  onShare(record);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Share className="w-4 h-4" />
                Share
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  onDelete(record);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Main HealthRecordCard component
export const HealthRecordCard: React.FC<HealthRecordCardProps> = ({
  record,
  onView,
  onEdit,
  onDownload,
  onShare,
  onDelete,
  className = '',
  showActions = true, // Changed default to true
  showMenu = true
}) => {
  // Get the display name - your hook provides fileName
  const displayName = record.fileName || 'Unknown Document';
  
  // Get the creation date - your hook provides createdAt
  const createdAt = record.createdAt;
  
  // Check if edited - your hook provides hasBeenEdited
  const hasBeenEdited = record.hasBeenEdited || !!record.lastEditedAt;

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${className}`}>
      <div className="p-6">
        {/* Header with document type badge and menu */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getDocumentTypeColor(record.documentType)}`}>
              {formatDocumentType(record.documentType)}
            </span>
            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded border">
              {getFileExtension(displayName)}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Edit indicator */}
            {hasBeenEdited && (
              <div className="text-blue-500" title="Record has been edited">
                <Edit className="w-4 h-4" />
              </div>
            )}
            
            {/* FHIR data indicator */}
            {record.fhirData && (
              <div className="text-green-500" title="FHIR data available">
                <CheckCircle className="w-4 h-4" />
              </div>
            )}
            
            {/* Menu dropdown */}
            {showMenu && (onDownload || onShare || onDelete) && (
              <CardMenu 
                record={record}
                onDownload={onDownload}
                onShare={onShare}
                onDelete={onDelete}
              />
            )}
          </div>
        </div>

        {/* Document Name */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2" title={displayName}>
          {displayName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')}
        </h3>
        
        {/* Date Information */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <Calendar className="w-4 h-4" />
          <span>Uploaded: {formatDate(createdAt)}</span>
        </div>

        {/* Status and Metadata */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${getStatusColor(record.status)}`}></span>
              <span className="text-gray-600 capitalize">{record.status || 'completed'}</span>
            </div>
            
            {record.lastEditedAt && (
              <div className="flex items-center gap-1 text-gray-500">
                <Clock className="w-3 h-3" />
                <span className="text-xs">Edited {formatDate(record.lastEditedAt)}</span>
              </div>
            )}
          </div>

          {/* FHIR Resource Count */}
          {record.fhirData?.entry && (
            <div className="text-xs text-gray-500">
              {record.fhirData.entry.length} FHIR resource{record.fhirData.entry.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Extracted Text Preview */}
        {record.extractedText && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Extracted Text</p>
            <p className="text-sm text-gray-700 line-clamp-2" title={record.extractedText}>
              {record.extractedText}
            </p>
          </div>
        )}

        {/* Action Buttons - Always show View/Edit */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onView ? onView(record) : console.log('View:', displayName)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm"
          >
            <Eye className="w-4 h-4" />
            View
          </button>
          <button
            onClick={() => onEdit ? onEdit(record) : console.log('Edit:', displayName)}
            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>
    </div>
  );
};

export default HealthRecordCard;