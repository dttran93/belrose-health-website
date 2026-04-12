// src/features/Auth/components/GuestClaimAccountModal.tsx

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getAuth, updatePassword, updateProfile } from 'firebase/auth';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { SharingKeyManagementService } from '@/features/Sharing/services/sharingKeyManagementService';
import { MemberRegistryBlockchain } from '@/features/Auth/services/memberRegistryBlockchain';
import { SmartAccountService } from '@/features/BlockchainWallet/services/smartAccountService';
import { RecoveryKeyDisplay } from '@/features/Auth/components/RecoveryKeyDisplay';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';
import { generateKeyBundle } from '@/features/Messaging';
import { KeyBundleService } from '@/features/Messaging/services/keyBundleService';
import { toast } from 'sonner';
import InputField from '@/components/ui/InputField';
import { WalletGenerationService } from '@/features/Auth/services/walletGenerationService';
import {
  collection,
  deleteField,
  doc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import PasswordStrengthIndicator from '@/features/Auth/components/ui/PasswordStrengthIndicator';

type ClaimStep = 'credentials' | 'recovery' | 'processing' | 'done';

interface ClaimProgress {
  message: string;
}

interface GuestClaimAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  guestContext?: 'sharing' | 'record_request';
}

export const GuestClaimAccountModal: React.FC<GuestClaimAccountModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  guestContext,
}) => {
  const { user, refreshUser } = useAuthContext();

  if (!user) {
    throw new Error('GuestClaimAccountModal must be used within an authenticated guest account');
  }

  const [step, setStep] = useState<ClaimStep>('credentials');
  const [progress, setProgress] = useState<ClaimProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Generated crypto data — held in state between steps
  const [cryptoData, setCryptoData] = useState<{
    masterKey: CryptoKey;
    encryptedMasterKey: string;
    masterKeyIV: string;
    masterKeySalt: string;
    recoveryKey: string;
    recoveryKeyHash: string;
    publicKey: string;
    encryptedPrivateKey: string;
    encryptedPrivateKeyIV: string;
  } | null>(null);

  const handleCredentialsSubmit = async () => {
    if (!firstName || !lastName || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (guestContext !== 'record_request' && !EncryptionKeyManager.hasGuestFileKeys()) {
      setError(
        'Your session has expired. Please click the invite link again before creating an account.'
      );
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 1. Generate master key
      const masterKey = await EncryptionKeyManager.generateMasterKey();

      // 2. Wrap with password
      const { encryptedKey, iv, salt } = await EncryptionKeyManager.wrapMasterKeyWithPassword(
        masterKey,
        password
      );

      // 3. Generate recovery key
      const recoveryKeyWords =
        await EncryptionKeyManager.generateRecoveryKeyFromMasterKey(masterKey);
      const recoveryKeyHash = await EncryptionKeyManager.hashRecoveryKey(recoveryKeyWords);

      // 4. Generate RSA key pair
      const { publicKey, privateKey } = await SharingKeyManagementService.generateUserKeyPair();

      // 5. Encrypt RSA private key with master key
      const privateKeyBytes = base64ToArrayBuffer(privateKey);
      const { encrypted: encryptedPrivateKeyBuffer, iv: privateKeyIV } =
        await EncryptionService.encryptFile(privateKeyBytes, masterKey);

      setCryptoData({
        masterKey,
        encryptedMasterKey: encryptedKey,
        masterKeyIV: iv,
        masterKeySalt: salt,
        recoveryKey: recoveryKeyWords,
        recoveryKeyHash,
        publicKey,
        encryptedPrivateKey: arrayBufferToBase64(encryptedPrivateKeyBuffer),
        encryptedPrivateKeyIV: arrayBufferToBase64(privateKeyIV),
      });

      setRecoveryKey(recoveryKeyWords);
      setStep('recovery');
    } catch (err: any) {
      setError(err.message || 'Failed to set up encryption. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClaim = async () => {
    if (!acknowledged || !cryptoData) return;
    console.log('🔑 Guest RSA key at handleClaim:', EncryptionKeyManager.hasGuestRsaPrivateKey());
    console.log('🔑 Guest RSA key length:', EncryptionKeyManager.getGuestRsaPrivateKey()?.length);

    setStep('processing');
    setError(null);

    try {
      const auth = getAuth();
      const guestUid = user.uid;
      const guestFileKeys = EncryptionKeyManager.getGuestFileKeys();
      const db = getFirestore();
      const batch = writeBatch(db);

      const shouldCheckKeys = guestContext !== 'record_request';
      const hasKeys = guestFileKeys !== null && guestFileKeys.size > 0;

      if (shouldCheckKeys && !hasKeys) {
        setError('Your session has expired. Please click the invite link again.');
        setStep('recovery');
        return;
      }

      // ── Step 1a: Re-wrap guest file keys (Sharing Flow) ───────────────────
      const newRsaPublicKey = await SharingKeyManagementService.importPublicKey(
        cryptoData.publicKey
      );

      if (hasKeys) {
        setProgress({ message: 'Re-encrypting record access keys...' });
        for (const [recordId, fileKey] of guestFileKeys!) {
          const docId = `${recordId}_${guestUid}`;
          const rewrapped = await SharingKeyManagementService.wrapKey(fileKey, newRsaPublicKey);
          batch.update(doc(db, 'wrappedKeys', docId), {
            wrappedKey: rewrapped,
            isCreator: false,
            isGuest: false,
            expiresAt: deleteField(),
            claimedAt: serverTimestamp(),
          });
        }
      }

      // ── Step 1b: Rewrap record Note keys (Request Flow) ───────────────────────────
      // The note key was wrapped with the ephemeral guest RSA key. Now that the
      // provider has a real RSA key pair, rewrap it so they can decrypt the note
      // going forward. The guest private key was stored in EncryptionKeyManager
      // when the provider first opened the fulfill URL.
      const guestPrivateKeyBase64 = EncryptionKeyManager.getGuestRsaPrivateKey();

      if (guestPrivateKeyBase64) {
        setProgress({ message: 'Re-encrypting request note access...' });

        try {
          const guestRsaPrivateKey =
            await SharingKeyManagementService.importPrivateKey(guestPrivateKeyBase64);

          // Find all record requests where this guest was the provider
          const requestSnap = await getDocs(
            query(collection(db, 'recordRequests'), where('providerGuestUid', '==', guestUid))
          );

          for (const requestDoc of requestSnap.docs) {
            const data = requestDoc.data();
            if (!data.encryptedNoteKeyForProvider || !data.encryptedNoteIv) continue;

            // Unwrap the AES note key with the old guest RSA private key
            const aesNoteKey = await SharingKeyManagementService.unwrapKey(
              data.encryptedNoteKeyForProvider,
              guestRsaPrivateKey
            );

            // Rewrap with the new RSA public key
            const rewrappedNoteKey = await SharingKeyManagementService.wrapKey(
              aesNoteKey,
              newRsaPublicKey
            );

            batch.update(doc(db, 'recordRequests', requestDoc.id), {
              encryptedNoteKeyForProvider: rewrappedNoteKey,
            });
          }

          console.log('✅ Note keys rewrapped for', requestSnap.docs.length, 'request(s)');
        } catch (err) {
          // Non-fatal — log and continue. The provider loses note access for
          // this request but the fulfill flow and record access are unaffected.
          console.warn('⚠️ Failed to rewrap note key:', err);
        }
      }

      // ── Step 2: Set password on Firebase Auth account ────────────────────────
      setProgress({ message: 'Securing your account...' });
      try {
        await updatePassword(auth.currentUser!, password);
      } catch (err: any) {
        if (err.code === 'auth/requires-recent-login') {
          throw new Error(
            'Your session has expired. Please click the invite link again to refresh your session.'
          );
        }
        throw err;
      }

      // ── Step 3: Call claimGuestAccount Cloud Function ────────────────────────
      // Handles profile update, wrappedKeys re-wrap, guestInvites accepted
      // Does NOT touch wallet — that's handled separately below
      setProgress({ message: 'Saving your account details...' });
      const displayName = `${firstName} ${lastName}`;

      // Update user profile
      const userRef = doc(db, 'users', guestUid);
      batch.update(userRef, {
        displayName,
        displayNameLower: displayName.toLowerCase(),
        firstName,
        lastName,
        isGuest: false,
        emailVerified: true,
        emailVerifiedAt: serverTimestamp(),
        identityVerified: false,
        identityVerifiedAt: null,
        updatedAt: serverTimestamp(),
        encryption: {
          enabled: true,
          encryptedMasterKey: cryptoData.encryptedMasterKey,
          masterKeyIV: cryptoData.masterKeyIV,
          masterKeySalt: cryptoData.masterKeySalt,
          recoveryKeyHash: cryptoData.recoveryKeyHash,
          publicKey: cryptoData.publicKey,
          encryptedPrivateKey: cryptoData.encryptedPrivateKey,
          encryptedPrivateKeyIV: cryptoData.encryptedPrivateKeyIV,
          setupAt: new Date().toISOString(),
        },
      });

      // ── Step 4: Mark guestInvites as accepted ────────────────────────
      const inviteSnap = await getDocs(
        query(
          collection(db, 'guestInvites'),
          where('guestUserId', '==', guestUid),
          where('status', '==', 'pending')
        )
      );

      inviteSnap.docs.forEach(inviteDoc => {
        batch.update(inviteDoc.ref, {
          status: 'accepted',
          claimedAt: serverTimestamp(),
        });
      });

      // ── Step 4b: Backfill targetUserId on any recordRequests matched by email ──
      // useInboundRequests queries by both userId and email, but setting targetUserId
      // ensures future queries by ID alone (e.g. useRecordFollowUps) still find them.
      const requestSnap = await getDocs(
        query(
          collection(db, 'recordRequests'),
          where('targetEmail', '==', user.email),
          where('status', '==', 'pending')
        )
      );

      requestSnap.docs.forEach(requestDoc => {
        batch.update(requestDoc.ref, {
          targetUserId: guestUid,
        });
      });

      await batch.commit();

      // ── Step 5: Generate real wallet ─────────────────────────────────────────
      // Overwrites the placeholder guest wallet with a real one.
      // wallet.ts now allows this for guest accounts (isGuest check).
      setProgress({ message: 'Generating your wallet...' });
      const walletData = await WalletGenerationService.generateWallet({
        userId: guestUid,
        masterKey: cryptoData.masterKey,
      });
      console.log('✅ Real wallet generated:', walletData.walletAddress);

      // Set real master key in session before smart account initialization, function pulls from the session to compute smart account address
      EncryptionKeyManager.setSessionKey(cryptoData.masterKey);

      // ── Step 6: Register EOA on blockchain ───────────────────────────────────
      setProgress({ message: 'Registering on the secure network...' });
      await MemberRegistryBlockchain.registerMemberWallet(walletData.walletAddress);

      // ── Step 7: Initialize smart account ────────────────────────────────────
      setProgress({ message: 'Setting up your smart account...' });
      await SmartAccountService.ensureFullyInitialized();

      // ── Step 8: Updating user status on chain to Active ────────────────────────────────────
      // In the sharing flow, grantGuestAccess sets status to Guest on-chain.
      // registerMemberWallet (step 6) doesn't override it since the identity
      // already exists. So we need to explicitly set Active here.
      //
      // In the request flow, registerMemberWallet creates a new identity and
      // automatically sets Active — calling setUserStatus would revert.
      if (guestContext !== 'record_request') {
        setProgress({ message: 'Updating status on distributed network...' });
        await MemberRegistryBlockchain.setUserStatus(guestUid, 2);
      }

      // ── Step 9: Deactivate placeholder guest wallet on-chain (nice-to-have) ──
      // Sharing flow only — in the request flow no placeholder wallet was ever
      // registered on-chain so there's nothing to deactivate.
      if (guestContext !== 'record_request') {
        try {
          const placeholderWallet = user.onChainIdentity?.linkedWallets?.find(
            w => w.address !== walletData.walletAddress
          )?.address;
          if (placeholderWallet) {
            await MemberRegistryBlockchain.deactivateWallet(placeholderWallet);
            console.log('✅ Placeholder wallet deactivated');
          }
        } catch (err) {
          console.warn('⚠️ Could not deactivate placeholder wallet:', err);
        }
      }

      // ── Step 10: Generate Signal keys ─────────────────────────────────────────
      setProgress({ message: 'Setting up secure messaging...' });
      const signalKeyBundle = await generateKeyBundle(guestUid);
      await KeyBundleService.uploadKeyBundle(guestUid, signalKeyBundle);

      // ── Step 11: Clear guest key ───────────────
      EncryptionKeyManager.setGuestFileKeys(new Map());

      // ── Step 12: Refresh auth context so banner disappears ───────────────────
      setProgress({ message: 'Finalizing...' });

      // Update display name in Firebase Auth profile (optional, since we have it in Firestore, but good for consistency)
      await updateProfile(auth.currentUser!, {
        displayName,
      });
      await refreshUser();

      setStep('done');
      toast.success('Welcome to Belrose!', {
        description: 'Your account has been created successfully.',
      });
    } catch (err: any) {
      console.error('❌ Claim failed:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setStep('recovery');
    }
  };

  const handleClose = () => {
    if (step === 'processing') return; // Don't allow closing during processing
    setStep('credentials');
    setError(null);
    setPassword('');
    setConfirmPassword('');
    setCryptoData(null);
    setAcknowledged(false);
    onClose();
  };

  const handleDone = () => {
    setStep('credentials');
    setError(null);
    setPassword('');
    setConfirmPassword('');
    setCryptoData(null);
    setAcknowledged(false);
    // If caller provided onComplete, use it — otherwise fall back to onClose
    if (onComplete) {
      onComplete();
    } else {
      onClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                     bg-white rounded-2xl shadow-2xl z-[201] w-full max-w-lg max-h-[90vh] 
                     overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <Dialog.Title className="text-lg font-bold text-slate-900">
                Create Your Account
              </Dialog.Title>
              <Dialog.Description className="text-sm text-slate-500 mt-0.5">
                Turn your guest access into a permanent account
              </Dialog.Description>
            </div>
            {step !== 'processing' && (
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>

          {/* Step indicator */}
          {(step === 'credentials' || step === 'recovery') && (
            <div className="flex items-center gap-3 px-6 pt-4">
              <div
                className={`flex items-center gap-2 text-xs font-medium ${
                  step === 'credentials' ? 'text-amber-600' : 'text-green-600'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs
                  ${step === 'credentials' ? 'bg-amber-500' : 'bg-green-500'}`}
                >
                  {step === 'recovery' ? <Check className="w-3 h-3" /> : '1'}
                </div>
                Account Details
              </div>
              <div className="flex-1 h-px bg-slate-200" />
              <div
                className={`flex items-center gap-2 text-xs font-medium ${
                  step === 'recovery' ? 'text-amber-600' : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs
                  ${step === 'recovery' ? 'bg-amber-500' : 'bg-slate-300'}`}
                >
                  2
                </div>
                Recovery Key
              </div>
            </div>
          )}

          <div className="p-6">
            {/* ── Step 1: Credentials ── */}
            {step === 'credentials' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      First Name
                    </label>
                    <InputField
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className="px-3 py-2 text-sm"
                      placeholder="Jane"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Last Name
                    </label>
                    <InputField
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      className="px-3 py-2 text-sm"
                      placeholder="Smith"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Email</label>
                  <InputField
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    ✓ Already verified via your invite link
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Password</label>
                  <InputField
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="px-3 py-2 text-sm"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <PasswordStrengthIndicator password={password} /> {/* ← add here */}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Confirm Password
                  </label>
                  <InputField
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="px-3 py-2 text-sm"
                    placeholder="Repeat your password"
                    onKeyDown={e => e.key === 'Enter' && handleCredentialsSubmit()}
                  />
                </div>

                {error && (
                  <p
                    className="text-xs text-red-600 bg-red-50 border border-red-200 
                                rounded-lg px-3 py-2"
                  >
                    {error}
                  </p>
                )}

                <Button
                  onClick={handleCredentialsSubmit}
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Setting up encryption...
                    </span>
                  ) : (
                    'Continue →'
                  )}
                </Button>
              </div>
            )}

            {/* ── Step 2: Recovery Key ── */}
            {step === 'recovery' && (
              <div className="space-y-4">
                <RecoveryKeyDisplay
                  recoveryKey={recoveryKey}
                  onAcknowledge={setAcknowledged}
                  onComplete={handleClaim}
                  isCompleted={acknowledged}
                  isActivated={true}
                />

                {error && (
                  <p
                    className="text-xs text-red-600 bg-red-50 border border-red-200 
                                rounded-lg px-3 py-2"
                  >
                    {error}
                  </p>
                )}
              </div>
            )}

            {/* ── Processing ── */}
            {step === 'processing' && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                <p className="font-semibold text-slate-800">Creating your account...</p>
                {progress && (
                  <p className="text-sm text-slate-500 text-center">{progress.message}</p>
                )}
              </div>
            )}

            {/* ── Done ── */}
            {step === 'done' && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="w-7 h-7 text-green-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Welcome to Belrose!</h3>
                <p className="text-sm text-slate-500 max-w-xs">
                  Your account is ready. You now have full access to all features.
                </p>
                <Button onClick={handleDone} className="mt-2">
                  Get Started
                </Button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
