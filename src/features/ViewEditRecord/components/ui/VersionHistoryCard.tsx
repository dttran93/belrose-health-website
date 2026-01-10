// src/features/ViewEditRecord/components/VersionHistoryCard.tsx

import React from 'react';
import {
  Clock,
  User,
  RotateCcw,
  Eye,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  SquareDashedMousePointer,
  Lock,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RecordVersion, Change } from '../../services/versionControlService.types';
import { formatTimestamp } from '@/utils/dataFormattingUtils';

export interface VersionHistoryCardProps {
  version: RecordVersion;
  isCurrent: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  isRollingBack: boolean;
  isDecrypting: boolean;
  displayChanges: Change[] | null;
  selectionInfo?: {
    order: number;
    colorClass: string;
    bgClass: string;
    textClass: string;
    badgeClass: string;
  } | null;
  onToggleExpand: () => void;
  onSelect: () => void;
  onView: () => void;
  onRollback: () => void;
}

export const VersionHistoryCard: React.FC<VersionHistoryCardProps> = ({
  version,
  isCurrent,
  isExpanded,
  isSelected,
  isRollingBack,
  isDecrypting,
  displayChanges,
  selectionInfo,
  onToggleExpand,
  onSelect,
  onView,
  onRollback,
}) => {
  // Check if there are changes to show
  const hasChanges = (displayChanges && displayChanges.length > 0) || version.hasEncryptedChanges;

  // Dynamic container styling based on selection state
  let containerClasses = 'border rounded-lg transition-all duration-200 ';
  if (isCurrent && !isSelected) {
    containerClasses += 'border-green-200 bg-green-50';
  } else if (isSelected && selectionInfo) {
    containerClasses += selectionInfo.bgClass;
  } else {
    containerClasses += 'border-gray-200 hover:border-gray-300 hover:bg-gray-50';
  }

  return (
    <div className={containerClasses}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* Selection Indicator */}
            {isSelected && selectionInfo && (
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${selectionInfo.bgClass} ${selectionInfo.textClass}`}
              >
                Selected #{selectionInfo.order}
              </span>
            )}

            <div className="flex-1">
              {/* Version Number & Status Badges */}
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-800">
                  v{version.versionNumber}
                </span>

                {isCurrent && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Current
                  </span>
                )}

                {/* Commit Message */}
                {version.commitMessage && (
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium">{version.commitMessage}</span>
                  </div>
                )}
              </div>

              {/* Record Hash */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1 text-xs">
                  Record Hash
                  <Hash className="w-3 h-3 text-gray-500" />
                </div>
                <span className="text-xs px-1 py-0.5 rounded font-mono text-gray-700">
                  {version.recordHash}
                </span>
                {version.hasEncryptedChanges && <Lock className="w-3 h-3 text-amber-500" />}
              </div>

              {/* Author, Time, and Changes Summary */}
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {version.editedByName || 'Unknown'}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(version.editedAt, 'short') || 'Unknown time'}
                </div>
                <span className="text-xs text-gray-600">
                  {formatTimestamp(version.editedAt, 'relative')}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 ml-4">
            {/* Select Button */}
            <Button
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              onClick={onSelect}
              className={`px-2 py-1 h-auto ${
                isSelected && selectionInfo
                  ? `${selectionInfo.badgeClass} hover:opacity-90 text-white`
                  : ''
              }`}
            >
              <SquareDashedMousePointer className="w-3 h-3 mr-1" />
              {isSelected ? `Selected #${selectionInfo?.order}` : 'Select'}
            </Button>

            {/* View & Rollback (only for non-current versions) */}
            {!isCurrent && (
              <>
                <Button variant="outline" size="sm" onClick={onView} className="px-2 py-1 h-auto">
                  <Eye className="w-3 h-3 mr-1" />
                  View
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRollback}
                  disabled={isRollingBack}
                  className="px-2 py-1 h-auto"
                >
                  {isRollingBack ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent mr-1" />
                  ) : (
                    <RotateCcw className="w-3 h-3 mr-1" />
                  )}
                  Rollback
                </Button>
              </>
            )}

            {/* Expand/Collapse Button */}
            {hasChanges && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
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

        {/* Expanded Changes Section */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <h4 className="text-sm font-medium mb-2">Changes:</h4>

            {/* Loading state while decrypting */}
            {isDecrypting && (
              <div className="flex items-center gap-2 text-gray-600 p-4">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
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
                      {change.operation.charAt(0).toUpperCase() + change.operation.slice(1)}:{' '}
                      {change.path}
                    </div>
                    {change.description && (
                      <div className="mt-1 opacity-75">{change.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* No changes state */}
            {!isDecrypting && displayChanges && displayChanges.length === 0 && (
              <div className="text-sm text-gray-500 p-2">No changes in this version</div>
            )}

            {/* Waiting to decrypt (encrypted but not yet expanded) */}
            {!isDecrypting && !displayChanges && version.hasEncryptedChanges && (
              <div className="flex items-center gap-2 text-sm text-amber-600 p-2">
                <Lock className="w-4 h-4" />
                Unlock encryption to view changes
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VersionHistoryCard;
