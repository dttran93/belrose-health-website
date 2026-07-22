// src/features/ViewEditRecord/utils/__tests__/firestoreMapping.test.ts
//
// Tier 1 — pure Firestore-doc -> FileObject mapping, no mocking. Covers the fallback defaults
// (fileName placeholder for encrypted docs, array fields defaulting to [], status hardcoded to
// 'completed') and that encrypted-field pass-through works when present.

import { describe, it, expect } from 'vitest';
import mapFirestoreToFileObject from '../firestoreMapping';

describe('mapFirestoreToFileObject', () => {
  it('maps core fields and stamps the docId as id', () => {
    const result = mapFirestoreToFileObject('doc-1', {
      fileName: 'labs.pdf',
      fileSize: 1234,
      fileType: 'application/pdf',
    });

    expect(result).toMatchObject({
      id: 'doc-1',
      fileName: 'labs.pdf',
      fileSize: 1234,
      fileType: 'application/pdf',
      status: 'completed',
    });
  });

  it('always sets status to completed, regardless of any status field in the doc', () => {
    const result = mapFirestoreToFileObject('doc-1', { status: 'processing' } as any);
    expect(result.status).toBe('completed');
  });

  it('falls back fileSize to 0 and fileType to application/octet-stream when missing', () => {
    const result = mapFirestoreToFileObject('doc-1', {});
    expect(result.fileSize).toBe(0);
    expect(result.fileType).toBe('application/octet-stream');
  });

  it('falls back fileName to "Unknown File" when neither fileName nor encryptedFileName exist', () => {
    const result = mapFirestoreToFileObject('doc-1', {});
    expect(result.fileName).toBe('Unknown File');
  });

  it('falls back fileName to "[ENCRYPTED]" when only encryptedFileName is present', () => {
    const result = mapFirestoreToFileObject('doc-1', { encryptedFileName: 'ciphertext' });
    expect(result.fileName).toBe('[ENCRYPTED]');
  });

  it('prefers a real fileName over the encrypted placeholder when both are present', () => {
    const result = mapFirestoreToFileObject('doc-1', {
      fileName: 'labs.pdf',
      encryptedFileName: 'ciphertext',
    });
    expect(result.fileName).toBe('labs.pdf');
  });

  it('defaults ownership array fields to empty arrays when absent', () => {
    const result = mapFirestoreToFileObject('doc-1', {});
    expect(result.owners).toEqual([]);
    expect(result.viewers).toEqual([]);
    expect(result.sharers).toEqual([]);
    expect(result.subjects).toEqual([]);
    expect(result.trustees).toEqual([]);
  });

  it('preserves administrators as-is (no default) since it is required on FileObject', () => {
    const result = mapFirestoreToFileObject('doc-1', { administrators: ['user-1'] });
    expect(result.administrators).toEqual(['user-1']);
  });

  it('defaults isEncrypted to false and passes through encrypted fields when present', () => {
    const plain = mapFirestoreToFileObject('doc-1', {});
    expect(plain.isEncrypted).toBe(false);

    const encrypted = mapFirestoreToFileObject('doc-1', {
      isEncrypted: true,
      encryptedFileIV: 'iv',
      encryptedExtractedText: 'ciphertext',
    });
    expect(encrypted.isEncrypted).toBe(true);
    expect(encrypted.encryptedFileIV).toBe('iv');
    expect(encrypted.encryptedExtractedText).toBe('ciphertext');
  });

  it('passes through verification fields untouched', () => {
    const result = mapFirestoreToFileObject('doc-1', {
      recordHash: '0xabc',
      previousRecordHash: ['0xdef'],
      originalFileHash: 'rawhash',
    });
    expect(result.recordHash).toBe('0xabc');
    expect(result.previousRecordHash).toEqual(['0xdef']);
    expect(result.originalFileHash).toBe('rawhash');
  });
});
