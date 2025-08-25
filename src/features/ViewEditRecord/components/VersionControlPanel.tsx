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
  RecordVersion
} from '../services/versionControlService.types';

export const VersionControlPanel: React.FC<VersionControlPanelProps> = ({ 
  documentId, 
  className,
  onBack,
  onViewVersion
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
        olderVersion,  // Older version
        newerVersion   // Newer version
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
        badgeClass: index === 0 ? 'bg-chart-2' : 'bg-chart-4'
    };
    
    console.log('getSelectionInfo returning:', info);
    return info;
    };

  const handleVersionsLoaded = (loadedVersions: RecordVersion[]) => {
    setVersions(loadedVersions);
  };

  const handleVersionSelect = (version: RecordVersion) => {
    setSelectedVersions(prev => {
        if (prev.includes(version.versionId)) {
            // Deselect if already selected
            return prev.filter(id => id !== version.versionId);
        } else if (prev.length < 2) {
            // Select if less than 2 selected
            return [...prev, version.versionId];
        } else {
            // Replace oldest selection with new one
            const secondVersion = prev[1];
            if (secondVersion) {
                return [secondVersion, version.versionId];
        } else {
            return [version.versionId];
        }
        }
    });
};

  const getVersionByIdName = (versionId: string): string => {
    const version = versions.find(v => v.versionId === versionId);
    if (!version) return versionId;
    
    const date = new Date(version.timestamp).toLocaleDateString();
    const time = new Date(version.timestamp).toLocaleTimeString();
    return `${date} ${time}`;
  };

  console.log('Version Array', versions.length);

  return (
    <div className={`space-y-4 ${className}`}>
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
                {selectedVersions.map((versionId) => {
                    const selectionInfo = getSelectionInfo(versionId);
                    return (
                    <div 
                        key={versionId} 
                        className={`text-xs p-2 rounded ${selectionInfo?.bgClass} ${selectionInfo?.textClass}`}
                    >
                        <div className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full ${selectionInfo?.badgeClass} text-white text-xs font-bold`}>
                            {selectionInfo?.order}
                        </span>
                        <span className="font-medium">
                            {getVersionByIdName(versionId)}
                        </span>
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
            <VersionDiffViewer 
              diff={showDiff} 
              onClose={() => setShowDiff(null)} 
            />
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