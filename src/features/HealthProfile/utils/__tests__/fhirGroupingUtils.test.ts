// src/features/HealthProfile/utils/__tests__/fhirGroupingUtils.test.ts
//
// Tier 1 — pure FHIR extraction/grouping/display-helper functions, no mocking. Covers
// extractResourcesFromRecord's Bundle/single-resource/malformed-entry/nested-Bundle branches,
// groupResourcesByCategory's known-vs-unknown resourceType routing and summary counts,
// getPopulatedCategoriesSorted's priority ordering, and the per-resourceType display helpers.

import { describe, it, expect } from 'vitest';
import {
  extractResourcesFromRecord,
  groupResourcesByCategory,
  getCategoryConfig,
  getPopulatedCategoriesSorted,
  getResourceDisplayName,
  getResourceDate,
  getResourceSecondaryDetail,
} from '../fhirGroupingUtils';
import type { FileObject } from '@/types/core';
import type { FHIRResource } from '@/types/fhir';

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'record-1',
    fileName: 'labs.pdf',
    fileSize: 100,
    fileType: 'application/pdf',
    administrators: ['user-1'],
    status: 'completed',
    ...overrides,
  } as FileObject;
}

function bundle(resources: any[]) {
  return { resourceType: 'Bundle', entry: resources.map(r => ({ resource: r })) };
}

describe('extractResourcesFromRecord', () => {
  it('returns [] when the record has no fhirData', () => {
    expect(extractResourcesFromRecord(makeRecord({ fhirData: undefined }))).toEqual([]);
  });

  it('extracts every entry from a well-formed Bundle, tagged with provenance', () => {
    const record = makeRecord({
      id: 'rec-1',
      fileName: 'visit.pdf',
      belroseFields: { title: 'GP Visit' } as any,
      fhirData: bundle([{ resourceType: 'Condition' }, { resourceType: 'MedicationStatement' }]) as any,
    });

    const result = extractResourcesFromRecord(record);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      resource: { resourceType: 'Condition' },
      sourceRecordId: 'rec-1',
      sourceRecordName: 'GP Visit',
    });
  });

  it('falls back to fileName when belroseFields.title is absent', () => {
    const record = makeRecord({
      fileName: 'raw.pdf',
      fhirData: bundle([{ resourceType: 'Condition' }]) as any,
    });
    expect(extractResourcesFromRecord(record)[0]?.sourceRecordName).toBe('raw.pdf');
  });

  it('handles a single stored resource (not wrapped in a Bundle) as an edge case', () => {
    const record = makeRecord({ fhirData: { resourceType: 'Condition', id: 'c1' } as any });
    const result = extractResourcesFromRecord(record);
    expect(result).toHaveLength(1);
    expect(result[0]?.resource).toMatchObject({ resourceType: 'Condition' });
  });

  it('skips malformed entries (missing resource or resourceType)', () => {
    const record = makeRecord({
      fhirData: {
        resourceType: 'Bundle',
        entry: [{ resource: null }, {}, { resource: { resourceType: 'Condition' } }],
      } as any,
    });
    expect(extractResourcesFromRecord(record)).toHaveLength(1);
  });

  it('skips nested Bundles inside entries', () => {
    const record = makeRecord({
      fhirData: bundle([{ resourceType: 'Bundle' }, { resourceType: 'Condition' }]) as any,
    });
    expect(extractResourcesFromRecord(record)).toHaveLength(1);
  });

  it('returns [] for a Bundle-shaped object with a non-array entry', () => {
    const record = makeRecord({ fhirData: { resourceType: 'Bundle', entry: 'not-an-array' } as any });
    expect(extractResourcesFromRecord(record)).toEqual([]);
  });
});

