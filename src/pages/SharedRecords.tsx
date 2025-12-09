// src/pages/SharedRecords.tsx

import React, { useEffect, useState } from 'react';
import { Share2, Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useSharing } from '@/features/Sharing/hooks/useSharing';
import { AccessPermissionData, SharingService } from '@/features/Sharing/services/sharingService';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

export const SharedRecords: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shared-by-me' | 'shared-with-me'>('shared-by-me');
  const [sharedByMe, setSharedByMe] = useState<AccessPermissionData[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<AccessPermissionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { getSharedRecords, getRecordsSharedWithMe, revokeAccess, isRevoking } = useSharing();

  // Load shared records
  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const [byMe, withMe] = await Promise.all([getSharedRecords(), getRecordsSharedWithMe()]);
      setSharedByMe(byMe);
      setSharedWithMe(withMe);
    } catch (error) {
      console.error('Failed to load shared records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async (recordId: string, receiverId: string) => {
    if (!confirm('Are you sure you want to revoke access to this record?')) {
      return;
    }

    try {
      await revokeAccess(recordId, receiverId);
      // Reload records after revocation
      await loadRecords();
    } catch (error) {
      console.error('Failed to revoke access:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Share2 className="w-8 h-8 text-primary" />
            Shared Records
          </h1>
          <p className="text-gray-600 mt-2">
            Manage records you've shared and view records shared with you
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('shared-by-me')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'shared-by-me'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Users className="w-5 h-5" />
                <span>Shared by Me</span>
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-sm">
                  {sharedByMe.length}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('shared-with-me')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'shared-with-me'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Share2 className="w-5 h-5" />
                <span>Shared with Me</span>
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-sm">
                  {sharedWithMe.length}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-gray-600">Loading shared records...</p>
          </div>
        ) : activeTab === 'shared-by-me' ? (
          <SharedByMeList records={sharedByMe} onRevoke={handleRevoke} isRevoking={isRevoking} />
        ) : (
          <SharedWithMeList records={sharedWithMe} />
        )}
      </div>
    </div>
  );
};

// Component for records shared by current user
const SharedByMeList: React.FC<{
  records: AccessPermissionData[];
  onRevoke: (recordId: string, receiverId: string) => void;
  isRevoking: boolean;
}> = ({ records, onRevoke, isRevoking }) => {
  if (records.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <Share2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No shared records yet</h3>
        <p className="text-gray-600">
          Share your health records with family, doctors, or researchers
        </p>
      </div>
    );
  }

  // Group records by recordId
  const groupedRecords = records.reduce(
    (acc, record) => {
      const existing = acc[record.recordId];
      if (existing) {
        existing.push(record);
      } else {
        acc[record.recordId] = [record];
      }
      return acc;
    },
    {} as Record<string, AccessPermissionData[]>
  );

  return (
    <div className="space-y-4">
      {Object.entries(groupedRecords).map(([recordId, sharedWithList]) => (
        <div key={recordId} className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Record Header */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Record: {recordId}</h3>
            <p className="text-sm text-gray-600 mt-1">
              Shared with {sharedWithList.length}{' '}
              {sharedWithList.length === 1 ? 'person' : 'people'}
            </p>
          </div>

          {/* Shared With List */}
          <div className="divide-y divide-gray-100">
            {sharedWithList.map(record => (
              <div key={record.receiverId} className="p-6 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center text-white font-semibold">
                      {record.receiverWalletAddress.slice(2, 4).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {record.receiverWalletAddress.slice(0, 6)}...
                        {record.receiverWalletAddress.slice(-4)}
                      </p>
                      <p className="text-sm text-gray-500">Receiver ID: {record.receiverId}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>Granted {new Date(record.grantedAt).toLocaleDateString()}</span>
                    </div>

                    {record.isActive ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="font-medium">Active</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="w-4 h-4" />
                        <span className="font-medium">
                          Revoked{' '}
                          {record.revokedAt && new Date(record.revokedAt).toLocaleDateString()}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {record.isActive && (
                  <Button
                    variant="outline"
                    onClick={() => onRevoke(record.recordId, record.receiverId)}
                    disabled={isRevoking}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    {isRevoking ? 'Revoking...' : 'Revoke Access'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Component for records shared with current user
const SharedWithMeList: React.FC<{
  records: AccessPermissionData[];
}> = ({ records }) => {
  if (records.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No records shared with you</h3>
        <p className="text-gray-600">
          When someone shares their health records with you, they'll appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {records.map(record => (
        <div
          key={`${record.recordId}-${record.sharerId}`}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* Owner Info */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                  {record.sharerId.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Shared by</p>
                  <p className="font-medium text-gray-900">Owner ID: {record.sharerId}</p>
                </div>
              </div>

              {/* Record Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-3">
                <p className="text-sm text-gray-600 mb-1">Record ID</p>
                <p className="font-mono text-sm font-medium text-gray-900">{record.recordId}</p>
              </div>

              {/* Metadata */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Shared {new Date(record.grantedAt).toLocaleDateString()}</span>
                </div>
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">Active Access</span>
                </span>
              </div>
            </div>

            {/* View Button */}
            <Button className="ml-4">View Record</Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SharedRecords;
