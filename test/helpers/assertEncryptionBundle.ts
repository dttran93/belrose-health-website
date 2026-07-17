// test/helpers/assertEncryptionBundle.ts
//
// The E2EE bootstrap (generate master key -> wrap with password -> 24-word recovery
// key + hash -> RSA keypair -> encrypt private key) is duplicated across three flows:
// Auth registration (RegistrationForm), Dependents (DependentAccountService.createAccount),
// and GuestAccess claim (GuestClaimAccountModal). Each writes the same 7-field
// `encryption` bundle shape to a users/{uid} doc. This helper is shared across their
// respective test suites (unit + orchestration) so "was a valid bundle written" is
// checked identically everywhere instead of re-implemented per suite.

import { expect } from 'vitest';

export interface EncryptionBundle {
  encryptedMasterKey: string;
  masterKeyIV: string;
  masterKeySalt: string;
  publicKey: string;
  encryptedPrivateKey: string;
  encryptedPrivateKeyIV: string;
  recoveryKeyHash: string;
}

const REQUIRED_FIELDS: Array<keyof EncryptionBundle> = [
  'encryptedMasterKey',
  'masterKeyIV',
  'masterKeySalt',
  'publicKey',
  'encryptedPrivateKey',
  'encryptedPrivateKeyIV',
  'recoveryKeyHash',
];

/**
 * Asserts `bundle` is a plausible encryption block: every required field present as a
 * non-empty string. Does not verify cryptographic correctness (that the key actually
 * decrypts anything) — only that the shape a real bootstrap produces was persisted.
 */
export function assertValidEncryptionBundle(
  bundle: unknown
): asserts bundle is EncryptionBundle {
  expect(bundle, 'expected an encryption bundle object, got null/undefined').toBeTruthy();

  const record = bundle as Record<string, unknown>;
  for (const field of REQUIRED_FIELDS) {
    expect(typeof record[field], `encryption.${field} should be a string`).toBe('string');
    expect((record[field] as string).length, `encryption.${field} should be non-empty`).toBeGreaterThan(0);
  }
}
