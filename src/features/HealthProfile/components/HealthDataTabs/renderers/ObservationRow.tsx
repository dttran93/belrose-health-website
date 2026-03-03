import React from 'react';
import { FHIRResourceWithProvenance } from '@/features/HealthProfile/utils/fhirGroupingUtils';
import { ObservationResource } from '@/types/fhir';
import { RowShell } from '../ui/RowShell';
import { RowBadge } from '../ui/RowBadge';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import { OBSERVATION_FIELDS } from '@/features/HealthProfile/configs/fieldMaps';
import { useResourceFields } from '@/features/HealthProfile/hooks/useResourceFields';

export const ObservationRow: React.FC<{ item: FHIRResourceWithProvenance }> = ({ item }) => {
  const r = item.resource as ObservationResource;

  const name = r.code?.text || r.code?.coding?.[0]?.display || 'Observation';

  // Value — try each possible value type in priority order
  let value: string | null = null;
  if (r.valueQuantity) {
    value = `${r.valueQuantity.value} ${r.valueQuantity.unit ?? ''}`.trim();
  } else if (r.valueString) {
    value = r.valueString;
  } else if (r.valueCodeableConcept?.text) {
    value = r.valueCodeableConcept.text;
  } else if (r.valueCodeableConcept?.coding?.[0]?.display) {
    value = r.valueCodeableConcept.coding[0].display;
  }

  const status = r.status;
  const date = r.effectiveDateTime || r.effectivePeriod?.start || r.issued;
  const formattedDate = date ? formatTimestamp(date, 'month-year') : null;

  const statusVariant =
    status === 'final' ? 'green' : status === 'preliminary' ? 'amber' : 'default';
  const detailFields = useResourceFields(item.resource, OBSERVATION_FIELDS);

  return (
    <RowShell
      sourceRecordId={item.sourceRecordId}
      sourceRecordName={item.sourceRecordName}
      detailFields={detailFields}
      primary={<p className="text-sm font-medium text-card-foreground truncate">{name}</p>}
    >
      {value && (
        <span className="text-sm font-semibold text-card-foreground flex-shrink-0">{value}</span>
      )}
      {status && <RowBadge label={status} variant={statusVariant} />}
      {formattedDate && (
        <span className="text-xs text-muted-foreground/70 flex-shrink-0">{formattedDate}</span>
      )}
    </RowShell>
  );
};
