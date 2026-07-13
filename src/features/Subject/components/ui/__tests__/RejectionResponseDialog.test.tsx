// @vitest-environment jsdom
//
// src/features/Subject/components/ui/__tests__/RejectionResponseDialog.test.tsx
//
// Modal for a creator to Drop or Escalate a declined subject request. SubjectRejectionService is
// mocked (it has its own orchestration suite); this test is about the dialog's own state: the
// two response options, Confirm staying disabled until one is picked, success wiring, and the
// error path (which currently surfaces via window.alert — see the failing-path test below).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RejectionResponseDialog } from '../RejectionResponseDialog';
import type { FileObject, BelroseUserProfile } from '@/types/core';
import type { SubjectConsentRequest } from '@belrose/shared';

vi.mock('../../../services/subjectRejectionService', () => ({
  SubjectRejectionService: { respondToRejection: vi.fn() },
}));

import { SubjectRejectionService } from '../../../services/subjectRejectionService';

function makeRequest(overrides: Partial<SubjectConsentRequest> = {}): SubjectConsentRequest {
  return {
    recordId: 'rec1',
    subjectId: 'sub1',
    requestedBy: 'owner1',
    requestedSubjectRole: 'sharer',
    status: 'rejected',
    ...overrides,
  } as unknown as SubjectConsentRequest;
}

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return { id: 'rec1', fileName: 'lab-results.pdf', ...overrides } as unknown as FileObject;
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof RejectionResponseDialog>> = {}) {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const defaults: React.ComponentProps<typeof RejectionResponseDialog> = {
    isOpen: true,
    onClose,
    request: makeRequest(),
    record: makeRecord(),
    subjectProfile: { uid: 'sub1', displayName: 'Alice' } as BelroseUserProfile,
    onSuccess,
  };
  render(<RejectionResponseDialog {...defaults} {...overrides} />);
  return { onClose, onSuccess };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('RejectionResponseDialog', () => {
  it('renders nothing when isOpen is false', () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByText('Respond to Declined Request')).not.toBeInTheDocument();
  });

  it('shows the record title and rejection reason when present', () => {
    renderDialog({ request: makeRequest({ rejection: { reason: 'not me' } as any }) });

    expect(screen.getByText('lab-results.pdf')).toBeInTheDocument();
    expect(screen.getByText('"not me"')).toBeInTheDocument();
  });

  it('disables Confirm until a response option is selected', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByRole('button', { name: /Confirm/ })).toBeDisabled();

    await user.click(screen.getByText('Drop Request'));
    expect(screen.getByRole('button', { name: /Confirm/ })).not.toBeDisabled();
  });

  it('confirms with "escalated" and calls onSuccess + onClose on success', async () => {
    vi.mocked(SubjectRejectionService.respondToRejection).mockResolvedValue({
      success: true,
      recordId: 'rec1',
      subjectId: 'sub1',
      response: 'escalated',
    });
    const user = userEvent.setup();
    const { onClose, onSuccess } = renderDialog();

    await user.click(screen.getByText('Escalate'));
    await user.click(screen.getByRole('button', { name: /Confirm/ }));

    expect(SubjectRejectionService.respondToRejection).toHaveBeenCalledWith(
      'rec1',
      'sub1',
      'escalated'
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('alerts on failure and does not call onSuccess/onClose', async () => {
    vi.mocked(SubjectRejectionService.respondToRejection).mockRejectedValue(
      new Error('network error')
    );
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    const { onClose, onSuccess } = renderDialog();

    await user.click(screen.getByText('Drop Request'));
    await user.click(screen.getByRole('button', { name: /Confirm/ }));

    expect(alertSpy).toHaveBeenCalledWith('network error');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('resets the selected response and closes when the X button is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(screen.getByText('Drop Request'));
    const closeButtons = screen.getAllByRole('button').filter(b => !b.textContent);
    await user.click(closeButtons[0]!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
