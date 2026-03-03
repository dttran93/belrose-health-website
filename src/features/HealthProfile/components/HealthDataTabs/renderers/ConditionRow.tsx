import React from 'react';
import { FHIRResourceWithProvenance } from '@/features/HealthProfile/utils/fhirGroupingUtils';
import { ConditionResource } from '@/types/fhir';
import { RowShell } from '../ui/RowShell';
import { RowBadge } from '../ui/RowBadge';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import { useResourceFields } from '@/features/HealthProfile/hooks/useResourceFields';
import { CONDITION_FIELDS } from '../../../configs/fieldMaps';

export const ConditionRow: React.FC<{ item: FHIRResourceWithProvenance }> = ({ item }) => {
  const r = item.resource as ConditionResource;
  const detailFields = useResourceFields(item.resource, CONDITION_FIELDS);

  const name = r.code?.text || r.code?.coding?.[0]?.display || 'Unknown Condition';
  const status = r.clinicalStatus?.coding?.[0]?.code;
  const severity = r.severity?.coding?.[0]?.display || r.severity?.text;
  const onset = r.onsetDateTime || r.recordedDate;
  const formattedDate = onset ? formatTimestamp(onset, 'month-year') : null;
  const statusVariant = status === 'active' ? 'red' : status === 'resolved' ? 'green' : 'default';

  return (
    <RowShell
      sourceRecordId={item.sourceRecordId}
      sourceRecordName={item.sourceRecordName}
      detailFields={detailFields}
      primary={<p className="text-sm font-medium text-card-foreground truncate">{name}</p>}
    >
      {severity && (
        <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
          {severity}
        </span>
      )}
      {status && <RowBadge label={status} variant={statusVariant} />}
      {formattedDate && (
        <span className="text-xs text-muted-foreground/70 flex-shrink-0">{formattedDate}</span>
      )}
    </RowShell>
  );
};
