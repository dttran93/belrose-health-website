// @vitest-environment jsdom
//
// src/features/HealthProfile/hooks/__tests__/useResourceFields.test.ts
//
// Tier 1 — pure dot-notation field resolution + formatting, rendered via renderHook since it's a
// real hook (wraps useMemo). Covers array-index path segments, boolean->Yes/No, ISO-date
// detection/formatting vs. non-date strings, null/undefined/empty-string skipping, and label
// deduplication when multiple paths map to the same display label.

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResourceFields } from '../useResourceFields';
import type { FHIRResource } from '@/types/fhir';

function run(resource: any, fieldMap: Record<string, string>) {
  const { result } = renderHook(() => useResourceFields(resource as FHIRResource, fieldMap));
  return result.current;
}

describe('useResourceFields', () => {
  it('resolves a simple dot-notation path', () => {
    const result = run({ code: { text: 'Diabetes' } }, { 'code.text': 'Condition' });
    expect(result).toEqual([{ label: 'Condition', value: 'Diabetes' }]);
  });

  it('resolves paths through numeric array indices', () => {
    const result = run(
      { clinicalStatus: { coding: [{ code: 'active' }] } },
      { 'clinicalStatus.coding.0.code': 'Status' }
    );
    expect(result).toEqual([{ label: 'Status', value: 'active' }]);
  });

  it('skips fields that resolve to null, undefined, or empty string', () => {
    const result = run(
      { a: null, b: undefined, c: '', d: 'kept' },
      { a: 'A', b: 'B', c: 'C', d: 'D' }
    );
    expect(result).toEqual([{ label: 'D', value: 'kept' }]);
  });

  it('silently skips paths through a missing intermediate object', () => {
    const result = run({}, { 'a.b.c': 'Missing' });
    expect(result).toEqual([]);
  });

  it('formats booleans as Yes/No', () => {
    const result = run({ active: true, chronic: false }, { active: 'Active', chronic: 'Chronic' });
    expect(result).toEqual([
      { label: 'Active', value: 'Yes' },
      { label: 'Chronic', value: 'No' },
    ]);
  });

  it('stringifies non-string, non-boolean values', () => {
    const result = run({ count: 42 }, { count: 'Count' });
    expect(result).toEqual([{ label: 'Count', value: '42' }]);
  });

  it('reformats ISO-date-shaped strings but leaves other strings untouched', () => {
    const result = run(
      { onsetDateTime: '2024-03-15', status: 'active-not-a-date' },
      { onsetDateTime: 'Onset', status: 'Status' }
    );

    const onset = result.find(r => r.label === 'Onset');
    const status = result.find(r => r.label === 'Status');
    expect(onset?.value).not.toBe('2024-03-15'); // got reformatted
    expect(onset?.value).toMatch(/2024/);
    expect(status?.value).toBe('active-not-a-date'); // untouched — not date-shaped
  });

  it('falls back to the raw value if the date-shaped string fails to format', () => {
    const result = run({ date: '2024-99-99' }, { date: 'Date' }); // looks date-shaped, isn't valid
    expect(result[0]?.value).toBe('2024-99-99');
  });

  it('deduplicates by label, keeping only the first path that resolves', () => {
    const result = run(
      { primary: 'first', secondary: 'second' },
      { primary: 'Value', secondary: 'Value' }
    );
    expect(result).toEqual([{ label: 'Value', value: 'first' }]);
  });

  it('returns an empty array for an empty field map', () => {
    expect(run({ anything: 'x' }, {})).toEqual([]);
  });
});
