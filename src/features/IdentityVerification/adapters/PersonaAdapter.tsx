import React, { useEffect, useRef } from 'react';
import type { VerificationAdapterProps, VerificationResult } from '@/types/identity';

// Persona SDK types (you'd get these from @persona/client or define them)
interface PersonaClient {
  open: () => void;
  close: () => void;
}

interface PersonaConfig {
  templateId: string;
  environmentId: string;
  sessionToken: string;
  onLoad?: () => void;
  onComplete?: (event: { inquiryId: string; status: string }) => void;
  onCancel?: () => void;
  onError?: (error: Error) => void;
}

// Extend the Window interface to include Persona
declare global {
  interface Window {
    Persona?: {
      Client: new (config: PersonaConfig) => PersonaClient;
    };
  }
}

interface CreateSessionResponse {
  sessionToken: string;
  inquiryId: string;
}

const PersonaAdapter: React.FC<VerificationAdapterProps> = ({
  userId,
  onStatusChange,
  onSuccess,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<PersonaClient | null>(null);

  useEffect(() => {
    const initializeVerification = async (): Promise<void> => {
      try {
        onStatusChange('loading');

        // Call YOUR backend endpoint
        const response = await fetch('/api/identity/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const { sessionToken, inquiryId }: CreateSessionResponse = await response.json();

        // Check if Persona SDK is loaded
        if (!window.Persona) {
          throw new Error('Persona SDK not loaded. Add the script tag to your HTML.');
        }

        // Initialize Persona's UI
        const client = new window.Persona.Client({
          templateId: import.meta.env.VITE_PERSONA_TEMPLATE_ID || 'itmpl_XXXXXXXXXXXX',
          environmentId: import.meta.env.VITE_PERSONA_ENVIRONMENT_ID || 'env_XXXXXXXXXXXX',
          sessionToken,

          onLoad: () => {
            onStatusChange('verifying');
          },

          onComplete: ({ inquiryId, status }) => {
            onStatusChange('complete');
            handleVerificationComplete(inquiryId, status);
          },

          onCancel: () => {
            onStatusChange('idle');
          },

          onError: error => {
            console.error('Persona error:', error);
            onStatusChange('error');
            onError(error);
          },
        });

        clientRef.current = client;
        client.open();
      } catch (error) {
        console.error('Failed to initialize verification:', error);
        onStatusChange('error');
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    };

    const handleVerificationComplete = async (inquiryId: string, status: string): Promise<void> => {
      try {
        const response = await fetch('/api/identity/verification-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, inquiryId, status }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: VerificationResult = await response.json();

        if (result.verified) {
          onSuccess(result);
        } else {
          onError(new Error(result.reason || 'Verification failed'));
        }
      } catch (error) {
        console.error('Error processing verification:', error);
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    };

    initializeVerification();

    // Cleanup
    return () => {
      if (clientRef.current) {
        clientRef.current = null;
      }
    };
  }, [userId, onStatusChange, onSuccess, onError]);

  return (
    <div ref={containerRef} className="persona-container">
      <button
        onClick={() => clientRef.current?.open()}
        className="start-verification-btn"
        type="button"
      >
        Start Verification
      </button>
    </div>
  );
};

export default PersonaAdapter;
