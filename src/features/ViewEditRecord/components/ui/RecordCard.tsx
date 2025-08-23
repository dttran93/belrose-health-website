import React from 'react';
import { 
  Calendar, 
  Edit, 
  Eye,
  User,
  Hospital,
  Ellipsis, 
  BriefcaseMedical
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FileObject } from '@/types/core';
import HealthRecordMenu from '@/features/ViewEditRecord/components/ui/RecordMenu'

interface HealthRecordCardProps {
  record: FileObject;
  onView?: (record: FileObject) => void;
  onEdit?: (record: FileObject) => void;
  onDownload?: (record: FileObject) => void;
  onShare?: (record: FileObject) => void;
  onDelete?: (record: FileObject) => void;
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

const getFileExtension = (fileName?: string): string => {
  if (!fileName) return 'Unknown';
  const extension = fileName.split('.').pop()?.toUpperCase();
  return extension || 'Unknown';
};

// Main HealthRecordCard component
export const HealthRecordCard: React.FC<HealthRecordCardProps> = ({
  record,
  onView,
  onEdit,
  className = '',
}) => {

  // Get the display name - your hook provides fileName
  const displayName = record.name || 'Unknown Document';
  
  return (
    <div className={`bg-background rounded-lg shadow-sm border border-border/20 hover:shadow-md transition-shadow ${className}`}>
      <div className="p-6">
        {/* Header with document type badge and menu and verification status */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getDocumentTypeColor(record.documentType)}`}>
              {record.belroseFields?.visitType}
            </span>
            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded border">
              {getFileExtension(displayName)}
            </span>
          </div>
          <div className='flex'>
          <div className="bg-red-100 text-red-800 border-red-200 rounded-full text-xs px-2 py-1">
            Self-Reported
          </div>
          <HealthRecordMenu 
              record={record}
              triggerIcon={Ellipsis}
              showView={true}
              triggerClassName="mx-1 p-2 rounded-3xl hover:bg-gray-100"
           />
           </div>
        </div>

        {/* Document Name */}
        <h3 className="text-lg flex justify-start font-semibold text-gray-900 mb-2 line-clamp-2" title={displayName}>
          {record.belroseFields?.title}
        </h3>
        
        {/* Date Information */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
          <Calendar className="w-4 h-4" />
          <span>{record.belroseFields?.completedDate}</span>
        </div>

        {/* Provider/Institution Information */}
        <div className="flex gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <BriefcaseMedical className="w-4 h-4" />
            <span>{record.belroseFields?.provider}</span>
          </div>       
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Hospital className="w-4 h-4" />
            <span>{record.belroseFields?.institution || 'Institution not available'}</span>
          </div>
        </div>    

        {/* Patient Information */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <User className="w-4 h-4" />
            <span>{record.belroseFields?.patient}</span>
        </div>     

        {/* Summary */}
          <div className="mb-4">
            <p className="flex justify-start text-xs text-gray-500 uppercase tracking-wider mt-3 mb-2">Summary</p>
            <p className="flex justify-start text-left text-sm text-gray-700 line-clamp-2">
              {record.belroseFields?.summary}
            </p>
          </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="default"
            onClick={() => onView ? onView(record) : console.log('View:', displayName)}
            className="flex-1 px-4 py-2 flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            View
          </Button>
          <Button
            variant="outline"
            onClick={() => onEdit ? onEdit(record) : console.log('Edit:', displayName)}
            className="flex-1 px-4 py-2 flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HealthRecordCard;