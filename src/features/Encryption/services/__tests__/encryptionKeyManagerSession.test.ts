// src/features/Encryption/services/__tests__/encryptionKeyManagerSession.test.ts
//
// Tier 2 — EncryptionKeyManager's stateful session layer: in-memory sessionKey, sessionStorage
// persistence (survives a page refresh), activity-based expiry, and the guest-key stores.
// EncryptionKeyManager is a singleton with module-level static state, so every test must reset
// that state in beforeEach (clearSession, plus setSessionTimeout back to the 30-minute default —
// setSessionTimeout permanently mutates shared state otherwise). sessionStorage isn't a Node
// global, so a tiny in-memory stub is installed per test via vi.stubGlobal.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EncryptionKeyManager } from '../encryptionKeyManager';

function installFakeSessionStorage() {
  const store = new Map<string, string>();
  const fakeStorage: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  vi.stubGlobal('sessionStorage', fakeStorage);
  return fakeStorage;
}

async function keyRawBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return Buffer.from(raw).toString('base64');
}

beforeEach(() => {
  installFakeSessionStorage();
  EncryptionKeyManager.clearSession();
});

afterEach(() => {
  EncryptionKeyManager.setSessionTimeout(30); // restore the real default so it never bleeds across files
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('EncryptionKeyManager.setSessionKey / getSessionKey', () => {
  it('returns null when no session has ever been set', async () => {
    expect(await EncryptionKeyManager.getSessionKey()).toBeNull();
  });

  it('returns the same key that was set', async () => {
    const key = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(key);

    const retrieved = await EncryptionKeyManager.getSessionKey();
    expect(retrieved).not.toBeNull();
    expect(await keyRawBase64(retrieved!)).toBe(await keyRawBase64(key));
  });

  it('hasActiveSession reflects whether a session key is set', async () => {
    expect(await EncryptionKeyManager.hasActiveSession()).toBe(false);
    EncryptionKeyManager.setSessionKey(await EncryptionKeyManager.generateMasterKey());
    expect(await EncryptionKeyManager.hasActiveSession()).toBe(true);
  });
});

describe('EncryptionKeyManager session expiry', () => {
  it('expires the session once the timeout elapses with no activity', async () => {
    vi.useFakeTimers();
    EncryptionKeyManager.setSessionTimeout(0.001); // 60ms
    EncryptionKeyManager.setSessionKey(await EncryptionKeyManager.generateMasterKey());

    vi.advanceTimersByTime(100);

    expect(await EncryptionKeyManager.getSessionKey()).toBeNull();
    expect(await EncryptionKeyManager.hasActiveSession()).toBe(false);
  });

  it('does not expire before the timeout elapses', async () => {
    vi.useFakeTimers();
    EncryptionKeyManager.setSessionTimeout(1); // 60s
    const key = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(key);

    vi.advanceTimersByTime(1000); // well under 60s

    const retrieved = await EncryptionKeyManager.getSessionKey();
    expect(retrieved).not.toBeNull();
    expect(await keyRawBase64(retrieved!)).toBe(await keyRawBase64(key));
  });

  it('extendSession resets the activity clock so a session survives past what would have been the original expiry', async () => {
    vi.useFakeTimers();
    EncryptionKeyManager.setSessionTimeout(0.05); // 3s
    EncryptionKeyManager.setSessionKey(await EncryptionKeyManager.generateMasterKey());

    vi.advanceTimersByTime(2000); // 2s in — still alive
    EncryptionKeyManager.extendSession();
    vi.advanceTimersByTime(2000); // another 2s — 4s total, but only 2s since the extend

    expect(await EncryptionKeyManager.getSessionKey()).not.toBeNull();
  });

  it('getRemainingSessionTime is 0 with no session and decreases as time passes', async () => {
    expect(EncryptionKeyManager.getRemainingSessionTime()).toBe(0);

    vi.useFakeTimers();
    EncryptionKeyManager.setSessionTimeout(1); // 60s
    EncryptionKeyManager.setSessionKey(await EncryptionKeyManager.generateMasterKey());

    const remainingAtStart = EncryptionKeyManager.getRemainingSessionTime();
    vi.advanceTimersByTime(10_000);
    const remainingLater = EncryptionKeyManager.getRemainingSessionTime();

    expect(remainingLater).toBeLessThan(remainingAtStart);
  });
});

describe('EncryptionKeyManager.clearSession', () => {
  it('wipes the session key, guest keys, and sessionStorage', async () => {
    EncryptionKeyManager.setSessionKey(await EncryptionKeyManager.generateMasterKey());
    EncryptionKeyManager.setGuestFileKeys(new Map([['record1', await EncryptionKeyManager.generateMasterKey()]]));
    EncryptionKeyManager.setGuestRsaPrivateKey('fake-private-key-base64');

    EncryptionKeyManager.clearSession();

    expect(await EncryptionKeyManager.getSessionKey()).toBeNull();
    expect(EncryptionKeyManager.hasGuestFileKeys()).toBe(false);
    expect(EncryptionKeyManager.hasGuestRsaPrivateKey()).toBe(false);
    expect(sessionStorage.getItem('encryptionKey')).toBeNull();
  });
});

describe('EncryptionKeyManager session persistence across a simulated page refresh', () => {
  it('restores the session from sessionStorage when the in-memory key is gone', async () => {
    const key = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(key);

    // setSessionKey fires persistSessionToStorage() without awaiting it (fire-and-forget), so
    // give that microtask a chance to actually write sessionStorage before simulating a refresh —
    // otherwise this test races the real source code's own async write.
    await vi.waitFor(() => expect(sessionStorage.getItem('encryptionKey')).not.toBeNull());

    // Simulate a page refresh: the module's in-memory static state is gone, but sessionStorage
    // (a real browser storage, not tied to JS heap lifetime) still has what persistSessionToStorage
    // wrote. There's no public API to wipe just the in-memory key without also clearing storage,
    // so this reaches into the private static field directly — the only way to exercise
    // restoreSessionFromStorage's actual "nothing in memory yet" branch instead of the
    // already-in-memory fast path the other tests cover.
    (EncryptionKeyManager as unknown as { sessionKey: CryptoKey | null }).sessionKey = null;

    const restored = await EncryptionKeyManager.getSessionKey();
    expect(restored).not.toBeNull();
    expect(await keyRawBase64(restored!)).toBe(await keyRawBase64(key));
  });

  it('treats a stored session past its expiry as gone and clears it', async () => {
    EncryptionKeyManager.setSessionKey(await EncryptionKeyManager.generateMasterKey());
    (EncryptionKeyManager as unknown as { sessionKey: CryptoKey | null }).sessionKey = null;
    sessionStorage.setItem('sessionExpiry', (Date.now() - 1000).toString()); // already expired

    expect(await EncryptionKeyManager.getSessionKey()).toBeNull();
    expect(sessionStorage.getItem('encryptionKey')).toBeNull(); // clearSession ran as a side effect
  });
});

describe('EncryptionKeyManager.exportSessionKey / importAndSetSessionKey', () => {
  it('returns null when there is no active session', async () => {
    expect(await EncryptionKeyManager.exportSessionKey()).toBeNull();
  });

  it('round-trips the session key through export -> import', async () => {
    const key = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(key);

    const exported = await EncryptionKeyManager.exportSessionKey();
    expect(exported).not.toBeNull();

    EncryptionKeyManager.clearSession();
    await EncryptionKeyManager.importAndSetSessionKey(exported!);

    const restored = await EncryptionKeyManager.getSessionKey();
    expect(await keyRawBase64(restored!)).toBe(await keyRawBase64(key));
  });
});

describe('EncryptionKeyManager guest file keys', () => {
  it('stores and retrieves guest file keys by recordId', async () => {
    const key = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setGuestFileKeys(new Map([['record1', key]]));

    expect(EncryptionKeyManager.hasGuestFileKeys()).toBe(true);
    expect(await keyRawBase64(EncryptionKeyManager.getGuestFileKey('record1')!)).toBe(
      await keyRawBase64(key)
    );
    expect(EncryptionKeyManager.getGuestFileKey('nonexistent-record')).toBeUndefined();
  });

  it('hasGuestFileKeys is false when no guest keys have been set, or the map is empty', () => {
    expect(EncryptionKeyManager.hasGuestFileKeys()).toBe(false);
    EncryptionKeyManager.setGuestFileKeys(new Map());
    expect(EncryptionKeyManager.hasGuestFileKeys()).toBe(false);
  });
});

describe('EncryptionKeyManager guest RSA private key', () => {
  it('stores and retrieves the guest RSA private key', () => {
    expect(EncryptionKeyManager.hasGuestRsaPrivateKey()).toBe(false);

    EncryptionKeyManager.setGuestRsaPrivateKey('some-base64-key');

    expect(EncryptionKeyManager.hasGuestRsaPrivateKey()).toBe(true);
    expect(EncryptionKeyManager.getGuestRsaPrivateKey()).toBe('some-base64-key');
  });
});
