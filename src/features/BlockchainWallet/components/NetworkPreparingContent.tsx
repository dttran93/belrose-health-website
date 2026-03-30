// src/features/BlockchainWallet/components/ui/NetworkPreparingContent.tsx

/**
 * NetworkPreparingContent
 *
 * Shared "preparing" phase UI for all blockchain action dialogs.
 * Renders an animated step-by-step progress list while the app
 * sets up the user's distributed network account and record.
 *
 * Each feature passes only the steps it actually uses via the
 * `steps` prop — unused steps are never rendered.
 *
 * Canonical step order (subset used per feature):
 *   computing          → Permissions, Subject, Credibility
 *   saving             → Permissions, Subject, Credibility
 *   registering        → Permissions, Subject, Credibility
 *   initializing_record→ Permissions, Subject, Credibility
 *   ensuring_hash      → Credibility only
 *
 * Usage:
 *   // Permissions / Subject (4 steps)
 *   <NetworkPreparingContent
 *     progress={preparationProgress}
 *     steps={['computing', 'saving', 'registering', 'initializing_record']}
 *   />
 *
 *   // Credibility (5 steps)
 *   <NetworkPreparingContent
 *     progress={preparationProgress}
 *     steps={['computing', 'saving', 'registering', 'initializing_record', 'ensuring_hash']}
 *   />
 */

import { Loader2, CheckCircle2 } from 'lucide-react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

// ============================================================================
// STEP REGISTRY
// All known steps in canonical execution order.
// ============================================================================

/**
 * Every step that any feature might emit, in the order they execute.
 * This order is what drives the "complete / active / pending" logic.
 */
const STEP_ORDER = [
  'computing',
  'saving',
  'registering',
  'initializing_record',
  'ensuring_hash',
  'complete',
] as const;

export type NetworkStep = (typeof STEP_ORDER)[number];

/**
 * Human-readable labels shown next to each step indicator.
 * Uses "distributed network" language — no blockchain jargon.
 */
const STEP_LABELS: Record<NetworkStep, string> = {
  computing: 'Setting up your network identity',
  saving: 'Saving your network profile',
  registering: 'Connecting to the distributed network',
  initializing_record: 'Preparing record on the network',
  ensuring_hash: 'Verifying record fingerprint',
  complete: 'Complete', // never rendered as a step row
};

// ============================================================================
// TYPES
// ============================================================================

export interface NetworkProgress {
  step: string; // loosely typed so all three progress types are compatible
  message: string;
}

interface NetworkPreparingContentProps {
  /** Live progress from the preparation service */
  progress?: NetworkProgress | null;
  /**
   * Which steps this feature uses, in the order they should appear.
   * Only these steps are rendered. 'complete' is always excluded from rendering.
   */
  steps: Exclude<NetworkStep, 'complete'>[];
  /** Optional override for the dialog title */
  title?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function getStepStatus(
  currentStep: string | undefined,
  stepName: NetworkStep
): 'pending' | 'active' | 'complete' {
  if (!currentStep) return 'pending';

  const currentIndex = STEP_ORDER.indexOf(currentStep as NetworkStep);
  const stepIndex = STEP_ORDER.indexOf(stepName);

  if (currentIndex === -1) return 'pending'; // unrecognised step → safe fallback

  if (currentStep === stepName) return 'active';
  if (currentIndex > stepIndex) return 'complete';
  return 'pending';
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const StepRow: React.FC<{ label: string; status: 'pending' | 'active' | 'complete' }> = ({
  label,
  status,
}) => (
  <div className="flex items-center gap-3">
    {status === 'complete' && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
    {status === 'active' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />}
    {status === 'pending' && (
      <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
    )}
    <span
      className={`text-sm ${
        status === 'complete'
          ? 'text-green-600'
          : status === 'active'
            ? 'text-blue-600 font-medium'
            : 'text-gray-400'
      }`}
    >
      {label}
    </span>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const NetworkPreparingContent: React.FC<NetworkPreparingContentProps> = ({
  progress,
  steps,
  title = 'Connecting to the Network',
}) => (
  <div className="flex flex-col items-center gap-4 py-6 px-2">
    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />

    <AlertDialog.Title className="text-lg font-bold text-center">{title}</AlertDialog.Title>

    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      {progress?.message || 'Setting up your network account...'}
    </AlertDialog.Description>

    <div className="w-full mt-2 space-y-3">
      {steps.map(step => (
        <StepRow
          key={step}
          label={STEP_LABELS[step]}
          status={getStepStatus(progress?.step, step)}
        />
      ))}
    </div>
  </div>
);

export default NetworkPreparingContent;
