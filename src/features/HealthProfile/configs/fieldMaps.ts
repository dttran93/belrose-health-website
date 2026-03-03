// src/features/HealthProfile/components/config/fieldMaps.ts

/**
 * Field label maps for each FHIR resource type.
 *
 * Keys are dot-notation paths into the resource object.
 * Values are the human-readable labels shown in the detail panel.
 *
 * Rules:
 * - Only include fields that are clinically meaningful to a non-specialist
 * - Order matters — fields render in the order listed here
 * - If multiple paths could resolve the same concept (e.g. text vs coding.display),
 *   list the preferred one first — useResourceFields deduplicates by label
 */

export const CONDITION_FIELDS: Record<string, string> = {
  'clinicalStatus.coding.0.code': 'Clinical Status',
  'verificationStatus.coding.0.code': 'Verification',
  'category.0.coding.0.display': 'Category',
  'category.0.text': 'Category',
  'severity.text': 'Severity',
  'severity.coding.0.display': 'Severity',
  'code.text': 'Condition',
  'bodySite.0.text': 'Body Site',
  'bodySite.0.coding.0.display': 'Body Site',
  'stage.0.summary.text': 'Stage',
  onsetDateTime: 'Onset',
  onsetString: 'Onset',
  abatementDateTime: 'Resolved',
  abatementString: 'Resolved',
  recordedDate: 'Recorded',
  'note.0.text': 'Note',
};

export const MEDICATION_FIELDS: Record<string, string> = {
  'medicationCodeableConcept.text': 'Medication',
  'medicationCodeableConcept.coding.0.display': 'Medication',
  status: 'Status',
  intent: 'Intent',
  'dosageInstruction.0.text': 'Dosage',
  'dosage.0.text': 'Dosage',
  'dosageInstruction.0.timing.repeat.frequency': 'Frequency',
  'dosageInstruction.0.route.text': 'Route',
  'dosageInstruction.0.route.coding.0.display': 'Route',
  'courseOfTherapyType.text': 'Course Type',
  'reasonCode.0.text': 'Reason',
  'reasonCode.0.coding.0.display': 'Reason',
  authoredOn: 'Prescribed',
  effectiveDateTime: 'Effective',
  dateAsserted: 'Asserted',
  'note.0.text': 'Note',
};

export const ALLERGY_FIELDS: Record<string, string> = {
  'code.text': 'Substance',
  'code.coding.0.display': 'Substance',
  'clinicalStatus.coding.0.code': 'Clinical Status',
  'verificationStatus.coding.0.code': 'Verification',
  type: 'Type',
  'category.0': 'Category',
  criticality: 'Criticality',
  'reaction.0.manifestation.0.text': 'Reaction',
  'reaction.0.manifestation.0.coding.0.display': 'Reaction',
  'reaction.0.severity': 'Reaction Severity',
  'reaction.0.onset': 'Reaction Onset',
  'reaction.0.description': 'Description',
  onsetDateTime: 'Onset',
  recordedDate: 'Recorded',
  'note.0.text': 'Note',
};

export const OBSERVATION_FIELDS: Record<string, string> = {
  'code.text': 'Observation',
  'code.coding.0.display': 'Observation',
  status: 'Status',
  'category.0.coding.0.display': 'Category',
  'category.0.text': 'Category',
  'valueQuantity.value': 'Value',
  valueString: 'Value',
  'valueCodeableConcept.text': 'Value',
  'valueCodeableConcept.coding.0.display': 'Value',
  'valueQuantity.unit': 'Unit',
  'referenceRange.0.text': 'Reference Range',
  'referenceRange.0.low.value': 'Range Low',
  'referenceRange.0.high.value': 'Range High',
  'interpretation.0.coding.0.display': 'Interpretation',
  'interpretation.0.text': 'Interpretation',
  effectiveDateTime: 'Effective',
  issued: 'Issued',
  'note.0.text': 'Note',
};

export const PATIENT_FIELDS: Record<string, string> = {
  'name.0.text': 'Name',
  gender: 'Gender',
  birthDate: 'Date of Birth',
  deceasedBoolean: 'Deceased',
  deceasedDateTime: 'Date of Death',
  'address.0.text': 'Address',
  'address.0.city': 'City',
  'address.0.country': 'Country',
  'telecom.0.value': 'Contact',
  'maritalStatus.text': 'Marital Status',
  'maritalStatus.coding.0.display': 'Marital Status',
  'communication.0.language.text': 'Language',
};

