import React, { useState } from 'react';
import { cn } from '@/utils/utils';
import { Button } from '@/components/ui/Button';
import { CheckCircle, AlertTriangle, ChevronRight, HelpCircle } from 'lucide-react';
import VerificationForm, {
  ExistingVerification,
  VerificationData,
  VerificationLevel,
} from './ui/VerificationForm';
import DisputeForm, {
  DisputeCulpability,
  DisputeData,
  DisputeSeverity,
  ExistingDispute,
} from './ui/DisputeForm';
import * as Tooltip from '@radix-ui/react-tooltip';

export interface RecordReviewPanelProps {
  recordId: string;
  recordHash: string;
  recordTitle?: string;
  onSubmitVerification?: (data: VerificationData) => Promise<void>;
  onSubmitDispute?: (data: DisputeData) => Promise<void>;
  onViewRecord?: () => void;
  existingVerification?: ExistingVerification | null;
  existingDispute?: ExistingDispute | null;
  className?: string;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const RecordReviewPanel: React.FC<RecordReviewPanelProps> = ({
  recordId,
  recordHash,
  onSubmitVerification,
  onSubmitDispute,
  onViewRecord,
  existingVerification = null,
  existingDispute = null,
}) => {
  const [activeTab, setActiveTab] = useState<'verify' | 'dispute'>('verify');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Verification state
  const [verificationLevel, setVerificationLevel] = useState<VerificationLevel | null>(null);

  // Dispute state
  const [severity, setSeverity] = useState<DisputeSeverity | null>(null);
  const [culpability, setCulpability] = useState<DisputeCulpability | null>(null);
  const [disputeNotes, setDisputeNotes] = useState('');

  const handleSubmitVerification = async () => {
    if (!verificationLevel) return;

    setIsSubmitting(true);
    try {
      await onSubmitVerification?.({
        recordId,
        recordHash,
        level: verificationLevel,
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setVerificationLevel(null);
      }, 2000);
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDispute = async () => {
    if (!severity || !culpability) return;

    setIsSubmitting(true);
    try {
      await onSubmitDispute?.({
        recordId,
        recordHash,
        severity,
        culpability,
        notes: disputeNotes,
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSeverity(null);
        setCulpability(null);
        setDisputeNotes('');
      }, 2000);
    } catch (error) {
      console.error('Dispute failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmitVerification = verificationLevel !== null;
  const canSubmitDispute = severity !== null && culpability !== null;

  return (
    <div>
      {/* Hash Badge */}
      <div className="mx-5 my-4 px-4 py-3 bg-muted rounded-xl flex items-center justify-center gap-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Record Hash
        </span>
        <button onClick={onViewRecord} className="hover:underline cursor-pointer">
          <code className="text-xs font-mono text-foreground px-2">{recordHash}</code>
        </button>
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <HelpCircle className="w-4 h-4 text-blue-700 cursor-help" />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="bg-gray-900 text-white rounded-lg p-4 max-w-sm shadow-xl z-50"
                sideOffset={5}
              >
                <p className="font-semibold mb-2 text-sm">
                  The record hash is the digital fingerprint of the current version of the record:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Your verification or dispute is tied to this hash specifically.</li>
                  <li>
                    If this record is changed, your review will not transfer to the new record. You
                    will have to write another review if desired.
                  </li>
                  <li>You may remove or edit your review at any time.</li>
                </ol>
                <Tooltip.Arrow className="fill-gray-900" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 px-5 mb-2">
        <button
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold rounded-xl transition-all',
            activeTab === 'verify'
              ? 'bg-chart-3 text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
          onClick={() => setActiveTab('verify')}
        >
          <CheckCircle className="w-4 h-4" />
          Verify
        </button>
        <button
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold rounded-xl transition-all',
            activeTab === 'dispute'
              ? 'bg-red-700 text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
          onClick={() => setActiveTab('dispute')}
        >
          <AlertTriangle className="w-4 h-4" />
          Dispute
        </button>
      </div>

      {/* Content */}
      <div className="p-5 min-h-[360px]">
        {activeTab === 'verify' ? (
          <VerificationForm
            selectedLevel={verificationLevel}
            onSelectLevel={setVerificationLevel}
            existingVerification={existingVerification}
          />
        ) : (
          <DisputeForm
            severity={severity}
            culpability={culpability}
            notes={disputeNotes}
            onSelectSeverity={setSeverity}
            onSelectCulpability={setCulpability}
            onNotesChange={setDisputeNotes}
            existingDispute={existingDispute}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 pt-4 border-t border-border">
        {showSuccess ? (
          <div className="flex items-center justify-center gap-3 py-3 bg-chart-3/10 text-chart-3 rounded-xl">
            <div className="w-6 h-6 bg-chart-3 text-white rounded-full flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
            <span className="font-semibold">
              {activeTab === 'verify' ? 'Verification submitted!' : 'Dispute submitted!'}
            </span>
          </div>
        ) : (
          <Button
            className={cn(
              'w-full py-3 text-sm font-semibold',
              activeTab === 'verify'
                ? 'bg-chart-3 hover:bg-chart-3/90'
                : 'bg-red-600 hover:bg-red-700'
            )}
            disabled={activeTab === 'verify' ? !canSubmitVerification : !canSubmitDispute}
            loading={isSubmitting}
            onClick={activeTab === 'verify' ? handleSubmitVerification : handleSubmitDispute}
          >
            {activeTab === 'verify' ? 'Submit Verification' : 'Submit Dispute'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
        <p className="mt-3 text-xs text-muted-foreground text-center">
          Your review will be recorded on the blockchain and cannot be deleted. You can retract or
          modify it later.
        </p>
      </div>
    </div>
  );
};

export default RecordReviewPanel;
