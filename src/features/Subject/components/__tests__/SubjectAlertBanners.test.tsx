// @vitest-environment jsdom
//
// src/features/Subject/components/__tests__/SubjectAlertBanners.test.tsx
//
// Four small presentational wrappers around AlertBanner. Nothing to mock — purely props to
// rendered text/buttons.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  PendingSubjectRequestAlert,
  RejectionResponseAlert,
  RemovalRequestAlert,
  VerifiedNoSubjectAlert,
} from '../SubjectAlertBanners';

describe('PendingSubjectRequestAlert', () => {
  it('calls onAccept and onDecline from their respective buttons', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(<PendingSubjectRequestAlert onAccept={onAccept} onDecline={onDecline} />);

    await user.click(screen.getByRole('button', { name: 'Accept & Link' }));
    expect(onAccept).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Decline' }));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while loading', () => {
    render(
      <PendingSubjectRequestAlert onAccept={vi.fn()} onDecline={vi.fn()} isLoading />
    );

    expect(screen.getByRole('button', { name: 'Accept & Link' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeDisabled();
  });
});

describe('RejectionResponseAlert', () => {
  it('defaults the description to "A subject" when no name is given', () => {
    render(<RejectionResponseAlert onDrop={vi.fn()} onEscalate={vi.fn()} />);
    expect(screen.getByText(/^A subject has removed themselves/)).toBeInTheDocument();
  });

  it('uses the provided subject name in the description', () => {
    render(<RejectionResponseAlert subjectName="Alice" onDrop={vi.fn()} onEscalate={vi.fn()} />);
    expect(screen.getByText(/^Alice has removed themselves/)).toBeInTheDocument();
  });

  it('calls onDrop and onEscalate from their respective buttons', async () => {
    const user = userEvent.setup();
    const onDrop = vi.fn();
    const onEscalate = vi.fn();
    render(<RejectionResponseAlert onDrop={onDrop} onEscalate={onEscalate} />);

    await user.click(screen.getByRole('button', { name: 'Drop It' }));
    expect(onDrop).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Escalate' }));
    expect(onEscalate).toHaveBeenCalledTimes(1);
  });
});

describe('RemovalRequestAlert', () => {
  it('calls onDispute and onRemove from their respective buttons', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onDispute = vi.fn();
    render(<RemovalRequestAlert onRemove={onRemove} onDispute={onDispute} />);

    await user.click(screen.getByRole('button', { name: 'Dispute' }));
    expect(onDispute).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Remove Myself' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while loading', () => {
    render(<RemovalRequestAlert onRemove={vi.fn()} onDispute={vi.fn()} isLoading />);
    expect(screen.getByRole('button', { name: 'Dispute' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove Myself' })).toBeDisabled();
  });
});

describe('VerifiedNoSubjectAlert', () => {
  it('calls onSetSubject when clicked', async () => {
    const user = userEvent.setup();
    const onSetSubject = vi.fn();
    render(<VerifiedNoSubjectAlert onSetSubject={onSetSubject} />);

    await user.click(screen.getByRole('button', { name: 'Set Subject' }));
    expect(onSetSubject).toHaveBeenCalledTimes(1);
  });

  it('disables the button while loading', () => {
    render(<VerifiedNoSubjectAlert onSetSubject={vi.fn()} isLoading />);
    expect(screen.getByRole('button', { name: 'Set Subject' })).toBeDisabled();
  });
});
