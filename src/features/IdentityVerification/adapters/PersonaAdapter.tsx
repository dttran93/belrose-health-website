// src/features/IdentityVerification/adapters/PersonaAdapter.tsx

import React, { useEffect, useRef } from 'react';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { auth } from '@/firebase/config';
import type { VerificationAdapterProps, VerificationResult } from '@/types/identity';

// Persona SDK types
interface PersonaClient {
  open: () => void;
  close: () => void;
}

interface PersonaConfig {
  environmentId: string;
  inquiryId: string;
  onLoad?: () => void;
  onComplete?: (event: { inquiryId: string; status: string }) => void;
  onCancel?: () => void;
  onError?: (error: Error) => void;
}

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
  const functionsRef = useRef(getFunctions());

  // Connect to emulator in development - only run once
  useEffect(() => {
    if (import.meta.env.DEV) {
      try {
        connectFunctionsEmulator(functionsRef.current, '127.0.0.1', 5001);
        console.log('🔧 Connected to Firebase Functions Emulator');
      } catch (error) {
        // Emulator already connected, ignore
        console.log('Emulator already connected');
      }
    }
  }, []);

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return; //to prevent re-initialization

    const initializeVerification = async (): Promise<void> => {
      hasInitialized.current = true;
      try {
        onStatusChange('loading');

        // Check if user is authenticated
        const user = auth.currentUser;
        if (!user) {
          throw new Error('User must be authenticated to verify identity');
        }

        console.log('🔐 User authenticated, calling createVerificationSession...');

        const templateId = import.meta.env.VITE_PERSONA_TEMPLATE_ID;

        if (!templateId) {
          throw new Error('VITE_PERSONA_TEMPLATE_ID not configured in .env.local');
        }

        // Call Firebase Cloud Function
        const createSession = httpsCallable<{ templateId: string }, CreateSessionResponse>(
          functionsRef.current,
          'createVerificationSession'
        );

        console.log('📞 Calling Firebase function...');
        const result = await createSession({ templateId });
        const { sessionToken, inquiryId } = result.data;

        console.log('✅ Session created:', {
          inquiryId,
          hasToken: !!sessionToken,
          tokenLength: sessionToken?.length,
          templateIdUsed: templateId, // Make sure this matches what you expect
        });

        // Check if Persona SDK is loaded
        if (!window.Persona) {
          throw new Error(
            'Persona SDK not loaded. Add this to your index.html: ' +
              '<script src="https://cdn.withpersona.com/dist/persona-v4.5.0.js"></script>'
          );
        }

        // Initialize Persona's UI
        const client = new window.Persona.Client({
          environmentId: import.meta.env.VITE_PERSONA_ENVIRONMENT_ID || 'env_XXXXXXXXXXXX',
          inquiryId: sessionToken,

          onLoad: () => {
            console.log('📋 Persona verification UI loaded');
            onStatusChange('verifying');
          },

          onComplete: ({ inquiryId, status }) => {
            console.log('✅ Persona verification completed:', { inquiryId, status });
            onStatusChange('complete');
            handleVerificationComplete(inquiryId, status);
          },

          onCancel: () => {
            console.log('❌ User cancelled verification');
            onStatusChange('idle');
          },

          onError: error => {
            console.error('❌ Persona verification error:', error);
            onStatusChange('error');
            onError(error);
          },
        });

        clientRef.current = client;
        client.open();
      } catch (error: any) {
        console.error('Failed to initialize verification:', error);
        console.error('Error details:', error.message);
        onStatusChange('error');
        onError(error instanceof Error ? error : new Error('Unknown error'));
        hasInitialized.current = false;
      }
    };

    const handleVerificationComplete = async (inquiryId: string, status: string): Promise<void> => {
      try {
        console.log('🔍 Checking verification status with backend...');

        // Call Firebase Cloud Function to check status
        const checkStatus = httpsCallable<{ inquiryId: string }, VerificationResult>(
          functionsRef.current,
          'checkVerificationStatus'
        );

        const result = await checkStatus({ inquiryId });
        const verificationResult = result.data;

        if (verificationResult.verified) {
          console.log('✅ Identity verified successfully:', verificationResult.data);
          onSuccess(verificationResult);
        } else {
          console.error('❌ Verification failed:', verificationResult.reason);
          onError(new Error(verificationResult.reason || 'Verification failed'));
        }
      } catch (error: any) {
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
      hasInitialized.current = false;
    };
  }, [userId]);

  return (
    <div ref={containerRef} className="persona-container">
      {/* Persona will render its modal here */}
    </div>
  );
};

export default PersonaAdapter;
