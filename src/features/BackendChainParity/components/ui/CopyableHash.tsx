// src/features/BackendChainParity/components/CopyableHash.tsx

import React from 'react';
import { toast } from 'sonner';
import { truncateHash } from '@/utils/dataFormattingUtils';

interface CopyableHashProps {
  value: string | undefined;
  chars?: number;
  /** Show the full value without truncation (still copies on click) */
  full?: boolean;
  className?: string;
}

export const CopyableHash: React.FC<CopyableHashProps> = ({
  value,
  chars = 10,
  full = false,
  className = '',
}) => {
  if (!value) return <span className="text-gray-400">—</span>;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(value!);
    toast.success('Copied to clipboard');
  }

  return (
    <span
      onClick={handleClick}
      title={value}
      className={`cursor-pointer hover:text-blue-600 transition-colors ${className}`}
    >
      {full ? value : truncateHash(value, chars)}
    </span>
  );
};
