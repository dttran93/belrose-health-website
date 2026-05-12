import React, { useState } from 'react';
import { UserLock, ArrowLeft } from 'lucide-react';
import { FileObject } from '@/types/core';
import { Button } from '@/components/ui/Button';
import { OwnerManagement } from './OwnerManagement';
import AdminManagement from './AdministratorManagement';
import ViewerManagement from './ViewerManagement';
import { useRecordTrustees } from '@/features/Trustee/hooks/useRecordTrustees';

interface PermissionsManagerProps {
  record: FileObject;
  onBack: () => void;
}

type PermissionViewMode = 'manager' | 'add-subject' | 'add-owner' | 'add-viewer';

export const PermissionsManager: React.FC<PermissionsManagerProps> = ({ record, onBack }) => {
  const [viewMode, setViewMode] = useState<PermissionViewMode>('manager');

  // Collect all direct-role userIds so the hook knows who the trustors could be
  const allRecordUserIds = [
    ...(record.owners ?? []),
    ...(record.administrators ?? []),
    ...(record.viewers ?? []),
  ];

  // Fetch trustee data once at this level — passed down as props to each section
  const { trusteeMap, trustorMap } = useRecordTrustees(allRecordUserIds, record.trustees ?? []);

  const handleManagerScreen = () => setViewMode('manager');

  return (
    <div className="w-full mx-auto p-8 space-y-6">
      {/* Page Header */}
      {viewMode === 'manager' && (
        <div className="flex items-center justify-between mb-4 pb-2 border-b">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <UserLock className="w-5 h-5" />
            Permissions
          </h3>
          <Button onClick={onBack} className="w-8 h-8 border-none bg-transparent hover:bg-gray-200">
            <ArrowLeft className="text-primary" />
          </Button>
        </div>
      )}

      {/* Owners Section */}
      {(viewMode === 'manager' || viewMode === 'add-subject') && (
        <OwnerManagement
          record={record}
          currentOwners={record.owners}
          onSuccess={() => {}}
          onBack={handleManagerScreen}
          onAddMode={() => setViewMode('add-subject')}
          isAddMode={viewMode === 'add-subject'}
          trusteeMap={trusteeMap}
          trustorMap={trustorMap}
        />
      )}

      {/* Administrators Section */}
      {(viewMode === 'manager' || viewMode === 'add-owner') && (
        <AdminManagement
          record={record}
          currentAdmins={record.administrators}
          onBack={handleManagerScreen}
          onAddMode={() => setViewMode('add-owner')}
          isAddMode={viewMode === 'add-owner'}
          trusteeMap={trusteeMap}
          trustorMap={trustorMap}
        />
      )}

      {/* Viewers Section */}
      {(viewMode === 'manager' || viewMode === 'add-viewer') && (
        <ViewerManagement
          record={record}
          currentViewers={record.viewers}
          onBack={handleManagerScreen}
          onAddMode={() => setViewMode('add-viewer')}
          isAddMode={viewMode === 'add-viewer'}
          trusteeMap={trusteeMap}
          trustorMap={trustorMap}
        />
      )}
    </div>
  );
};

export default PermissionsManager;
