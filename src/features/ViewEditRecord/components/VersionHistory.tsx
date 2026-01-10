// src/features/ViewEditRecord/components/VersionHistory.tsx

import React, { useState, useEffect } from 'react';
import { FileText, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { VersionControlService } from '../services/versionControlService';
import {
  RecordVersion,
  VersionHistoryProps,
  Change,
} from '../services/versionControlService.types';
import { VersionHistoryCard } from '../components/ui/VersionHistoryCard';

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  documentId,
  onVersionSelect,
  onViewVersion,
  onRollback,
  compact = false,
  onBack,
  onVersionsLoaded,
  selectedVersions = [],
  getSelectionInfo,
}) => {
  const [versions, setVersions] = useState<RecordVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [isRollingBack, setIsRollingBack] = useState<string | null>(null);

  // Track decrypted changes for each version
  const [decryptedChanges, setDecryptedChanges] = useState<Map<string, Change[]>>(new Map());
  const [decryptingVersions, setDecryptingVersions] = useState<Set<string>>(new Set());

  const versionControl = new VersionControlService();

  // ==================== DATA FETCHING ====================

  const refreshVersions = async () => {
    if (!documentId) return;

    setLoading(true);
    setError(null);

    try {
      const versionsData = await versionControl.getVersionHistory(documentId);
      console.log(
        '🔍 Versions loaded:',
        versionsData.map(v => ({
          versionNumber: v.versionNumber,
          commitMessage: v.commitMessage,
          id: v.id,
        }))
      );

      setVersions(versionsData);
      onVersionsLoaded?.(versionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentId) {
      refreshVersions();
    }
  }, [documentId]);

  // ==================== ENCRYPTION HELPERS ====================

  const decryptVersionChanges = async (versionId: string, version: RecordVersion) => {
    setDecryptingVersions(prev => new Set(prev).add(versionId));

    try {
      const changes = await versionControl.getVersionChanges(version);
      setDecryptedChanges(prev => new Map(prev).set(versionId, changes));
    } catch (err) {
      console.error('Failed to decrypt changes:', err);
      toast.error(
        err instanceof Error && err.message.includes('encryption session')
          ? 'Please unlock your encryption to view detailed changes'
          : 'Failed to decrypt changes'
      );
    } finally {
      setDecryptingVersions(prev => {
        const next = new Set(prev);
        next.delete(versionId);
        return next;
      });
    }
  };

  const getDisplayChanges = (version: RecordVersion): Change[] | null => {
    const versionId = version.id || '';

    if (version.encryptedChanges) {
      return decryptedChanges.get(versionId) || null;
    }

    return version.changes || [];
  };

  // ==================== EVENT HANDLERS ====================

  const handleToggleExpand = async (versionId: string, version: RecordVersion) => {
    const newExpanded = new Set(expandedVersions);

    if (newExpanded.has(versionId)) {
      newExpanded.delete(versionId);
      setExpandedVersions(newExpanded);
    } else {
      newExpanded.add(versionId);
      setExpandedVersions(newExpanded);

      // Decrypt if needed
      if (version.hasEncryptedChanges && !decryptedChanges.has(versionId)) {
        await decryptVersionChanges(versionId, version);
      }
    }
  };

  const handleRollback = async (versionId: string, version: RecordVersion) => {
    const versionDate = version.editedAt?.toDate?.() || new Date();

    if (
      !confirm(
        `Are you sure you want to rollback to version ${version.versionNumber} from ${versionDate.toLocaleString()}?`
      )
    ) {
      return;
    }

    setIsRollingBack(versionId);
    try {
      await versionControl.rollbackToVersion(documentId, versionId);
      toast.success(`Rolled back to version ${version.versionNumber}`);
      onRollback?.(versionId);
      await refreshVersions();
    } catch (error) {
      toast.error('Failed to rollback to selected version');
    } finally {
      setIsRollingBack(null);
    }
  };

  const handleSelectVersion = (version: RecordVersion) => {
    onVersionSelect?.(version);
  };

  const handleViewVersion = (version: RecordVersion) => {
    onViewVersion?.(version);
  };

  // ==================== RENDER STATES ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
          Loading version history...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-4 h-4" />
          Error loading versions: {error}
        </div>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col">
        <div className="flex justify-end">
          <Button onClick={onBack} className="w-8 h-8 border-none bg-transparent hover:bg-gray-200">
            <ArrowLeft className="text-primary" />
          </Button>
        </div>
        <div className="text-center text-gray-500 p-8">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No version history available</p>
          <p className="text-sm mt-1">Versions will appear here after edits are made</p>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDER ====================

  return (
    <div className="space-y-1">
      <div className="space-y-2">
        {versions.map((version, index) => {
          const versionId = version.id || '';
          const isCurrent = index === 0;
          const selectionInfo = getSelectionInfo?.(versionId);

          return (
            <VersionHistoryCard
              key={versionId}
              version={version}
              isCurrent={isCurrent}
              isExpanded={expandedVersions.has(versionId)}
              isSelected={!!selectionInfo}
              isRollingBack={isRollingBack === versionId}
              isDecrypting={decryptingVersions.has(versionId)}
              displayChanges={getDisplayChanges(version)}
              selectionInfo={selectionInfo}
              onToggleExpand={() => handleToggleExpand(versionId, version)}
              onSelect={() => handleSelectVersion(version)}
              onView={() => handleViewVersion(version)}
              onRollback={() => handleRollback(versionId, version)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default VersionHistory;
