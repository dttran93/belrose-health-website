// src/components/site/Company/EmailCaptureModal.tsx

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { ExternalLink, Download } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Button } from '@/components/ui/Button';

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
  whitepaper: {
    label: 'whitepaper',
    viewUrl: 'https://drive.google.com/file/d/1Vmt2tDtHVwsHPOPwWW4_9SWrNEEMGUiJ/preview',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=1Vmt2tDtHVwsHPOPwWW4_9SWrNEEMGUiJ',
  },
  pitch: {
    label: 'pitch deck',
    viewUrl: 'https://drive.google.com/file/d/1xSqq_8DlN1QupzeHHCFe9xxHkg3KQFEb/preview',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=1xSqq_8DlN1QupzeHHCFe9xxHkg3KQFEb',
  },
};

const CONSENT_TEXT =
  'Sign up for our mailing list to keep up with product and company updates! Optional and you can unsubscribe at any time.';

// ============================================================================
// HELPERS
// ============================================================================

// Calls the addToMailingList Cloud Function — all validation, deduplication,
// waitlist checks, and email sending happen server-side.
async function captureEmailLead(
  email: string,
  resource: ResourceKey,
  action: ActionType
): Promise<void> {
  const addToMailingList = httpsCallable(getFunctions(), 'addToMailingList');

  // We don't need the returned status here — all outcomes (success,
  // waitlist, duplicate) are fine from the user's perspective.
  // Errors will throw and bubble up to handleSubmit's catch block.
  await addToMailingList({
    email,
    source: 'learnMoreHub',
    resourceAccessed: resource,
    consentText: CONSENT_TEXT,
  });
}

// ============================================================================
// FORM CONTENT
// ============================================================================

const FormContent: React.FC<{
  resource: ResourceKey;
  action: ActionType;
  onSubmit: (email: string) => Promise<void>;
  onSkip: () => void;
}> = ({ resource, action, onSubmit, onSkip }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const res = RESOURCES[resource];
  const actionLabel = action === 'download' ? 'download' : 'view';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    const isValid = trimmed.length > 0 && trimmed.includes('@');
    if (!isValid) {
      // No/invalid email — skip straight through without calling the function
      onSkip();
      return;
    }
    setLoading(true);
    await onSubmit(trimmed);
    // onSubmit calls proceed() which closes the dialog —
    // no need to setLoading(false)
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
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5"
        >
          {loading ? (
            'Sending...'
          ) : (
            <>
              {action === 'download' ? <Download size={13} /> : <ExternalLink size={13} />}
              Sign up &amp; {actionLabel}
            </>
          )}
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
  // decided: true when the user actively submitted or skipped (not just
  // dismissed by clicking the backdrop). LearnMoreHub uses this to set
  // hasDecided and bypass the modal on subsequent clicks.
  onClose: (decided: boolean) => void;
}

export const EmailCaptureDialog: React.FC<EmailCaptureDialogProps> = ({
  isOpen,
  resource,
  action,
  onClose,
}) => {
  const res = RESOURCES[resource];
  const targetUrl = action === 'download' ? res.downloadUrl : res.viewUrl;

  const proceed = (decided: boolean) => {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    onClose(decided);
  };

  const handleSubmit = async (email: string) => {
    try {
      await captureEmailLead(email, resource, action);
    } catch (err) {
      // Don't block the user from the file if the function fails —
      // log it and proceed anyway
      console.error('Failed to capture email lead:', err);
    }
    proceed(true);
  };

  return (
    <AlertDialog.Root
      open={isOpen}
      // Radix calls this with false when the user clicks the backdrop or
      // presses Escape — treat that as not decided so the modal shows again
      onOpenChange={open => !open && onClose(false)}
    >
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
            onSkip={() => proceed(true)}
          />
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export default EmailCaptureDialog;
