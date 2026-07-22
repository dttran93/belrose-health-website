// @vitest-environment jsdom
//
// src/features/ViewEditRecord/hooks/__tests__/useRecordFilters.test.ts
//
// Tier 1 — pure useMemo search/filter/sort logic, no mocking. Covers case-insensitive
// search-by-name-or-sourceType, the sourceType dropdown filter, the unique sourceTypes list,
// and newest-first date sorting (including records with no date sorting to the end).

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecordFilters } from '../useRecordFilters';
import type { FileObject } from '@/types/core';

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'r1',
    fileName: 'Blood Test.pdf',
    fileSize: 100,
    fileType: 'application/pdf',
    administrators: ['user-1'],
    status: 'completed',
    sourceType: 'File Upload',
    ...overrides,
  } as FileObject;
}

describe('useRecordFilters — search + sourceType filter', () => {
  it('matches by fileName, case-insensitively', () => {
    const records = [makeRecord({ id: 'a', fileName: 'Blood Test.pdf' }), makeRecord({ id: 'b', fileName: 'X-Ray.pdf' })];
    const { result } = renderHook(() => useRecordFilters(records));

    act(() => result.current.setSearchTerm('blood'));

    expect(result.current.filteredRecords.map(r => r.id)).toEqual(['a']);
  });

  it('matches by sourceType when the search term does not match the fileName', () => {
    const records = [
      makeRecord({ id: 'a', fileName: 'note.pdf', sourceType: 'Plain Text Submission' }),
      makeRecord({ id: 'b', fileName: 'scan.pdf', sourceType: 'File Upload' }),
    ];
    const { result } = renderHook(() => useRecordFilters(records));

    act(() => result.current.setSearchTerm('plain text'));

    expect(result.current.filteredRecords.map(r => r.id)).toEqual(['a']);
  });

  it('filters by sourceType via sourceTypeFilter', () => {
    const records = [
      makeRecord({ id: 'a', sourceType: 'File Upload' }),
      makeRecord({ id: 'b', sourceType: 'Plain Text Submission' }),
    ];
    const { result } = renderHook(() => useRecordFilters(records));

    act(() => result.current.setSourceTypeFilter('Plain Text Submission'));

    expect(result.current.filteredRecords.map(r => r.id)).toEqual(['b']);
  });

  it('combines search and sourceType filters (both must match)', () => {
    const records = [
      makeRecord({ id: 'a', fileName: 'Blood Test.pdf', sourceType: 'File Upload' }),
      makeRecord({ id: 'b', fileName: 'Blood Panel.pdf', sourceType: 'Plain Text Submission' }),
    ];
    const { result } = renderHook(() => useRecordFilters(records));

    act(() => {
      result.current.setSearchTerm('blood');
      result.current.setSourceTypeFilter('File Upload');
    });

    expect(result.current.filteredRecords.map(r => r.id)).toEqual(['a']);
  });

  it('exposes a de-duplicated list of sourceTypes present in the records', () => {
    const records = [
      makeRecord({ id: 'a', sourceType: 'File Upload' }),
      makeRecord({ id: 'b', sourceType: 'File Upload' }),
      makeRecord({ id: 'c', sourceType: 'Plain Text Submission' }),
      makeRecord({ id: 'd', sourceType: undefined }),
    ];
    const { result } = renderHook(() => useRecordFilters(records));

    expect(result.current.sourceTypes.sort()).toEqual(['File Upload', 'Plain Text Submission']);
  });
});

describe('useRecordFilters — sortedRecords', () => {
  it('sorts by createdAt, newest first', () => {
    const records = [
      makeRecord({ id: 'oldest', createdAt: new Date('2024-01-01') as any }),
      makeRecord({ id: 'newest', createdAt: new Date('2024-06-01') as any }),
      makeRecord({ id: 'middle', createdAt: new Date('2024-03-01') as any }),
    ];
    const { result } = renderHook(() => useRecordFilters(records));

    expect(result.current.sortedRecords.map(r => r.id)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('places records with no date after all dated records', () => {
    const records = [
      makeRecord({ id: 'no-date', createdAt: undefined }),
      makeRecord({ id: 'dated', createdAt: new Date('2024-01-01') as any }),
    ];
    const { result } = renderHook(() => useRecordFilters(records));

    expect(result.current.sortedRecords.map(r => r.id)).toEqual(['dated', 'no-date']);
  });

  it('reflects the filtered set, not the full record list', () => {
    const records = [
      makeRecord({ id: 'a', fileName: 'keep.pdf', createdAt: new Date('2024-01-01') as any }),
      makeRecord({ id: 'b', fileName: 'drop.pdf', createdAt: new Date('2024-06-01') as any }),
    ];
    const { result } = renderHook(() => useRecordFilters(records));

    act(() => result.current.setSearchTerm('keep'));

    expect(result.current.sortedRecords.map(r => r.id)).toEqual(['a']);
  });
});
