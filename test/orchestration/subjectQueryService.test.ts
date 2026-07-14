// test/orchestration/subjectQueryService.test.ts
//
// Layer 3 (orchestration) — SubjectQueryService, the read side for consent/removal requests.
// Real Firestore emulator; only firebase/auth is mocked. `SubjectQueryService.db` used to be a
// class-field initializer (getFirestore() called once at module-import time) — fixed to a getter
// so a normal static import works here like every other orchestration test file; see
// subjectQueryService.ts for the full explanation.

import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { doc, setDoc } from 'firebase/firestore';
import { deleteApp, getApps } from 'firebase/app';
import { connectTestFirestore, clearTestFirestore, seedRecord } from './helpers/testFirestore';

const { mockCurrentUser } = vi.hoisted(() => ({
  mockCurrentUser: { uid: null as string | null },
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: mockCurrentUser.uid ? { uid: mockCurrentUser.uid } : null }),
}));

import { SubjectQueryService } from '../../src/features/Subject/services/subjectQueryService';
import { getConsentRequestId } from '../../src/features/Subject/services/subjectConsentService';
import { getRemovalRequestId } from '../../src/features/Subject/services/subjectRemovalService';

const RECORD_ID = 'subject-query-record';
const OTHER_RECORD_ID = 'subject-query-other-record';
const OWNER = 'subject-query-owner';
const SUBJECT = 'subject-query-subject';
const OTHER_SUBJECT = 'subject-query-other-subject';

function setCaller(uid: string | null) {
  mockCurrentUser.uid = uid;
}

const db = connectTestFirestore('belrose-orchestration-subject-query');

async function seedConsentRequest(
  recordId: string,
  subjectId: string,
  status: string,
  overrides: Record<string, unknown> = {}
) {
  await setDoc(doc(db, 'subjectConsentRequests', getConsentRequestId(recordId, subjectId)), {
    recordId,
    subjectId,
    requestedBy: OWNER,
    requestedSubjectRole: 'sharer',
    status,
    createdAt: new Date(),
    grantedAccessOnSubjectRequest: false,
    ...overrides,
  });
}

async function seedRemovalRequest(
  recordId: string,
  subjectId: string,
  status: string,
  overrides: Record<string, unknown> = {}
) {
  await setDoc(doc(db, 'subjectRemovalRequests', getRemovalRequestId(recordId, subjectId)), {
    recordId,
    subjectId,
    requestedBy: OWNER,
    reason: '',
    status,
    createdAt: new Date(),
    ...overrides,
  });
}

