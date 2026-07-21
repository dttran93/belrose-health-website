// @vitest-environment jsdom
//
// src/features/Dependents/hooks/__tests__/useCreateDependent.test.ts
//
// Tier 2 (DependentAccountService mocked) unit tests for the create-dependent wizard state
// machine: info -> password -> recovery -> done, plus the client-side password validation that
// gates the actual createAccount call.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { createAccountMock } = vi.hoisted(() => ({ createAccountMock: vi.fn() }));

vi.mock('../../services/dependentAccountService', () => ({
  DependentAccountService: { createAccount: createAccountMock },
  generatePlaceholderEmail: () => 'dep-fixed-id@placeholder.belrose.health',
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { useCreateDependent } from '../useCreateDependent';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCreateDependent — initial state', () => {
  it('starts on the info step with empty form data', () => {
    const { result } = renderHook(() => useCreateDependent());
    expect(result.current.step).toBe('info');
    expect(result.current.formData).toEqual({
      firstName: '',
      lastName: '',
      password: '',
      confirmPassword: '',
      acknowledgedRecoveryKey: false,
    });
  });
});

describe('useCreateDependent — form/step management', () => {
  it('updateFormData merges partial updates', () => {
    const { result } = renderHook(() => useCreateDependent());
    act(() => result.current.updateFormData({ firstName: 'Jane' }));
    expect(result.current.formData.firstName).toBe('Jane');

    act(() => result.current.updateFormData({ lastName: 'Doe' }));
    expect(result.current.formData).toMatchObject({ firstName: 'Jane', lastName: 'Doe' });
  });

  it('goToStep changes the step and clears any error', async () => {
    createAccountMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCreateDependent());

    act(() => result.current.updateFormData({ password: 'password123', confirmPassword: 'password123' }));
    await act(async () => result.current.createAccount());
    expect(result.current.error).toBe('boom');

    act(() => result.current.goToStep('password'));
    expect(result.current.step).toBe('password');
    expect(result.current.error).toBeNull();
  });

  it('finish() moves to the done step', () => {
    const { result } = renderHook(() => useCreateDependent());
    act(() => result.current.finish());
    expect(result.current.step).toBe('done');
  });

  it('reset() restores the initial state', () => {
    const { result } = renderHook(() => useCreateDependent());
    act(() => {
      result.current.updateFormData({ firstName: 'Jane' });
      result.current.goToStep('password');
    });
    act(() => result.current.reset());

    expect(result.current.step).toBe('info');
    expect(result.current.formData.firstName).toBe('');
    expect(result.current.error).toBeNull();
  });
});

describe('useCreateDependent — createAccount validation', () => {
  it('rejects mismatched passwords without calling the service', async () => {
    const { result } = renderHook(() => useCreateDependent());
    act(() => result.current.updateFormData({ password: 'password123', confirmPassword: 'different1' }));

    await act(async () => result.current.createAccount());

    expect(result.current.error).toBe('Passwords do not match');
    expect(createAccountMock).not.toHaveBeenCalled();
  });

  it('rejects passwords shorter than 8 characters without calling the service', async () => {
    const { result } = renderHook(() => useCreateDependent());
    act(() => result.current.updateFormData({ password: 'short1', confirmPassword: 'short1' }));

    await act(async () => result.current.createAccount());

    expect(result.current.error).toBe('Password must be at least 8 characters');
    expect(createAccountMock).not.toHaveBeenCalled();
  });
});

describe('useCreateDependent — createAccount happy path', () => {
  it('calls DependentAccountService with trimmed names, generated email, and password', async () => {
    createAccountMock.mockResolvedValue({
      uid: 'dep-uid',
      walletAddress: '0xabc',
      smartAccountAddress: '0xdef',
      recoveryKey: 'word1 word2',
    });
    const { result } = renderHook(() => useCreateDependent());
    act(() =>
      result.current.updateFormData({
        firstName: '  Jane  ',
        lastName: '  Doe  ',
        password: 'password123',
        confirmPassword: 'password123',
      })
    );

    await act(async () => result.current.createAccount());

    expect(createAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'dep-fixed-id@placeholder.belrose.health',
        password: 'password123',
      })
    );
  });

  it('drives dialogPhase via the onProgress callback, then advances to the recovery step', async () => {
    const phases: string[] = [];
    createAccountMock.mockImplementation(async (params: any) => {
      params.onProgress('keys');
      phases.push('keys-observed');
      params.onProgress('registering');
      return { uid: 'dep-uid', walletAddress: '0xabc', smartAccountAddress: '0xdef', recoveryKey: 'word1' };
    });
    const { result } = renderHook(() => useCreateDependent());
    act(() =>
      result.current.updateFormData({ password: 'password123', confirmPassword: 'password123' })
    );

    await act(async () => result.current.createAccount());

    expect(result.current.step).toBe('recovery');
    expect(result.current.dialogPhase).toBe('idle');
    expect(result.current.result).toMatchObject({ uid: 'dep-uid' });
  });

  it('maps functions/already-exists to a friendly error message', async () => {
    createAccountMock.mockRejectedValue({ code: 'functions/already-exists' });
    const { result } = renderHook(() => useCreateDependent());
    act(() =>
      result.current.updateFormData({ password: 'password123', confirmPassword: 'password123' })
    );

    await act(async () => result.current.createAccount());

    expect(result.current.error).toBe('An account with this email already exists');
    expect(result.current.dialogPhase).toBe('error');
  });

  it('closeDialogError resets dialogPhase and error', async () => {
    createAccountMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCreateDependent());
    act(() =>
      result.current.updateFormData({ password: 'password123', confirmPassword: 'password123' })
    );
    await act(async () => result.current.createAccount());
    expect(result.current.dialogPhase).toBe('error');

    act(() => result.current.closeDialogError());
    expect(result.current.dialogPhase).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});
