import React, { useState } from 'react';
import { Eye, EyeOff, Copy, Check, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionHeader, SettingsRow } from './ui/SettingsRow';
import { BelroseUserProfile } from '@/types/core';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { copyToClipboard } from '@/utils/browserUtils';
import { toast } from 'sonner';

interface AccountSettingsProps {
  user: BelroseUserProfile;
  onChangeEmail?: () => void;
  onChangePassword?: () => void;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({
  user,
  onChangeEmail,
  onChangePassword,
}) => {
  // Recovery phrase state
  const [recoveryPhrase, setRecoveryPhrase] = useState<string | null>(null);
  const [isLoadingPhrase, setIsLoadingPhrase] = useState(false);
  const [isPhraseVisible, setIsPhraseVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRevealPhrase = async () => {
    if (recoveryPhrase) {
      // Already loaded — just toggle visibility
      setIsPhraseVisible(prev => !prev);
      return;
    }

    setIsLoadingPhrase(true);
    try {
      const masterKey = await EncryptionKeyManager.getSessionKey();
      if (!masterKey) {
        toast.error('No active session. Please log out and back in.');
        return;
      }
      const phrase = await EncryptionKeyManager.generateRecoveryKeyFromMasterKey(masterKey);
      setRecoveryPhrase(phrase);
      setIsPhraseVisible(true);
    } catch (err) {
      console.error('Failed to derive recovery phrase:', err);
      toast.error('Failed to load recovery phrase');
    } finally {
      setIsLoadingPhrase(false);
    }
  };

  const handleCopyPhrase = async () => {
    if (!recoveryPhrase) return;
    await copyToClipboard(recoveryPhrase, 'Recovery phrase');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Split phrase into numbered words for display
  const phraseWords = recoveryPhrase?.split(' ') ?? [];

  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      {/* Login & Security */}
      <SectionHeader title="Login & Security" />

      <SettingsRow
        label="Email address"
        value={user.email}
        buttonText="Change email"
        onButtonClick={onChangeEmail}
      />

      <SettingsRow
        label="Password"
        value={<span className="tracking-widest text-muted-foreground text-xs">••••••••</span>}
        buttonText="Change password"
        onButtonClick={onChangePassword}
      />

      {/* Recovery Phrase */}
      <SectionHeader title="Encryption Recovery Phrase" />

      {/* Warning banner */}
      <div className="flex items-start gap-3 bg-complement-4/10 border border-complement-4/30 rounded-xl p-4 mb-4">
        <ShieldAlert className="w-4 h-4 text-complement-4 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          This 24-word phrase is the only way to recover your encrypted data if you lose access to
          your account. Store it somewhere safe and never share it with anyone.
        </p>
      </div>

      <div className="py-3">
        <div className="text-sm font-medium text-foreground mb-3">Recovery phrase</div>

        {/* Phrase grid — shown when visible */}
        {isPhraseVisible && recoveryPhrase && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {phraseWords.map((word, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2"
              >
                <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                  {i + 1}.
                </span>
                <span className="text-sm font-mono text-foreground">{word}</span>
              </div>
            ))}
          </div>
        )}

        {/* Blurred placeholder — shown when hidden */}
        {!isPhraseVisible && (
          <div className="grid grid-cols-3 gap-2 mb-4 select-none pointer-events-none">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2"
              >
                <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                  {i + 1}.
                </span>
                <span className="text-sm font-mono text-muted-foreground blur-sm">••••••</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevealPhrase}
            disabled={isLoadingPhrase}
            className="flex items-center gap-2"
          >
            {isLoadingPhrase ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isPhraseVisible ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {isPhraseVisible ? 'Hide phrase' : 'Reveal phrase'}
          </Button>

          {recoveryPhrase && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPhrase}
              className="flex items-center gap-2"
            >
              {copied ? (
                <Check className="w-4 h-4 text-complement-3" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? 'Copied!' : 'Copy phrase'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
