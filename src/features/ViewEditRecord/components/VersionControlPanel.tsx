// src/features/ViewEditRecord/components/VersionControlPanel.tsx

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { VersionHistory } from './Edit/VersionHistory';
import { VersionDiffViewer } from './Edit/VersionDiffViewer';
import { VersionControlService } from '../services/versionControlService';
import {
  VersionDiff,
  VersionControlPanelProps,
  RecordVersion,
} from '../services/versionControlService.types';
import { ArrowLeft, GitBranch } from 'lucide-react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { CredibilityStats } from './Edit/VersionReviewBadge';
import VersionDetailPage from './Edit/VersionDetailPage';

export const VersionControlPanel: React.FC<VersionControlPanelProps> = ({
  documentId,
  className,
  onBack,
  onViewVersion,
  record,
  onModifyVerification,
  onModifyDispute,
}) => {
  const [showDiff, setShowDiff] = useState<VersionDiff | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [versions, setVersions] = useState<RecordVersion[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  console.log('Record Info', record);

  // Credibility stats state
  const [credibilityStatsMap, setCredibilityStatsMap] = useState<Map<string, CredibilityStats>>(
    new Map()
  );
  const [isLoadingCredibility, setIsLoadingCredibility] = useState(false);

  // Version detail page state
  const [selectedVersionForDetail, setSelectedVersionForDetail] = useState<RecordVersion | null>(
    null
  );

  const versionControl = new VersionControlService();

  // Fetch credibility stats for all versions from Firebase
  // Query by recordId (which we have permission for), then group by recordHash client-side
  const fetchCredibilityStats = useCallback(
    async (loadedVersions: RecordVersion[]) => {
      if (loadedVersions.length === 0) return;

      setIsLoadingCredibility(true);

      try {
        const db = getFirestore();

        // Build a set of hashes we care about for quick lookup
        const recordHashes = new Set(
          loadedVersions.map(v => v.recordHash).filter((hash): hash is string => !!hash)
        );

        // Query ALL verifications for this record (by recordId, which we have permission for)
        const verificationsRef = collection(db, 'verifications');
        const verificationsQuery = query(verificationsRef, where('recordId', '==', documentId));
        const verificationsSnapshot = await getDocs(verificationsQuery);

        // Query ALL disputes for this record (by recordId)
        const disputesRef = collection(db, 'disputes');
        const disputesQuery = query(disputesRef, where('recordId', '==', documentId));
        const disputesSnapshot = await getDocs(disputesQuery);

        // Build stats map by grouping results by recordHash
        const newMap = new Map<string, CredibilityStats>();

        // Initialize all hashes with zero counts
        recordHashes.forEach(hash => {
          newMap.set(hash, {
            verifications: { total: 0, active: 0 },
            disputes: { total: 0, active: 0 },
          });
        });

        // Count verifications per hash
        verificationsSnapshot.forEach(doc => {
          const data = doc.data();
          const hash = data.recordHash;
          if (hash && newMap.has(hash)) {
            const stats = newMap.get(hash)!;
            stats.verifications.total++;
            if (data.isActive) {
              stats.verifications.active++;
            }
          }
        });

        // Count disputes per hash
        disputesSnapshot.forEach(doc => {
          const data = doc.data();
          const hash = data.recordHash;
          if (hash && newMap.has(hash)) {
            const stats = newMap.get(hash)!;
            stats.disputes.total++;
            if (data.isActive) {
              stats.disputes.active++;
            }
          }
        });

        setCredibilityStatsMap(newMap);
      } catch (error) {
        console.error('Failed to fetch credibility stats:', error);
        // Don't show error toast - stats are supplementary info
      } finally {
        setIsLoadingCredibility(false);
      }
    },
    [documentId]
  );

  const handleCompareVersions = async () => {
    if (selectedVersions.length !== 2) {
      toast.error('Please select exactly two versions to compare');
      return;
    }

    // Type-safe access to array elements
    const [newerVersion, olderVersion] = selectedVersions;
    if (!newerVersion || !olderVersion) {
      toast.error('Invalid version selection');
      return;
    }

    setIsComparing(true);
    try {
      const diff = await versionControl.compareVersions(
        documentId,
        olderVersion, // Older version
        newerVersion // Newer version
      );
      setShowDiff(diff);
    } catch (error) {
      toast.error('Failed to compare versions');
    } finally {
      setIsComparing(false);
    }
  };

  const getSelectionInfo = (versionId: string) => {
    const index = selectedVersions.indexOf(versionId);
    console.log(`getSelectionInfo called with ${versionId}, index: ${index}`);

    if (index === -1) return null;

    const info = {
      order: index + 1,
      colorClass: index === 0 ? 'complement-2' : 'complement-4',
      bgClass:
        index === 0
          ? 'bg-complement-2/10 border-complement-3/75'
          : 'bg-complement-4/10 border-complement-4/75',
      textClass: index === 0 ? 'text-complement-2' : 'text-complement-4',
      badgeClass: index === 0 ? 'bg-complement-2' : 'bg-complement-4',
    };

    console.log('getSelectionInfo returning:', info);
    return info;
  };

  const handleVersionsLoaded = (loadedVersions: RecordVersion[]) => {
    setVersions(loadedVersions);
    // Fetch credibility stats when versions are loaded
    fetchCredibilityStats(loadedVersions);
  };

  const handleVersionSelect = (version: RecordVersion) => {
    const versionId = version.id || '';

    setSelectedVersions(prev => {
      if (prev.includes(versionId)) {
        // Deselect if already selected
        return prev.filter(id => id !== versionId);
      } else if (prev.length < 2) {
        // Select if less than 2 selected
        return [...prev, versionId];
      } else {
        // Replace oldest selection with new one
        const secondVersion = prev[1];
        if (secondVersion) {
          return [secondVersion, versionId];
        } else {
          return [versionId];
        }
      }
    });
  };

  const getVersionByIdName = (versionId: string): string => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return versionId;

    const timestamp = version.editedAt?.toDate?.() || new Date();
    const date = timestamp.toLocaleDateString();
    const time = timestamp.toLocaleTimeString();
    return `${date} ${time}`;
  };

  // Handler for opening credibility modal
  const handleOpenCredibilityModal = (recordHash: string) => {
    console.log('handleOpenCredibilityModal called with:', recordHash);
    console.log(
      'Available versions:',
      versions.map(v => ({ id: v.id, recordHash: v.recordHash }))
    );
    const version = versions.find(v => v.recordHash === recordHash);
    console.log('Found version:', version);

    if (version) {
      setSelectedVersionForDetail(version);
    }
  };

  // Handler for closing version detail page
  const handleCloseDetailPage = () => {
    setSelectedVersionForDetail(null);
    // Refresh credibility stats in case something changed
    fetchCredibilityStats(versions);
  };

  console.log('Version Array', versions.length);
  console.log(
    'Fetched versions:',
    versions.map(v => ({
      id: v.id,
      versionNumber: v.versionNumber,
      createdAt: v.editedAt?.toDate?.() || v.editedAt,
      record: v.recordSnapshot,
    }))
  );

  return (
    <div className={`space-y-4 p-8 ${className}`}>
      {/* Show Version Detail Page when a version is selected */}
      {selectedVersionForDetail && record ? (
        <VersionDetailPage
          record={record}
          version={selectedVersionForDetail}
          credibilityStats={credibilityStatsMap.get(selectedVersionForDetail.recordHash)}
          onBack={handleCloseDetailPage}
          onModifyVerification={onModifyVerification}
          onModifyDispute={onModifyDispute}
        />
      ) : (
        <>
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
              <Button
                onClick={onBack}
                className="w-8 h-8 border-none bg-transparent hover:bg-gray-200"
              >
                <ArrowLeft className="text-primary" />
              </Button>
            </div>
          </div>

          {/* Version Comparison Tool */}
          {versions.length > 1 && (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Compare Versions</h4>
                <div className="text-sm text-gray-600">
                  Select 2 versions to compare ({selectedVersions.length}/2)
                </div>
              </div>

              {selectedVersions.length > 0 && (
                <div className="mb-3 p-2 bg-white rounded border">
                  <div className="text-sm font-medium mb-2">Selected versions:</div>
                  <div className="space-y-1">
                    {selectedVersions.map(versionId => {
                      const selectionInfo = getSelectionInfo(versionId);
                      return (
                        <div
                          key={versionId}
                          className={`text-xs p-2 rounded ${selectionInfo?.bgClass} ${selectionInfo?.textClass}`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-4 h-4 rounded-full ${selectionInfo?.badgeClass} text-white text-xs font-bold`}
                            >
                              {selectionInfo?.order}
                            </span>
                            <span className="font-medium">{getVersionByIdName(versionId)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Click on versions below to select them for comparison
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedVersions([])}
                    disabled={selectedVersions.length === 0}
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={handleCompareVersions}
                    disabled={selectedVersions.length !== 2 || isComparing}
                    size="sm"
                  >
                    {isComparing ? 'Comparing...' : 'Compare'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Diff Viewer Modal */}
          {showDiff && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="max-w-4xl w-full max-h-full overflow-hidden">
                <VersionDiffViewer diff={showDiff} onClose={() => setShowDiff(null)} />
              </div>
            </div>
          )}

          {/* Version History with Selection */}
          <div>
            <VersionHistory
              documentId={documentId}
              onVersionSelect={handleVersionSelect}
              onViewVersion={onViewVersion}
              onRollback={() => {
                setSelectedVersions([]);
              }}
              selectedVersions={selectedVersions}
              onVersionsLoaded={handleVersionsLoaded}
              onBack={onBack}
              getSelectionInfo={getSelectionInfo}
              credibilityStatsMap={credibilityStatsMap}
              isLoadingCredibility={isLoadingCredibility}
              onOpenCredibilityModal={handleOpenCredibilityModal}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default VersionControlPanel;
