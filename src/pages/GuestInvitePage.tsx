// src/pages/GuestInvitePage.tsx

/**
 * GuestInvitePage
 *
 * Handles the invite link doctors receive when a patient shares records with them.
 * URL format: /invite?token=<customToken>#<privateKeyBase64>
 *
 * The key challenge: HealthProfile (and all its hooks) decrypt records via
 * EncryptionKeyManager.getSessionKey(), which expects a master AES key in memory.
 * Guests have an RSA private key instead — so this page bridges that gap before
 * handing off to the normal HealthProfile view.
 *
 * Bridge approach:
 *   1. Sign in via custom token
 *   2. Import RSA private key from URL fragment
 *   3. Generate a throwaway AES master key (lives only in this browser session)
 *   4. For each wrappedKey doc: unwrap file key with RSA, re-wrap with throwaway master key,
 *      update wrappedKeys doc so getRecordKey() finds it as isCreator: true
 *   5. Set the throwaway master key as the session key
 *   6. Redirect to /app/health-profile/<patientSubjectId>
 *      → HealthProfile loads normally, zero changes to existing hooks
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { SharingKeyManagementService } from '@/features/Sharing/services/sharingKeyManagementService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { AlertTriangle, Loader2, Lock, UserPlus } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type PageStatus =
  | 'loading' // Validating token, signing in
  | 'bridging' // Signed in, re-wrapping keys into session
  | 'redirecting' // About to navigate to HealthProfile
  | 'expired' // Token or key missing/invalid
  | 'error';

// ── Component ────────────────────────────────────────────────────────────────

const GuestInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<PageStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [patientName, setPatientName] = useState('');

  useEffect(() => {
    initInvite();
  }, []);

  const initInvite = async () => {
    try {
      // ── Step 1: Read token + private key from URL ──────────────────────────
      const token = searchParams.get('token');
      const privateKeyBase64 = window.location.hash.replace('#', '');

      if (!token || !privateKeyBase64) {
        setStatus('expired');
        return;
      }

      // ── Step 2: Sign in with the Firebase custom token ─────────────────────
      // After this, auth.currentUser is the guest UID — Firestore security
      // rules will allow reads on their wrappedKeys documents.
      const auth = getAuth();
      await signInWithCustomToken(auth, token);
      const guestUid = auth.currentUser!.uid;
      console.log('✅ Signed in as guest:', guestUid);

      setStatus('bridging');

      // ── Step 3: Import RSA private key from URL fragment ───────────────────
      const rsaPrivateKey = await SharingKeyManagementService.importPrivateKey(privateKeyBase64);

      // ── Step 4: Generate throwaway AES master key ──────────────────────────
      // Never stored anywhere — only satisfies EncryptionGate's session check.
      // Actual decryption uses the pre-loaded file keys injected below.
      const throwawayMasterKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // ── Step 5: Fetch wrappedKeys and unwrap with RSA ──────────────────────
      // Nothing is written to Firestore — the RSA-wrapped key is preserved
      // so every link visit freshly unwraps it. File keys live in memory only.
      const db = getFirestore();

      const inviteSnap = await getDocs(
        query(
          collection(db, 'guestInvites'),
          where('guestUserId', '==', guestUid),
          where('status', '==', 'pending')
        )
      );

      if (inviteSnap.empty) {
        setStatus('expired');
        return;
      }

      // Check expiry — find the most recent invite for this guest
      const now = new Date();
      const validInvite = inviteSnap.docs.find(d => {
        const expiresAt = d.data().expiresAt?.toDate();
        return expiresAt && expiresAt > now;
      });

      if (!validInvite) {
        setStatus('expired');
        return;
      }

      // Step 6: Fetch wrappedKeys and unwrap with RSA
      const wrappedKeysSnap = await getDocs(
        query(
          collection(db, 'wrappedKeys'),
          where('userId', '==', guestUid),
          where('isActive', '==', true)
        )
      );

      if (wrappedKeysSnap.empty) {
        setErrorMessage('No shared records found. The link may have expired or been revoked.');
        setStatus('error');
        return;
      }

      let patientSubjectId: string | null = null;
      const fileKeys = new Map<string, CryptoKey>();

      for (const keyDoc of wrappedKeysSnap.docs) {
        const keyData = keyDoc.data();
        try {
          const fileKey = await SharingKeyManagementService.unwrapKey(
            keyData.wrappedKey,
            rsaPrivateKey
          );
          fileKeys.set(keyData.recordId, fileKey);

          // Grab patientSubjectId for navigation
          if (!patientSubjectId) {
            const recordSnap = await getDocs(
              query(collection(db, 'records'), where('__name__', '==', keyData.recordId))
            );
            if (!recordSnap.empty) {
              const recordData = recordSnap.docs[0]?.data();
              patientSubjectId = recordData?.subjects?.[0] ?? null;

              if (patientSubjectId) {
                const patientSnap = await getDocs(
                  query(collection(db, 'users'), where('__name__', '==', patientSubjectId))
                );
                if (!patientSnap.empty) {
                  const p = patientSnap.docs[0]?.data();
                  setPatientName(
                    p?.displayName ||
                      `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() ||
                      'your patient'
                  );
                }
              }
            }
          }
        } catch (err) {
          console.error(`⚠️ Failed to unwrap key for record ${keyData.recordId}:`, err);
        }
      }

      if (fileKeys.size === 0) {
        setErrorMessage('Failed to decrypt access keys. The link may be invalid.');
        setStatus('error');
        return;
      }

      // ── Step 6: Inject file keys and set session ───────────────────────────
      // File keys injected into EncryptionKeyManager — RecordDecryptionService
      // will find them via getGuestFileKey() and bypass the AES path entirely.
      EncryptionKeyManager.setGuestFileKeys(fileKeys);
      EncryptionKeyManager.setSessionKey(throwawayMasterKey);
      console.log('✅ Guest encryption session established');

      // ── Step 7: Redirect ───────────────────────────────────────────────────
      setStatus('redirecting');

      setTimeout(() => {
        if (patientSubjectId) {
          navigate(`/app/health-profile/${patientSubjectId}`);
        } else {
          navigate('/app/all-records');
        }
      }, 800);
    } catch (err: any) {
      console.error('❌ Guest invite error:', err);
      if (err.code === 'auth/invalid-custom-token' || err.code === 'auth/custom-token-mismatch') {
        setStatus('expired');
      } else {
        setErrorMessage(err.message || 'Something went wrong. Please try again.');
        setStatus('error');
      }
    }
  };

  if (status === 'expired') {
    return (
      <PageShell>
        <StatusCard
          icon={<Lock className="w-8 h-8 text-amber-500" />}
          title="This link has expired"
          description="Invite links are valid for 7 days. Ask your patient to send a new invite."
          bg="bg-amber-50"
          border="border-amber-200"
        />
      </PageShell>
    );
  }

  if (status === 'error') {
    return (
      <PageShell>
        <StatusCard
          icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
          title="Unable to load records"
          description={errorMessage}
          bg="bg-red-50"
          border="border-red-200"
        />
      </PageShell>
    );
  }

  const statusMessages: Record<string, string> = {
    loading: 'Verifying your access...',
    bridging: 'Preparing secure session...',
    redirecting: patientName
      ? `Opening ${patientName}'s health profile...`
      : 'Opening health profile...',
  };

  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">{statusMessages[status]}</p>
          <p className="text-xs text-slate-400 mt-1">Your connection is end-to-end encrypted</p>
        </div>

        {(status === 'bridging' || status === 'redirecting') && (
          <div
            className="mt-6 flex items-center gap-3 bg-slate-50 border border-slate-200
                          rounded-xl px-5 py-3 text-sm text-slate-500 max-w-sm text-center"
          >
            <UserPlus className="w-4 h-4 flex-shrink-0 text-slate-400" />
            <span>
              Want to manage patients on Belrose?{' '}
              <button
                onClick={() => navigate('/auth/register')}
                className="font-semibold text-slate-700 underline underline-offset-2"
              >
                Create a free account
              </button>
            </span>
          </div>
        )}
      </div>
    </PageShell>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-slate-50">
    <header className="bg-white border-b border-slate-100 px-6 py-4">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <span className="font-bold text-slate-900 text-lg tracking-tight">Belrose</span>
        <span className="text-xs text-slate-400">Secure health record sharing</span>
      </div>
    </header>
    <main className="max-w-3xl mx-auto px-4 py-10">{children}</main>
  </div>
);

const StatusCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  bg: string;
  border: string;
}> = ({ icon, title, description, bg, border }) => (
  <div
    className={`${bg} ${border} border rounded-xl p-8 flex flex-col items-center text-center gap-3`}
  >
    {icon}
    <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
    <p className="text-slate-500 text-sm max-w-sm">{description}</p>
  </div>
);

export default GuestInvitePage;
