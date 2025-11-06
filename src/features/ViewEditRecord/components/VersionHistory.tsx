// src/features/ViewEditRecord/components/VersionHistory.tsx

import React, { useState, useEffect } from 'react';
import {
  Clock,
  User,
  RotateCcw,
  Eye,
  ChevronDown,
  ChevronRight,
  GitBranch,
  FileText,
  AlertTriangle,
  CheckCircle,
  SquareDashedMousePointer,
  ArrowLeft,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { VersionControlService } from '../services/versionControlService';
import {
  RecordVersion,
  VersionHistoryProps,
  Change,
} from '../services/versionControlService.types';
import { formatTimestamp } from '@/utils/dataFormattingUtils';

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

  // 🆕 Track decrypted changes for each version
  const [decryptedChanges, setDecryptedChanges] = useState<Map<string, Change[]>>(new Map());
  const [decryptingVersions, setDecryptingVersions] = useState<Set<string>>(new Set());

  const versionControl = new VersionControlService();

  const refreshVersions = async () => {
    if (!documentId) return;

    setLoading(true);
    setError(null);

    try {
      const versionsData = await versionControl.getVersionHistory(documentId);

      setVersions(versionsData);
      onVersionsLoaded?.(versionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (versionId: string, version: RecordVersion) => {
    // Firestore Timestamp, need to convert
    const versionDate = version.editedAt?.toDate?.() || new Date();

    if (
      !confirm(
        `Are you sure you want to rollback to the version from ${versionDate.toLocaleString()}?`
      )
    ) {
      return;
    }

    setIsRollingBack(versionId);
    try {
      await versionControl.rollbackToVersion(documentId, versionId);
      toast.success(`Rolled back to version from ${versionDate.toLocaleString()}`);
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

  // 🆕 Toggle expanded and decrypt changes if needed
  const toggleExpanded = async (versionId: string, version: RecordVersion) => {
    const newExpanded = new Set(expandedVersions);

    if (newExpanded.has(versionId)) {
      // Collapsing - just remove from expanded set
      newExpanded.delete(versionId);
      setExpandedVersions(newExpanded);
    } else {
      // Expanding - need to decrypt if encrypted
      newExpanded.add(versionId);
      setExpandedVersions(newExpanded);

      // If changes are encrypted and not yet decrypted, decrypt them
      if (version.hasEncryptedChanges && !decryptedChanges.has(versionId)) {
        await decryptVersionChanges(versionId, version);
      }
    }
  };

  // 🆕 Decrypt changes for a specific version
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

  // 🆕 Get changes for display (encrypted or plain)
  const getDisplayChanges = (version: RecordVersion): Change[] | null => {
    const versionId = version.id || '';

    // If encrypted, return decrypted changes (or null if not yet decrypted)
    if (version.hasEncryptedChanges) {
      return decryptedChanges.get(versionId) || null;
    }

    // Otherwise return plain changes
    return version.changes || [];
  };

  // 🆕 Get changes count for summary
  const getChangesCount = (version: RecordVersion): number => {
    if (version.hasEncryptedChanges) {
      // If we've decrypted, use that count
      const changes = decryptedChanges.get(version.id || '');
      if (changes) return changes.length;

      // Otherwise, we don't know the count without decrypting
      return 0;
    }

    return version.changes?.length || 0;
  };

  const getChangesSummary = (version: RecordVersion): string => {
    const displayChanges = getDisplayChanges(version);

    // If changes are encrypted but not yet decrypted
    if (version.hasEncryptedChanges && !displayChanges) {
      return 'Encrypted changes (expand to view)';
    }

    if (!displayChanges || displayChanges.length === 0) {
      return 'Initial version';
    }

    const operations = {
      create: displayChanges.filter(c => c.operation === 'create').length,
      update: displayChanges.filter(c => c.operation === 'update').length,
      delete: displayChanges.filter(c => c.operation === 'delete').length,
    };

    const parts: string[] = [];
    if (operations.update > 0) parts.push(`${operations.update} updated`);
    if (operations.create > 0) parts.push(`${operations.create} added`);
    if (operations.delete > 0) parts.push(`${operations.delete} removed`);

    return parts.length > 0 ? parts.join(', ') : 'No changes';
  };

  useEffect(() => {
    if (documentId) {
      refreshVersions();
    }
  }, [documentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
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

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <GitBranch className="w-5 h-5" />
          Version History
        </h3>
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-600">
            {versions.length} version{versions.length !== 1 ? 's' : ''}
          </div>
          {selectedVersions.length > 0 && (
            <div className="text-xs text-gray-500">({selectedVersions.length} selected)</div>
          )}
          <Button onClick={onBack} className="w-8 h-8 border-none bg-transparent hover:bg-gray-200">
            <ArrowLeft className="text-primary" />
          </Button>
        </div>
      </div>

      {/* Version List */}
      <div className="space-y-2">
        {versions.map((version, index) => {
          const versionId = version.id || '';
          const isExpanded = expandedVersions.has(versionId);
          const isCurrent = index === 0;
          const selectionInfo = getSelectionInfo?.(versionId);
          const isSelected = !!selectionInfo;
          const displayChanges = getDisplayChanges(version);
          const hasChanges = getChangesCount(version) > 0 || version.hasEncryptedChanges;
          const isDecrypting = decryptingVersions.has(versionId);

          // 🎨 Dynamic styling based on selection
          let containerClasses = 'border rounded-lg transition-all duration-200 ';
          if (isCurrent && !isSelected) {
            containerClasses += 'border-green-200 bg-green-50';
          } else if (isSelected) {
            containerClasses += selectionInfo.bgClass;
          } else {
            containerClasses += 'border-gray-200 hover:border-gray-300 hover:bg-gray-50';
          }

          return (
            <div key={versionId} className={containerClasses}>
              {/* Version Header */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {/* 🔵 Selection Indicator */}
                    {isSelected && (
                      <div
                        className={`w-5 h-5 rounded-full ${selectionInfo.badgeClass} text-white text-xs font-bold flex items-center justify-center mt-0.5 flex-shrink-0`}
                      >
                        {selectionInfo.order}
                      </div>
                    )}

                    <div className="flex-1">
                      {/* Version Info */}
                      <div className="flex items-center gap-2 mb-2">
                        {isCurrent && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Current
                          </span>
                        )}
                        {isSelected && (
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${selectionInfo.bgClass} ${selectionInfo.textClass}`}
                          >
                            Selected #{selectionInfo.order}
                          </span>
                        )}
                        {/* 🆕 Encrypted indicator */}
                        {version.hasEncryptedChanges && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <Lock className="w-3 h-3 mr-1" />
                            Encrypted
                          </span>
                        )}
                        <span className="text-sm text-gray-600">
                          {formatTimestamp(version.editedAt, 'relative')}
                        </span>
                      </div>

                      {/* Commit Message */}
                      {version.commitMessage && (
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-sm font-medium">{version.commitMessage}</span>
                        </div>
                      )}

                      {/* Author and Changes */}
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {version.editedByName || 'Unknown'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(version.editedAt, 'short') || 'Unknown time'}
                        </div>
                        <div>{getChangesSummary(version)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-4">
                    {/* 🔘 Select Button */}
                    {(versions.length > 1 || !isCurrent) && (
                      <>
                        <Button
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleSelectVersion(version)}
                          className={`px-2 py-1 h-auto ${
                            isSelected
                              ? `${selectionInfo.badgeClass} hover:opacity-90 text-white`
                              : ''
                          }`}
                        >
                          <SquareDashedMousePointer className="w-3 h-3 mr-1" />
                          {isSelected ? `Selected #${selectionInfo?.order}` : 'Select'}
                        </Button>

                        {!isCurrent && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewVersion(version)}
                              className="px-2 py-1 h-auto"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRollback(versionId, version)}
                              disabled={isRollingBack === versionId}
                              className="px-2 py-1 h-auto"
                            >
                              {isRollingBack === versionId ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent mr-1" />
                              ) : (
                                <RotateCcw className="w-3 h-3 mr-1" />
                              )}
                              Rollback
                            </Button>
                          </>
                        )}
                      </>
                    )}

                    {/* 🆕 Updated expand button - only show if there are changes */}
                    {hasChanges && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(versionId, version)}
                        className="px-1 py-1 h-auto"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* 🆕 Expanded Changes - handles encrypted/plain/loading states */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <h4 className="text-sm font-medium mb-2">Changes:</h4>

                    {/* Loading state while decrypting */}
                    {isDecrypting && (
                      <div className="flex items-center gap-2 text-gray-600 p-4">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                        Decrypting changes...
                      </div>
                    )}

                    {/* Show changes if available */}
                    {!isDecrypting && displayChanges && displayChanges.length > 0 && (
                      <div className="space-y-1">
                        {displayChanges.map((change, changeIndex) => (
                          <div
                            key={changeIndex}
                            className={`text-xs p-2 rounded ${
                              change.operation === 'create'
                                ? 'bg-green-100 text-green-800'
                                : change.operation === 'update'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            <div className="font-medium">
                              {change.operation.charAt(0).toUpperCase() + change.operation.slice(1)}
                              : {change.path}
                            </div>
                            {change.description && (
                              <div className="mt-1 opacity-75">{change.description}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* No changes */}
                    {!isDecrypting && displayChanges && displayChanges.length === 0 && (
                      <div className="text-sm text-gray-500 p-2">No changes in this version</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VersionHistory;