describe('SubjectQueryService (orchestration)', () => {
  beforeEach(async () => {
    await clearTestFirestore();
    setCaller(null);
  });

  afterAll(() => {
    getApps().forEach(app => deleteApp(app));
  });

  describe('getRecordSubjects', () => {
    it('throws when the record does not exist', async () => {
      await expect(SubjectQueryService.getRecordSubjects(RECORD_ID)).rejects.toThrow(
        'Record not found'
      );
    });

    it('returns the subjects array', async () => {
      await seedRecord(db, RECORD_ID, { subjects: [SUBJECT] });
      await expect(SubjectQueryService.getRecordSubjects(RECORD_ID)).resolves.toEqual([SUBJECT]);
    });
  });

  describe('getConsentRequest / getRemovalRequest', () => {
    it('getConsentRequest returns null when no request exists', async () => {
      await expect(SubjectQueryService.getConsentRequest(RECORD_ID, SUBJECT)).resolves.toBeNull();
    });

    it('getConsentRequest returns the request with its id attached', async () => {
      await seedConsentRequest(RECORD_ID, SUBJECT, 'pending');
      const result = await SubjectQueryService.getConsentRequest(RECORD_ID, SUBJECT);
      expect(result?.status).toBe('pending');
      expect((result as any).id).toBe(getConsentRequestId(RECORD_ID, SUBJECT));
    });

    it('getRemovalRequest returns null when no request exists', async () => {
      await expect(SubjectQueryService.getRemovalRequest(RECORD_ID, SUBJECT)).resolves.toBeNull();
    });

    it('getRemovalRequest returns the request when it exists', async () => {
      await seedRemovalRequest(RECORD_ID, SUBJECT, 'pending');
      const result = await SubjectQueryService.getRemovalRequest(RECORD_ID, SUBJECT);
      expect(result?.status).toBe('pending');
    });
  });

  describe('getPendingConsentRequestsForRecord', () => {
    it('throws when not authenticated', async () => {
      await expect(SubjectQueryService.getPendingConsentRequestsForRecord(RECORD_ID)).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('returns a request whether the caller is the subject or the requester, without duplicating', async () => {
      setCaller(SUBJECT);
      await seedConsentRequest(RECORD_ID, SUBJECT, 'pending', { requestedBy: SUBJECT });

      const results = await SubjectQueryService.getPendingConsentRequestsForRecord(RECORD_ID);
      expect(results).toHaveLength(1);
      expect(results[0]!.subjectId).toBe(SUBJECT);
    });

    it('excludes non-pending requests', async () => {
      setCaller(SUBJECT);
      await seedConsentRequest(RECORD_ID, SUBJECT, 'accepted');

      const results = await SubjectQueryService.getPendingConsentRequestsForRecord(RECORD_ID);
      expect(results).toHaveLength(0);
    });
  });

  describe('getRejectedConsentRequestsForRecord', () => {
    it('excludes rejections the creator already dropped', async () => {
      await seedConsentRequest(RECORD_ID, SUBJECT, 'rejected', {
        rejection: { creatorResponse: { status: 'dropped' } },
      });
      await seedConsentRequest(RECORD_ID, OTHER_SUBJECT, 'rejected', {
        rejection: { creatorResponse: { status: 'pending_creator_decision' } },
      });

      const results = await SubjectQueryService.getRejectedConsentRequestsForRecord(RECORD_ID);
      expect(results.map(r => r.subjectId)).toEqual([OTHER_SUBJECT]);
    });
  });

  describe('getIncomingConsentRequests', () => {
    it('throws when not authenticated', async () => {
      await expect(SubjectQueryService.getIncomingConsentRequests()).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('returns pending requests where the caller is the subject, correctly shaped', async () => {
      setCaller(SUBJECT);
      await seedConsentRequest(RECORD_ID, SUBJECT, 'pending', { requestedSubjectRole: 'administrator' });

      const results = await SubjectQueryService.getIncomingConsentRequests();
      expect(results).toEqual([
        expect.objectContaining({
          recordId: RECORD_ID,
          requestedBy: OWNER,
          requestedSubjectRole: 'administrator',
          status: 'pending',
        }),
      ]);
    });
  });

  describe('getAllConsentRequestsForRecord', () => {
    it('returns every request for the record regardless of status', async () => {
      await seedConsentRequest(RECORD_ID, SUBJECT, 'pending');
      await seedConsentRequest(RECORD_ID, OTHER_SUBJECT, 'rejected');
      await seedConsentRequest(OTHER_RECORD_ID, SUBJECT, 'pending');

      const results = await SubjectQueryService.getAllConsentRequestsForRecord(RECORD_ID);
      expect(results.map(r => r.subjectId).sort()).toEqual([OTHER_SUBJECT, SUBJECT].sort());
    });
  });

  describe('getPendingRemovalRequestsForRecord', () => {
    it('returns only the pending request matching recordId + subjectId', async () => {
      await seedRemovalRequest(RECORD_ID, SUBJECT, 'pending');
      await seedRemovalRequest(RECORD_ID, OTHER_SUBJECT, 'accepted');

      const results = await SubjectQueryService.getPendingRemovalRequestsForRecord(RECORD_ID, SUBJECT);
      expect(results).toHaveLength(1);
      expect(results[0]!.subjectId).toBe(SUBJECT);
    });
  });

  describe('getIncomingRemovalRequests', () => {
    it('throws when not authenticated', async () => {
      await expect(SubjectQueryService.getIncomingRemovalRequests()).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('returns pending removal requests targeting the caller, correctly shaped', async () => {
      setCaller(SUBJECT);
      await seedRemovalRequest(RECORD_ID, SUBJECT, 'pending', { reason: 'wrong person' });

      const results = await SubjectQueryService.getIncomingRemovalRequests();
      expect(results).toEqual([
        expect.objectContaining({ recordId: RECORD_ID, requestedBy: OWNER, reason: 'wrong person' }),
      ]);
    });
  });

  describe('getOutgoingRemovalRequests', () => {
    it('throws when not authenticated', async () => {
      await expect(SubjectQueryService.getOutgoingRemovalRequests()).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('returns every request made by the caller, regardless of status', async () => {
      setCaller(OWNER);
      await seedRemovalRequest(RECORD_ID, SUBJECT, 'pending', { requestedBy: OWNER });
      await seedRemovalRequest(OTHER_RECORD_ID, OTHER_SUBJECT, 'accepted', { requestedBy: OWNER });
      await seedRemovalRequest(RECORD_ID, OTHER_SUBJECT, 'pending', { requestedBy: 'someone-else' });

      const results = await SubjectQueryService.getOutgoingRemovalRequests();
      expect(results.map(r => r.subjectId).sort()).toEqual([OTHER_SUBJECT, SUBJECT].sort());
    });
  });

  describe('getAllRemovalRequestsForRecord', () => {
    it('returns every removal request for the record', async () => {
      await seedRemovalRequest(RECORD_ID, SUBJECT, 'pending');
      await seedRemovalRequest(RECORD_ID, OTHER_SUBJECT, 'rejected');

      const results = await SubjectQueryService.getAllRemovalRequestsForRecord(RECORD_ID);
      expect(results).toHaveLength(2);
    });
  });

  describe('getPendingRejectionResponses', () => {
    it('throws when not authenticated', async () => {
      await expect(SubjectQueryService.getPendingRejectionResponses(RECORD_ID)).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('returns only rejections still awaiting the creator\'s decision, requested by the caller', async () => {
      setCaller(OWNER);
      await seedConsentRequest(RECORD_ID, SUBJECT, 'rejected', {
        requestedBy: OWNER,
        rejection: {
          rejectedAt: new Date(),
          reason: 'privacy',
          creatorResponse: { status: 'pending_creator_decision' },
        },
      });
      await seedConsentRequest(RECORD_ID, OTHER_SUBJECT, 'rejected', {
        requestedBy: OWNER,
        rejection: { rejectedAt: new Date(), reason: 'other', creatorResponse: { status: 'dropped' } },
      });

      const results = await SubjectQueryService.getPendingRejectionResponses(RECORD_ID);
      expect(results).toEqual([
        expect.objectContaining({ recordId: RECORD_ID, subjectId: SUBJECT, reason: 'privacy' }),
      ]);
    });
  });

  describe('getAllIncomingRequests', () => {
    it('throws when not authenticated', async () => {
      await expect(SubjectQueryService.getAllIncomingRequests()).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('combines incoming consent and removal requests for the caller', async () => {
      setCaller(SUBJECT);
      await seedConsentRequest(RECORD_ID, SUBJECT, 'pending');
      await seedRemovalRequest(OTHER_RECORD_ID, SUBJECT, 'pending');

      const result = await SubjectQueryService.getAllIncomingRequests();
      expect(result.consentRequests).toHaveLength(1);
      expect(result.removalRequests).toHaveLength(1);
    });
  });

  describe('getRecordAlerts', () => {
    it('returns all-empty defaults when not authenticated', async () => {
      const result = await SubjectQueryService.getRecordAlerts(RECORD_ID);
      expect(result).toEqual({
        hasPendingRequest: false,
        hasRemovalRequest: false,
        removalRequest: null,
        pendingConsentRequests: [],
        pendingRemovalRequests: [],
        pendingRejectionResponses: [],
      });
    });

    it("combines the caller's own alerts with record-wide pending requests", async () => {
      setCaller(SUBJECT);
      await seedConsentRequest(RECORD_ID, SUBJECT, 'pending');
      await seedRemovalRequest(RECORD_ID, SUBJECT, 'pending', { reason: 'wrong person' });

      const result = await SubjectQueryService.getRecordAlerts(RECORD_ID);

      expect(result.hasPendingRequest).toBe(true);
      expect(result.hasRemovalRequest).toBe(true);
      expect(result.removalRequest).toEqual(
        expect.objectContaining({ recordId: RECORD_ID, reason: 'wrong person' })
      );
      expect(result.pendingConsentRequests).toHaveLength(1);
      expect(result.pendingRemovalRequests).toHaveLength(1);
    });
  });
});
