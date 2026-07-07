import React, { useState, useRef, useEffect } from 'react';
import { Hash } from 'lucide-react';
import { FileObject } from '@/types/core';
import { CopyableHash } from '@/features/BackendChainParity/components/ui/CopyableHash';

interface RecordIdentifiersPopoverProps {
  record: FileObject;
  className?: string;
}

export const RecordIdentifiersPopover: React.FC<RecordIdentifiersPopoverProps> = ({
  record,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className={`relative flex-shrink-0 ${className}`} ref={containerRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        title="Record identifiers"
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
          isOpen ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'
        }`}
      >
        <Hash className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-60 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 text-left">
          <div className="flex gap-1 items-center mb-1 justify-between">
            <div className="text-[10px] uppercase tracking-wider text-gray-400">Record ID</div>
            <CopyableHash
              value={record.id}
              chars={10}
              className="font-mono text-sm text-gray-800"
            />
          </div>
          <div className="flex gap-1 items-center mb-1 justify-between">
            <div className="text-[10px] uppercase tracking-wider text-gray-400">Network ID</div>
            <CopyableHash
              value={record.recordIdHash}
              chars={10}
              className="font-mono text-sm text-gray-800"
            />
          </div>
          <div className="flex gap-1 items-center mb-1 justify-between">
            <div className="text-[10px] uppercase tracking-wider text-gray-400">Hash</div>
            <CopyableHash
              value={record.recordHash}
              chars={10}
              className="font-mono text-sm text-gray-800"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordIdentifiersPopover;
