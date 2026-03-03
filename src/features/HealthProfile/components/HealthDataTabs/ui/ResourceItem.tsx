import React from 'react';
import { FHIRResourceWithProvenance } from '../../../utils/fhirGroupingUtils';
import { ConditionRow } from '../renderers/ConditionRow';
import { MedicationRow } from '../renderers/MedicationRow';
import { AllergyRow } from '../renderers/AllergyRow';
import { ObservationRow } from '../renderers/ObservationRow';
import { PatientRow } from '../renderers/PatientRow';
import { EncounterRow } from '../renderers/EncounterRow';
import { ProcedureRow } from '../renderers/ProcedureRow';
import { ImmunizationRow } from '../renderers/ImmunizationRow';
import { GenericRow } from '../renderers/GenericRow';

type RowRenderer = React.FC<{ item: FHIRResourceWithProvenance }>;

const RENDERERS: Partial<Record<string, RowRenderer>> = {
  Condition: ConditionRow,
  MedicationRequest: MedicationRow,
  MedicationStatement: MedicationRow,
  AllergyIntolerance: AllergyRow,
  Observation: ObservationRow,
  DiagnosticReport: ObservationRow,
  Patient: PatientRow,
  Encounter: EncounterRow,
  EpisodeOfCare: EncounterRow,
  Procedure: ProcedureRow,
  Immunization: ImmunizationRow,
};

interface ResourceItemProps {
  item: FHIRResourceWithProvenance;
}

export const ResourceItem: React.FC<ResourceItemProps> = ({ item }) => {
  const Renderer = RENDERERS[item.resource.resourceType] ?? GenericRow;
  return <Renderer item={item} />;
};

export default ResourceItem;
