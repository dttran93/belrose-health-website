// ProcedureRow.tsx
import React from 'react';
import { FHIRResourceWithProvenance } from '@/features/HealthProfile/utils/fhirGroupingUtils';
import { ProcedureResource } from '@/types/fhir';
import { RowShell } from '../ui/RowShell';
import { RowBadge } from '../ui/RowBadge';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import { useResourceFields } from '@/features/HealthProfile/hooks/useResourceFields';
import { PROCEDURE_FIELDS } from '@/features/HealthProfile/configs/fieldMaps';

export const ProcedureRow: React.FC<{ item: FHIRResourceWithProvenance }> = ({ item }) => {
  const r = item.resource as ProcedureResource;
  const name = r.code?.text || r.code?.coding?.[0]?.display || 'Unknown Procedure';
  const status = r.status;
  const date = r.performedDateTime || r.performedPeriod?.start;
  const formattedDate = date ? formatTimestamp(date, 'month-year') : null;
  const statusVariant =
    status === 'completed' ? 'green' : status === 'in-progress' ? 'blue' : 'default';
  const detailFields = useResourceFields(item.resource, PROCEDURE_FIELDS);

  return (
    <RowShell
      sourceRecordId={item.sourceRecordId}
      sourceRecordName={item.sourceRecordName}
      detailFields={detailFields}
      primary={<p className="text-sm font-medium text-card-foreground truncate">{name}</p>}
    >
      {status && <RowBadge label={status} variant={statusVariant} />}
      {formattedDate && (
        <span className="text-xs text-muted-foreground/70 flex-shrink-0">{formattedDate}</span>
      )}
    </RowShell>
  );
};
