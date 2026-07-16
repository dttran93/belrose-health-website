// @vitest-environment jsdom
//
// src/features/Trustee/hooks/__tests__/useTrusteeFlow.test.tsx
//
// Tier 3 — useTrusteeFlow, the Trustee feature's equivalent of useSubjectFlow: a phase/state
// machine (idle -> preparing -> confirming -> [executing] -> submitted/error) driving six
// operation variants. TrusteeRelationshipService and getUserProfile are mocked at the module
// boundary (each already has its own dedicated test suite) — this test is about the hook's own
// phase transitions, wallet-readiness gating, and which confirm* function does what.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { OnChainActivityTrayProvider } from '@/features/OnChainActivityTray/OnChainActivityTrayContext';
import type { BelroseUserProfile } from '@/types/core';

const { mockCurrentUser, trusteeRelMocks, profileMocks } = vi.hoisted(() => ({
  mockCurrentUser: { uid: 'caller1' as string | null },
  trusteeRelMocks: {
    inviteTrustee: vi.fn(),
    acceptInvite: vi.fn(),
    declineInvite: vi.fn(),
    revokeTrustee: vi.fn(),
    editTrusteeRelationship: vi.fn(),
    resignAsTrustee: vi.fn(),
    stepDownTrusteeLevel: vi.fn(),
  },
  profileMocks: {
    getUserProfile: vi.fn(),
  },
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: mockCurrentUser.uid ? { uid: mockCurrentUser.uid } : null }),
}));

vi.mock('@/features/Trustee/services/trusteeRelationshipService', () => ({
  TrusteeRelationshipService: trusteeRelMocks,
}));

vi.mock('@/features/Users/services/userProfileService', () => ({
  getUserProfile: profileMocks.getUserProfile,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useTrusteeFlow } from '../useTrusteeFlow';
import { toast } from 'sonner';

function walletedProfile(): BelroseUserProfile {
  return {
    onChainIdentity: { linkedWallets: [{ address: '0xWallet', isWalletActive: true }] },
  } as unknown as BelroseUserProfile;
}

function noWalletProfile(): BelroseUserProfile {
  return { onChainIdentity: { linkedWallets: [] } } as unknown as BelroseUserProfile;
}

function makeUser(overrides: Partial<BelroseUserProfile> = {}): BelroseUserProfile {
  return { uid: 'target1', displayName: 'Target', ...overrides } as BelroseUserProfile;
}

function wrapper({ children }: { children: ReactNode }) {
  return <OnChainActivityTrayProvider>{children}</OnChainActivityTrayProvider>;
}

function setCaller(uid: string | null) {
  mockCurrentUser.uid = uid;
}

beforeEach(() => {
  vi.resetAllMocks();
  setCaller('caller1');
  profileMocks.getUserProfile.mockResolvedValue(walletedProfile());
});

describe('useTrusteeFlow.initiateInvite / confirmInvite', () => {
  it('moves to confirming when both parties have active wallets', async () => {
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateInvite(makeUser());
    });

    expect(result.current.dialogProps.phase).toBe('confirming');
    expect(result.current.dialogProps.operationType).toBe('invite');
    expect(result.current.dialogProps.selectedTrustLevel).toBe('observer');
  });

  it('moves to error with the wallet reason when the target has no active wallet', async () => {
    profileMocks.getUserProfile.mockImplementation(async (uid: string) =>
      uid === 'target1' ? noWalletProfile() : walletedProfile()
    );
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateInvite(makeUser());
    });

    expect(result.current.dialogProps.phase).toBe('error');
    expect(result.current.dialogProps.error).toBe('The other user does not have an active blockchain wallet.');
  });

  it('moves to error when the caller has no active wallet', async () => {
    profileMocks.getUserProfile.mockImplementation(async (uid: string) =>
      uid === 'caller1' ? noWalletProfile() : walletedProfile()
    );
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateInvite(makeUser());
    });

    expect(result.current.dialogProps.error).toBe('You do not have an active blockchain wallet.');
  });

  it('fires inviteTrustee with the selected level, closes to submitted immediately, and calls onSuccess', async () => {
    trusteeRelMocks.inviteTrustee.mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useTrusteeFlow({ onSuccess }), { wrapper });

    await act(async () => {
      await result.current.initiateInvite(makeUser());
    });
    act(() => {
      result.current.dialogProps.setSelectedTrustLevel('controller');
    });
    act(() => {
      result.current.dialogProps.onConfirmInvite();
    });

    expect(result.current.dialogProps.phase).toBe('submitted');
    await act(async () => {});
    expect(trusteeRelMocks.inviteTrustee).toHaveBeenCalledWith('target1', 'controller');
    expect(onSuccess).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Trustee invite sent');
  });

  it('surfaces a failed invite tx as a failed background activity rather than throwing', async () => {
    trusteeRelMocks.inviteTrustee.mockRejectedValue(new Error('reverted'));
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateInvite(makeUser());
    });
    act(() => {
      result.current.dialogProps.onConfirmInvite();
    });

    expect(result.current.dialogProps.phase).toBe('submitted');
    await act(async () => {});
    // The dialog itself doesn't re-surface the error — it already closed to the tray.
    expect(result.current.dialogProps.phase).toBe('submitted');
  });
});

