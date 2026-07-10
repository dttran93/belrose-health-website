// src/features/Encryption/services/__tests__/encryptionService.test.ts
//
// Tier 1 — pure crypto unit tests for EncryptionService, the AES-256-GCM engine behind every
// encrypted health record field. Real WebCrypto (Node 22's global `crypto`), no mocking — every
// assertion is a genuine encrypt/decrypt or derive/verify round-trip, not a call-count check.

import { describe, it, expect } from 'vitest';
import { EncryptionService } from '../encryptionService';
import { base64ToArrayBuffer } from '@/utils/dataFormattingUtils';

async function keyRawBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return Buffer.from(raw).toString('base64');
}

describe('EncryptionService.generateFileKey / exportKey / importKey', () => {
  it('generates an extractable AES-256-GCM key usable for encrypt and decrypt', async () => {
    const key = await EncryptionService.generateFileKey();
    expect(key.algorithm.name).toBe('AES-GCM');
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
    expect(key.usages).toEqual(expect.arrayContaining(['encrypt', 'decrypt']));
  });

  it('round-trips a key through export -> import, recovering a functionally identical key', async () => {
    const original = await EncryptionService.generateFileKey();
    const exported = await EncryptionService.exportKey(original);
    const imported = await EncryptionService.importKey(exported);

    const { encrypted, iv } = await EncryptionService.encryptText('round trip check', original);
    const recovered = await EncryptionService.decryptText(encrypted, imported, iv);
    expect(recovered).toBe('round trip check');
  });

  it('generates a fresh key on every call', async () => {
    const a = await EncryptionService.exportKey(await EncryptionService.generateFileKey());
    const b = await EncryptionService.exportKey(await EncryptionService.generateFileKey());
    expect(Buffer.from(a).toString('base64')).not.toBe(Buffer.from(b).toString('base64'));
  });
});

describe('EncryptionService.encryptFile / decryptFile', () => {
  it('round-trips arbitrary binary data', async () => {
    const key = await EncryptionService.generateFileKey();
    const original = new Uint8Array([0, 1, 2, 253, 254, 255, 42, 7]).buffer;

    const { encrypted, iv } = await EncryptionService.encryptFile(original, key);
    const decrypted = await EncryptionService.decryptFile(encrypted, key, iv);

    expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(original));
  });

  it('produces a different IV (and ciphertext) on every call, even for identical input', async () => {
    const key = await EncryptionService.generateFileKey();
    const data = new TextEncoder().encode('same plaintext').buffer;

    const first = await EncryptionService.encryptFile(data, key);
    const second = await EncryptionService.encryptFile(data, key);

    expect(Buffer.from(first.iv).toString('base64')).not.toBe(
      Buffer.from(second.iv).toString('base64')
    );
    expect(Buffer.from(first.encrypted).toString('base64')).not.toBe(
      Buffer.from(second.encrypted).toString('base64')
    );
  });

  it('fails to decrypt with the wrong key', async () => {
    const key = await EncryptionService.generateFileKey();
    const wrongKey = await EncryptionService.generateFileKey();
    const { encrypted, iv } = await EncryptionService.encryptFile(
      new TextEncoder().encode('secret').buffer,
      key
    );

    await expect(EncryptionService.decryptFile(encrypted, wrongKey, iv)).rejects.toThrow();
  });
});

describe('EncryptionService.encryptJSON / decryptJSON', () => {
  it('round-trips a nested object', async () => {
    const key = await EncryptionService.generateFileKey();
    const original = { name: 'Jane Doe', tags: ['a', 'b'], nested: { ok: true, count: 3 } };

    const { encrypted, iv } = await EncryptionService.encryptJSON(original, key);
    const recovered = await EncryptionService.decryptJSON(encrypted, key, iv);

    expect(recovered).toEqual(original);
  });
});

describe('EncryptionService.encryptText / decryptText', () => {
  it('round-trips plain text', async () => {
    const key = await EncryptionService.generateFileKey();
    const { encrypted, iv } = await EncryptionService.encryptText('hello world', key);
    expect(await EncryptionService.decryptText(encrypted, key, iv)).toBe('hello world');
  });

  it('round-trips unicode/emoji without corruption', async () => {
    const key = await EncryptionService.generateFileKey();
    const text = 'café ☕️ 日本語 🩺';
    const { encrypted, iv } = await EncryptionService.encryptText(text, key);
    expect(await EncryptionService.decryptText(encrypted, key, iv)).toBe(text);
  });
});

