// src/features/Sharing/services/__tests__/emailInvitationService.test.ts
//
// Tier 3 — thin wrapper around a Cloud Function httpsCallable. Nothing to verify about the
// function's own behavior (that's functions/'s concern, untested per CLAUDE.md), just that this
// service calls it with the right name/data and turns a rejection into the documented error.

import { describe, it, expect, vi } from 'vitest';

const { mockCallable, mockFunctionsInstance } = vi.hoisted(() => ({
  mockCallable: vi.fn(),
  mockFunctionsInstance: { __brand: 'functions-instance' },
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => mockFunctionsInstance),
  httpsCallable: vi.fn(() => mockCallable),
}));

import { httpsCallable } from 'firebase/functions';
import { EmailInvitationService } from '../emailInvitationService';

const REQUEST = {
  senderName: 'Dr. Smith',
  senderEmail: 'dr.smith@example.com',
  receiverEmail: 'patient@example.com',
  recordName: 'Lab Results',
};

describe('EmailInvitationService.sendShareInvitation', () => {
  it('calls the sendShareInvitationEmail callable with the given data and returns its result', async () => {
    mockCallable.mockResolvedValue({
      data: { success: true, message: 'Invitation sent', action: 'signup_required' },
    });

    const result = await EmailInvitationService.sendShareInvitation(REQUEST);

    expect(httpsCallable).toHaveBeenCalledWith(mockFunctionsInstance, 'sendShareInvitationEmail');
    expect(mockCallable).toHaveBeenCalledWith(REQUEST);
    expect(result).toEqual({ success: true, message: 'Invitation sent', action: 'signup_required' });
  });

  it('wraps a callable failure in a generic error message', async () => {
    mockCallable.mockRejectedValue(new Error('functions/internal'));

    await expect(EmailInvitationService.sendShareInvitation(REQUEST)).rejects.toThrow(
      'Failed to send invitation email'
    );
  });
});
