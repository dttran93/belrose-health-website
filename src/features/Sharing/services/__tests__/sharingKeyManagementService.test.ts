// src/features/Sharing/services/__tests__/sharingKeyManagementService.test.ts
//
// Tier 1 — pure crypto unit tests. No Firestore, no auth, no mocking at all: Node 22 exposes
// real WebCrypto as the global `crypto`, so generateUserKeyPair/importPublicKey/importPrivateKey/
// wrapKey/unwrapKey run against the actual RSA-OAEP implementation. This is the tier that
// directly guards against "recipient gets a key they can't unwrap" — verified here via real
// wrap -> unwrap -> encrypt/decrypt round-trips, not by asserting mock call counts.

import { describe, it, expect } from 'vitest';
import { SharingKeyManagementService } from '../sharingKeyManagementService';

async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

async function encryptWithKey(key: CryptoKey, plaintext: string): Promise<{ iv: ArrayBuffer; ciphertext: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return { iv: iv.buffer, ciphertext };
}

async function decryptWithKey(key: CryptoKey, iv: ArrayBuffer, ciphertext: ArrayBuffer): Promise<string> {
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintextBuffer);
}

describe('SharingKeyManagementService.generateUserKeyPair', () => {
  it('returns non-empty, distinct base64-encoded public and private keys', async () => {
    const { publicKey, privateKey } = await SharingKeyManagementService.generateUserKeyPair();

    expect(publicKey.length).toBeGreaterThan(0);
    expect(privateKey.length).toBeGreaterThan(0);
    expect(publicKey).not.toEqual(privateKey);
  });

  it('generates a fresh, random key pair on every call', async () => {
    const first = await SharingKeyManagementService.generateUserKeyPair();
    const second = await SharingKeyManagementService.generateUserKeyPair();

    expect(first.publicKey).not.toEqual(second.publicKey);
    expect(first.privateKey).not.toEqual(second.privateKey);
  });
});

describe('SharingKeyManagementService.importPublicKey / importPrivateKey', () => {
  it('imports a generated public key back into a usable CryptoKey', async () => {
    const { publicKey } = await SharingKeyManagementService.generateUserKeyPair();
    const imported = await SharingKeyManagementService.importPublicKey(publicKey);

    expect(imported.type).toBe('public');
    expect(imported.algorithm.name).toBe('RSA-OAEP');
  });

  it('imports a generated private key back into a usable CryptoKey', async () => {
    const { privateKey } = await SharingKeyManagementService.generateUserKeyPair();
    const imported = await SharingKeyManagementService.importPrivateKey(privateKey);

    expect(imported.type).toBe('private');
    expect(imported.algorithm.name).toBe('RSA-OAEP');
  });
});

describe('SharingKeyManagementService.wrapKey / unwrapKey', () => {
  it('round-trips an AES key through wrap -> unwrap, recovering a key that decrypts the same data', async () => {
    const { publicKey, privateKey } = await SharingKeyManagementService.generateUserKeyPair();
    const rsaPublicKey = await SharingKeyManagementService.importPublicKey(publicKey);
    const rsaPrivateKey = await SharingKeyManagementService.importPrivateKey(privateKey);

    const originalAesKey = await generateAesKey();
    const { iv, ciphertext } = await encryptWithKey(originalAesKey, 'hello from the record owner');

    const wrappedBase64 = await SharingKeyManagementService.wrapKey(originalAesKey, rsaPublicKey);
    expect(wrappedBase64.length).toBeGreaterThan(0);

    const unwrappedAesKey = await SharingKeyManagementService.unwrapKey(wrappedBase64, rsaPrivateKey);
    expect(unwrappedAesKey.algorithm.name).toBe('AES-GCM');

    const recovered = await decryptWithKey(unwrappedAesKey, iv, ciphertext);
    expect(recovered).toBe('hello from the record owner');
  });

  it('rejects when unwrapping with a private key that does not match the wrapping public key', async () => {
    const receiverPair = await SharingKeyManagementService.generateUserKeyPair();
    const attackerPair = await SharingKeyManagementService.generateUserKeyPair();

    const receiverPublicKey = await SharingKeyManagementService.importPublicKey(receiverPair.publicKey);
    const attackerPrivateKey = await SharingKeyManagementService.importPrivateKey(attackerPair.privateKey);

    const aesKey = await generateAesKey();
    const wrappedBase64 = await SharingKeyManagementService.wrapKey(aesKey, receiverPublicKey);

    await expect(
      SharingKeyManagementService.unwrapKey(wrappedBase64, attackerPrivateKey)
    ).rejects.toThrow();
  });

  it('rejects when unwrapping garbage base64 that is not a valid wrapped key', async () => {
    const { privateKey } = await SharingKeyManagementService.generateUserKeyPair();
    const rsaPrivateKey = await SharingKeyManagementService.importPrivateKey(privateKey);

    const garbageBase64 = btoa('this is not a real wrapped RSA-OAEP key');

    await expect(
      SharingKeyManagementService.unwrapKey(garbageBase64, rsaPrivateKey)
    ).rejects.toThrow();
  });
});
