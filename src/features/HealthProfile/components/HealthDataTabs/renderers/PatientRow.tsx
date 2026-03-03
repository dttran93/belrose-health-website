import React from 'react';
import { FHIRResourceWithProvenance } from '@/features/HealthProfile/utils/fhirGroupingUtils';
import { PatientResource } from '@/types/fhir';
import { RowShell } from '../ui/RowShell';
import { RowBadge } from '../ui/RowBadge';
import { useResourceFields } from '@/features/HealthProfile/hooks/useResourceFields';
import { PATIENT_FIELDS } from '@/features/HealthProfile/configs/fieldMaps';

export const PatientRow: React.FC<{ item: FHIRResourceWithProvenance }> = ({ item }) => {
  const r = item.resource as PatientResource;

  const name =
    r.name?.[0]?.text ||
    [r.name?.[0]?.given?.join(' '), r.name?.[0]?.family].filter(Boolean).join(' ') ||
    'Unknown Patient';
  const gender = r.gender;
  const dob = r.birthDate;
  const detailFields = useResourceFields(item.resource, PATIENT_FIELDS);

  return (
    <RowShell
      sourceRecordId={item.sourceRecordId}
      sourceRecordName={item.sourceRecordName}
      detailFields={detailFields}
      primary={<p className="text-sm font-medium text-card-foreground truncate">{name}</p>}
    >
      {dob && <span className="text-xs text-muted-foreground flex-shrink-0">DOB: {dob}</span>}
      {gender && <RowBadge label={gender} variant="blue" />}
    </RowShell>
  );
};
