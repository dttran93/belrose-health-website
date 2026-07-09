// src/features/Permissions/services/__tests__/writePermissionChangeEvent.test.ts
//
// writePermissionChangeEvent is a fire-and-forget audit log write — it must never let a
// failed Firestore write propagate and block the real permission change that triggered it.
// This is the one behavior not already exercised indirectly by the orchestration suite
// (which only ever runs this against a working Firestore emulator, never a failing one).

import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock('@/features/Notifications/services/encryptNotificationTitle', () => ({
  encryptNotificationTitle: vi.fn(),
}));

import { addDoc } from 'firebase/firestore';
import writePermissionChangeEvent from '../writePermissionChangeEvent';

describe('writePermissionChangeEvent', () => {
  it('never throws, even when the underlying Firestore write fails', async () => {
    vi.mocked(addDoc).mockRejectedValue(new Error('Firestore unavailable'));

    await expect(
      writePermissionChangeEvent(
        'rec1',
        'user1',
        [{ userId: 'target1', action: 'granted', previousRole: null, newRole: 'viewer' }],
        { txHash: '0xabc', chainId: 84532, blockNumber: 1, contractAddress: '0xContract' }
      )
    ).resolves.toBeUndefined();
  });
});
