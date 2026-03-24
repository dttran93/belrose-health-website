import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionHeader, SettingsRow } from './ui/SettingsRow';
import { BelroseUserProfile } from '@/types/core';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import { NETWORK } from '@/config/blockchainAddresses';
import { copyToClipboard } from '@/utils/browserUtils';

interface GeneralSettingsProps {
  user: BelroseUserProfile;
  onChangeName?: () => void;
  onChangeEmail?: () => void;
  onChangePhoto?: () => void;
  onStartVerification?: () => void;
  className?: string;
}

// Main UserSettings Component
const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  user,
  onChangeName,
  onChangeEmail,
  onChangePhoto,
  onStartVerification,
  className,
}) => {
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U';

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

      {/* Profile Details Section */}
      <SectionHeader title="Profile Details" />

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
      <SectionHeader title="Distributed Network Accounts" />

      <SettingsRow
        label="Distributed Network ID Hash"
        value={user.onChainIdentity?.userIdHash}
        mono
      />

      {user.onChainIdentity?.linkedWallets?.length ? (
        user.onChainIdentity.linkedWallets.map((wallet, index) => {
          const isEOA = wallet.type === 'eoa';
          const label = isEOA ? 'EOA Account' : 'Smart Account';
          const etherscanBase = NETWORK.etherscanBaseUrl;

          return (
            <div key={wallet.address} className={index > 0 ? 'mt-6' : ''}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide m-4 p-1">
                {label}
              </p>

              <SettingsRow
                label="Address"
                value={wallet.address}
                isLink
                linkHref={`${etherscanBase}/address/${wallet.address}`}
                mono
                buttonText="Copy"
                onButtonClick={() => copyToClipboard(wallet.address, 'Wallet address')}
              />

              <SettingsRow
                label="Status"
                value={
                  wallet.isWalletActive ? (
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
                label="Transaction Hash"
                value={wallet.txHash}
                isLink
                linkHref={`${etherscanBase}/tx/${wallet.txHash}`}
                mono
              />

              <SettingsRow
                label="Linked At"
                value={formatTimestamp(wallet.linkedAt.toDate?.() || wallet.linkedAt)}
              />
            </div>
          );
        })
      ) : (
        <div className="text-sm text-muted-foreground py-3">No wallets linked.</div>
      )}
    </div>
  );
};

export default GeneralSettings;
