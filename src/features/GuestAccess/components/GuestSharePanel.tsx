// src/features/Sharing/components/GuestSharePanel.tsx

import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import { FileObject } from '@/types/core';
import { Button } from '@/components/ui/Button';
import { Send, CheckCircle, AlertTriangle, Stethoscope } from 'lucide-react';
import { ethers } from 'ethers';
import { getAuth } from 'firebase/auth';
import { BlockchainRoleManagerService } from '@/features/Permissions/services/blockchainRoleManagerService';
import { arrayUnion, doc, getFirestore, updateDoc } from 'firebase/firestore';
import { SharingService } from '../../Sharing/services/sharingService';

interface GuestSharePanelProps {
  record: FileObject;
  patientName: string;
}

type PanelState = 'idle' | 'loading' | 'success' | 'error';

type DurationOption = (typeof DURATION_OPTIONS)[number];

const DURATION_OPTIONS = [
  { label: '1 day', seconds: 86400 },
  { label: '3 days', seconds: 259200 },
  { label: '7 days', seconds: 604800 },
  { label: '30 days', seconds: 2592000 },
] as const;

const DEFAULT_DURATION = DURATION_OPTIONS[2]; // 7 days

function deriveGuestWallet(guestUid: string): string {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(`guest:${guestUid}`));
  // keccak256 returns 32 bytes — take the last 20 bytes as an address
  return ethers.getAddress('0x' + hash.slice(-40));
}

// Helper — hash an email consistently for the blockchain audit trail
function hashEmail(email: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(email.toLowerCase().trim()));
}

export const GuestSharePanel: React.FC<GuestSharePanelProps> = ({ record, patientName }) => {
  const [email, setEmail] = useState('');
  const [duration, setDuration] = useState<DurationOption>(DEFAULT_DURATION);
  const [state, setState] = useState<PanelState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSend = async () => {
    if (!email) return;
    setState('loading');
    setErrorMsg('');

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
      const guestProfile = await getUserProfile(guestUid);
      if (!guestProfile) throw new Error('Guest profile not found after creation.');

      await SharingService.grantEncryptionAccess(record.id, guestUid, currentUser.uid);
      console.log('✅ Encryption access granted');

      // ── Step 4: Firestore viewers array ───────────────────────────────────
      // Adds guest UID to the record's viewers array so Firestore security
      // rules allow them to read the record document.
      const db = getFirestore();
      await updateDoc(doc(db, 'records', record.id), {
        viewers: arrayUnion(guestUid),
      });
      console.log('✅ Added to Firestore viewers array');

      setState('success');
      setEmail('');
    } catch (err: any) {
      console.error('❌ Guest share failed:', err);
      setErrorMsg(err.message || 'Failed to send invite. Please try again.');
      setState('error');
    }
  };

  return (
    <div className="mt-6 border border-dashed border-complement-4 rounded-lg p-4 bg-complement-4/20">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="w-4 h-4 text-foreground" />
        <h4 className="text-sm font-semibold text-foreground">Share via Email</h4>
      </div>

      <p className="text-xs text-foreground mb-4">
        They don't need a Belrose account. We'll email them a secure link.
      </p>

      {state === 'success' ? (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle className="w-4 h-4" />
          Invite sent! The guest will receive an email with a secure link valid for {duration.label}
          .
        </div>
      ) : (
        <div className="space-y-2">
          {/* Email + Send row */}
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="doctor@clinic.com"
              className="flex-1 text-sm border border-complement-4 rounded-lg px-3 py-2 
                       bg-white focus:outline-none focus:ring-2 focus:ring-complement-4 focus:border-transparent"
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <Button
              onClick={handleSend}
              disabled={!email || state === 'loading'}
              className="shrink-0"
            >
              <Send className="w-4 h-4 mr-1" />
              {state === 'loading' ? 'Sending...' : 'Send'}
            </Button>
          </div>

          {/* Duration selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground/60">Link expires in:</span>
            <div className="flex gap-1">
              {DURATION_OPTIONS.map(option => (
                <button
                  key={option.seconds}
                  onClick={() => setDuration(option)}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                    duration.seconds === option.seconds
                      ? 'bg-complement-4 border-complement-4 text-white font-medium'
                      : 'border-complement-4/40 text-foreground/60 hover:border-complement-4 hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-center gap-2 mt-2 text-red-600 text-xs">
          <AlertTriangle className="w-3 h-3" />
          {errorMsg}
        </div>
      )}
    </div>
  );
};
