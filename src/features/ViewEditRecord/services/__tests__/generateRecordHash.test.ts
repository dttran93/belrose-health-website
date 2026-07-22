// src/features/ViewEditRecord/services/__tests__/generateRecordHash.test.ts
//
// Tier 1 — pure, deterministic content hashing with real crypto.subtle (no mocks). This
// underlies every blockchain hash comparison (credibility, version history, recordIdHash), so
// its determinism/key-order-independence and its blindness to non-content fields (status,
// timestamps, ownership) are both load-bearing properties worth locking down directly.

import { describe, it, expect } from 'vitest';
import { RecordHashService, HashableFileContent } from '../generateRecordHash';

function content(overrides: Partial<HashableFileContent> = {}): HashableFileContent {
  return {
    fileName: 'labs.pdf',
    extractedText: 'extracted text',
    originalText: undefined,
    originalFileHash: 'abc123',
    contextText: undefined,
    fhirData: { resourceType: 'Bundle' },
    belroseFields: undefined,
    customData: undefined,
    ...overrides,
  } as HashableFileContent;
}

describe('RecordHashService.generateRecordHash', () => {
  it('produces a 0x-prefixed 64-hex-char (bytes32) hash', async () => {
    const hash = await RecordHashService.generateRecordHash(content());
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('is deterministic for identical content', async () => {
    const hashA = await RecordHashService.generateRecordHash(content());
    const hashB = await RecordHashService.generateRecordHash(content());
    expect(hashA).toBe(hashB);
  });

  it('is independent of the order in which fields are provided (keys are sorted before hashing)', async () => {
    const a = content();
    const b: HashableFileContent = {
      belroseFields: a.belroseFields,
      customData: a.customData,
      contextText: a.contextText,
      fhirData: a.fhirData,
      originalFileHash: a.originalFileHash,
      originalText: a.originalText,
      extractedText: a.extractedText,
      fileName: a.fileName,
    };

    const hashA = await RecordHashService.generateRecordHash(a);
    const hashB = await RecordHashService.generateRecordHash(b);
    expect(hashA).toBe(hashB);
  });

  it('treats undefined and omitted fields the same way (both normalize to null)', async () => {
    const withUndefined = content({ contextText: undefined });
    const omitted = { ...content() };
    delete (omitted as any).contextText;

    const hashA = await RecordHashService.generateRecordHash(withUndefined);
    const hashB = await RecordHashService.generateRecordHash(omitted);
    expect(hashA).toBe(hashB);
  });

  it('produces a different hash when medically-relevant content changes', async () => {
    const hashA = await RecordHashService.generateRecordHash(content());
    const hashB = await RecordHashService.generateRecordHash(
      content({ extractedText: 'different extracted text' })
    );
    expect(hashA).not.toBe(hashB);
  });

  it('is nested-key-order independent for object-valued fields like fhirData', async () => {
    const hashA = await RecordHashService.generateRecordHash(
      content({ fhirData: { resourceType: 'Bundle', id: '1' } })
    );
    const hashB = await RecordHashService.generateRecordHash(
      content({ fhirData: { id: '1', resourceType: 'Bundle' } })
    );
    expect(hashA).toBe(hashB);
  });

  it('is blind to fields outside the hashable subset (e.g. status, ownership, timestamps)', async () => {
    const base = content();
    const withExtraFields = {
      ...base,
      status: 'completed',
      administrators: ['user-1'],
      uploadedAt: { seconds: 123, nanoseconds: 0 },
    } as HashableFileContent & Record<string, unknown>;

    const hashA = await RecordHashService.generateRecordHash(base);
    const hashB = await RecordHashService.generateRecordHash(withExtraFields);
    expect(hashA).toBe(hashB);
  });
});

describe('RecordHashService.toBytes32', () => {
  it('prefixes a hex string with 0x', () => {
    expect(RecordHashService.toBytes32('abcd')).toBe('0xabcd');
  });
});
