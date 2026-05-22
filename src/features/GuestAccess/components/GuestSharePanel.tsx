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
} from '@/features/Permissions/components/ui/PermissionActionDialog';
import { RecordPicker } from '@/features/Ai/components/ui/RecordPicker';
import { getShareableRecords } from '../services/guestShareableRecords';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import { GuestFeatureGate } from './GuestFeatureGate';
import { useOnChainActivityTray } from '@/features/OnChainActivityTray/OnChainActivityTrayContext';

interface GuestSharePanelProps {
  record?: FileObject; // optional — pre-selects this record if provided
  patientName: string;
  onSuccess?: () => void;
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
  const [selectedRecords, setSelectedRecords] = useState<FileObject[]>(record ? [record] : []);
  const [availableRecords, setAvailableRecords] = useState<FileObject[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [isRecordPickerOpen, setIsRecordPickerOpen] = useState(false);

  // OnChainActivityTray — UI display for blockchain processing in background
  const { addActivity, updateActivity } = useOnChainActivityTray();
  const [submittedLabel, setSubmittedLabel] = useState('');

  const fetchShareableRecords = async () => {
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setLoadingRecords(true);
    try {
      // Fetch encrypted records
      const records = await getShareableRecords(uid);

      // Decrypt so RecordPicker can display titles, providers, dates
      const decrypted = await RecordDecryptionService.decryptRecords(records);
      setAvailableRecords(decrypted);

      // If a primary record was pre-selected but came in encrypted,
      // replace it with the decrypted version so the chip shows the title
      if (record) {
        const decryptedPrimary = decrypted.find(r => r.id === record.id);
        if (decryptedPrimary) {
          setSelectedRecords([decryptedPrimary]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch shareable records:', err);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleOpen = async () => {
    setEmail('');
    setDuration(DEFAULT_DURATION);
    setError(null);
    setPhase('confirming');
    setSelectedRecords(record ? [record] : []);
    setIsOpen(true);
    await fetchShareableRecords();
  };

  const handleClose = () => {
    setIsOpen(false);
    setEmail('');
    setError(null);
    setPhase('confirming');
    setIsRecordPickerOpen(false);
  };

  const handleRemoveRecord = (id: string) => {
    setSelectedRecords(prev => prev.filter(r => r.id !== id));
  };

  const handleRecordPickerApply = (ids: string[]) => {
    const picked = availableRecords.filter(r => ids.includes(r.id));
    setSelectedRecords(picked);
    setIsRecordPickerOpen(false);
  };

  const handleConfirm = async () => {
    if (!email || selectedRecords.length === 0) return;
    setError(null);

    // Capture before closing
    const recordsToShare = [...selectedRecords];
    const durationToUse = duration;
    const emailToUse = email;

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('You must be logged in to share records.');

      // ── Step 1: Cloud Function ─────────────────────────────────────────────
      // Creates guest Firebase Auth account, writes guest Firestore profile
      // with RSA public key, creates guestInvites doc, sends email
      setPhase('executing');
      const functions = getFunctions();
      const createGuestInvite = httpsCallable(functions, 'createGuestInvite');
      const result = (await createGuestInvite({
        guestEmail: emailToUse,
        recordIds: recordsToShare.map(r => r.id),
        patientName,
        durationSeconds: durationToUse.seconds,
      })) as { data: { guestUid: string } };

      const { guestUid } = result.data;

      // ── Step 2: Hand off to activity tray ───────────────────────────────────
      const activityId = addActivity({ label: `Guest invite sent to ${emailToUse}` });
      setSubmittedLabel(`Guest invite sent to ${emailToUse}`);
      setPhase('submitted');

      // ── Step 3: Blockchain and guest access ───────────────────────────────────
      // Derives a deterministic placeholder wallet for the guest so they
      // slot into the existing wallets/userIdHash infrastructure on-chain.
      // Fires GuestAccessGranted event with expiry for the audit trail.
      const guestWallet = deriveGuestWallet(guestUid);
      const guestIdHash = ethers.keccak256(ethers.toUtf8Bytes(guestUid));
      const guestEmailHash = hashEmail(email);
      const db = getFirestore();

      console.log('🔗 Granting guest access on blockchain...');
      BlockchainRoleManagerService.grantGuestAccess(
        recordsToShare.map(
          r => r.recordIdHash ?? ethers.keccak256(ethers.toUtf8Bytes(r.firestoreId ?? r.id))
        ),
        guestWallet,
        guestIdHash,
        guestEmailHash,
        durationToUse.seconds
      )
        .then(async () => {
          await Promise.all(
            recordsToShare.map(r =>
              SharingService.grantEncryptionAccess(r.id, guestUid, currentUser.uid, {
                isGuest: true,
                expiresAt: new Date(Date.now() + durationToUse.seconds * 1000),
              })
            )
          );
          await Promise.all(
            recordsToShare.map(r =>
              updateDoc(doc(db, 'records', r.id), { viewers: arrayUnion(guestUid) })
            )
          );
          updateActivity(activityId, { status: 'confirmed' });
          onSuccess?.();
        })
        .catch(err => {
          const message = err instanceof Error ? err.message : 'Failed to complete guest setup';
          updateActivity(activityId, { status: 'failed', errorMessage: message });
        });
    } catch (err: any) {
      // Cloud Function failed — invite never sent, show error in dialog
      console.error('❌ Guest invite failed:', err);
      setError(err.message || 'Failed to send invite. Please try again.');
      setPhase('error');
    }
  };

  return (
    <>
      <GuestFeatureGate
        featureName="share records with guests"
        featureDescription="Share records with anyone via secure time-limited links, no Belrose account needed."
      >
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

        {/* Main invite dialog */}
        <PermissionActionDialog
          isOpen={isOpen && !isRecordPickerOpen}
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
            selectedRecords,
            loadingRecords,
            onOpenRecordPicker: () => setIsRecordPickerOpen(true),
            onRemoveRecord: handleRemoveRecord,
          }}
          submittedLabel={submittedLabel}
        />

        {/* Record picker — shown on top of main dialog */}
        {isRecordPickerOpen && (
          <RecordPicker
            records={availableRecords}
            selectedRecordIds={selectedRecords.map(r => r.id)}
            onSelectionChange={handleRecordPickerApply}
            onClose={() => setIsRecordPickerOpen(false)}
          />
        )}
      </GuestFeatureGate>{' '}
    </>
  );
};
