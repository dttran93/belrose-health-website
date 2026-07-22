// @vitest-environment jsdom
//
// src/features/RecordFollowUp/components/ui/__tests__/RecordActionGroup.test.tsx
//
// Tier 4 — mocks useRecordFollowUps (covered separately) and react-router's useNavigate, renders
// the real component. Covers the loading skeleton, the null render when there's nothing to show,
// the record-title fallback chain, the action-count badge, and the onAction -> per-itemId view
// navigation mapping.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { User } from 'lucide-react';

const { useRecordFollowUpsMock, navigateMock } = vi.hoisted(() => ({
  useRecordFollowUpsMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('../../../hooks/useRecordFollowUps', () => ({ default: useRecordFollowUpsMock }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

import RecordActionGroup from '../RecordActionGroup';
import type { FileObject } from '@/types/core';

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return { id: 'record-1', fileSize: 100, fileType: 'application/pdf', administrators: [], status: 'completed', ...overrides } as FileObject;
}

function makeItem(id: string, onAction: () => void) {
  return {
    id,
    label: `label-${id}`,
    icon: User,
    status: 'pending' as const,
    ctaLabel: 'Go',
    onAction,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RecordActionGroup — loading / empty', () => {
  it('shows a skeleton while loading', () => {
    useRecordFollowUpsMock.mockReturnValue({ followUpItems: [], isLoading: true });
    const { container } = render(<RecordActionGroup record={makeRecord()} />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders nothing when there are no outstanding items', () => {
    useRecordFollowUpsMock.mockReturnValue({ followUpItems: [], isLoading: false });
    const { container } = render(<RecordActionGroup record={makeRecord()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('RecordActionGroup — record title fallback', () => {
  it('prefers belroseFields.title', () => {
    useRecordFollowUpsMock.mockReturnValue({
      followUpItems: [makeItem('subject', vi.fn())],
      isLoading: false,
    });
    render(<RecordActionGroup record={makeRecord({ belroseFields: { title: 'GP Visit' } as any })} />);
    expect(screen.getByText('GP Visit')).toBeInTheDocument();
  });

  it('falls back to fileName when there is no belroseFields title', () => {
    useRecordFollowUpsMock.mockReturnValue({
      followUpItems: [makeItem('subject', vi.fn())],
      isLoading: false,
    });
    render(<RecordActionGroup record={makeRecord({ fileName: 'labs.pdf' })} />);
    expect(screen.getByText('labs.pdf')).toBeInTheDocument();
  });

  it('falls back to a truncated record id when there is no title or fileName', () => {
    useRecordFollowUpsMock.mockReturnValue({
      followUpItems: [makeItem('subject', vi.fn())],
      isLoading: false,
    });
    render(<RecordActionGroup record={makeRecord({ id: 'abcdefgh12345', fileName: undefined })} />);
    expect(screen.getByText('Record abcdefgh')).toBeInTheDocument();
  });
});

describe('RecordActionGroup — action count + navigation', () => {
  it('shows the singular/plural action count badge', () => {
    useRecordFollowUpsMock.mockReturnValue({
      followUpItems: [makeItem('subject', vi.fn()), makeItem('verify', vi.fn())],
      isLoading: false,
    });
    render(<RecordActionGroup record={makeRecord()} />);
    expect(screen.getByText('2 actions')).toBeInTheDocument();
  });

  it('navigates to the record when the header is clicked', async () => {
    useRecordFollowUpsMock.mockReturnValue({
      followUpItems: [makeItem('subject', vi.fn())],
      isLoading: false,
    });
    render(<RecordActionGroup record={makeRecord({ id: 'record-1', fileName: 'labs.pdf' })} />);

    await userEvent.click(screen.getByText('labs.pdf'));
    expect(navigateMock).toHaveBeenCalledWith('/app/records/record-1');
  });

  it("maps each follow-up item's onAction to the correct pre-selected view", () => {
    let capturedOnAction: ((fileItem: FileObject, itemId: string) => void) | undefined;
    useRecordFollowUpsMock.mockImplementation((_record: FileObject, options: any) => {
      capturedOnAction = options.onAction;
      return { followUpItems: [], isLoading: false };
    });

    render(<RecordActionGroup record={makeRecord({ id: 'record-1' })} />);

    capturedOnAction?.(makeRecord({ id: 'record-1' }), 'verify');
    expect(navigateMock).toHaveBeenCalledWith('/app/records/record-1?view=credibility');

    capturedOnAction?.(makeRecord({ id: 'record-1' }), 'link-request');
    expect(navigateMock).toHaveBeenCalledWith('/app/records/record-1?view=follow-up');

    capturedOnAction?.(makeRecord({ id: 'record-1' }), 'subject-rejection');
    expect(navigateMock).toHaveBeenCalledWith('/app/records/record-1?view=subject');
  });
});
