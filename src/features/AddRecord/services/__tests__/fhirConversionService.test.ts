// src/features/AddRecord/services/__tests__/fhirConversionService.test.ts
//
// Tier 2 — only `fetch` is stubbed (the Cloud Function call); the FHIRPath structural
// validation itself (validateStructure, private) runs for real via convertToFHIR's returned
// _validation, exercising the actual fhirpath.js checks against real Bundle shapes.
// getValidationStatusForUI is pure and tested directly with no mocking at all.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertToFHIR, getValidationStatusForUI } from '../fhirConversionService';
import type { FHIRWithValidation } from '../fhirConversionService.type';

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

const validBundle = {
  resourceType: 'Bundle',
  id: 'bundle-1',
  type: 'collection',
  entry: [{ resource: { resourceType: 'Condition' } }],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('convertToFHIR — structural validation of the AI response', () => {
  it('marks a well-formed Bundle valid with no errors or warnings', async () => {
    mockFetchOnce(validBundle);

    const result = await convertToFHIR('some document text');

    expect(result._validation.isValid).toBe(true);
    expect(result._validation.hasErrors).toBe(false);
    expect(result._validation.hasWarnings).toBe(false);
    expect(result._validation.errors).toEqual([]);
  });

  it('flags an error when the response is not a Bundle', async () => {
    mockFetchOnce({ resourceType: 'Condition', entry: [] });

    const result = await convertToFHIR('some document text');

    expect(result._validation.isValid).toBe(false);
    expect(result._validation.hasErrors).toBe(true);
    expect(result._validation.errors).toContainEqual(
      expect.objectContaining({ message: 'AI response must be a FHIR Bundle', severity: 'error' })
    );
  });

  it('flags an error when the Bundle has no entries', async () => {
    mockFetchOnce({ resourceType: 'Bundle', id: 'b1', type: 'collection', entry: [] });

    const result = await convertToFHIR('some document text');

    expect(result._validation.hasErrors).toBe(true);
    expect(result._validation.errors).toContainEqual(
      expect.objectContaining({ message: 'Bundle must contain at least one entry' })
    );
  });

  it('flags an error when an entry is missing a resourceType', async () => {
    mockFetchOnce({
      resourceType: 'Bundle',
      id: 'b1',
      type: 'collection',
      entry: [{ resource: {} }],
    });

    const result = await convertToFHIR('some document text');

    expect(result._validation.hasErrors).toBe(true);
    expect(result._validation.errors).toContainEqual(
      expect.objectContaining({ message: 'All entries must have a resourceType' })
    );
  });

  it('is valid-with-warnings when id/type are missing but structure is otherwise sound', async () => {
    mockFetchOnce({
      resourceType: 'Bundle',
      entry: [{ resource: { resourceType: 'Condition' } }],
    });

    const result = await convertToFHIR('some document text');

    expect(result._validation.isValid).toBe(true);
    expect(result._validation.hasWarnings).toBe(true);
    expect(result._validation.warnings.map(w => w.message)).toEqual(
      expect.arrayContaining(['Bundle should have an ID', 'Bundle should have a type'])
    );
  });

  it('throws a wrapped error when the Cloud Function responds with an error body', async () => {
    mockFetchOnce({ error: 'Anthropic API quota exceeded' }, { ok: false, status: 429 });

    await expect(convertToFHIR('some document text')).rejects.toThrow(
      'Failed to convert to FHIR: Anthropic API quota exceeded'
    );
  });

  it('throws a wrapped error when the Cloud Function response has no error field', async () => {
    mockFetchOnce({}, { ok: false, status: 500 });

    await expect(convertToFHIR('some document text')).rejects.toThrow(
      'Failed to convert to FHIR: HTTP error! status: 500'
    );
  });

  it('throws a wrapped error when the network request itself fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    await expect(convertToFHIR('some document text')).rejects.toThrow(
      'Failed to convert to FHIR: network down'
    );
  });
});

describe('getValidationStatusForUI', () => {
  it('returns "unknown" when there is no validation data', () => {
    expect(getValidationStatusForUI(null)).toMatchObject({ status: 'unknown', color: 'gray' });
  });

  it('returns "valid" (green) when valid with no warnings', () => {
    const fhirData = {
      _validation: { isValid: true, hasWarnings: false, hasErrors: false, errors: [], warnings: [] },
    } as unknown as FHIRWithValidation;

    expect(getValidationStatusForUI(fhirData)).toMatchObject({ status: 'valid', color: 'green' });
  });

  it('returns "valid-with-warnings" (yellow) with warning details when valid but has warnings', () => {
    const fhirData = {
      _validation: {
        isValid: true,
        hasWarnings: true,
        hasErrors: false,
        errors: [],
        warnings: [{ message: 'Bundle should have an ID', severity: 'warning' }],
      },
    } as unknown as FHIRWithValidation;

    const status = getValidationStatusForUI(fhirData);
    expect(status).toMatchObject({ status: 'valid-with-warnings', color: 'yellow' });
    expect(status.details).toEqual(['Bundle should have an ID']);
  });

  it('returns "invalid" (red) with error details when invalid', () => {
    const fhirData = {
      _validation: {
        isValid: false,
        hasWarnings: false,
        hasErrors: true,
        errors: [{ message: 'AI response must be a FHIR Bundle', severity: 'error' }],
        warnings: [],
      },
    } as unknown as FHIRWithValidation;

    const status = getValidationStatusForUI(fhirData);
    expect(status).toMatchObject({ status: 'invalid', color: 'red' });
    expect(status.details).toEqual(['AI response must be a FHIR Bundle']);
  });
});