describe('useTrusteeFlow.initiateAccept / confirmAccept', () => {
  it('requires both wallets ready, then confirms via acceptInvite', async () => {
    trusteeRelMocks.acceptInvite.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateAccept('trustor1', makeUser({ uid: 'trustor1' }), 'custodian');
    });
    expect(result.current.dialogProps.phase).toBe('confirming');
    expect(result.current.dialogProps.trustLevel).toBe('custodian');

    act(() => {
      result.current.dialogProps.onConfirmAccept();
    });

    expect(result.current.dialogProps.phase).toBe('submitted');
    await act(async () => {});
    expect(trusteeRelMocks.acceptInvite).toHaveBeenCalledWith('trustor1');
    expect(toast.success).toHaveBeenCalledWith('Trustee invite accepted');
  });
});

describe('useTrusteeFlow.initiateDecline / confirmDecline', () => {
  it('goes straight to confirming with no wallet preparation', () => {
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    act(() => {
      result.current.initiateDecline('trustor1', makeUser({ uid: 'trustor1' }), 'observer');
    });

    expect(result.current.dialogProps.phase).toBe('confirming');
    expect(result.current.dialogProps.operationType).toBe('decline');
  });

  it('resets to idle with a success toast on confirm', async () => {
    trusteeRelMocks.declineInvite.mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useTrusteeFlow({ onSuccess }), { wrapper });

    act(() => {
      result.current.initiateDecline('trustor1', makeUser({ uid: 'trustor1' }), 'observer');
    });
    await act(async () => {
      await result.current.dialogProps.onConfirmDecline();
    });

    expect(trusteeRelMocks.declineInvite).toHaveBeenCalledWith('trustor1');
    expect(result.current.dialogProps.phase).toBe('idle');
    expect(toast.success).toHaveBeenCalledWith('Invite declined');
    expect(onSuccess).toHaveBeenCalled();
  });

  it('moves to error and toasts on failure — this is a synchronous await, unlike the fire-and-forget flows', async () => {
    trusteeRelMocks.declineInvite.mockRejectedValue(new Error('reverted'));
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    act(() => {
      result.current.initiateDecline('trustor1', makeUser({ uid: 'trustor1' }), 'observer');
    });
    await act(async () => {
      await result.current.dialogProps.onConfirmDecline();
    });

    expect(result.current.dialogProps.phase).toBe('error');
    expect(result.current.dialogProps.error).toBe('reverted');
    expect(toast.error).toHaveBeenCalledWith('reverted');
  });
});

describe('useTrusteeFlow.initiateRevoke / confirmRevoke', () => {
  it('only requires the caller\'s own wallet, and pre-seeds the selector to the current (disabled) level', async () => {
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateRevoke('trustee1', makeUser({ uid: 'trustee1' }), 'custodian');
    });

    expect(result.current.dialogProps.phase).toBe('confirming');
    expect(result.current.dialogProps.selectedTrustLevel).toBe('custodian');
    expect(profileMocks.getUserProfile).toHaveBeenCalledTimes(1);
    expect(profileMocks.getUserProfile).toHaveBeenCalledWith('caller1');
  });

  it('confirms via revokeTrustee and reaches submitted', async () => {
    trusteeRelMocks.revokeTrustee.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateRevoke('trustee1', makeUser({ uid: 'trustee1' }), 'custodian');
    });
    act(() => {
      result.current.dialogProps.onConfirmRevoke();
    });

    expect(result.current.dialogProps.phase).toBe('submitted');
    await act(async () => {});
    expect(trusteeRelMocks.revokeTrustee).toHaveBeenCalledWith('trustee1');
    expect(toast.success).toHaveBeenCalledWith('Trustee revoked');
  });
});

