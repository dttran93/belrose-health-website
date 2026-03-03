// ImmunizationRow.tsx
import React from 'react';
import { FHIRResourceWithProvenance } from '@/features/HealthProfile/utils/fhirGroupingUtils';
import { ImmunizationResource } from '@/types/fhir';
import { RowShell } from '../ui/RowShell';
import { RowBadge } from '../ui/RowBadge';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import { useResourceFields } from '@/features/HealthProfile/hooks/useResourceFields';
import { IMMUNIZATION_FIELDS } from '@/features/HealthProfile/configs/fieldMaps';

export const ImmunizationRow: React.FC<{ item: FHIRResourceWithProvenance }> = ({ item }) => {
  const r = item.resource as ImmunizationResource;
  const name = r.vaccineCode?.text || r.vaccineCode?.coding?.[0]?.display || 'Unknown Vaccine';
  const status = r.status;
  const date = r.occurrenceDateTime;
  const formattedDate = date ? formatTimestamp(date, 'month-year') : null;
  const detailFields = useResourceFields(item.resource, IMMUNIZATION_FIELDS);

  return (
    <RowShell
      sourceRecordId={item.sourceRecordId}
      sourceRecordName={item.sourceRecordName}
      detailFields={detailFields}
      primary={<p className="text-sm font-medium text-card-foreground truncate">{name}</p>}
    >
      {status && <RowBadge label={status} variant={status === 'completed' ? 'green' : 'default'} />}
      {formattedDate && (
        <span className="text-xs text-muted-foreground/70 flex-shrink-0">{formattedDate}</span>
      )}
    </RowShell>
  );
};