describe('EncryptionService.encryptKeyWithMasterKey / decryptKeyWithMasterKey', () => {
  it('wraps and unwraps a file key with a master key, recovering the exact same key', async () => {
    const masterKey = await EncryptionService.generateFileKey();
    const fileKey = await EncryptionService.generateFileKey();

    const wrapped = await EncryptionService.encryptKeyWithMasterKey(fileKey, masterKey);
    const unwrappedRaw = await EncryptionService.decryptKeyWithMasterKey(wrapped, masterKey);
    const unwrappedKey = await EncryptionService.importKey(unwrappedRaw);

    expect(await keyRawBase64(unwrappedKey)).toBe(await keyRawBase64(fileKey));
  });

  it('fails to unwrap with the wrong master key', async () => {
    const masterKey = await EncryptionService.generateFileKey();
    const wrongMasterKey = await EncryptionService.generateFileKey();
    const fileKey = await EncryptionService.generateFileKey();

    const wrapped = await EncryptionService.encryptKeyWithMasterKey(fileKey, masterKey);

    await expect(
      EncryptionService.decryptKeyWithMasterKey(wrapped, wrongMasterKey)
    ).rejects.toThrow();
  });
});

describe('EncryptionService salt helpers', () => {
  it('generateSalt returns 16 random bytes', () => {
    const salt = EncryptionService.generateSalt();
    expect(salt.length).toBe(16);
  });

  it('round-trips a salt through saltToString -> stringToSalt', () => {
    const salt = EncryptionService.generateSalt();
    const roundTripped = EncryptionService.stringToSalt(EncryptionService.saltToString(salt));
    expect(roundTripped).toEqual(salt);
  });
});

describe('EncryptionService.deriveKeyFromPassword (PBKDF2)', () => {
  it('derives a usable key that can encrypt and decrypt', async () => {
    const salt = EncryptionService.generateSalt();
    const key = await EncryptionService.deriveKeyFromPassword('correct horse battery staple', salt);

    const { encrypted, iv } = await EncryptionService.encryptText('protected', key);
    expect(await EncryptionService.decryptText(encrypted, key, iv)).toBe('protected');
  });

  it('derives the identical key for the same password + salt (deterministic)', async () => {
    const salt = EncryptionService.generateSalt();
    const keyA = await EncryptionService.deriveKeyFromPassword('same-password', salt);
    const keyB = await EncryptionService.deriveKeyFromPassword('same-password', salt);

    const { encrypted, iv } = await EncryptionService.encryptText('data', keyA);
    expect(await EncryptionService.decryptText(encrypted, keyB, iv)).toBe('data');
  });

  it('derives a different key for a different password with the same salt', async () => {
    const salt = EncryptionService.generateSalt();
    const keyA = await EncryptionService.deriveKeyFromPassword('password-one', salt);
    const keyB = await EncryptionService.deriveKeyFromPassword('password-two', salt);

    const { encrypted, iv } = await EncryptionService.encryptText('data', keyA);
    await expect(EncryptionService.decryptText(encrypted, keyB, iv)).rejects.toThrow();
  });
});

describe('EncryptionService.hashPassword', () => {
  it('is deterministic for the same password + salt', async () => {
    const salt = EncryptionService.generateSalt();
    const a = await EncryptionService.hashPassword('hunter2', salt);
    const b = await EncryptionService.hashPassword('hunter2', salt);
    expect(a).toBe(b);
  });

  it('differs for a different password', async () => {
    const salt = EncryptionService.generateSalt();
    const a = await EncryptionService.hashPassword('hunter2', salt);
    const b = await EncryptionService.hashPassword('hunter3', salt);
    expect(a).not.toBe(b);
  });

  it('differs for a different salt', async () => {
    const a = await EncryptionService.hashPassword('hunter2', EncryptionService.generateSalt());
    const b = await EncryptionService.hashPassword('hunter2', EncryptionService.generateSalt());
    expect(a).not.toBe(b);
  });
});

