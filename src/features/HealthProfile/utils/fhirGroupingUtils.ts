// src/features/HealthProfile/utils/fhirGroupingUtils.ts

/**
 * fhirGroupingUtils.ts
 *
 * Pure utility functions for extracting and grouping FHIR resources across
 * multiple FileObjects (records). No React, no side effects — just data
 * transformation logic that can be tested in isolation.
 *
 * The core job:
 *   FileObject[] → flatten all FHIR bundle entries → group by display category
 *
 */

import { FileObject } from '@/types/core';
import { FHIRResource } from '@/types/fhir';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A FHIR resource with provenance metadata attached — i.e. which record it
 * came from. This lets us show "Source: GP Visit 2023" badges in the UI.
 */
export interface FHIRResourceWithProvenance {
  resource: FHIRResource;
  sourceRecordId: string;
  sourceRecordName: string;
  sourceRecordDate?: string; // ISO string from record.createdAt, if available
}

/**
 * The display-level category config for each FHIR resource type.
 * `categoryKey` is what we group by in the UI (e.g. multiple FHIR resource
 * types can map to the same category — see Medications below).
 */
export interface CategoryConfig {
  categoryKey: HealthProfileCategory;
  label: string;
  icon: string;
  priority: number;
}

/**
 * The canonical set of display categories for the HealthProfile.
 * These are the "buckets" a doctor or patient would expect to see.
 *
 * Clinical data:
 *   conditions, medications, allergies, observations, procedures, immunizations
 * Supporting context:
 *   care_team  — Practitioner, PractitionerRole (who treated the patient)
 *   providers  — Organization (hospitals, clinics, pharmacies)
 *   locations  — Location (specific physical sites)
 * Documents & catch-all:
 *   documents, other
 */
export type HealthProfileCategory =
  | 'conditions'
  | 'medications'
  | 'allergies'
  | 'observations'
  | 'procedures'
  | 'immunizations'
  | 'visits'
  | 'family_history'
  | 'care_team'
  | 'patients'
  | 'providers'
  | 'locations'
  | 'documents'
  | 'other';

/**
 * The final grouped output: a map from category key to an array of
 * FHIR resources (with provenance) that belong to that category.
 */
export type GroupedHealthData = Map<HealthProfileCategory, FHIRResourceWithProvenance[]>;

/**
 * Summary stats returned alongside the grouped data.
 */
export interface HealthProfileSummary {
  totalRecordsProcessed: number;
  totalResourcesExtracted: number;
  categoryCounts: Record<HealthProfileCategory, number>;
  /** Records that had no parseable FHIR data — useful for debugging */
  recordsWithNoFhir: string[];
}

// ============================================================================
// CATEGORY CONFIGURATION
// ============================================================================

/**
 * Maps FHIR resourceType strings → display category config.
 *
 * We capture everything — no resources are discarded. Each type gets its own
 * category so future tabs (e.g. "Care Team", "Providers", "Locations") can
 * be surfaced without any data layer changes.
 *
 * Grouping rationale:
 * - MedicationRequest + MedicationStatement → 'medications' (same clinical concept)
 * - DiagnosticReport → 'observations' (structured lab result, same viewer context)
 * - Practitioner + PractitionerRole + Patient → 'care_team' (who was involved)
 * - Organization → 'providers' (institutions: hospitals, clinics, pharmacies)
 * - Location → 'locations' (physical sites — useful for referral context)
 * - Nested Bundle → 'other' (shouldn't happen but handled gracefully)
 * - Anything unknown → 'other'
 */
