// src/features/ViewEditRecord/components/RecordsList.tsx

import React from 'react';
import { FileText } from 'lucide-react';
import { HealthRecordCard } from '@/features/ViewEditRecord/components/View/RecordCard';
import { FileObject } from '@/types/core';

interface RecordsListProps {
  records: FileObject[];

  // Action handlers
  onView: (record: FileObject) => void;
  onEdit: (record: FileObject) => void;
  onVersions: (record: FileObject) => void;
  onSubject: (record: FileObject) => void;
  onAccess: (record: FileObject) => void;
  onCredibility: (record: FileObject) => void;
  onPermissions: (record: FileObject) => void;
  onDelete?: (record: FileObject) => void;
  onCopy: (record: FileObject) => void;
  onDownload: (record: FileObject) => void;
}

export const RecordsList: React.FC<RecordsListProps> = ({ records, ...handlers }) => {
  if (records.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No records match your search criteria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {records.map(record => (
        <HealthRecordCard
          key={record.id}
          record={record}
          onView={handlers.onView}
          onEdit={handlers.onEdit}
          onVersions={handlers.onVersions}
          onSubject={handlers.onSubject}
          onAccess={handlers.onAccess}
          onCredibility={handlers.onCredibility}
          onPermissions={handlers.onPermissions}
          onDelete={handlers.onDelete}
          onCopy={handlers.onCopy}
          onDownload={handlers.onDownload}
          className="max-w-none"
        />
      ))}
    </div>
  );
};

export default RecordsList;
