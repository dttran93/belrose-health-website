// src/features/ViewEditRecord/components/VersionControlPanel.tsx

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { VersionHistory } from './VersionHistory';
import { VersionDiffViewer } from './VersionDiffViewer';
import { VersionControlService } from '../services/versionControlService';
import {
  VersionDiff,
  VersionControlPanelProps,
  RecordVersion,
} from '../services/versionControlService.types';
import { ArrowLeft, GitBranch } from 'lucide-react';

export const VersionControlPanel: React.FC<VersionControlPanelProps> = ({
  documentId,
  className,
  onBack,
  onViewVersion,
}) => {
  const [showDiff, setShowDiff] = useState<VersionDiff | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [versions, setVersions] = useState<RecordVersion[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  const versionControl = new VersionControlService();

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
      colorClass: index === 0 ? 'chart-2' : 'chart-4',
      bgClass: index === 0 ? 'bg-chart-2/10 border-chart-3/75' : 'bg-chart-4/10 border-chart-4/75',
      textClass: index === 0 ? 'text-chart-2' : 'text-chart-4',
      badgeClass: index === 0 ? 'bg-chart-2' : 'bg-chart-4',
    };

    console.log('getSelectionInfo returning:', info);
    return info;
  };

  const handleVersionsLoaded = (loadedVersions: RecordVersion[]) => {
    setVersions(loadedVersions);
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
            // Clear selection after rollback
            setSelectedVersions([]);
            // Trigger a page refresh or update the parent component
            window.location.reload();
          }}
          // Pass additional props for selection styling
          selectedVersions={selectedVersions}
          onVersionsLoaded={handleVersionsLoaded}
          onBack={onBack}
          getSelectionInfo={getSelectionInfo}
        />
      </div>
    </div>
  );
};

export default VersionControlPanel;