export const FHIR_CATEGORY_MAP: Record<string, CategoryConfig> = {
  // --- Clinical data ---
  Condition: {
    categoryKey: 'conditions',
    label: 'Conditions',
    icon: 'activity',
    priority: 1,
  },
  MedicationStatement: {
    categoryKey: 'medications',
    label: 'Medications',
    icon: 'pill',
    priority: 2,
  },
  MedicationRequest: {
    categoryKey: 'medications',
    label: 'Medications',
    icon: 'pill',
    priority: 2,
  },
  AllergyIntolerance: {
    categoryKey: 'allergies',
    label: 'Allergies',
    icon: 'alert-triangle',
    priority: 3,
  },
  Observation: {
    categoryKey: 'observations',
    label: 'Observations & Labs',
    icon: 'bar-chart-2',
    priority: 4,
  },
  DiagnosticReport: {
    categoryKey: 'observations',
    label: 'Observations & Labs',
    icon: 'bar-chart-2',
    priority: 4,
  },
  Procedure: {
    categoryKey: 'procedures',
    label: 'Procedures',
    icon: 'scissors',
    priority: 5,
  },
  Immunization: {
    categoryKey: 'immunizations',
    label: 'Immunizations',
    icon: 'shield',
    priority: 6,
  },
  // --- Encounters & family context ---
  Encounter: {
    categoryKey: 'visits',
    label: 'Visits & Encounters',
    icon: 'calendar',
    priority: 7,
  },
  EpisodeOfCare: {
    categoryKey: 'visits',
    label: 'Visits & Encounters',
    icon: 'calendar',
    priority: 7,
  },
  FamilyMemberHistory: {
    categoryKey: 'family_history',
    label: 'Family History',
    icon: 'users',
    priority: 8,
  },
  // --- Care context (who, where) ---
  Practitioner: {
    categoryKey: 'care_team',
    label: 'Care Team',
    icon: 'user-check',
    priority: 9,
  },
  PractitionerRole: {
    categoryKey: 'care_team',
    label: 'Care Team',
    icon: 'user-check',
    priority: 9,
  },
  Patient: {
    categoryKey: 'patients',
    label: 'Patient',
    icon: 'user',
    priority: 0,
  },
  Organization: {
    categoryKey: 'providers',
    label: 'Providers & Organisations',
    icon: 'building-2',
    priority: 10,
  },
  Location: {
    categoryKey: 'locations',
    label: 'Locations',
    icon: 'map-pin',
    priority: 11,
  },
  // --- Documents ---
  DocumentReference: {
    categoryKey: 'documents',
    label: 'Documents',
    icon: 'file-text',
    priority: 12,
  },
};

/**
 * Config for the 'other' catch-all category.
 * Any resourceType not listed in FHIR_CATEGORY_MAP ends up here —
 * this ensures we never silently discard data we don't recognise yet.
 */
export const OTHER_CATEGORY_CONFIG: CategoryConfig = {
  categoryKey: 'other',
  label: 'Other',
  icon: 'more-horizontal',
  priority: 13,
};

// ============================================================================
// CORE EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract all FHIR resources from a single FileObject's fhirData bundle.
 *
 * A FileObject's fhirData is a FHIR Bundle that looks like:
 * {
 *   resourceType: "Bundle",
 *   entry: [
 *     { resource: { resourceType: "Condition", ... } },
 *     { resource: { resourceType: "MedicationStatement", ... } },
 *     ...
 *   ]
 * }
 *
 * We pull out each entry.resource and attach provenance from the parent record.
 */
export function extractResourcesFromRecord(record: FileObject): FHIRResourceWithProvenance[] {
  // Guard: no fhirData on this record
  if (!record.fhirData) {
    return [];
  }

  const fhirData = record.fhirData as any;

  // Guard: must be a Bundle with entries
  if (fhirData.resourceType !== 'Bundle' || !Array.isArray(fhirData.entry)) {
    // Handle edge case: someone stored a single resource (not a bundle)
    if (fhirData.resourceType && fhirData.resourceType !== 'Bundle') {
      return [
        {
          resource: fhirData as FHIRResource,
          sourceRecordId: record.id,
          sourceRecordName: record.belroseFields?.title || record.fileName || 'Unknown Record',
          sourceRecordDate: resolveRecordDate(record),
        },
      ];
    }
    return [];
  }

  // Flatten all bundle entries into provenance-tagged resources
  const results: FHIRResourceWithProvenance[] = [];

  for (const entry of fhirData.entry) {
    const resource = entry?.resource;

    // Skip malformed entries
    if (!resource || !resource.resourceType) {
      continue;
    }

    // Skip nested Bundles — these are structural wrappers, not clinical data.
    // A Bundle inside a Bundle shouldn't occur in practice but guard anyway.
    if (resource.resourceType === 'Bundle') {
      continue;
    }

    results.push({
      resource: resource as FHIRResource,
      sourceRecordId: record.id,
      sourceRecordName: record.belroseFields?.title || record.fileName || 'Unknown Record',
      sourceRecordDate: resolveRecordDate(record),
    });
  }

  return results;
}

// ============================================================================
// CORE GROUPING FUNCTION
// ============================================================================

/**
 * The main entry point for the HealthProfile data layer.
 *
 * Takes an array of FileObjects (a subject's records) and returns:
 * 1. `grouped` — resources organised by display category
 * 2. `summary` — counts and metadata for the UI
 *
 * Example usage in useHealthProfile.ts:
 *   const { grouped, summary } = groupResourcesByCategory(records);
 *   // grouped.get('medications') → [{ resource: MedicationStatement, sourceRecordId: '...', ... }]
 */
