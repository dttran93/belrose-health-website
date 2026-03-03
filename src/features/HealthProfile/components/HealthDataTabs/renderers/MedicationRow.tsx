import React from 'react';
import { FHIRResourceWithProvenance } from '@/features/HealthProfile/utils/fhirGroupingUtils';
import { MedicationRequestResource, MedicationStatementResource } from '@/types/fhir';
import { RowShell } from '../ui/RowShell';
import { RowBadge } from '../ui/RowBadge';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import { useResourceFields } from '@/features/HealthProfile/hooks/useResourceFields';
import { MEDICATION_FIELDS } from '../../../configs/fieldMaps';

export const MedicationRow: React.FC<{ item: FHIRResourceWithProvenance }> = ({ item }) => {
  const r = item.resource as MedicationRequestResource | MedicationStatementResource;

  const name =
    r.medicationCodeableConcept?.text ||
    r.medicationCodeableConcept?.coding?.[0]?.display ||
    (r as any).medicationReference?.display ||
    'Unknown Medication';

  const dosage =
    (r as MedicationRequestResource).dosageInstruction?.[0]?.text ||
    (r as MedicationStatementResource).dosage?.[0]?.text;

  const status = r.status;
  const date =
    (r as MedicationRequestResource).authoredOn ||
    (r as MedicationStatementResource).effectiveDateTime;
  const formattedDate = date ? formatTimestamp(date, 'month-year') : null;

  const statusVariant =
    status === 'active'
      ? 'green'
      : status === 'stopped' || status === 'cancelled'
        ? 'red'
        : 'default';

  const detailFields = useResourceFields(item.resource, MEDICATION_FIELDS);

  return (
    <RowShell
      sourceRecordId={item.sourceRecordId}
      sourceRecordName={item.sourceRecordName}
      detailFields={detailFields}
      primary={<p className="text-sm font-medium text-card-foreground truncate">{name}</p>}
    >
      {dosage && (
        <span className="text-xs text-muted-foreground truncate w-40 flex-shrink-0 hidden md:block">
          {dosage}
        </span>
      )}
      {status && <RowBadge label={status} variant={statusVariant} />}
      {formattedDate && (
        <span className="text-xs text-muted-foreground/70 flex-shrink-0">{formattedDate}</span>
      )}
    </RowShell>
  );
};
