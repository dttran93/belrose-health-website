// @vitest-environment jsdom
//
// src/features/RecordFollowUp/components/__tests__/RecordFollowUpsView.test.tsx
//
// Tier 4 — mocks useRecordFollowUps (its own logic is covered by useRecordFollowUps.test.ts) and
// renders the real component. Covers the loading/all-done/has-items states and the back button.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { User } from 'lucide-react';

const { useRecordFollowUpsMock } = vi.hoisted(() => ({ useRecordFollowUpsMock: vi.fn() }));

vi.mock('../../hooks/useRecordFollowUps', () => ({ default: useRecordFollowUpsMock }));

import RecordFollowUpsView from '../RecordFollowUpsView';
import type { FileObject } from '@/types/core';

function makeFile(overrides: Partial<FileObject> = {}): FileObject {
  return { id: 'record-1', fileSize: 100, fileType: 'application/pdf', administrators: [], status: 'completed', ...overrides } as FileObject;
}

describe('RecordFollowUpsView — loading', () => {
  it('shows a checking-status message while loading', () => {
    useRecordFollowUpsMock.mockReturnValue({ followUpItems: [], isLoading: true });
    render(<RecordFollowUpsView record={makeFile()} onBack={vi.fn()} onAction={vi.fn()} />);
    expect(screen.getByText('Checking record status...')).toBeInTheDocument();
  });
});

describe('RecordFollowUpsView — all done', () => {
  it('shows the "Record is complete" state when there are no follow-up items', () => {
    useRecordFollowUpsMock.mockReturnValue({ followUpItems: [], isLoading: false });
    render(<RecordFollowUpsView record={makeFile()} onBack={vi.fn()} onAction={vi.fn()} />);
    expect(screen.getByText('Record is complete')).toBeInTheDocument();
  });
});

describe('RecordFollowUpsView — outstanding items', () => {
  it('renders the follow-up items list when there are outstanding items', () => {
    useRecordFollowUpsMock.mockReturnValue({
      followUpItems: [
        {
          id: 'subject',
          label: 'Tag a subject',
          icon: User,
          status: 'pending',
          ctaLabel: 'Send request',
          onAction: vi.fn(),
        },
      ],
      isLoading: false,
    });
    render(<RecordFollowUpsView record={makeFile()} onBack={vi.fn()} onAction={vi.fn()} />);
    expect(screen.getByText('Tag a subject')).toBeInTheDocument();
    expect(screen.queryByText('Record is complete')).not.toBeInTheDocument();
  });
});

describe('RecordFollowUpsView — navigation', () => {
  it('calls onBack when the back button is clicked', async () => {
    useRecordFollowUpsMock.mockReturnValue({ followUpItems: [], isLoading: false });
    const onBack = vi.fn();
    render(<RecordFollowUpsView record={makeFile()} onBack={onBack} onAction={vi.fn()} />);

    await userEvent.click(screen.getByRole('button'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
