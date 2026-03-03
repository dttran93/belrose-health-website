import React from 'react';
import { FHIRResourceWithProvenance } from '@/features/HealthProfile/utils/fhirGroupingUtils';
import { EncounterResource } from '@/types/fhir';
import { RowShell } from '../ui/RowShell';
import { RowBadge } from '../ui/RowBadge';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import { ENCOUNTER_FIELDS } from '@/features/HealthProfile/configs/fieldMaps';
import { useResourceFields } from '@/features/HealthProfile/hooks/useResourceFields';

export const EncounterRow: React.FC<{ item: FHIRResourceWithProvenance }> = ({ item }) => {
  const r = item.resource as EncounterResource;

  const name =
    r.type?.[0]?.text ||
    r.type?.[0]?.coding?.[0]?.display ||
    (r as any).class?.display ||
    (r as any).class?.code ||
    'Encounter';
  const status = r.status;
  const date = r.period?.start || (r as any).actualPeriod?.start;
  const formattedDate = date ? formatTimestamp(date, 'month-year') : null;
  const serviceProvider = (r as any).serviceProvider?.display;

  const statusVariant =
    status === 'finished' ? 'green' : status === 'in-progress' ? 'blue' : 'default';
  const detailFields = useResourceFields(item.resource, ENCOUNTER_FIELDS);

  return (
    <RowShell
      sourceRecordId={item.sourceRecordId}
      sourceRecordName={item.sourceRecordName}
      detailFields={detailFields}
      primary={<p className="text-sm font-medium text-card-foreground truncate">{name}</p>}
    >
      {serviceProvider && (
        <span className="text-xs text-muted-foreground truncate w-36 flex-shrink-0 hidden md:block">
          {serviceProvider}
        </span>
      )}
      {status && <RowBadge label={status} variant={statusVariant} />}
      {formattedDate && (
        <span className="text-xs text-muted-foreground/70 flex-shrink-0">{formattedDate}</span>
      )}
    </RowShell>
  );
};
