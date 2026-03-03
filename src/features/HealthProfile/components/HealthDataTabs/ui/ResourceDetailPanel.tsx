// src/features/HealthProfile/components/overview/renderers/detail/ResourceDetailPanel.tsx

import React from 'react';
import { ResolvedField } from '@/features/HealthProfile/hooks/useResourceFields';

interface ResourceDetailPanelProps {
  fields: ResolvedField[];
  sourceRecordName: string;
}

export const ResourceDetailPanel: React.FC<ResourceDetailPanelProps> = ({
  fields,
  sourceRecordName,
}) => {
  if (fields.length === 0) {
    return (
      <div className="px-3 py-3 text-xs text-muted-foreground italic">
        No additional details available.
      </div>
    );
  }

  return (
    <div className="mx-3 mb-3 rounded-lg bg-muted/40 border border-border/50 overflow-hidden">
      {/* Field grid */}
      <dl className="divide-y divide-border/40">
        {fields.map(({ label, value }) => (
          <div key={label} className="flex items-baseline gap-4 px-3 py-2">
            <dt className="text-[11px] font-medium text-muted-foreground w-36 flex-shrink-0">
              {label}
            </dt>
            <dd className="text-xs text-card-foreground flex-1 min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>

      {/* Source footer */}
      <div className="px-3 py-2 border-t border-border/40 bg-muted/20">
        <span className="text-[11px] text-muted-foreground/60">Source: {sourceRecordName}</span>
      </div>
    </div>
  );
};
