//src/features/Messaging/hooks/useSignalSetup.ts

/**
 * useSignalSetup.ts
 *
 * Ensures the current user has a Signal Protocol key bundle before
 * messaging can be used. Handles both new accounts (keys generated at
 * registration) and existing accounts that predate the messaging feature.
 *
 * Flow:
 *   1. Check Firestore for an existing key bundle (cheap read)
 *   2. If found → ready immediately
 *   3. If not found → generate keys client-side + upload to Firestore
 *   4. Expose status so useMessaging (and UI) can gate on readiness
 *
 * This hook is idempotent — safe to call on every mount. The Firestore
 * check is fast and the generation path only runs once per account.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { KeyBundleService } from '../services/keyBundleService';
import { generateKeyBundle } from '../lib/keyGeneration';
import { BelroseSignalStore } from '../lib/BelroseSignalStore';

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

const setupPromises = new Map<string, Promise<void>>();

// ---------------------------------------------------------------------------
// Helper: check whether private keys exist in local IndexedDB
// ---------------------------------------------------------------------------

async function hasLocalPrivateKeys(): Promise<boolean> {
  try {
    const store = new BelroseSignalStore();
    const keyPair = await store.getIdentityKeyPair();
    return !!keyPair;
  } catch {
    return false;
  }
}

/**
 * Clears all Signal session state from IndexedDB.
 *
 * Called whenever keys are regenerated — any existing sessions are
 * guaranteed to be invalid because they were built with the old keys.
 * Leaving stale sessions causes Bad MAC errors on the next decrypt
 * because the Double Ratchet state no longer matches the key material.
 */
async function clearStaleSessions(): Promise<void> {
  return new Promise(resolve => {
    const req = indexedDB.open('belrose-signal');
    req.onsuccess = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      const storesToClear = ['sessions', 'preKeys'];
      let cleared = 0;

      storesToClear.forEach(storeName => {
        if (!Array.from(db.objectStoreNames).includes(storeName)) {
          cleared++;
          if (cleared === storesToClear.length) resolve();
          return;
        }

        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear().onsuccess = () => {
          cleared++;
          if (cleared === storesToClear.length) {
            console.log('🧹 Cleared stale Signal sessions and preKeys from IndexedDB');
            resolve();
          }
        };
      });
    };
    req.onerror = () => {
      // Non-fatal — log and continue, worst case is Bad MAC on stale messages
      console.warn('⚠️ Could not clear stale Signal sessions');
      resolve();
    };
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignalSetupStatus =
  | 'idle' // hook not yet started
  | 'checking' // checking Firestore for existing bundle
  | 'registering' // generating + uploading keys (first-time setup)
  | 'ready' // key bundle confirmed in Firestore
  | 'error'; // setup failed

export interface UseSignalSetupReturn {
  status: SignalSetupStatus;
  isReady: boolean;
  error: Error | null;
  /** Manually retry setup after an error */
  retry: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSignalSetup(): UseSignalSetupReturn {
  const { user } = useAuthContext();

  const [status, setStatus] = useState<SignalSetupStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  const setup = useCallback(async () => {
    if (!user) return;

    // If setup is already in-flight for this user (e.g. two components mounted
    // simultaneously), wait on the existing promise rather than running again
    if (setupPromises.has(user.uid)) {
      try {
        await setupPromises.get(user.uid);
        setStatus('ready');
      } catch {
        // Error already handled by the original caller
      }
      return;
    }

    setStatus('checking');
    setError(null);

    const promise = (async () => {
      const [hasBundle, hasLocalKeys] = await Promise.all([
        KeyBundleService.hasKeyBundle(user.uid),
        hasLocalPrivateKeys(),
      ]);

      if (hasBundle && hasLocalKeys) {
        // Both Firestore public keys and local private keys exist — fully ready
        setStatus('ready');
        return;
      }

      // Either Firestore bundle is missing, OR local private keys were cleared
      // (e.g. IndexedDB wiped during debugging). Either way regenerate everything
      // so public and private keys are guaranteed to be in sync.
      if (hasBundle && !hasLocalKeys) {
        console.log(
          '⚠️ Firestore bundle exists but local private keys are missing — regenerating to resync...'
        );
      } else {
        console.log('📦 No Signal key bundle found — setting up messaging for this account...');
      }

      setStatus('registering');

      toast.info('Setting up secure messaging...', {
        description: 'This only happens once. Just a moment.',
        duration: 4000,
      });

      // Clear any stale session state first — sessions built with old keys
      // will cause Bad MAC errors on decrypt if left in IndexedDB
      await clearStaleSessions();

      // generateKeyBundle() saves fresh private keys to IndexedDB
      // and returns the public bundle for Firestore upload
      const keyBundle = await generateKeyBundle();
      await KeyBundleService.uploadKeyBundle(user.uid, keyBundle);

      console.log('✅ Signal key bundle generated and uploaded');
      toast.success('Secure messaging ready');
      setStatus('ready');
    })();

    // Register before awaiting so concurrent callers see it immediately
    setupPromises.set(user.uid, promise);

    try {
      await promise;
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(err.message ?? 'Unknown error');
      console.error('❌ Signal setup failed:', error);
      setError(error);
      setStatus('error');
      toast.error('Failed to set up secure messaging', {
        description: 'Please try again or refresh the page.',
      });
    } finally {
      // Clear after completion so a retry() can re-run if needed
      setupPromises.delete(user.uid);
    }
  }, [user?.uid]);

  // Run on mount and whenever user changes
  useEffect(() => {
    setup();
  }, [setup]);

  return {
    status,
    isReady: status === 'ready',
    error,
    retry: setup,
  };
}