export const ENCOUNTER_FIELDS: Record<string, string> = {
  'type.0.text': 'Type',
  'type.0.coding.0.display': 'Type',
  status: 'Status',
  'class.display': 'Class',
  'class.code': 'Class',
  'priority.text': 'Priority',
  'serviceType.text': 'Service',
  'serviceType.coding.0.display': 'Service',
  'period.start': 'Start',
  'period.end': 'End',
  'actualPeriod.start': 'Start',
  'actualPeriod.end': 'End',
  'serviceProvider.display': 'Provider',
  'reasonCode.0.text': 'Reason',
  'reasonCode.0.coding.0.display': 'Reason',
  'hospitalization.admitSource.text': 'Admission Source',
  'hospitalization.dischargeDisposition.text': 'Discharge',
  'length.value': 'Duration',
};

export const PROCEDURE_FIELDS: Record<string, string> = {
  'code.text': 'Procedure',
  'code.coding.0.display': 'Procedure',
  status: 'Status',
  'category.text': 'Category',
  'bodySite.0.text': 'Body Site',
  'bodySite.0.coding.0.display': 'Body Site',
  performedDateTime: 'Performed',
  'performedPeriod.start': 'Start',
  'performedPeriod.end': 'End',
  'outcome.text': 'Outcome',
  'outcome.coding.0.display': 'Outcome',
  'reasonCode.0.text': 'Reason',
  'complication.0.text': 'Complication',
  'note.0.text': 'Note',
};

export const IMMUNIZATION_FIELDS: Record<string, string> = {
  'vaccineCode.text': 'Vaccine',
  'vaccineCode.coding.0.display': 'Vaccine',
  status: 'Status',
  occurrenceDateTime: 'Date Given',
  occurrenceString: 'Date Given',
  primarySource: 'Primary Source',
  'manufacturer.display': 'Manufacturer',
  lotNumber: 'Lot Number',
  expirationDate: 'Expiry',
  'site.text': 'Site',
  'site.coding.0.display': 'Site',
  'route.text': 'Route',
  'route.coding.0.display': 'Route',
  'doseQuantity.value': 'Dose',
  'doseQuantity.unit': 'Dose Unit',
  'note.0.text': 'Note',
};

export const FAMILY_HISTORY_FIELDS: Record<string, string> = {
  'relationship.text': 'Relationship',
  'relationship.coding.0.display': 'Relationship',
  'sex.text': 'Sex',
  bornDate: 'Born',
  deceasedBoolean: 'Deceased',
  'deceasedAge.value': 'Age at Death',
  'condition.0.code.text': 'Condition',
  'condition.0.code.coding.0.display': 'Condition',
  'condition.0.outcome.text': 'Outcome',
  'condition.0.onsetAge.value': 'Onset Age',
  'note.0.text': 'Note',
};

export const PRACTITIONER_FIELDS: Record<string, string> = {
  'name.0.text': 'Name',
  gender: 'Gender',
  birthDate: 'Date of Birth',
  'telecom.0.value': 'Contact',
  'address.0.text': 'Address',
  'qualification.0.code.text': 'Qualification',
  'qualification.0.code.coding.0.display': 'Qualification',
  'qualification.0.issuer.display': 'Issuer',
};

export const ORGANIZATION_FIELDS: Record<string, string> = {
  name: 'Name',
  'type.0.text': 'Type',
  'type.0.coding.0.display': 'Type',
  'telecom.0.value': 'Contact',
  'address.0.text': 'Address',
  'address.0.city': 'City',
  'address.0.country': 'Country',
};

export const DIAGNOSTIC_REPORT_FIELDS: Record<string, string> = {
  'code.text': 'Report',
  'code.coding.0.display': 'Report',
  status: 'Status',
  'category.0.text': 'Category',
  'category.0.coding.0.display': 'Category',
  effectiveDateTime: 'Effective',
  issued: 'Issued',
  conclusion: 'Conclusion',
  'conclusionCode.0.text': 'Conclusion Code',
};

/**
 * Builds a field map dynamically from any FHIR resource by walking
 * its top-level keys. Used by GenericRow for unrecognised resource types.
 *
 * Only includes primitive values (string, number, boolean) — skips nested
 * objects and arrays which would just render as "[object Object]".
 * This means you get the flat fields (id, status, dates etc.) for free
 * without needing to know the resource shape in advance.
 */
export function buildGenericFieldMap(resource: any): Record<string, string> {
  const map: Record<string, string> = {};
  const skip = new Set(['resourceType', 'id', 'meta', 'text', 'contained']);

  for (const key of Object.keys(resource)) {
    if (skip.has(key)) continue;
    const value = resource[key];

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      // Convert camelCase key → "Camel Case" label
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      map[key] = label;
    }
  }

  return map;
}
