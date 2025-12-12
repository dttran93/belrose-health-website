import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { SectionHeader, SettingsRow } from './ui/SettingsRow';
import { BelroseUserProfile } from '@/types/core';
import {
  BlockchainRoleManagerService,
  MemberStatus,
  MemberInfo,
} from '@/features/Permissions/services/blockchainRoleManagerService';
import { ethers } from 'ethers';

interface UserSettingsProps {
  user: BelroseUserProfile;
  onChangeName?: () => void;
  onChangeEmail?: () => void;
  onChangePhoto?: () => void;
  onStartVerification?: () => void;
  className?: string;
}

// Helper to truncate hashes
const truncateHash = (hash: string, startChars = 10, endChars = 8): string => {
  if (hash.length <= startChars + endChars) return hash;
  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`;
};

// Helper to format dates
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

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
      const memberData = await BlockchainRoleManagerService.getMember(user.wallet.address);
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
        return { label: 'Verified', color: 'text-chart-3', bg: 'bg-chart-3' };
      case MemberStatus.Active:
        return { label: 'Active', color: 'text-chart-1', bg: 'bg-chart-1' };
      case MemberStatus.Inactive:
        return { label: 'Inactive', color: 'text-chart-4', bg: 'bg-chart-4' };
      default:
        return { label: 'Unknown', color: 'text-muted-foreground', bg: 'bg-foreground' };
    }
  };

  const computedUserIdHash = user.uid ? ethers.keccak256(ethers.toUtf8Bytes(user.uid)) : null;
  const hashesMatch =
    computedUserIdHash && onChainData?.userIdHash
      ? computedUserIdHash.toLowerCase() === onChainData.userIdHash.toLowerCase()
      : false;

  return (
    <div className={`max-w-2xl mx-auto py-8 px-6 ${className || ''}`}>
      {/* Profile Photo / Avatar */}
      <div className="flex flex-col items-center mb-8">
        <div
          className={
            'w-24 h-24 rounded-full flex items-center justify-center text-3xl font-semibold text-white mb-3 bg-gradient-to-br from-chart-1 to-chart-5'
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
        <div className="bg-chart-4/10 border border-chart-4/30 rounded-xl p-4 mb-6 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-chart-4 shrink-0" />
            <div>
              <div className="text-sm font-medium text-chart-4">Identity not verified</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Complete verification to unlock all platform features
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onStartVerification}
            className="bg-chart-4 hover:bg-chart-4/90 text-primary-foreground shrink-0"
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

      <SettingsRow
        label="Block Number"
        value={`#${user.blockchainMember?.blockNumber.toLocaleString()}`}
        mono
      />

      <SettingsRow
        label="Transaction Hash"
        value={user.blockchainMember?.txHash ? user.blockchainMember.txHash : 'Not registered'}
        isLink={!!user.blockchainMember?.txHash}
        linkHref={`https://etherscan.io/tx/${user.blockchainMember?.txHash}`}
        mono
      />

      {!user.wallet?.address ? (
        <div className="text-sm text-muted-foreground py-3">
          No wallet connected. Connect a wallet to view on-chain data.
        </div>
      ) : isLoadingOnChain ? (
        <div className="text-sm text-muted-foreground py-3 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Querying blockchain...
        </div>
      ) : onChainError ? (
        <div className="text-sm text-destructive py-3">{onChainError}</div>
      ) : onChainData ? (
        <>
          <SettingsRow
            label="On-Chain Status"
            value={(() => {
              const { label, color, bg } = formatOnChainStatus(onChainData.status);
              return (
                <span className={`inline-flex items-center gap-1 ${color}`}>
                  <span className={`w-2 h-2 rounded-full ${bg}`} />
                  {label}
                </span>
              );
            })()}
          />

          <SettingsRow
            label="User ID Hash (on-chain)"
            value={
              <div className="flex items-center gap -2">
                <span className="font-mono text-sm break-all">{onChainData.userIdHash}</span>
                {hashesMatch ? (
                  <span className="inline-flex items-center text-chart-3 gap-1">
                    <span className="w-2 h-2 rounded-full bg-chart-3 ml-2" /> <span>Verified</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <span className="w-2 h-2 rounded-full bg-foreground mx-1" />{' '}
                    <span className="text-xs">Mismatch</span>
                  </span>
                )}
              </div>
            }
          />

          <SettingsRow
            label="Joined At (on-chain)"
            value={onChainData.joinedAt ? onChainData.joinedAt.toLocaleString() : 'Not registered'}
          />
        </>
      ) : (
        <div className="text-sm text-muted-foreground py-3">
          No on-chain member data found for this wallet address.
        </div>
      )}
    </div>
  );
};

export default UserSettings;
