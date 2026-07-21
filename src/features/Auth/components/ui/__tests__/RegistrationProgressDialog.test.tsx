// @vitest-environment jsdom
//
// src/features/Auth/components/ui/__tests__/RegistrationProgressDialog.test.tsx
//
// RegistrationProgressDialog is the blocking modal RegistrationForm shows while wallet
// generation/on-chain registration/Firestore completion run. getStepStatus (the phase-state-
// machine mapping driving each ProgressStep's pending/active/complete look) isn't exported, so
// these tests drive it indirectly by rendering with different `progress.step` values and
// reading back each step label's status class — pinning the exact state machine, including the
// slightly odd case where the final "Finalizing account setup" step stays 'active' (never
// visually flips to 'complete') for both the 'firestore_update' and 'complete' step values,
// since 'complete' is included in its own stepNames set.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegistrationProgressDialog } from '../RegistrationProgressDialog';
import type { RegistrationProgress } from '../RegistrationProgressDialog';

const EOA_LABEL = 'Registering Belrose account on distributed network';
const SMART_ACCOUNT_LABEL = 'Registering smart account for network automation';
const FINALIZE_LABEL = 'Finalizing account setup';

function stepClass(label: string): string {
  return screen.getByText(label).className;
}

function renderRegistering(progress?: RegistrationProgress | null) {
  return render(
    <RegistrationProgressDialog
      isOpen
      phase="registering"
      progress={progress}
      onClose={() => {}}
    />
  );
}

describe('RegistrationProgressDialog — isOpen gating', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <RegistrationProgressDialog isOpen={false} phase="registering" onClose={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('RegistrationProgressDialog — registering phase step statuses', () => {
  it('marks all steps pending when there is no progress yet', () => {
    renderRegistering(null);
    expect(stepClass(EOA_LABEL)).toContain('text-gray-400');
    expect(stepClass(SMART_ACCOUNT_LABEL)).toContain('text-gray-400');
    expect(stepClass(FINALIZE_LABEL)).toContain('text-gray-400');
  });

  it('marks step 1 active and the rest pending at eoa_registration', () => {
    renderRegistering({ step: 'eoa_registration', message: 'Registering EOA...' });
    expect(stepClass(EOA_LABEL)).toContain('text-primary');
    expect(stepClass(SMART_ACCOUNT_LABEL)).toContain('text-gray-400');
    expect(stepClass(FINALIZE_LABEL)).toContain('text-gray-400');
    expect(screen.getByText('Registering EOA...')).toBeInTheDocument();
  });

  it('marks step 1 complete and step 2 active at smart_account_registration', () => {
    renderRegistering({ step: 'smart_account_registration', message: 'Registering smart account...' });
    expect(stepClass(EOA_LABEL)).toContain('text-complement-3');
    expect(stepClass(SMART_ACCOUNT_LABEL)).toContain('text-primary');
    expect(stepClass(FINALIZE_LABEL)).toContain('text-gray-400');
  });

  it('marks steps 1-2 complete and step 3 active at firestore_update', () => {
    renderRegistering({ step: 'firestore_update', message: 'Finalizing...' });
    expect(stepClass(EOA_LABEL)).toContain('text-complement-3');
    expect(stepClass(SMART_ACCOUNT_LABEL)).toContain('text-complement-3');
    expect(stepClass(FINALIZE_LABEL)).toContain('text-primary');
  });

  it('keeps step 3 active (not complete) even at the terminal "complete" step', () => {
    renderRegistering({ step: 'complete', message: 'Done' });
    expect(stepClass(EOA_LABEL)).toContain('text-complement-3');
    expect(stepClass(SMART_ACCOUNT_LABEL)).toContain('text-complement-3');
    expect(stepClass(FINALIZE_LABEL)).toContain('text-primary');
  });

  it('falls back to the default message when progress is not provided', () => {
    renderRegistering(null);
    expect(screen.getByText('Setting up your anonymous network identity...')).toBeInTheDocument();
  });
});

describe('RegistrationProgressDialog — success phase', () => {
  it('shows the success message and calls onClose when continuing', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RegistrationProgressDialog isOpen phase="success" onClose={onClose} />);

    expect(screen.getByText('Account Created Successfully!')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue to Verification' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('RegistrationProgressDialog — error phase', () => {
  it('shows the given error message', () => {
    render(
      <RegistrationProgressDialog isOpen phase="error" error="Wallet registration failed" onClose={() => {}} />
    );
    expect(screen.getByText('Wallet registration failed')).toBeInTheDocument();
  });

  it('falls back to a generic message when no error is given', () => {
    render(<RegistrationProgressDialog isOpen phase="error" onClose={() => {}} />);
    expect(screen.getByText('An unexpected error occurred during registration.')).toBeInTheDocument();
  });

  it('calls onClose from Cancel and onRetry from Try Again when provided', async () => {
    const onClose = vi.fn();
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <RegistrationProgressDialog isOpen phase="error" onClose={onClose} onRetry={onRetry} />
    );

    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('omits the Try Again button when onRetry is not provided', () => {
    render(<RegistrationProgressDialog isOpen phase="error" onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument();
  });
});
