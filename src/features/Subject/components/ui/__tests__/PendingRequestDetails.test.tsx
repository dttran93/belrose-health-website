// @vitest-environment jsdom
//
// src/features/Subject/components/ui/__tests__/PendingRequestDetails.test.tsx
//
// PendingRequestDetails' own logic: pending vs. rejected header/banner variants, the
// hasCreatorResponded gate on the Respond button, requester-profile fetching, and the
// window.confirm-gated cancel flow. RejectionResponseDialog (its child, tested on its own) is
// mocked here to isolate this component's own responsibilities.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PendingRequestDetails } from '../PendingRequestDetails';
import type { FileObject, BelroseUserProfile } from '@/types/core';
import type { SubjectConsentRequest } from '@belrose/shared';

const { profilesMock } = vi.hoisted(() => ({ profilesMock: vi.fn() }));

vi.mock('@/features/Users/services/userProfileService', () => ({
  getUserProfiles: profilesMock,
}));

vi.mock('../RejectionResponseDialog', () => ({
  RejectionResponseDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="rejection-response-dialog">rejection dialog open</div> : null,
}));

function makeRequest(overrides: Partial<SubjectConsentRequest> = {}): SubjectConsentRequest {
  return {
    recordId: 'rec1',
    subjectId: 'sub1',
    requestedBy: 'owner1',
    requestedSubjectRole: 'sharer',
    status: 'pending',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as unknown as SubjectConsentRequest;
}

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return { id: 'rec1', fileName: 'lab-results.pdf', ...overrides } as unknown as FileObject;
}

function renderDetails(overrides: Partial<React.ComponentProps<typeof PendingRequestDetails>> = {}) {
  const onBack = vi.fn();
  const onCancelRequest = vi.fn();
  const onSuccess = vi.fn();
  const defaults: React.ComponentProps<typeof PendingRequestDetails> = {
    request: makeRequest(),
    record: makeRecord(),
    subjectProfile: { uid: 'sub1', displayName: 'Alice' } as BelroseUserProfile,
    onBack,
    onCancelRequest,
    onSuccess,
  };
  render(<PendingRequestDetails {...defaults} {...overrides} />);
  return { onBack, onCancelRequest, onSuccess };
}

beforeEach(() => {
  vi.resetAllMocks();
  profilesMock.mockResolvedValue(new Map([['owner1', { uid: 'owner1', displayName: 'Owner Bob' }]]));
});

describe('PendingRequestDetails — pending state', () => {
  it('shows the pending header, awaiting-response banner, and a Cancel Request button', async () => {
    renderDetails();

    expect(screen.getByText('Pending Subject Request')).toBeInTheDocument();
    expect(screen.getByText('Awaiting Response')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Request' })).toBeInTheDocument();
    expect(screen.queryByText('Respond')).not.toBeInTheDocument();
  });

  it('shows the requester name once fetched, and the requested role', async () => {
    renderDetails();

    expect(await screen.findByText('Owner Bob')).toBeInTheDocument();
    expect(screen.getByText('Sharer')).toBeInTheDocument();
  });

  it('confirms via window.confirm before cancelling, and skips the call when declined', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onCancelRequest } = renderDetails();

    await user.click(screen.getByRole('button', { name: 'Cancel Request' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(onCancelRequest).not.toHaveBeenCalled();
  });

  it('cancels the request once window.confirm is accepted', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onCancelRequest } = renderDetails();

    await user.click(screen.getByRole('button', { name: 'Cancel Request' }));

    expect(onCancelRequest).toHaveBeenCalledTimes(1);
  });
});

describe('PendingRequestDetails — rejected state, not yet responded', () => {
  it('shows the declined header, a "you can drop or escalate" banner, and a Respond button', () => {
    renderDetails({
      isRejected: true,
      request: makeRequest({
        status: 'rejected',
        rejection: {
          rejectionType: 'request_rejected',
          reason: 'not me',
          creatorResponse: { status: 'pending_creator_decision' },
        } as any,
      }),
    });

    expect(screen.getByText('Declined Request')).toBeInTheDocument();
    expect(screen.getByText(/You can drop or escalate this request/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Respond' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Request' })).not.toBeInTheDocument();
    expect(screen.getByText('"not me"')).toBeInTheDocument();
  });

  it('opens the response dialog when Respond is clicked', async () => {
    const user = userEvent.setup();
    renderDetails({
      isRejected: true,
      request: makeRequest({
        status: 'rejected',
        rejection: { creatorResponse: { status: 'pending_creator_decision' } } as any,
      }),
    });

    expect(screen.queryByTestId('rejection-response-dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Respond' }));
    expect(screen.getByTestId('rejection-response-dialog')).toBeInTheDocument();
  });
});

describe('PendingRequestDetails — rejected state, already responded', () => {
  it('shows the response status and hides the Respond button', () => {
    renderDetails({
      isRejected: true,
      request: makeRequest({
        status: 'rejected',
        respondedAt: new Date('2026-01-02T00:00:00.000Z') as any,
        rejection: { creatorResponse: { status: 'dropped' } } as any,
      }),
    });

    expect(screen.getByText(/This request has been dropped/)).toBeInTheDocument();
    expect(screen.getByText('Response Status')).toBeInTheDocument();
    expect(screen.getByText('Dropped')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Respond' })).not.toBeInTheDocument();
  });
});

describe('PendingRequestDetails — navigation', () => {
  it('calls onBack when Back is clicked', async () => {
    const user = userEvent.setup();
    const { onBack } = renderDetails();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
