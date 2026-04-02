// src/features/GuestAccess/components/GuestFeatureGate.tsx

import React from 'react';
import { Lock } from 'lucide-react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { GuestClaimAccountModal } from '@/features/GuestAccess/components/GuestClaimAccountModal';
import { useState } from 'react';

interface GuestFeatureGateProps {
  children: React.ReactNode;
  featureName: string; // e.g. "adding records"
  featureDescription?: string; // optional explanation
}

export const GuestFeatureGate: React.FC<GuestFeatureGateProps> = ({
  children,
  featureName,
  featureDescription,
}) => {
  const { user } = useAuthContext();
  const [isClaimOpen, setIsClaimOpen] = useState(false);

  if (!user?.isGuest) return <>{children}</>;

  return (
    <>
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">
          Create an account to {featureName}
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mb-6">
          {featureDescription ||
            'This feature is available to registered Belrose users. Creating an account is free and takes 2 minutes.'}
        </p>
        <button
          onClick={() => setIsClaimOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white font-semibold 
                     px-6 py-2.5 rounded-lg transition-colors text-sm"
        >
          Create Free Account →
        </button>
      </div>

      <GuestClaimAccountModal isOpen={isClaimOpen} onClose={() => setIsClaimOpen(false)} />
    </>
  );
};
