// src/features/IdentityVerification/components/IdentityVerificationCard.tsx

import React from 'react';
import { IdCard, CheckCircle2, Clock, Shield, Users, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { VerifiedData } from '../identity.types';

type IdentityStatus = 'unverified' | 'pending_manual_review' | 'verified';

interface IdentityVerificationCardProps {
  emailVerified: boolean;
  status: IdentityStatus;
  verifiedData?: VerifiedData | null;
  onStart: () => void;
}

const IdentityVerificationCard: React.FC<IdentityVerificationCardProps> = ({
  emailVerified,
  status,
  verifiedData,
  onStart,
}) => {
  const cardClass = `border-2 rounded-xl p-6 transition-all ${
    status === 'verified'
      ? 'border-complement-3 bg-complement-3/5'
      : status === 'pending_manual_review'
        ? 'border-amber-300 bg-amber-50/30'
        : emailVerified
          ? 'border-gray-200 hover:border-complement-4'
          : 'border-gray-200 opacity-60'
  }`;

  const iconClass = `flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
    status === 'verified'
      ? 'bg-complement-3'
      : status === 'pending_manual_review'
        ? 'bg-amber-400'
        : emailVerified
          ? 'bg-complement-4'
          : 'bg-gray-300'
  }`;

  return (
    <div className={cardClass}>
      <div className="flex items-start space-x-4">
        <div className={iconClass}>
          {status === 'verified' ? (
            <CheckCircle2 className="w-6 h-6 text-white" />
          ) : status === 'pending_manual_review' ? (
            <Clock className="w-6 h-6 text-white" />
          ) : (
            <IdCard className="w-6 h-6 text-white" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-semibold text-primary">Identity Verification</h3>
            {status === 'pending_manual_review' && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                UNDER REVIEW
              </span>
            )}
            {status === 'unverified' && (
              <span className="px-2 py-0.5 text-xs font-medium bg-complement-4/20 text-complement-4 rounded">
                RECOMMENDED
              </span>
            )}
            {status === 'verified' && (
              <span className="text-sm text-complement-3 font-medium">✓ Verified</span>
            )}
          </div>

          {status === 'unverified' && (
            <>
              <p className="text-muted-foreground mb-4">
                {emailVerified
                  ? 'Verify your identity to unlock important features and enhanced trust'
                  : 'Complete email verification first to enable identity verification'}
              </p>
              {emailVerified && (
                <>
                  <div className="space-y-2 mb-4">
                    {[
                      {
                        icon: FileText,
                        text: 'Allow Belrose to request medical records on your behalf',
                      },
                      { icon: Sparkles, text: 'Verified trust status' },
                      { icon: Users, text: 'Higher credibility when sharing with providers' },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center text-sm text-muted-foreground">
                        <Icon className="w-4 h-4 mr-2 text-complement-4" />
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>
                  <Button onClick={onStart} variant="default">
                    <IdCard className="w-4 h-4 mr-2" />
                    Start Identity Verification
                  </Button>
                </>
              )}
            </>
          )}

          {status === 'pending_manual_review' && (
            <div className="flex items-start space-x-3">
              <div>
                <p className="text-sm text-amber-800">
                  Your documents have been submitted and are being reviewed by our team. This
                  usually takes less than 24 hours.
                </p>
                <p className="text-xs text-amber-700 mt-2">
                  You'll receive an email once confirmed. You can continue using Belrose in the
                  meantime.
                </p>
              </div>
            </div>
          )}

          {status === 'verified' && verifiedData && (
            <div className="space-y-2 mt-2">
              <p className="text-muted-foreground">
                Identity verified as{' '}
                <span className="font-medium text-primary">
                  {verifiedData.firstName} {verifiedData.lastName}
                </span>
              </p>
              <div className="flex items-center text-sm text-complement-3">
                <Shield className="w-4 h-4 mr-1" />
                <span>Network status: Verified Member</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdentityVerificationCard;