describe('groupResourcesByCategory', () => {
  it('initializes every category, even when empty', () => {
    const { grouped } = groupResourcesByCategory([]);
    expect(grouped.get('conditions')).toEqual([]);
    expect(grouped.get('other')).toEqual([]);
  });

  it('routes known resourceTypes to their mapped category', () => {
    const record = makeRecord({
      fhirData: bundle([
        { resourceType: 'Condition' },
        { resourceType: 'MedicationRequest' },
        { resourceType: 'MedicationStatement' },
      ]) as any,
    });

    const { grouped, summary } = groupResourcesByCategory([record]);
    expect(grouped.get('conditions')).toHaveLength(1);
    expect(grouped.get('medications')).toHaveLength(2); // both medication types share one category
    expect(summary.totalResourcesExtracted).toBe(3);
    expect(summary.categoryCounts.medications).toBe(2);
  });

  it('routes unknown resourceTypes to "other"', () => {
    const record = makeRecord({ fhirData: bundle([{ resourceType: 'CarePlan' }]) as any });
    const { grouped } = groupResourcesByCategory([record]);
    expect(grouped.get('other')).toHaveLength(1);
  });

  it('tracks records with no parseable FHIR data separately', () => {
    const withFhir = makeRecord({ id: 'has-fhir', fhirData: bundle([{ resourceType: 'Condition' }]) as any });
    const withoutFhir = makeRecord({ id: 'no-fhir', fhirData: undefined });

    const { summary } = groupResourcesByCategory([withFhir, withoutFhir]);
    expect(summary.totalRecordsProcessed).toBe(2);
    expect(summary.recordsWithNoFhir).toEqual(['no-fhir']);
  });
});

describe('getCategoryConfig / getPopulatedCategoriesSorted', () => {
  it('falls back to OTHER_CATEGORY_CONFIG for the "other" category', () => {
    expect(getCategoryConfig('other').label).toBe('Other');
  });

  it('returns only non-empty categories, sorted by priority', () => {
    const grouped = groupResourcesByCategory([
      makeRecord({
        fhirData: bundle([
          { resourceType: 'Organization' }, // priority 10
          { resourceType: 'Condition' }, // priority 1
          { resourceType: 'Immunization' }, // priority 6
        ]) as any,
      }),
    ]).grouped;

    expect(getPopulatedCategoriesSorted(grouped)).toEqual(['conditions', 'immunizations', 'providers']);
  });
});

describe('getResourceDisplayName', () => {
  it('resolves Condition via code.text, falling back through coding display/code', () => {
    expect(getResourceDisplayName({ resourceType: 'Condition', code: { text: 'Diabetes' } } as any)).toBe(
      'Diabetes'
    );
    expect(
      getResourceDisplayName({
        resourceType: 'Condition',
        code: { coding: [{ display: 'Diabetes mellitus' }] },
      } as any)
    ).toBe('Diabetes mellitus');
    expect(getResourceDisplayName({ resourceType: 'Condition' } as any)).toBe('Unknown Condition');
  });

  it('resolves MedicationRequest via medicationCodeableConcept', () => {
    expect(
      getResourceDisplayName({
        resourceType: 'MedicationRequest',
        medicationCodeableConcept: { text: 'Ibuprofen' },
      } as any)
    ).toBe('Ibuprofen');
  });

  it('falls back to resourceType for an unrecognized resource', () => {
    expect(getResourceDisplayName({ resourceType: 'CarePlan' } as any)).toBe('CarePlan');
  });
});

describe('getResourceDate', () => {
  it('resolves per-resourceType date fields', () => {
    expect(getResourceDate({ resourceType: 'Condition', onsetDateTime: '2024-01-01' } as any)).toBe(
      '2024-01-01'
    );
    expect(
      getResourceDate({ resourceType: 'Immunization', occurrenceDateTime: '2024-02-02' } as any)
    ).toBe('2024-02-02');
    expect(getResourceDate({ resourceType: 'CarePlan' } as any)).toBeUndefined();
  });
});

describe('getResourceSecondaryDetail', () => {
  it('formats an Observation valueQuantity', () => {
    expect(
      getResourceSecondaryDetail({
        resourceType: 'Observation',
        valueQuantity: { value: 98.6, unit: 'F' },
      } as any)
    ).toBe('98.6 F');
  });

  it('returns undefined when there is nothing to show', () => {
    expect(getResourceSecondaryDetail({ resourceType: 'Observation' } as any)).toBeUndefined();
  });

  it('formats AllergyIntolerance criticality', () => {
    expect(
      getResourceSecondaryDetail({ resourceType: 'AllergyIntolerance', criticality: 'high' } as any)
    ).toBe('Criticality: high');
  });
});
