// src/features/Dependents/services/__tests__/dependentManagementService.test.ts
//
// Tier 3 (httpsCallable mocked) unit tests for DependentManagementService — thin wrappers
// around the initiateHandoff/removeDependentRelationship Cloud Functions. Real behavior for
// what removeDependentRelationship actually does server-side (revoke vs. full delete) lives in
// the Functions-layer test for that handler; this file only checks call-argument wiring.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { httpsCallableMock, callableFnMock } = vi.hoisted(() => ({
  httpsCallableMock: vi.fn(),
  callableFnMock: vi.fn(async () => ({ data: {} })),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: httpsCallableMock,
}));

import { DependentManagementService } from '../dependentManagementService';

beforeEach(() => {
  vi.clearAllMocks();
  httpsCallableMock.mockReturnValue(callableFnMock);
});

describe('DependentManagementService.initiateHandoff', () => {
  it('calls the initiateHandoff callable with dependentUid and contactEmail', async () => {
    await DependentManagementService.initiateHandoff('dep-1', 'contact@example.com');

    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'initiateHandoff');
    expect(callableFnMock).toHaveBeenCalledWith({
      dependentUid: 'dep-1',
      contactEmail: 'contact@example.com',
    });
  });

  it('propagates errors from the callable', async () => {
    callableFnMock.mockRejectedValueOnce(new Error('not authorized'));
    await expect(
      DependentManagementService.initiateHandoff('dep-1', 'contact@example.com')
    ).rejects.toThrow('not authorized');
  });
});

describe('DependentManagementService.removeDependent', () => {
  it('calls the removeDependentRelationship callable with dependentUid', async () => {
    await DependentManagementService.removeDependent('dep-1');

    expect(httpsCallableMock).toHaveBeenCalledWith(
      expect.anything(),
      'removeDependentRelationship'
    );
    expect(callableFnMock).toHaveBeenCalledWith({ dependentUid: 'dep-1' });
  });

  it('propagates errors from the callable', async () => {
    callableFnMock.mockRejectedValueOnce(new Error('not authorized'));
    await expect(DependentManagementService.removeDependent('dep-1')).rejects.toThrow(
      'not authorized'
    );
  });
});
