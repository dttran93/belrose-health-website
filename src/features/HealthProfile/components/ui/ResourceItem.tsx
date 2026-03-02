// src/features/HealthProfile/components/overview/ResourceItem.tsx

/**
 * ResourceItem
 *
 * A single row inside a CategoryCard. Renders one FHIR resource with:
 * - Primary display name
 * - Optional date
 * - Optional secondary detail (dosage, status, value, etc.)
 * - Source record badge ("from GP Visit 2023")
 */

import React from 'react';
import { Calendar, FileText } from 'lucide-react';
import {
  FHIRResourceWithProvenance,
  getResourceDisplayName,
  getResourceDate,
  getResourceSecondaryDetail,
} from '../../utils/fhirGroupingUtils';
import { formatTimestamp } from '@/utils/dataFormattingUtils';

// ============================================================================
// COMPONENT
// ============================================================================

interface ResourceItemProps {
  item: FHIRResourceWithProvenance;
  /** Show the source record badge. Defaults to true. */
  showSource?: boolean;
}

export const ResourceItem: React.FC<ResourceItemProps> = ({ item, showSource = true }) => {
  const { resource, sourceRecordName, sourceRecordDate } = item;

  const displayName = getResourceDisplayName(resource);
  const resourceDate = getResourceDate(resource) ?? sourceRecordDate;
  const secondaryDetail = getResourceSecondaryDetail(resource);
  const formattedDate = resourceDate ? formatTimestamp(resourceDate, 'month-year') : null;

  return (
    <div className="flex items-start justify-between gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
      {/* Left: name + detail */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-card-foreground truncate leading-snug">
          {displayName}
        </p>

        {secondaryDetail && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{secondaryDetail}</p>
        )}

        {/* Source badge — subtle, shown below detail */}
        {showSource && (
          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <FileText className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
            <span className="text-[11px] text-muted-foreground/60 truncate">
              {sourceRecordName}
            </span>
          </div>
        )}
      </div>

      {/* Right: date */}
      {formattedDate && (
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          <Calendar className="w-3 h-3 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground/70 whitespace-nowrap">
            {formattedDate}
          </span>
        </div>
      )}
    </div>
  );
};

export default ResourceItem;
