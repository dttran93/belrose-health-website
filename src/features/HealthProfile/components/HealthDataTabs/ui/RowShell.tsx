// src/features/HealthProfile/components/overview/renderers/RowShell.tsx

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ResourceDetailPanel } from './ResourceDetailPanel';
import { ResolvedField } from '@/features/HealthProfile/hooks/useResourceFields';

interface RowShellProps {
  sourceRecordId: string;
  sourceRecordName: string;
  detailFields: ResolvedField[];
  /** The primary label — left-aligned, takes all remaining space */
  primary: React.ReactNode;
  /** Secondary fields — badges, dates, values — justified to the right */
  children?: React.ReactNode;
}

export const RowShell: React.FC<RowShellProps> = ({
  sourceRecordId,
  sourceRecordName,
  detailFields,
  primary,
  children,
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 py-2 px-3">
        {/* Primary label — left-aligned, takes remaining space */}
        <div className="flex-1 min-w-0 text-left">{primary}</div>

        {/* Secondary fields — right side, evenly spaced */}
        {children && (
          <div className="flex items-center justify-between gap-4 flex-shrink-0">{children}</div>
        )}

        {/* View record button — always visible */}
        <button
          onClick={() => navigate(`/app/records/${sourceRecordId}`)}
          className="flex items-center gap-1 px-2 py-1 rounded-md flex-shrink-0 text-xs text-muted-foreground hover:bg-muted hover:text-card-foreground transition-colors"
          title="View source record"
        >
          <ExternalLink className="w-3 h-3" />
          View Source
        </button>
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(p => !p)}
          className="flex-shrink-0 text-muted-foreground hover:text-muted-foreground transition-colors"
          title={expanded ? 'Hide details' : 'Show details'}
        >
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {expanded && (
        <ResourceDetailPanel fields={detailFields} sourceRecordName={sourceRecordName} />
      )}
    </div>
  );
};
