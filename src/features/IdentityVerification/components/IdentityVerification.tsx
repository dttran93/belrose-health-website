import React, { useState } from 'react';
import type {
  VerificationProvider,
  VerificationStatus,
  VerificationResult,
  VerificationAdapter,
} from '@/features/IdentityVerification/identity.types';
import IDswyftAdapter from '../adapters/IDswyftAdapter';
import StripeIdentityAdapter from '../adapters/StripeIdentityAdapter';

interface IdentityVerificationProps {
  userId: string;
  onSuccess: (result: VerificationResult) => void;
  onError: (error: Error) => void;
  provider?: VerificationProvider;
  onBack?: () => void;
}

const IdentityVerification: React.FC<IdentityVerificationProps> = ({
  userId,
  onSuccess,
  onError,
  provider = 'stripe',
  onBack,
}) => {
  const [status, setStatus] = useState<VerificationStatus>('idle');

  const getAdapter = (): VerificationAdapter => {
    switch (provider) {
      case 'stripe':
        return StripeIdentityAdapter;
      case 'idswyft':
        return IDswyftAdapter;
      default:
        const exhaustiveCheck: never = provider;
        throw new Error(`Unknown verification provider: ${exhaustiveCheck}`);
    }
  };

  const Adapter = getAdapter();

  return (
    <Adapter
      userId={userId}
      onStatusChange={setStatus}
      onSuccess={onSuccess}
      onError={onError}
      onBack={onBack}
    />
  );
};

export default IdentityVerification;