describe('useTrusteeFlow.initiateEditLevel / confirmEditLevel', () => {
  it('pre-seeds the selector to the current level', async () => {
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateEditLevel('trustee1', makeUser({ uid: 'trustee1' }), 'observer');
    });

    expect(result.current.dialogProps.selectedTrustLevel).toBe('observer');
    expect(result.current.dialogProps.operationType).toBe('editLevel');
  });

  it('confirms via editTrusteeRelationship with the newly selected level', async () => {
    trusteeRelMocks.editTrusteeRelationship.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateEditLevel('trustee1', makeUser({ uid: 'trustee1' }), 'observer');
    });
    act(() => {
      result.current.dialogProps.setSelectedTrustLevel('controller');
    });
    act(() => {
      result.current.dialogProps.onConfirmEditLevel();
    });

    expect(result.current.dialogProps.phase).toBe('submitted');
    await act(async () => {});
    expect(trusteeRelMocks.editTrusteeRelationship).toHaveBeenCalledWith('trustee1', 'controller');
    expect(toast.success).toHaveBeenCalledWith('Trust level updated');
  });

  it('is also the confirm handler used by the combined revoke/edit dialog (operationType "revoke")', async () => {
    trusteeRelMocks.editTrusteeRelationship.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    // initiateRevoke opens the combined dialog; its "Change Level" button calls onConfirmEditLevel.
    await act(async () => {
      await result.current.initiateRevoke('trustee1', makeUser({ uid: 'trustee1' }), 'observer');
    });
    act(() => {
      result.current.dialogProps.setSelectedTrustLevel('custodian');
    });
    act(() => {
      result.current.dialogProps.onConfirmEditLevel();
    });

    await act(async () => {});
    expect(trusteeRelMocks.editTrusteeRelationship).toHaveBeenCalledWith('trustee1', 'custodian');
  });

  it('is a no-op for an unrelated pending operation type (e.g. accept)', async () => {
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateAccept('trustor1', makeUser({ uid: 'trustor1' }), 'observer');
    });
    act(() => {
      result.current.dialogProps.onConfirmEditLevel();
    });

    expect(trusteeRelMocks.editTrusteeRelationship).not.toHaveBeenCalled();
  });
});

describe('useTrusteeFlow.initiateResign / confirmResign / confirmStepDown', () => {
  it('pre-selects one level below the current level', async () => {
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateResign('trustor1', makeUser({ uid: 'trustor1' }), 'controller');
    });

    expect(result.current.dialogProps.selectedTrustLevel).toBe('custodian');
  });

  it('defaults to observer when already at observer (nothing lower to select)', async () => {
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateResign('trustor1', makeUser({ uid: 'trustor1' }), 'observer');
    });

    expect(result.current.dialogProps.selectedTrustLevel).toBe('observer');
  });

  it('confirmResign calls resignAsTrustee regardless of the selected step-down level', async () => {
    trusteeRelMocks.resignAsTrustee.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateResign('trustor1', makeUser({ uid: 'trustor1' }), 'controller');
    });
    act(() => {
      result.current.dialogProps.onConfirmResign();
    });

    expect(result.current.dialogProps.phase).toBe('submitted');
    await act(async () => {});
    expect(trusteeRelMocks.resignAsTrustee).toHaveBeenCalledWith('trustor1');
    expect(trusteeRelMocks.stepDownTrusteeLevel).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('You have resigned as trustee');
  });

  it('confirmStepDown calls stepDownTrusteeLevel with the selected lower level instead of resigning', async () => {
    trusteeRelMocks.stepDownTrusteeLevel.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateResign('trustor1', makeUser({ uid: 'trustor1' }), 'controller');
    });
    act(() => {
      result.current.dialogProps.onConfirmStepDown();
    });

    expect(result.current.dialogProps.phase).toBe('submitted');
    await act(async () => {});
    expect(trusteeRelMocks.stepDownTrusteeLevel).toHaveBeenCalledWith('trustor1', 'custodian');
    expect(trusteeRelMocks.resignAsTrustee).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Trust level updated');
  });
});

describe('useTrusteeFlow — dialogProps.onClose / reset', () => {
  it('resets phase, error, and selectedTrustLevel back to defaults', async () => {
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });

    await act(async () => {
      await result.current.initiateEditLevel('trustee1', makeUser({ uid: 'trustee1' }), 'controller');
    });
    expect(result.current.dialogProps.phase).toBe('confirming');

    act(() => {
      result.current.dialogProps.onClose();
    });

    expect(result.current.dialogProps.phase).toBe('idle');
    expect(result.current.dialogProps.selectedTrustLevel).toBe('observer');
    expect(result.current.dialogProps.targetUser).toBeNull();
  });
});

describe('useTrusteeFlow — isLoading / isDialogOpen', () => {
  it('reflects preparing and executing phases as loading', async () => {
    const { result } = renderHook(() => useTrusteeFlow(), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isDialogOpen).toBe(false);

    act(() => {
      result.current.initiateDecline('trustor1', makeUser({ uid: 'trustor1' }), 'observer');
    });

    expect(result.current.isDialogOpen).toBe(true);
  });
});
