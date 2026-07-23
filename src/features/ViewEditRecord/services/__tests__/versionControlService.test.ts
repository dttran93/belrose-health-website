// src/features/ViewEditRecord/services/__tests__/versionControlService.test.ts
//
// Tier 1 — mocks firebase/auth and firebase/firestore (only needed so VersionControlService
// can be constructed); json-diff-ts is real. Exercises calculateDifferences/flattenDiffToChanges
// (private, reached via `as any`) to prove that editing a single nested field does NOT also
// produce spurious ancestor "changed" entries (json-diff-ts wraps every ancestor object/array
// level containing a nested diff in its own UPDATE entry with no value/oldValue — only the
// deepest leaf entry is a real change), and that array indices render as bracket-notation
// path segments (`entry[0]`) rather than dot-joined ones (`entry.0`).

import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  Timestamp: { now: vi.fn(() => 'now') },
}));

import { VersionControlService } from '../versionControlService';

function calculateDifferences(oldData: any, newData: any) {
  const service = new VersionControlService();
  return (service as any).calculateDifferences(oldData, newData);
}

describe('VersionControlService.calculateDifferences', () => {
  it('reports only the leaf change for a nested object update, not ancestor containers', () => {
    const oldData = { belroseFields: { patient: { a: 1, b: 'x' } } };
    const newData = { belroseFields: { patient: { a: 2, b: 'x' } } };

    const changes = calculateDifferences(oldData, newData);

    expect(changes).toEqual([
      {
        operation: 'update',
        path: 'belroseFields.patient.a',
        oldValue: 1,
        newValue: 2,
        description: 'Updated belroseFields.patient.a',
      },
    ]);
  });

  it('reports only the leaf change for an array-element field update, using bracket-notation path', () => {
    const oldData = {
      fhirData: { entry: [{ resource: { resourceType: 'Patient', name: 'Old Name' } }] },
    };
    const newData = {
      fhirData: { entry: [{ resource: { resourceType: 'Patient', name: 'New Name' } }] },
    };

    const changes = calculateDifferences(oldData, newData);

    expect(changes).toEqual([
      {
        operation: 'update',
        path: 'fhirData.entry[0].resource.name',
        oldValue: 'Old Name',
        newValue: 'New Name',
        description: 'Updated fhirData.entry[0].resource.name',
      },
    ]);
  });

  it('still reports additions and removals correctly', () => {
    const oldData = { belroseFields: { patient: { a: 1 } } };
    const newData = { belroseFields: { patient: { a: 1, c: 3 } } };

    const added = calculateDifferences(oldData, newData);
    expect(added).toEqual([
      {
        operation: 'create',
        path: 'belroseFields.patient.c',
        newValue: 3,
        description: 'Added belroseFields.patient.c',
      },
    ]);

    const removed = calculateDifferences(newData, oldData);
    expect(removed).toEqual([
      {
        operation: 'delete',
        path: 'belroseFields.patient.c',
        oldValue: 3,
        description: 'Removed belroseFields.patient.c',
      },
    ]);
  });

  it('returns an empty array when nothing changed', () => {
    const data = { belroseFields: { patient: { a: 1 } } };
    expect(calculateDifferences(data, JSON.parse(JSON.stringify(data)))).toEqual([]);
  });
});
