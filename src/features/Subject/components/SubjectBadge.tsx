// features/Subject/components/SubjectBadge.tsx

import React, { useState, useEffect } from 'react';
import { FileUser, Loader2, CircleDashed } from 'lucide-react';
import { FileObject } from '@/types/core';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useSubjectAlerts } from '../hooks/useSubjectAlerts';

interface SubjectBadgeProps {
  record: FileObject;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean; // Show first subject's name on badge
  onClick?: () => void; // If provided, overrides default click behavior
  onOpenManager?: () => void; // Navigate to SubjectManager when subjects exist
}

export const SubjectBadge: React.FC<SubjectBadgeProps> = ({
  record,
  size = 'sm',
  showName = true,
  onClick,
  onOpenManager,
}) => {
  const [firstSubjectName, setFirstSubjectName] = useState<string | null>(null);
  const [loadingName, setLoadingName] = useState(false);

  const subjects = record.subjects || [];
  const hasSubject = subjects.length > 0;
  const recordId = record.firestoreId ?? record.id;

  const { pendingConsentRequests } = useSubjectAlerts({ recordId });
  const hasPendingRequest = pendingConsentRequests.length > 0;

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
    }
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
    if (!hasSubject && hasPendingRequest) return 'Pending';

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
    if (!hasSubject && hasPendingRequest)
      return 'A subject request has been sent and is awaiting acceptance.';
    if (subjects.length === 1) {
      return `The record Subjects represent the Belrose account(s) this record is assigned to. Click to manage.`;
    }
    return `${subjects.length} subjects assigned. Click to manage.`;
  };

  // Pending state — no subject yet but request is out
  if (!hasSubject && hasPendingRequest) {
    return (
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={handleClick}
              className={`
                inline-flex items-center rounded-full border font-medium
                bg-amber-50 text-amber-700 border-amber-300
                hover:bg-amber-100
                transition-colors cursor-pointer
                ${sizeClasses[size]}
              `}
            >
              <CircleDashed className={`${iconSizes[size]}`} />
              <span>Pending</span>
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs z-50"
              sideOffset={5}
            >
              A subject request has been sent and is awaiting acceptance.
              <Tooltip.Arrow className="fill-gray-900" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
  }

  if (hasSubject) {
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
      </>
    );
  }
};

export default SubjectBadge;
