// @vitest-environment jsdom
//
// src/features/Subject/components/__tests__/SubjectBadge.test.tsx
//
// SubjectBadge's own logic: the three render states (nothing / pending / has-subject), the
// display-text variants (single vs. multiple subjects, showName on/off), and the click wiring
// (onClick override vs. the default onOpenManager-when-has-subject behavior). useSubjectAlerts
// and getUserProfiles are mocked — each already has its own dedicated test coverage.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubjectBadge } from '../SubjectBadge';
import type { FileObject, BelroseUserProfile } from '@/types/core';

const { alertsMocks, profilesMock } = vi.hoisted(() => ({
  alertsMocks: { pendingConsentRequests: [] as any[] },
  profilesMock: vi.fn(),
}));

vi.mock('../../hooks/useSubjectAlerts', () => ({
  useSubjectAlerts: () => ({ pendingConsentRequests: alertsMocks.pendingConsentRequests }),
}));

vi.mock('@/features/Users/services/userProfileService', () => ({
  getUserProfiles: profilesMock,
}));

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return { id: 'record1', subjects: [], ...overrides } as unknown as FileObject;
}

function makeProfile(uid: string, displayName: string): BelroseUserProfile {
  return { uid, displayName } as BelroseUserProfile;
}

beforeEach(() => {
  vi.resetAllMocks();
  alertsMocks.pendingConsentRequests = [];
  profilesMock.mockResolvedValue(new Map());
});

describe('SubjectBadge — nothing to show', () => {
  it('renders nothing when there is no subject and no pending request', () => {
    const { container } = render(<SubjectBadge record={makeRecord()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SubjectBadge — pending request, no subject yet', () => {
  it('shows a Pending badge', async () => {
    alertsMocks.pendingConsentRequests = [{ subjectId: 'someone' } as any];
    render(<SubjectBadge record={makeRecord()} />);

    expect(await screen.findByText('Pending')).toBeInTheDocument();
  });

  it('calling onClick fires it directly, without needing onOpenManager', async () => {
    alertsMocks.pendingConsentRequests = [{ subjectId: 'someone' } as any];
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<SubjectBadge record={makeRecord()} onClick={onClick} />);

    await user.click(await screen.findByText('Pending'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('SubjectBadge — has a subject', () => {
  it('fetches and shows the first subject\'s display name', async () => {
    profilesMock.mockResolvedValue(new Map([['sub1', makeProfile('sub1', 'Alice')]]));
    render(<SubjectBadge record={makeRecord({ subjects: ['sub1'] })} />);

    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  it('shows "Subject Set" instead of the name when showName is false', async () => {
    profilesMock.mockResolvedValue(new Map([['sub1', makeProfile('sub1', 'Alice')]]));
    render(<SubjectBadge record={makeRecord({ subjects: ['sub1'] })} showName={false} />);

    expect(await screen.findByText('Subject Set')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('shows "{name} +N" for multiple subjects when showName is true', async () => {
    profilesMock.mockResolvedValue(new Map([['sub1', makeProfile('sub1', 'Alice')]]));
    render(<SubjectBadge record={makeRecord({ subjects: ['sub1', 'sub2', 'sub3'] })} />);

    expect(await screen.findByText('Alice +2')).toBeInTheDocument();
  });

  it('shows "{count} Subjects" for multiple subjects when showName is false', async () => {
    render(
      <SubjectBadge record={makeRecord({ subjects: ['sub1', 'sub2'] })} showName={false} />
    );

    expect(await screen.findByText('2 Subjects')).toBeInTheDocument();
  });

  it('calls onOpenManager when clicked and no onClick override is given', async () => {
    profilesMock.mockResolvedValue(new Map([['sub1', makeProfile('sub1', 'Alice')]]));
    const onOpenManager = vi.fn();
    const user = userEvent.setup();
    render(<SubjectBadge record={makeRecord({ subjects: ['sub1'] })} onOpenManager={onOpenManager} />);

    await user.click(await screen.findByText('Alice'));
    expect(onOpenManager).toHaveBeenCalledTimes(1);
  });

  it('prefers onClick over onOpenManager when both are provided', async () => {
    profilesMock.mockResolvedValue(new Map([['sub1', makeProfile('sub1', 'Alice')]]));
    const onClick = vi.fn();
    const onOpenManager = vi.fn();
    const user = userEvent.setup();
    render(
      <SubjectBadge
        record={makeRecord({ subjects: ['sub1'] })}
        onClick={onClick}
        onOpenManager={onOpenManager}
      />
    );

    await user.click(await screen.findByText('Alice'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onOpenManager).not.toHaveBeenCalled();
  });
});
