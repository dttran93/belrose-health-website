import React, { useState } from 'react';
import { UserLock, ArrowLeft } from 'lucide-react';
import { FileObject } from '@/types/core';
import { Button } from '@/components/ui/Button';
import { OwnerManagement } from './OwnerManagement';
import AdminManagement from './AdministratorManagement';
import { ShareRecordView } from '@/features/Sharing/components/ShareRecordView';

interface PermissionsManagerProps {
  record: FileObject;
  onBack: () => void;
}

type PermissionViewMode = 'manager' | 'add-subject' | 'add-owner' | 'share';

export const PermissionsManager: React.FC<PermissionsManagerProps> = ({ record, onBack }) => {
  const [viewMode, setViewMode] = useState<PermissionViewMode>('manager');

  // handlers for navigating Permission Manager component
  const handleAddSubject = () => {
    setViewMode('add-subject');
  };

  const handleAddOwner = () => {
    setViewMode('add-owner');
  };

  const handleShareViewer = () => {
    setViewMode('share');
  };

  const handleManagerScreen = () => {
    setViewMode('manager');
  };

  return (
    <div className="w-full mx-auto p-6 space-y-6">
      {/* Page Header */}
      {viewMode === 'manager' && (
        <div className="flex items-center justify-between mb-4 pb-2 border-b">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <UserLock className="w-5 h-5" />
            Permissions
          </h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={onBack}
              className="w-8 h-8 border-none bg-transparent hover:bg-gray-200"
            >
              <ArrowLeft className="text-primary" />
            </Button>
          </div>
        </div>
      )}

      {/* Record Subject Section */}
      {(viewMode === 'manager' || viewMode === 'add-subject') && (
        <OwnerManagement
          record={record}
          onSuccess={() => {}}
          onBack={handleManagerScreen}
          onAddMode={handleAddSubject}
          isAddMode={viewMode === 'add-subject'}
        />
      )}

      {/* Owners Section */}
      {(viewMode === 'manager' || viewMode === 'add-owner') && (
        <AdminManagement
          record={record}
          currentAdmins={record.administrators}
          onBack={handleManagerScreen}
          onAddMode={handleAddOwner}
          isAddMode={viewMode === 'add-owner'}
        />
      )}

      {/* Viewers Section */}
      {(viewMode === 'manager' || viewMode === 'share') && (
        <ShareRecordView
          record={record}
          onBack={handleManagerScreen}
          onAddMode={handleShareViewer}
          isAddMode={viewMode === 'share'}
        />
      )}
    </div>
  );
};

export default PermissionsManager;
