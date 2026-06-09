// src/components/site/Company/EmailCaptureDialog.tsx

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Send, Check, ExternalLink, Download } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';

// ============================================================================
// TYPES
// ============================================================================

export type ResourceKey = 'whitepaper' | 'pitch';
export type ActionType = 'download' | 'view';

export interface ResourceConfig {
  label: string;
  viewUrl: string;
  downloadUrl: string;
}

export const RESOURCES: Record<ResourceKey, ResourceConfig> = {
  pitch: {
    label: 'pitch deck',
    viewUrl: 'https://drive.google.com/file/d/1xSqq_8DlN1QupzeHHCFe9xxHkg3KQFEb/preview',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=1xSqq_8DlN1QupzeHHCFe9xxHkg3KQFEb',
  },
  whitepaper: {
    label: 'whitepaper',
    viewUrl: 'https://drive.google.com/file/d/1Vmt2tDtHVwsHPOPwWW4_9SWrNEEMGUiJ/preview',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=1Vmt2tDtHVwsHPOPwWW4_9SWrNEEMGUiJ',
  },
};

const CONSENT_TEXT =
  'Sign up for our mailing list to keep up with product and company updates! Optional and you can unsubscribe at any time.';

// ============================================================================
// HELPERS
// ============================================================================

// Writes to mailingList collection only if:
//   1. The user gave consent
//   2. They are not already in the waitlist collection
// The onDocumentCreated trigger in sendMailingListConfirmationEmail.ts
// picks this up and sends the confirmation email automatically.
async function captureEmailLead(
  email: string,
  resource: ResourceKey,
  action: ActionType
): Promise<void> {
  const normalised = email.trim().toLowerCase();
  const db = getFirestore();

  await setDoc(doc(db, 'mailingList', normalised), {
    email: normalised,
    consentText: CONSENT_TEXT,
    consentTimestamp: serverTimestamp(),
    source: 'learnMoreHub',
    resourceAccessed: resource,
    status: 'active',
  });
}

// ============================================================================
// PHASE CONTENT COMPONENTS
// ============================================================================

// ─── Form phase ───────────────────────────────────────────────────────────────

const FormContent: React.FC<{
  resource: ResourceKey;
  action: ActionType;
  onSubmit: (email: string) => void;
  onSkip: () => void;
}> = ({ resource, action, onSubmit, onSkip }) => {
  const [email, setEmail] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const res = RESOURCES[resource];
  const actionLabel = action === 'download' ? 'download' : 'view';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = email.trim();
    const isValid = trimmed.length > 0 && trimmed.includes('@');
    // Valid email → capture then proceed; invalid/empty → skip straight through
    isValid ? onSubmit(trimmed) : onSkip();
  };

  return (
    <>
      <AlertDialog.Title className="text-[15px] font-bold text-gray-900">
        Interested in What We're Building?
      </AlertDialog.Title>

      <AlertDialog.Description className="mt-2 text-[13px] text-gray-500 leading-relaxed">
        {CONSENT_TEXT}
      </AlertDialog.Description>

      <div className="my-4 flex flex-col gap-1.5">
        <label
          htmlFor="capture-email"
          className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400"
        >
          Email address (optional)
        </label>
        <input
          ref={inputRef}
          id="capture-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="bg-background w-full text-[13px] px-3 py-2 rounded-lg border border-gray-200
            focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400
            placeholder:text-gray-300 text-gray-800 transition-all"
        />
      </div>

      <div className="flex gap-3">
        <AlertDialog.Cancel asChild>
          <Button variant="outline" className="flex-1" onClick={onSkip}>
            Skip
          </Button>
        </AlertDialog.Cancel>
        <Button onClick={handleSubmit} className="flex-1 flex items-center justify-center gap-1.5">
          <Send size={13} />
          Sign-up and {actionLabel}
        </Button>
      </div>
    </>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface EmailCaptureDialogProps {
  isOpen: boolean;
  resource: ResourceKey;
  action: ActionType;
  onClose: () => void;
}

export const EmailCaptureDialog: React.FC<EmailCaptureDialogProps> = ({
  isOpen,
  resource,
  action,
  onClose,
}) => {
  const res = RESOURCES[resource];
  const targetUrl = action === 'download' ? res.downloadUrl : res.viewUrl;

  const proceed = () => {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleSubmit = async (email: string) => {
    await captureEmailLead(email, resource, action);
    proceed();
  };

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
        <AlertDialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            bg-white rounded-2xl p-6 shadow-2xl z-[101] w-full max-w-sm"
        >
          <FormContent
            resource={resource}
            action={action}
            onSubmit={handleSubmit}
            onSkip={proceed}
          />
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export default EmailCaptureDialog;
