// features/Subject/components/SubjectBadge.tsx

import React, { useState, useEffect } from 'react';
import { FileUser, AlertTriangle, Loader2 } from 'lucide-react';
import { FileObject } from '@/types/core';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useSubjectFlow } from '../hooks/useSubjectFlow';
import SubjectActionDialog from './ui/SubjectActionDialog';

interface SubjectBadgeProps {
  record: FileObject;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean; // Show first subject's name on badge
  onClick?: () => void; // If provided, overrides default click behavior
  onOpenManager?: () => void; // Navigate to SubjectManager when subjects exist
  onSuccess?: () => void; // Called after successfully setting a subject
}

export const SubjectBadge: React.FC<SubjectBadgeProps> = ({
  record,
  size = 'sm',
  showName = true,
  onClick,
  onOpenManager,
  onSuccess,
}) => {
  const [showSetSubjectModal, setShowSetSubjectModal] = useState(false);
  const [firstSubjectName, setFirstSubjectName] = useState<string | null>(null);
  const [loadingName, setLoadingName] = useState(false);

  const subjects = record.subjects || [];
  const hasSubject = subjects.length > 0;

  const { dialogProps } = useSubjectFlow({
    record,
    onSuccess: () => {
      onSuccess?.();
    },
  });

  // Fetch the first subject's name for display
  useEffect(() => {
    const fetchFirstSubjectName = async () => {
      const firstSubject = subjects[0];
      if (!firstSubject || !showName) return;

      setLoadingName(true);
      try {
        const profiles = await getUserProfiles([firstSubject]);
        const profile = profiles.get(firstSubject);
        setFirstSubjectName(profile?.displayName || 'Unknown');
      } catch (error) {
        console.error('Error fetching subject name:', error);
        setFirstSubjectName('Unknown');
      } finally {
        setLoadingName(false);
      }
    };

    fetchFirstSubjectName();
  }, [subjects, showName]);

  // Handle badge click
  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    if (hasSubject && onOpenManager) {
      // Navigate to SubjectManager to view/manage subjects
      onOpenManager();
    } else if (!hasSubject) {
      // Open SetSubject modal to add a subject
      setShowSetSubjectModal(true);
    }
  };

  const handleModalClose = () => {
    setShowSetSubjectModal(false);
  };

  const handleSuccess = () => {
    setShowSetSubjectModal(false);
    onSuccess?.();
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  // Build display text
  const getDisplayText = () => {
    if (!hasSubject) {
      return 'Set Subject';
    }

    if (loadingName) {
      return 'Loading...';
    }

    if (subjects.length === 1) {
      return showName && firstSubjectName ? firstSubjectName : 'Subject Set';
    }

    // Multiple subjects
    if (showName && firstSubjectName) {
      return `${firstSubjectName} +${subjects.length - 1}`;
    }
    return `${subjects.length} Subjects`;
  };

  // Tooltip content
  const getTooltipContent = () => {
    if (!hasSubject) {
      return 'The record Subjects represents the Belrose account(s) this record is assigned to. Click to add a record Subject.';
    }

    if (subjects.length === 1) {
      return `The record Subjects represent the Belrose account(s) this record is assigned to. Click to manage.`;
    }

    return `${subjects.length} subjects assigned. Click to manage.`;
  };

  // Warning state (no subject set)
  if (!hasSubject) {
    return (
      <>
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={handleClick}
                className={`
                  inline-flex items-center rounded-full border font-medium
                  bg-amber-50 text-amber-700 border-amber-200
                  hover:bg-amber-100 hover:border-amber-300
                  transition-colors cursor-pointer
                  ${sizeClasses[size]}
                `}
              >
                <AlertTriangle className={iconSizes[size]} />
                <span>{getDisplayText()}</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs z-50"
                sideOffset={5}
              >
                {getTooltipContent()}
                <Tooltip.Arrow className="fill-gray-900" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>

        {/* Subject Action Modal - can still open from here if needed */}
        <SubjectActionDialog {...dialogProps} />
      </>
    );
  }

  // Subject(s) set - use primary color
  return (
    <>
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={handleClick}
              className={`
                inline-flex items-center rounded-full border font-medium
                bg-white text-primary border-primary
                hover:bg-secondary
                transition-colors cursor-pointer
                ${sizeClasses[size]}
              `}
            >
              {loadingName ? (
                <Loader2 className={`${iconSizes[size]} animate-spin`} />
              ) : (
                <FileUser className={iconSizes[size]} />
              )}
              <span>{getDisplayText()}</span>
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs z-50"
              sideOffset={5}
            >
              {getTooltipContent()}
              <Tooltip.Arrow className="fill-gray-900" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>

      {/* Subject Action Modal - can still open from here if needed */}
      <SubjectActionDialog {...dialogProps} />
    </>
  );
};

export default SubjectBadge;