export function groupResourcesByCategory(records: FileObject[]): {
  grouped: GroupedHealthData;
  summary: HealthProfileSummary;
} {
  // Initialise an empty map with all categories so the UI always has
  // every bucket available (even if it's empty).
  const grouped: GroupedHealthData = new Map([
    ['conditions', []],
    ['medications', []],
    ['allergies', []],
    ['observations', []],
    ['procedures', []],
    ['immunizations', []],
    ['visits', []],
    ['family_history', []],
    ['care_team', []],
    ['patients', []],
    ['providers', []],
    ['locations', []],
    ['documents', []],
    ['other', []],
  ]);

  const recordsWithNoFhir: string[] = [];
  let totalResourcesExtracted = 0;

  for (const record of records) {
    const resources = extractResourcesFromRecord(record);

    if (resources.length === 0) {
      recordsWithNoFhir.push(record.id);
      continue;
    }

    totalResourcesExtracted += resources.length;

    for (const taggedResource of resources) {
      const resourceType = taggedResource.resource.resourceType;
      const categoryConfig = FHIR_CATEGORY_MAP[resourceType];

      if (categoryConfig) {
        // Known category — push to the right bucket
        const bucket = grouped.get(categoryConfig.categoryKey)!;
        bucket.push(taggedResource);
      } else {
        // Unknown resourceType — goes to 'other'
        grouped.get('other')!.push(taggedResource);
      }
    }
  }

  // Build summary counts from the grouped map
  const categoryCounts = {} as Record<HealthProfileCategory, number>;
  for (const [category, items] of grouped.entries()) {
    categoryCounts[category] = items.length;
  }

  const summary: HealthProfileSummary = {
    totalRecordsProcessed: records.length,
    totalResourcesExtracted,
    categoryCounts,
    recordsWithNoFhir,
  };

  return { grouped, summary };
}

// ============================================================================
// CATEGORY METADATA HELPERS
// ============================================================================

/**
 * Get the display config for a category key (label, icon, priority).
 * Useful in the UI when rendering a CategoryCard — you pass the key and
 * get back everything you need to render the card header.
 */
export function getCategoryConfig(category: HealthProfileCategory): CategoryConfig {
  // Find the first FHIR_CATEGORY_MAP entry that has this categoryKey,
  // or fall back to the OTHER_CATEGORY_CONFIG.
  const match = Object.values(FHIR_CATEGORY_MAP).find(c => c.categoryKey === category);
  return match ?? OTHER_CATEGORY_CONFIG;
}

/**
 * Get all categories sorted by priority (for rendering the grid in order).
 * Returns only categories that have at least one resource — no empty cards.
 */
export function getPopulatedCategoriesSorted(grouped: GroupedHealthData): HealthProfileCategory[] {
  return (Array.from(grouped.entries()) as [HealthProfileCategory, FHIRResourceWithProvenance[]][])
    .filter(([, items]) => items.length > 0)
    .sort(([catA], [catB]) => {
      const priorityA = getCategoryConfig(catA).priority;
      const priorityB = getCategoryConfig(catB).priority;
      return priorityA - priorityB;
    })
    .map(([category]) => category);
}

// ============================================================================
// RESOURCE DISPLAY HELPERS
// ============================================================================

/**
 * Extract a human-readable display name from any FHIR resource.
 *
 * Each resource type stores its "name" in a different field — this function
 * knows where to look for each type and returns a sensible fallback if
 * nothing useful is found.
 *
 * This is used by ResourceItem.tsx to render the primary label for each row.
 */
