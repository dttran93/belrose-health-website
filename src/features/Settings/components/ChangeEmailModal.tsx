// src/features/Settings/components/ChangeEmailModal.tsx

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ChangeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newEmail: string, currentPassword: string) => Promise<boolean>;
  isLoading: boolean;
  currentEmail: string;
}

export const ChangeEmailModal: React.FC<ChangeEmailModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  currentEmail,
}) => {
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setNewEmail('');
      setConfirmEmail('');
      setPassword('');
      setShowPassword(false);
      setError(null);
    }
  }, [isOpen]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!newEmail.trim()) {
      setError('New email is required');
      return;
    }
    if (!validateEmail(newEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setError('New email must be different from current email');
      return;
    }
    if (newEmail !== confirmEmail) {
      setError('Email addresses do not match');
      return;
    }
    if (!password) {
      setError('Password is required to change email');
      return;
    }

    const success = await onSubmit(newEmail.trim(), password);
    if (success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Change Email</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning */}
        <div className="bg-complement-4/10 border border-complement-4/30 rounded-lg p-3 mb-6 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-complement-4 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-complement-4">Email verification required</p>
            <p className="text-muted-foreground mt-1">
              We'll send a verification link to your new email address. Your email will only change
              ater you click that link.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Current Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Current Email
              </label>
              <input
                type="email"
                value={currentEmail}
                disabled
                className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground"
              />
            </div>

            {/* New Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">New Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-complement-1 focus:border-transparent"
                placeholder="Enter new email address"
                disabled={isLoading}
              />
            </div>

            {/* Confirm Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Confirm New Email
              </label>
              <input
                type="email"
                value={confirmEmail}
                onChange={e => setConfirmEmail(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-complement-1 focus:border-transparent"
                placeholder="Confirm new email address"
                disabled={isLoading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Current Password
              </label>
              <p className="text-xs text-muted-foreground mb-2">Required to confirm this change</p>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-complement-1 focus:border-transparent"
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" loading={isLoading} disabled={isLoading}>
              Change Email
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangeEmailModal;
