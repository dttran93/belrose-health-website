// src/features/BackendChainParity/components/CopyableHash.tsx

import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { truncateHash } from '@/utils/dataFormattingUtils';

interface CopyableHashProps {
  value: string | undefined | null;
  chars?: number;
  /** Show the full value without truncation (still copies on click) */
  full?: boolean;
  className?: string;
  /** When provided, renders an ArrowUpRight link to this relative URL (e.g. "?tab=members&search=uid") */
  navigateTo?: string;
}

export const CopyableHash: React.FC<CopyableHashProps> = ({
  value,
  chars = 10,
  full = false,
  className = '',
  navigateTo,
}) => {
  if (!value) return <span className="text-gray-400">—</span>;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(value!);
    toast.success('Copied to clipboard');
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span
        onClick={handleClick}
        title={value}
        className={`cursor-pointer hover:text-blue-600 transition-colors ${className}`}
      >
        {full ? value : truncateHash(value, chars)}
      </span>
      {navigateTo && (
        <a
          href={navigateTo}
          onClick={e => e.stopPropagation()}
          title="View in tab"
          className="text-gray-300 hover:text-blue-500 transition-colors"
        >
          <ArrowUpRight className="w-3 h-3" />
        </a>
      )}
    </span>
  );
};
