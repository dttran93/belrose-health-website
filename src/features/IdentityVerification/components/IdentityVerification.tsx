import React, { useState } from 'react';
import PersonaAdapter from '../adapters/PersonaAdapter';
import type {
  VerificationProvider,
  VerificationStatus,
  VerificationResult,
  VerificationAdapter,
} from '@/types/identity.ts';

interface IdentityVerificationProps {
  userId: string;
  onSuccess: (result: VerificationResult) => void;
  onError: (error: Error) => void;
  provider?: VerificationProvider; // Optional, defaults to 'persona'
}

const IdentityVerification: React.FC<IdentityVerificationProps> = ({
  userId,
  onSuccess,
  onError,
  provider = 'persona',
}) => {
  const [status, setStatus] = useState<VerificationStatus>('idle');

  // Type-safe adapter selection
  const getAdapter = (): VerificationAdapter => {
    switch (provider) {
      case 'persona':
        return PersonaAdapter;
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
    <div className="identity-verification-container">
      <h2>Verify Your Identity</h2>
      <p>We need to verify your identity to comply with healthcare regulations.</p>

      {status === 'error' && (
        <div className="error-message">
          Verification failed. Please try again or contact support.
        </div>
      )}

      <Adapter userId={userId} onStatusChange={setStatus} onSuccess={onSuccess} onError={onError} />
    </div>
  );
};

export default IdentityVerification;
