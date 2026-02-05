import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { SectionHeader, SettingsRow } from './ui/SettingsRow';
import { BelroseUserProfile, LinkedWalletRecord } from '@/types/core';
import {
  BlockchainRoleManagerService,
  MemberStatus,
  MemberInfo,
} from '@/features/Permissions/services/blockchainRoleManagerService';
import { ethers } from 'ethers';
import { formatTimestamp } from '@/utils/dataFormattingUtils';

interface UserSettingsProps {
  user: BelroseUserProfile;
  onChangeName?: () => void;
  onChangeEmail?: () => void;
  onChangePhoto?: () => void;
  onStartVerification?: () => void;
  className?: string;
}

// Copy to clipboard helper with toast notification
const copyToClipboard = async (text: string, label: string = 'Text'): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  } catch (err) {
    console.error('Failed to copy:', err);
    toast.error('Failed to copy to clipboard');
  }
};

// Main UserSettings Component
const UserSettings: React.FC<UserSettingsProps> = ({
  user,
  onChangeName,
  onChangeEmail,
  onChangePhoto,
  onStartVerification,
  className,
}) => {
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U';

  //Blockchain query state
  const [onChainData, setOnChainData] = useState<MemberInfo | null>(null);
  const [isLoadingOnChain, setIsLoadingOnChain] = useState(false);
  const [onChainError, setOnChainError] = useState<string | null>(null);

  //Fetch on-chain data
  const fetchOnChainData = async () => {
    if (!user.wallet?.address) {
      setOnChainError('No wallet address');
      return;
    }

    setIsLoadingOnChain(true);
    setOnChainError(null);

    try {
      const memberData = await BlockchainRoleManagerService.getMemberInfo(user.wallet.address);
      setOnChainData(memberData);
    } catch (error) {
      console.error('Error fetching on-chain data:', error);
      setOnChainError('Failed to query blockchain');
    } finally {
      setIsLoadingOnChain(false);
    }
  };

  useEffect(() => {
    if (user.wallet?.address) {
      fetchOnChainData();
    }
  }, [user.wallet?.address]);

  const formatOnChainStatus = (status: MemberStatus) => {
    switch (status) {
      case MemberStatus.Verified:
        return { label: 'Verified', color: 'text-complement-3', bg: 'bg-complement-3' };
      case MemberStatus.Active:
        return { label: 'Active', color: 'text-complement-1', bg: 'bg-complement-1' };
      case MemberStatus.Inactive:
        return { label: 'Inactive', color: 'text-complement-4', bg: 'bg-complement-4' };
      default:
        return { label: 'Unknown', color: 'text-muted-foreground', bg: 'bg-foreground' };
    }
  };

  const computedUserIdHash = user.uid ? ethers.keccak256(ethers.toUtf8Bytes(user.uid)) : null;
  const hashesMatch =
    computedUserIdHash && onChainData?.userIdHash
      ? computedUserIdHash.toLowerCase() === onChainData.userIdHash.toLowerCase()
      : false;

  //Helper to  get Current wallets
  const getCurrentWalletRecord = (
    linkedWallets: LinkedWalletRecord[] | undefined,
    currentAddress: string
  ): LinkedWalletRecord | null => {
    if (!linkedWallets || !currentAddress) return null;
    return (
      linkedWallets.find(wallet => wallet.address.toLowerCase() === currentAddress.toLowerCase()) ||
      null
    );
  };

  // Then in your component, after the initials definition:
  const currentWalletRecord = getCurrentWalletRecord(
    user.onChainIdentity?.linkedWallets,
    user.wallet?.address
  );

  return (
    <div className={`max-w-2xl mx-auto py-8 px-6 ${className || ''}`}>
      {/* Profile Photo / Avatar */}
      <div className="flex flex-col items-center mb-8">
        <div
          className={
            'w-24 h-24 rounded-full flex items-center justify-center text-3xl font-semibold text-white mb-3 bg-gradient-to-br from-complement-1 to-complement-5'
          }
          style={
            user.photoURL
              ? {
                  backgroundImage: `url(${user.photoURL})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          {!user.photoURL && initials}
        </div>
        <div className="text-xl font-semibold text-foreground">{user.displayName}</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onChangePhoto}
          className="mt-2 text-muted-foreground"
        >
          Change photo
        </Button>
      </div>

      {/* Identity Verification Warning Banner */}
      {!user.identityVerified && (
        <div className="bg-complement-4/10 border border-complement-4/30 rounded-xl p-4 mb-6 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-complement-4 shrink-0" />
            <div>
              <div className="text-sm font-medium text-complement-4">Identity not verified</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Complete verification to unlock all platform features
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onStartVerification}
            className="bg-complement-4 hover:bg-complement-4/90 text-primary-foreground shrink-0"
          >
            Start verification
          </Button>
        </div>
      )}

      {/* Account Details Section */}
      <SectionHeader title="Account Details" />

      <SettingsRow
        label="Full Name"
        value={user.displayName}
        buttonText="Change name"
        onButtonClick={onChangeName}
      />

      <SettingsRow
        label="Email"
        value={user.email}
        buttonText="Change email"
        onButtonClick={onChangeEmail}
      />

      <SettingsRow label="User ID" value={user.uid} mono />

      {/* Wallet Section */}
      <SectionHeader title="Wallet" />

      <SettingsRow
        label="Wallet Address"
        value={user.wallet.address || 'No wallet connected'}
        mono
        buttonText={user.wallet.address ? 'Copy' : undefined}
        onButtonClick={() => copyToClipboard(user.wallet.address, 'Wallet address')}
      />

      <SettingsRow label="Origin" value={user.wallet.origin} />

      <SettingsRow
        label="Wallet Activity"
        value={user.wallet.address}
        isLink
        linkHref={`https://etherscan.io/address/${user.wallet.address}`}
        mono
      />

      {/* Blockchain Member Registry Section */}
      <SectionHeader title="Blockchain Member Registry" />

      {currentWalletRecord ? (
        <>
          <SettingsRow
            label="Wallet Type"
            value={currentWalletRecord.type === 'eoa' ? 'EOA (Externally Owned)' : 'Smart Account'}
          />

          <SettingsRow
            label="Wallet Status"
            value={
              currentWalletRecord.isWalletActive ? (
                <span className="inline-flex items-center gap-1 text-complement-3">
                  <span className="w-2 h-2 rounded-full bg-complement-3" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                  Inactive
                </span>
              )
            }
          />

          <SettingsRow
            label="Block Number"
            value={`#${currentWalletRecord.blockNumber.toLocaleString()}`}
            mono
          />

          <SettingsRow
            label="Transaction Hash"
            value={currentWalletRecord.txHash}
            isLink
            linkHref={`https://etherscan.io/tx/${currentWalletRecord.txHash}`}
            mono
          />

          <SettingsRow
            label="Linked At"
            value={formatTimestamp(
              currentWalletRecord.linkedAt.toDate?.() || currentWalletRecord.linkedAt
            )}
          />
        </>
      ) : (
        <div className="text-sm text-muted-foreground py-3">
          This wallet is not registered on-chain.
        </div>
      )}
    </div>
  );
};

export default UserSettings;
