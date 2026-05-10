// src/features/IdentityVerification/components/IdentityVerificationCard.tsx

import React from 'react';
import { IdCard, CheckCircle2, Users, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { VerifiedData } from '../identity.types';

type IdentityStatus = 'unverified' | 'verified';

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
      : emailVerified
        ? 'border-gray-200 hover:border-complement-4'
        : 'border-gray-200 opacity-60'
  }`;

  const iconClass = `flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
    status === 'verified' ? 'bg-complement-3' : emailVerified ? 'bg-complement-4' : 'bg-gray-300'
  }`;

  return (
    <div className={cardClass}>
      <div className="flex items-start space-x-4">
        <div className={iconClass}>
          {status === 'verified' ? (
            <CheckCircle2 className="w-6 h-6 text-white" />
          ) : (
            <IdCard className="w-6 h-6 text-white" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-semibold text-primary">Identity Verification</h3>
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

          {status === 'verified' && verifiedData && (
            <div className="space-y-2 mt-2">
              <p className="text-muted-foreground">
                Identity verified as{' '}
                <span className="font-medium text-primary">
                  {verifiedData.firstName} {verifiedData.lastName}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdentityVerificationCard;
