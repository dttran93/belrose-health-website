import React, { useMemo } from 'react';
import { RowShell } from '../ui/RowShell';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import {
  FHIRResourceWithProvenance,
  getResourceDate,
  getResourceDisplayName,
  getResourceSecondaryDetail,
} from '@/features/HealthProfile/utils/fhirGroupingUtils';
import { useResourceFields } from '@/features/HealthProfile/hooks/useResourceFields';
import { buildGenericFieldMap } from '@/features/HealthProfile/configs/fieldMaps';

export const GenericRow: React.FC<{ item: FHIRResourceWithProvenance }> = ({ item }) => {
  const r = item.resource as any;
  const name = getResourceDisplayName(item.resource);
  const detail = getResourceSecondaryDetail(item.resource);
  const date = getResourceDate(item.resource);
  const formattedDate = date ? formatTimestamp(date, 'month-year') : null;

  const fieldMap = useMemo(() => buildGenericFieldMap(r), [r]);
  const detailFields = useResourceFields(item.resource, fieldMap);

  return (
    <RowShell
      sourceRecordId={item.sourceRecordId}
      sourceRecordName={item.sourceRecordName}
      detailFields={detailFields}
      primary={<p className="text-sm font-medium text-card-foreground truncate">{name}</p>}
    >
      {detail && (
        <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
          {detail}
        </span>
      )}
      {formattedDate && (
        <span className="text-xs text-muted-foreground/70 flex-shrink-0">{formattedDate}</span>
      )}
    </RowShell>
  );
};
