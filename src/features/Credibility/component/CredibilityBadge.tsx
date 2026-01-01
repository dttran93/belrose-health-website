import React from 'react';
import { FileObject } from '@/types/core';

interface CredibilityBadgeProps {
  fileObject: FileObject;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  onClick?: () => void;
}

export const CredibilityBadge: React.FC<CredibilityBadgeProps> = ({
  fileObject,
  size = 'sm',
  showDetails = false,
  onClick,
}) => {
  //if can't use blockchain verification, it's self-reported

  return (
    <div className="bg-red-100 text-red-800 border border-red-800 rounded-full text-xs px-2 py-0.5">
      Self-Reported
    </div>
  );
};
