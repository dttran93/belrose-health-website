// src/features/Sharing/components/GuestSharePanel.tsx

import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FileObject } from '@/types/core';
import { Stethoscope } from 'lucide-react';
import { ethers } from 'ethers';
import { getAuth } from 'firebase/auth';
import { BlockchainRoleManagerService } from '@/features/Permissions/services/blockchainRoleManagerService';
import { arrayUnion, doc, getFirestore, updateDoc } from 'firebase/firestore';
import { SharingService } from '@/features/Sharing/services/sharingService';
import {
  PermissionActionDialog,
  DialogPhase,
} from '@/features/Permissions/component/ui/PermissionActionDialog';

interface GuestSharePanelProps {
  record: FileObject;
  patientName: string;
  onSuccess?: () => void; // Optional callback to refresh data after successful sharing
}

type DurationOption = { label: string; seconds: number };

const DURATION_OPTIONS = [
  { label: '1 day', seconds: 86400 },
  { label: '3 days', seconds: 259200 },
  { label: '7 days', seconds: 604800 },
  { label: '30 days', seconds: 2592000 },
] as const;

const DEFAULT_DURATION = DURATION_OPTIONS[2]; // 7 days is default

function deriveGuestWallet(guestUid: string): string {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(`guest:${guestUid}`));
  return ethers.getAddress('0x' + hash.slice(-40));
}

// Helper — hash an email consistently for the blockchain audit trail
function hashEmail(email: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(email.toLowerCase().trim()));
}

export const GuestSharePanel: React.FC<GuestSharePanelProps> = ({
  record,
  patientName,
  onSuccess,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<DialogPhase>('confirming');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [duration, setDuration] = useState<DurationOption>(DEFAULT_DURATION);

  const handleOpen = () => {
    setEmail('');
    setDuration(DEFAULT_DURATION);
    setError(null);
    setPhase('confirming');
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setEmail('');
    setError(null);
    setPhase('confirming');
  };

  const handleConfirm = async () => {
    if (!email) return;
    setPhase('executing');
    setError(null);

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('You must be logged in to share records.');

      // ── Step 1: Cloud Function ─────────────────────────────────────────────
      // Creates guest Firebase Auth account, writes guest Firestore profile
      // with RSA public key, creates guestInvites doc, sends email
      const functions = getFunctions();
      const createGuestInvite = httpsCallable(functions, 'createGuestInvite');
      const result = (await createGuestInvite({
        guestEmail: email,
        recordIds: [record.id],
        patientName,
        durationSeconds: duration.seconds,
      })) as { data: { guestUid: string } };

      const { guestUid } = result.data;

      // ── Step 2: Blockchain guest access ───────────────────────────────────
      // Derives a deterministic placeholder wallet for the guest so they
      // slot into the existing wallets/userIdHash infrastructure on-chain.
      // Fires GuestAccessGranted event with expiry for the audit trail.
      const guestWallet = deriveGuestWallet(guestUid);
      const guestIdHash = ethers.keccak256(ethers.toUtf8Bytes(guestUid));
      const guestEmailHash = hashEmail(email);

      console.log('🔗 Granting guest access on blockchain...');
      await BlockchainRoleManagerService.grantGuestAccess(
        [record.id],
        guestWallet,
        guestIdHash,
        guestEmailHash,
        duration.seconds
      );
      console.log('✅ Blockchain: Guest access granted');

      // ── Step 3: Encryption access ─────────────────────────────────────────
      // Wraps the record's AES file key with the guest's RSA public key.
      // This is what allows GuestInvitePage to decrypt records on arrival.

      await SharingService.grantEncryptionAccess(record.id, guestUid, currentUser.uid, {
        isGuest: true,
        expiresAt: new Date(Date.now() + duration.seconds * 1000),
      });
      console.log('✅ Encryption access granted');

      // ── Step 4: Firestore viewers array ───────────────────────────────────
      // Adds guest UID to the record's viewers array so Firestore security
      // rules allow them to read the record document.
      const db = getFirestore();
      await updateDoc(doc(db, 'records', record.id), {
        viewers: arrayUnion(guestUid),
      });
      console.log('✅ Added to Firestore viewers array');

      handleClose();
      onSuccess?.();
    } catch (err: any) {
      console.error('❌ Guest share failed:', err);
      setError(err.message || 'Failed to send invite. Please try again.');
      setPhase('error');
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="mt-4 w-full flex items-center gap-3 border border-dashed border-complement-4
                   rounded-lg p-4 bg-complement-4/10 hover:bg-complement-4/20 transition-colors text-left"
      >
        <Stethoscope className="w-4 h-4 text-foreground shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">Share via Email</p>
          <p className="text-xs text-foreground/60">
            No Belrose account needed — sends a secure time-limited link
          </p>
        </div>
      </button>

      {/* Dialog */}
      <PermissionActionDialog
        isOpen={isOpen}
        phase={phase}
        operationType="guest-invite"
        role="viewer"
        user={null}
        error={error}
        onClose={handleClose}
        onConfirmGrant={() => {}}
        onConfirmRevoke={() => {}}
        onConfirmGuestInvite={handleConfirm}
        guestInviteProps={{
          email,
          setEmail,
          duration,
          setDuration,
          durationOptions: DURATION_OPTIONS,
        }}
      />
    </>
  );
};
