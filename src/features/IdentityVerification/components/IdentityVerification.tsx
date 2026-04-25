import React, { useState } from 'react';
import type {
  VerificationProvider,
  VerificationStatus,
  VerificationResult,
  VerificationAdapter,
} from '@/features/IdentityVerification/identity.types';
import IDswyftAdapter from '../adapters/IDswyftAdapter';

interface IdentityVerificationProps {
  userId: string;
  onSuccess: (result: VerificationResult) => void;
  onError: (error: Error) => void;
  provider?: VerificationProvider; // Optional, defaults to 'idswyft'
  onBack?: () => void;
}

const IdentityVerification: React.FC<IdentityVerificationProps> = ({
  userId,
  onSuccess,
  onError,
  provider = 'idswyft',
  onBack,
}) => {
  const [status, setStatus] = useState<VerificationStatus>('idle');

  // Type-safe adapter selection
  const getAdapter = (): VerificationAdapter => {
    switch (provider) {
      case 'idswyft':
        return IDswyftAdapter;
      // case 'onfido': <-- use for other identification groups in the future
      //   return OnfidoAdapter;
      default:
        // TypeScript ensures we handle all cases
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
