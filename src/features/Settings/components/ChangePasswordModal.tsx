// src/features/Settings/components/ChangePasswordModal.tsx

import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import PasswordStrengthIndicator from '@/features/Auth/components/ui/PasswordStrengthIndicator';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<boolean>;
  isLoading: boolean;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setError(null);
    }
  }, [isOpen]);

  const validatePassword = (password: string): { valid: boolean; error?: string } => {
    if (password.length < 8)
      return { valid: false, error: 'Password must be at least 8 characters' };
    let criteriaCount = 0;
    if (/[a-z]/.test(password)) criteriaCount++;
    if (/[A-Z]/.test(password)) criteriaCount++;
    if (/\d/.test(password)) criteriaCount++;
    if (/[^a-zA-Z0-9]/.test(password)) criteriaCount++;
    if (criteriaCount < 3) {
      return {
        valid: false,
        error:
          'Password must contain at least 3 of: lowercase, uppercase, number, special character',
      };
    }
    return { valid: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Current password is required');
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from your current password');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const success = await onSubmit(currentPassword, newPassword);
    if (success) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Change Password</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Encryption warning */}
        <div className="bg-complement-4/10 border border-complement-4/30 rounded-lg p-3 mb-6 flex gap-3">
          <ShieldAlert className="w-5 h-5 text-complement-4 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-complement-4">Your encryption key will be re-wrapped</p>
            <p className="text-muted-foreground mt-1">
              Your password protects your encrypted health data. Changing it will re-secure your
              encryption key with the new password.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Current password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Current password
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-complement-1 focus:border-transparent"
                  placeholder="Enter current password"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">New password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-complement-1 focus:border-transparent"
                  placeholder="Enter new password"
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength indicator — only shows when user starts typing */}
              <PasswordStrengthIndicator
                password={newPassword}
                showFeedback={newPassword.length > 0}
              />
            </div>

            {/* Confirm new password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-complement-1 focus:border-transparent"
                  placeholder="Confirm new password"
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Confirm match indicator */}
              {confirmPassword.length > 0 && (
                <p
                  className={`text-xs mt-1 ${newPassword === confirmPassword ? 'text-green-600' : 'text-destructive'}`}
                >
                  {newPassword === confirmPassword ? '✓ Passwords match' : 'Passwords do not match'}
                </p>
              )}
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
              Update password
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
