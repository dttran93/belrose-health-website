// @vitest-environment jsdom
//
// src/features/Permissions/hooks/__tests__/usePermissionFlow.test.tsx
//
// First component/hook-tier test in the repo — one rung cheaper than orchestration (no real
// Firestore/blockchain, no emulator) but one rung more realistic than pure unit tests (a real
// React hook lifecycle via renderHook, real state transitions). PermissionsService and
// PermissionPreparationService are mocked at the service boundary, same as the orchestration
// suite; OnChainActivityTrayProvider is used for real since it's just local React state with
// no external dependencies.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { OnChainActivityTrayProvider } from '@/features/OnChainActivityTray/OnChainActivityTrayContext';
import type { BelroseUserProfile, FileObject } from '@/types/core';

vi.mock('../../services/permissionsService', () => ({
  PermissionsService: {
    getRecordRoles: vi.fn(),
    getEligibleRoleTargets: vi.fn(),
    canRevokeAccess: vi.fn(),
    grantViewer: vi.fn(),
    grantSharer: vi.fn(),
    grantAdmin: vi.fn(),
    grantOwner: vi.fn(),
    grantRoleBatch: vi.fn(),
    changeRole: vi.fn(),
    removeViewer: vi.fn(),
    removeSharer: vi.fn(),
    removeAdmin: vi.fn(),
    removeOwner: vi.fn(),
  },
}));