export function getResourceDisplayName(resource: FHIRResource): string {
  const r = resource as any; // use `any` to access dynamic fields safely

  switch (resource.resourceType) {
    case 'Condition':
      return (
        r.code?.text ||
        r.code?.coding?.[0]?.display ||
        r.code?.coding?.[0]?.code ||
        'Unknown Condition'
      );

    case 'MedicationStatement':
    case 'MedicationRequest':
      return (
        r.medicationCodeableConcept?.text ||
        r.medicationCodeableConcept?.coding?.[0]?.display ||
        r.medicationReference?.display ||
        'Unknown Medication'
      );

    case 'AllergyIntolerance':
      return (
        r.code?.text ||
        r.code?.coding?.[0]?.display ||
        r.reaction?.[0]?.substance?.text ||
        'Unknown Allergy'
      );

    case 'Observation':
      return r.code?.text || r.code?.coding?.[0]?.display || 'Unknown Observation';

    case 'DiagnosticReport':
      return r.code?.text || r.code?.coding?.[0]?.display || 'Diagnostic Report';

    case 'Procedure':
      return r.code?.text || r.code?.coding?.[0]?.display || 'Unknown Procedure';

    case 'Immunization':
      return r.vaccineCode?.text || r.vaccineCode?.coding?.[0]?.display || 'Unknown Immunization';

    case 'Encounter':
      return (
        r.type?.[0]?.text ||
        r.type?.[0]?.coding?.[0]?.display ||
        r.class?.display ||
        r.class?.code ||
        'Encounter'
      );

    case 'FamilyMemberHistory':
      return r.relationship?.text || r.relationship?.coding?.[0]?.display || 'Family Member';

    case 'DocumentReference':
      return r.description || r.type?.text || r.type?.coding?.[0]?.display || 'Document';

    default:
      return r.code?.text || r.id || resource.resourceType;
  }
}

/**
 * Extract the most relevant date from a FHIR resource, as an ISO string.
 * Returns undefined if no date is found.
 *
 * Used for sorting items within a category (most recent first) and for
 * displaying the date in ResourceItem.tsx.
 */
export function getResourceDate(resource: FHIRResource): string | undefined {
  const r = resource as any;

  switch (resource.resourceType) {
    case 'Condition':
      return r.onsetDateTime || r.recordedDate;

    case 'MedicationStatement':
      return r.effectiveDateTime || r.effectivePeriod?.start || r.dateAsserted;

    case 'MedicationRequest':
      return r.authoredOn;

    case 'AllergyIntolerance':
      return r.recordedDate || r.onsetDateTime;

    case 'Observation':
      return r.effectiveDateTime || r.effectivePeriod?.start || r.issued;

    case 'DiagnosticReport':
      return r.effectiveDateTime || r.effectivePeriod?.start || r.issued;

    case 'Procedure':
      return r.performedDateTime || r.performedPeriod?.start;

    case 'Immunization':
      return r.occurrenceDateTime || r.occurrenceString;

    case 'Encounter':
      return r.period?.start || r.actualPeriod?.start;

    case 'FamilyMemberHistory':
      return r.date;

    case 'DocumentReference':
      return r.date;

    default:
      return undefined;
  }
}

/**
 * Extract a secondary detail string for display (e.g. dosage, status, value).
 * Keeps cards informative without overwhelming — one key detail per resource.
 */
export function getResourceSecondaryDetail(resource: FHIRResource): string | undefined {
  const r = resource as any;

  switch (resource.resourceType) {
    case 'Condition':
      return r.clinicalStatus?.coding?.[0]?.code
        ? `Status: ${r.clinicalStatus.coding[0].code}`
        : undefined;

    case 'MedicationStatement':
    case 'MedicationRequest':
      return r.dosageInstruction?.[0]?.text || r.dosage?.[0]?.text;

    case 'AllergyIntolerance':
      return r.criticality ? `Criticality: ${r.criticality}` : undefined;

    case 'Observation': {
      if (r.valueQuantity) {
        return `${r.valueQuantity.value} ${r.valueQuantity.unit || ''}`.trim();
      }
      if (r.valueString) return r.valueString;
      if (r.valueCodeableConcept?.text) return r.valueCodeableConcept.text;
      return undefined;
    }

    case 'Procedure':
      return r.status ? `Status: ${r.status}` : undefined;

    case 'Immunization':
      return r.status ? `Status: ${r.status}` : undefined;

    case 'Encounter':
      return r.status ? `Status: ${r.status}` : undefined;

    case 'FamilyMemberHistory': {
      // Surface any recorded conditions for this family member
      const condition =
        r.condition?.[0]?.code?.text || r.condition?.[0]?.code?.coding?.[0]?.display;
      return condition ? `Condition: ${condition}` : undefined;
    }

    default:
      return undefined;
  }
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Resolve the best available date string from a FileObject.
 * Handles Firestore Timestamp objects and plain ISO strings.
 */
function resolveRecordDate(record: FileObject): string | undefined {
  const raw = record.belroseFields?.completedDate || record.createdAt || record.uploadedAt;
  if (!raw) return undefined;

  // Firestore Timestamps have a toDate() method
  if (typeof (raw as any).toDate === 'function') {
    return (raw as any).toDate().toISOString();
  }

  // Plain string or number
  if (typeof raw === 'string' || typeof raw === 'number') {
    return new Date(raw).toISOString();
  }

  return undefined;
}
