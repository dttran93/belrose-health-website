import React from 'react';
import { FHIRResourceWithProvenance } from '@/features/HealthProfile/utils/fhirGroupingUtils';
import { AllergyIntoleranceResource } from '@/types/fhir';
import { RowShell } from '../ui/RowShell';
import { RowBadge } from '../ui/RowBadge';
import { useResourceFields } from '@/features/HealthProfile/hooks/useResourceFields';
import { ALLERGY_FIELDS } from '@/features/HealthProfile/configs/fieldMaps';

export const AllergyRow: React.FC<{ item: FHIRResourceWithProvenance }> = ({ item }) => {
  const r = item.resource as AllergyIntoleranceResource;

  const name = r.code?.text || r.code?.coding?.[0]?.display || 'Unknown Allergy';
  const criticality = r.criticality;
  const reaction =
    r.reaction?.[0]?.manifestation?.[0]?.text ||
    r.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display;
  const category = r.category?.[0];

  const criticalityVariant =
    criticality === 'high' ? 'red' : criticality === 'low' ? 'amber' : 'default';
  const detailFields = useResourceFields(item.resource, ALLERGY_FIELDS);

  return (
    <RowShell
      sourceRecordId={item.sourceRecordId}
      sourceRecordName={item.sourceRecordName}
      detailFields={detailFields}
      primary={<p className="text-sm font-medium text-card-foreground truncate">{name}</p>}
    >
      {reaction && (
        <span className="text-xs text-muted-foreground truncate w-36 flex-shrink-0 hidden md:block">
          {reaction}
        </span>
      )}
      {category && (
        <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block capitalize">
          {category}
        </span>
      )}
      {criticality && <RowBadge label={criticality} variant={criticalityVariant} />}
    </RowShell>
  );
};