vi.mock('../../services/permissionPreparationService', () => ({
  PermissionPreparationService: {
    verifyPrerequisites: vi.fn(),
    prepare: vi.fn(),
    prepareBatch: vi.fn(),
  },
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { usePermissionFlow } from '../usePermissionFlow';
import { PermissionsService } from '../../services/permissionsService';
import { PermissionPreparationService } from '../../services/permissionPreparationService';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';

const READY = { ready: true };
const NOT_READY = { ready: false, reason: 'Not ready yet' };

function makeUser(overrides: Partial<BelroseUserProfile> = {}): BelroseUserProfile {
  return {
    uid: 'target1',
    wallet: { address: '0xTargetWallet' },
    ...overrides,
  } as BelroseUserProfile;
}

function wrapper({ children }: { children: ReactNode }) {
  return <OnChainActivityTrayProvider>{children}</OnChainActivityTrayProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAuth).mockReturnValue({ currentUser: { uid: 'caller1' } } as any);
});

describe('usePermissionFlow.initiateGrant', () => {
  it('shows an error toast and never leaves idle when the target has no wallet', async () => {
    const { result } = renderHook(() => usePermissionFlow({ recordId: 'rec1' }), { wrapper });

    await act(async () => {
      await result.current.initiateGrant(makeUser({ wallet: undefined }), 'viewer');
    });

    expect(toast.error).toHaveBeenCalledWith('User does not have a wallet address');
    expect(result.current.phase).toBe('idle');
    expect(PermissionPreparationService.verifyPrerequisites).not.toHaveBeenCalled();
  });

  it('moves straight to confirming when prerequisites are already met', async () => {
    vi.mocked(PermissionPreparationService.verifyPrerequisites).mockResolvedValue(READY as any);
    const { result } = renderHook(() => usePermissionFlow({ recordId: 'rec1' }), { wrapper });

    await act(async () => {
      await result.current.initiateGrant(makeUser(), 'viewer');
    });

    expect(result.current.phase).toBe('confirming');
    expect(PermissionPreparationService.prepare).not.toHaveBeenCalled();
  });

  it('runs preparation when prerequisites are not yet met, then confirms', async () => {
    vi.mocked(PermissionPreparationService.verifyPrerequisites)
      .mockResolvedValueOnce(NOT_READY as any)
      .mockResolvedValueOnce(READY as any);
    vi.mocked(PermissionPreparationService.prepare).mockResolvedValue(undefined);
    vi.mocked(PermissionsService.getRecordRoles).mockResolvedValue({
      owners: ['caller1'],
      administrators: [],
      sharers: [],
      viewers: [],
    });
    const { result } = renderHook(() => usePermissionFlow({ recordId: 'rec1' }), { wrapper });

    await act(async () => {
      await result.current.initiateGrant(makeUser(), 'viewer');
    });

    expect(PermissionPreparationService.prepare).toHaveBeenCalledWith(
      'rec1',
      'owner',
      expect.any(Function)
    );
    expect(result.current.phase).toBe('confirming');
  });

  it('moves to error when preparation still is not ready on the final check', async () => {
    vi.mocked(PermissionPreparationService.verifyPrerequisites)
      .mockResolvedValueOnce(NOT_READY as any)
      .mockResolvedValueOnce(NOT_READY as any);
    vi.mocked(PermissionPreparationService.prepare).mockResolvedValue(undefined);
    vi.mocked(PermissionsService.getRecordRoles).mockResolvedValue({
      owners: [],
      administrators: [],
      sharers: [],
      viewers: [],
    });
    const { result } = renderHook(() => usePermissionFlow({ recordId: 'rec1' }), { wrapper });

    await act(async () => {
      await result.current.initiateGrant(makeUser(), 'viewer');
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('Not ready yet');
  });
});

describe('usePermissionFlow.confirmGrant', () => {
  it('dispatches to grantViewer and moves to submitted immediately (fire-and-forget)', async () => {
    vi.mocked(PermissionPreparationService.verifyPrerequisites).mockResolvedValue(READY as any);
    vi.mocked(PermissionsService.grantViewer).mockResolvedValue(undefined);
    const { result } = renderHook(() => usePermissionFlow({ recordId: 'rec1' }), { wrapper });

    await act(async () => {
      await result.current.initiateGrant(makeUser(), 'viewer');
    });
    await act(async () => {
      result.current.dialogProps.onConfirmGrant();
    });

    expect(PermissionsService.grantViewer).toHaveBeenCalledWith('rec1', 'target1', undefined);
    expect(result.current.phase).toBe('submitted');
  });
});

describe('usePermissionFlow.initiateRevoke', () => {
  it('computes eligibility and canFullyRevoke from the record before confirming', async () => {
    const fakeRecord = { id: 'rec1' } as FileObject;
    const eligibility = {
      viewer: { enabled: false },
      sharer: { enabled: true },
      administrator: { enabled: false },
      owner: { enabled: false },
    };
    const canFullyRevoke = { enabled: true };
    vi.mocked(PermissionsService.getEligibleRoleTargets).mockReturnValue(eligibility as any);
    vi.mocked(PermissionsService.canRevokeAccess).mockReturnValue(canFullyRevoke as any);
    vi.mocked(PermissionPreparationService.verifyPrerequisites).mockResolvedValue(READY as any);

    const { result } = renderHook(
      () => usePermissionFlow({ recordId: 'rec1', record: fakeRecord }),
      { wrapper }
    );

    await act(async () => {
      await result.current.initiateRevoke(makeUser(), 'sharer');
    });

    expect(PermissionsService.getEligibleRoleTargets).toHaveBeenCalledWith(
      fakeRecord,
      'caller1',
      'target1'
    );
    expect(result.current.dialogProps.eligibility).toEqual(eligibility);
    expect(result.current.dialogProps.canFullyRevoke).toEqual(canFullyRevoke);
    expect(result.current.phase).toBe('confirming');
  });
});

describe('usePermissionFlow.confirmRevoke', () => {
  it('maps "demote-admin" on an owner to removeOwner({ demoteTo: "administrator" })', async () => {
    vi.mocked(PermissionPreparationService.verifyPrerequisites).mockResolvedValue(READY as any);
    vi.mocked(PermissionsService.removeOwner).mockResolvedValue(undefined);
    const { result } = renderHook(() => usePermissionFlow({ recordId: 'rec1' }), { wrapper });

    await act(async () => {
      await result.current.initiateRevoke(makeUser(), 'owner');
    });
    await act(async () => {
      result.current.dialogProps.onConfirmRevoke('demote-admin');
    });

    expect(PermissionsService.removeOwner).toHaveBeenCalledWith('rec1', 'target1', undefined, {
      demoteTo: 'administrator',
    });
    expect(result.current.phase).toBe('submitted');
  });
});

describe('usePermissionFlow reset', () => {
  it('clears the phase and pending operation back to idle', async () => {
    vi.mocked(PermissionPreparationService.verifyPrerequisites).mockResolvedValue(READY as any);
    const { result } = renderHook(() => usePermissionFlow({ recordId: 'rec1' }), { wrapper });

    await act(async () => {
      await result.current.initiateGrant(makeUser(), 'viewer');
    });
    expect(result.current.phase).toBe('confirming');

    act(() => {
      result.current.dialogProps.onClose();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.dialogProps.user).toBeNull();
  });
});
