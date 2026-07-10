// src/features/Encryption/services/__tests__/encryptionKeyManager.test.ts
//
// Tier 1b — pure crypto methods on EncryptionKeyManager: master key generation, password
// wrap/unwrap (the actual login/registration unlock flow), and recovery-mnemonic derivation.
// Real WebCrypto, no mocking. The stateful session layer (sessionKey/sessionStorage/expiry) is
// covered separately in encryptionKeyManagerSession.test.ts, since it needs a sessionStorage stub
// and careful static-state reset between tests — none of that applies to these pure functions.

import { describe, it, expect } from 'vitest';
import { EncryptionKeyManager } from '../encryptionKeyManager';

async function keyRawBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return Buffer.from(raw).toString('base64');
}

async function encryptDecryptRoundTrip(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

describe('EncryptionKeyManager.generateMasterKey', () => {
  it('generates an extractable AES-256-GCM key', async () => {
    const key = await EncryptionKeyManager.generateMasterKey();
    expect(key.algorithm.name).toBe('AES-GCM');
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
    expect(key.extractable).toBe(true);
  });

  it('generates a fresh key on every call', async () => {
    const a = await EncryptionKeyManager.generateMasterKey();
    const b = await EncryptionKeyManager.generateMasterKey();
    expect(await keyRawBase64(a)).not.toBe(await keyRawBase64(b));
  });
});

describe('EncryptionKeyManager.deriveKEKFromPassword', () => {
  it('derives the identical key for the same password + salt', async () => {
    const salt = EncryptionKeyManager.generateSalt();
    const kekA = await EncryptionKeyManager.deriveKEKFromPassword('correct-password', salt);
    const kekB = await EncryptionKeyManager.deriveKEKFromPassword('correct-password', salt);

    expect(await encryptDecryptRoundTrip(kekA, 'x')).toBe('x');
    // Prove they're the same key by wrapping/unwrapping across the two derived instances.
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kekA, new TextEncoder().encode('shared'));
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kekB, encrypted);
    expect(new TextDecoder().decode(decrypted)).toBe('shared');
  });

  it('derives a different key for a different password', async () => {
    const salt = EncryptionKeyManager.generateSalt();
    const kekA = await EncryptionKeyManager.deriveKEKFromPassword('password-a', salt);
    const kekB = await EncryptionKeyManager.deriveKEKFromPassword('password-b', salt);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kekA, new TextEncoder().encode('x'));
    await expect(crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kekB, encrypted)).rejects.toThrow();
  });
});

describe('EncryptionKeyManager password wrap/unwrap — the login/registration unlock flow', () => {
  it('wraps and unwraps the master key, recovering the exact same key', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    const password = 'user-chosen-password-123';

    const { encryptedKey, iv, salt } = await EncryptionKeyManager.wrapMasterKeyWithPassword(
      masterKey,
      password
    );

    const recovered = await EncryptionKeyManager.unwrapMasterKeyWithPassword(
      encryptedKey,
      iv,
      password,
      salt
    );

    expect(await keyRawBase64(recovered)).toBe(await keyRawBase64(masterKey));
  });

  it('accepts a pre-generated salt instead of generating its own', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    const salt = EncryptionKeyManager.generateSalt();

    const wrapped = await EncryptionKeyManager.wrapMasterKeyWithPassword(masterKey, 'pw', salt);
    expect(wrapped.salt).toBe(EncryptionKeyManager.saltToString(salt));

    const recovered = await EncryptionKeyManager.unwrapMasterKeyWithPassword(
      wrapped.encryptedKey,
      wrapped.iv,
      'pw',
      wrapped.salt
    );
    expect(await keyRawBase64(recovered)).toBe(await keyRawBase64(masterKey));
  });

  it('rejects unwrapping with the wrong password — this is the "incorrect password" path EncryptionGate relies on', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    const { encryptedKey, iv, salt } = await EncryptionKeyManager.wrapMasterKeyWithPassword(
      masterKey,
      'correct-password'
    );

    await expect(
      EncryptionKeyManager.unwrapMasterKeyWithPassword(encryptedKey, iv, 'wrong-password', salt)
    ).rejects.toThrow();
  });
});

describe('EncryptionKeyManager recovery-key methods', () => {
  it('round-trips a master key through generateRecoveryKeyFromMasterKey -> recoverMasterKeyFromRecoveryKey, recovering the exact same key bytes', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    const recoveryKey = await EncryptionKeyManager.generateRecoveryKeyFromMasterKey(masterKey);

    expect(EncryptionKeyManager.validateRecoveryKey(recoveryKey)).toBe(true);

    const recovered = await EncryptionKeyManager.recoverMasterKeyFromRecoveryKey(recoveryKey);
    expect(await keyRawBase64(recovered)).toBe(await keyRawBase64(masterKey));
  });

  it('validateRecoveryKey rejects a garbage string', () => {
    expect(EncryptionKeyManager.validateRecoveryKey('totally not a mnemonic')).toBe(false);
  });

  it('recoverMasterKeyFromRecoveryKey throws for an invalid mnemonic', async () => {
    await expect(
      EncryptionKeyManager.recoverMasterKeyFromRecoveryKey('invalid mnemonic phrase')
    ).rejects.toThrow('Invalid recovery key');
  });

  it('hashRecoveryKey is deterministic for the same input and differs for a different one', async () => {
    const a = await EncryptionKeyManager.hashRecoveryKey('phrase one');
    const b = await EncryptionKeyManager.hashRecoveryKey('phrase one');
    const c = await EncryptionKeyManager.hashRecoveryKey('phrase two');

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('EncryptionKeyManager salt helpers', () => {
  it('generateSalt returns 16 random bytes, fresh each call', () => {
    const a = EncryptionKeyManager.generateSalt();
    const b = EncryptionKeyManager.generateSalt();
    expect(a.length).toBe(16);
    expect(a).not.toEqual(b);
  });

  it('round-trips a salt through saltToString -> stringToSalt', () => {
    const salt = EncryptionKeyManager.generateSalt();
    const roundTripped = EncryptionKeyManager.stringToSalt(EncryptionKeyManager.saltToString(salt));
    expect(roundTripped).toEqual(salt);
  });
});