describe('EncryptionService recovery-key methods', () => {
  it('generateRecoveryKey produces a valid, fresh mnemonic each call', () => {
    const a = EncryptionService.generateRecoveryKey();
    const b = EncryptionService.generateRecoveryKey();

    expect(EncryptionService.validateRecoveryKey(a)).toBe(true);
    expect(EncryptionService.validateRecoveryKey(b)).toBe(true);
    expect(a).not.toBe(b);
  });

  it('validateRecoveryKey rejects a garbage string', () => {
    expect(EncryptionService.validateRecoveryKey('not a real mnemonic at all')).toBe(false);
  });

  it('deriveKeyFromRecoveryKey derives a usable key from a valid mnemonic', async () => {
    const mnemonic = EncryptionService.generateRecoveryKey();
    const salt = EncryptionService.generateSalt();
    const key = await EncryptionService.deriveKeyFromRecoveryKey(mnemonic, salt);

    const { encrypted, iv } = await EncryptionService.encryptText('recovered data', key);
    expect(await EncryptionService.decryptText(encrypted, key, iv)).toBe('recovered data');
  });

  it('deriveKeyFromRecoveryKey throws for an invalid mnemonic', async () => {
    const salt = EncryptionService.generateSalt();
    await expect(
      EncryptionService.deriveKeyFromRecoveryKey('invalid mnemonic', salt)
    ).rejects.toThrow('Invalid recovery key');
  });
});

describe('EncryptionService.encryptCompleteRecord', () => {
  it('always encrypts fileName and returns a usable encryptedKey + fileKey', async () => {
    const masterKey = await EncryptionService.generateFileKey();

    const result = await EncryptionService.encryptCompleteRecord(
      'my-file.pdf',
      undefined,
      undefined,
      undefined,
      undefined,
      null,
      null,
      null,
      masterKey
    );

    expect(result.fileName.encrypted).toBeDefined();
    expect(result.file).toBeUndefined();
    expect(result.extractedText).toBeUndefined();
    expect(result.originalText).toBeUndefined();
    expect(result.contextText).toBeUndefined();
    expect(result.fhirData).toBeUndefined();
    expect(result.belroseFields).toBeUndefined();
    expect(result.customData).toBeUndefined();

    // The returned encryptedKey should decrypt (with the master key) back to the returned fileKey.
    const unwrappedRaw = await EncryptionService.decryptKeyWithMasterKey(
      base64ToArrayBuffer(result.encryptedKey),
      masterKey
    );
    const unwrappedKey = await EncryptionService.importKey(unwrappedRaw);
    expect(await keyRawBase64(unwrappedKey)).toBe(await keyRawBase64(result.fileKey));
  });

  it('encrypts optional fields only when present, and skips whitespace-only text fields', async () => {
    const masterKey = await EncryptionService.generateFileKey();

    const result = await EncryptionService.encryptCompleteRecord(
      'my-file.pdf',
      undefined,
      'extracted text here',
      '   ', // whitespace-only — should be treated as absent
      'real context',
      { resourceType: 'Patient' },
      { title: 'Lab result' },
      { custom: true },
      masterKey
    );

    expect(result.extractedText).toBeDefined();
    expect(result.originalText).toBeUndefined();
    expect(result.contextText).toBeDefined();
    expect(result.fhirData).toBeDefined();
    expect(result.belroseFields).toBeDefined();
    expect(result.customData).toBeDefined();

    // Spot-check one JSON field actually decrypts back correctly.
    const recoveredFhir = await EncryptionService.decryptJSON(
      base64ToArrayBuffer(result.fhirData!.encrypted),
      result.fileKey,
      base64ToArrayBuffer(result.fhirData!.iv)
    );
    expect(recoveredFhir).toEqual({ resourceType: 'Patient' });
  });

  it('uses the provided externalFileKey instead of generating a new one', async () => {
    const masterKey = await EncryptionService.generateFileKey();
    const externalFileKey = await EncryptionService.generateFileKey();

    const result = await EncryptionService.encryptCompleteRecord(
      'guest-file.pdf',
      undefined,
      undefined,
      undefined,
      undefined,
      null,
      null,
      null,
      masterKey,
      externalFileKey
    );

    expect(await keyRawBase64(result.fileKey)).toBe(await keyRawBase64(externalFileKey));
  });
});
