import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, User, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import { ClaimAccountService } from '../services/claimAccountService';
import type { BelroseUserProfile } from '@/types/core';

const ClaimAccountPage: React.FC = () => {
  const { user, refreshUser } = useAuthContext();
  const navigate = useNavigate();
  const [guardian, setGuardian] = useState<BelroseUserProfile | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!user?.dependentCreatedBy) return;
    getUserProfile(user.dependentCreatedBy)
      .then(setGuardian)
      .catch(() => {});
  }, [user?.dependentCreatedBy]);

  const handleClaim = async () => {
    setIsClaiming(true);
    try {
      await ClaimAccountService.claimAccount();
      setClaimed(true);
      // Give the success state a moment to show, then refresh and enter the app
      setTimeout(async () => {
        await refreshUser();
        navigate('/account-setup', { replace: true });
      }, 1500);
    } catch (err: any) {
      toast.error('Something went wrong. Please try again.');
      setIsClaiming(false);
    }
  };

  const guardianName = guardian?.displayName || guardian?.firstName || 'your guardian';
  const guardianInitials =
    `${guardian?.firstName?.[0] ?? ''}${guardian?.lastName?.[0] ?? ''}`.toUpperCase() || '?';

  if (claimed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
          <p className="text-lg font-semibold text-slate-900">Account claimed!</p>
          <p className="text-sm text-slate-500">Getting things ready…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-8 py-10 text-center">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Welcome to Belrose Health!</h1>
          <p className="text-sm text-white/70">
            This account was created for you. Claim full ownership below to proceed.
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-7 space-y-6">
          {/* Guardian info */}
          {guardian !== undefined && (
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-primary">
                {guardian?.photoURL ? (
                  <img
                    src={guardian.photoURL}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  guardianInitials
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                  Created by
                </p>
                <p className="text-sm font-semibold text-slate-900 truncate">{guardianName}</p>
              </div>
              <div className="ml-auto flex-shrink-0">
                <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                  Controller
                </span>
              </div>
            </div>
          )}

          {/* What claiming means */}
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p>You will become the independent owner of this account and its health records.</p>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p>
                <strong className="text-slate-800">{guardianName}</strong> will remain a controller
                trustee — they retain access to your records and management capability unless you
                remove them in{' '}
                <span className="font-medium text-slate-700">Settings → Trustees</span>.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-1">
            <Button
              onClick={handleClaim}
              disabled={isClaiming}
              className="w-full flex items-center justify-center gap-2"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Claiming…
                </>
              ) : (
                <>
                  Claim My Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimAccountPage;
