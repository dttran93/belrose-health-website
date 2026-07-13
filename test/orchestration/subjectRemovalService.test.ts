// test/orchestration/subjectRemovalService.test.ts
//
// Layer 3 (orchestration) — SubjectRemovalService: the owner/admin-initiated "please remove
// yourself as subject" request flow. Real Firestore emulator + the real SubjectPermissionService
// (already unit-tested) underneath; only firebase/auth is mocked.

import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { deleteApp, getApps } from 'firebase/app';
import { connectTestFirestore, clearTestFirestore, seedRecord } from './helpers/testFirestore';

const { mockCurrentUser } = vi.hoisted(() => ({
  mockCurrentUser: { uid: null as string | null },
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: mockCurrentUser.uid ? { uid: mockCurrentUser.uid } : null }),
}));

import {
  SubjectRemovalService,
  getRemovalRequestId,
} from '../../src/features/Subject/services/subjectRemovalService';

const RECORD_ID = 'subject-removal-record';
const SUBJECT = 'subject-removal-subject';
const OWNER = 'subject-removal-owner';
const ADMIN = 'subject-removal-admin';
const STRANGER = 'subject-removal-stranger';

function setCaller(uid: string | null) {
  mockCurrentUser.uid = uid;
}

const db = connectTestFirestore('belrose-orchestration-subject-removal');

async function seedRemovalRequest(status: string, overrides: Record<string, unknown> = {}) {
  await setDoc(doc(db, 'subjectRemovalRequests', getRemovalRequestId(RECORD_ID, SUBJECT)), {
    recordId: RECORD_ID,
    subjectId: SUBJECT,
    requestedBy: OWNER,
    reason: '',
    status,
    createdAt: new Date(),
    ...overrides,
  });
}

describe('SubjectRemovalService (orchestration)', () => {
  beforeEach(async () => {
    await clearTestFirestore();
    setCaller(null);
  });

  afterAll(() => {
    getApps().forEach(app => deleteApp(app));
  });

  describe('requestRemoval', () => {
    it('throws when not authenticated', async () => {
      await expect(SubjectRemovalService.requestRemoval(RECORD_ID, SUBJECT)).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('throws when requesting removal of yourself', async () => {
      setCaller(OWNER);
      await expect(SubjectRemovalService.requestRemoval(RECORD_ID, OWNER)).rejects.toThrow(
        'Use rejectSubjectStatus to remove yourself as a subject'
      );
    });

    it('throws when the record does not exist', async () => {
      setCaller(OWNER);
      await expect(SubjectRemovalService.requestRemoval(RECORD_ID, SUBJECT)).rejects.toThrow(
        'Record not found'
      );
    });

    it('denies a caller who cannot remove subjects (admin while an owner still exists)', async () => {
      await seedRecord(db, RECORD_ID, { owners: [OWNER], administrators: [ADMIN], subjects: [SUBJECT] });
      setCaller(ADMIN);

      await expect(SubjectRemovalService.requestRemoval(RECORD_ID, SUBJECT)).rejects.toThrow(
        'You do not have permission to request subject removal'
      );
    });

    it('throws when the target is not actually a subject of the record', async () => {
      await seedRecord(db, RECORD_ID, { owners: [OWNER] });
      setCaller(OWNER);

      await expect(SubjectRemovalService.requestRemoval(RECORD_ID, SUBJECT)).rejects.toThrow(
        'This user is not a subject of this record'
      );
    });

    it('throws when a pending removal request already exists', async () => {
      await seedRecord(db, RECORD_ID, { owners: [OWNER], subjects: [SUBJECT] });
      await seedRemovalRequest('pending');
      setCaller(OWNER);

      await expect(SubjectRemovalService.requestRemoval(RECORD_ID, SUBJECT)).rejects.toThrow(
        'A pending removal request already exists for this subject'
      );
    });

    it('creates a removal request with defaults for reason and recordTitle', async () => {
      await seedRecord(db, RECORD_ID, { owners: [OWNER], subjects: [SUBJECT] });
      setCaller(OWNER);

      const result = await SubjectRemovalService.requestRemoval(RECORD_ID, SUBJECT);

      expect(result).toEqual({
        success: true,
        recordId: RECORD_ID,
        subjectId: SUBJECT,
        requestId: getRemovalRequestId(RECORD_ID, SUBJECT),
      });

      const snap = await getDoc(doc(db, 'subjectRemovalRequests', result.requestId));
      const data = snap.data()!;
      expect(data.status).toBe('pending');
      expect(data.requestedBy).toBe(OWNER);
      expect(data.reason).toBe('');
      expect(data.recordTitle).toBe(`Record ${RECORD_ID.slice(0, 8)}...`);
    });

    it('uses the provided reason and recordTitle when given', async () => {
      await seedRecord(db, RECORD_ID, { owners: [OWNER], subjects: [SUBJECT] });
      setCaller(OWNER);

      await SubjectRemovalService.requestRemoval(RECORD_ID, SUBJECT, 'wrong person', 'Lab Results');

      const snap = await getDoc(
        doc(db, 'subjectRemovalRequests', getRemovalRequestId(RECORD_ID, SUBJECT))
      );
      expect(snap.data()?.reason).toBe('wrong person');
      expect(snap.data()?.recordTitle).toBe('Lab Results');
    });

    it('allows an administrator to request removal once there are no owners', async () => {
      await seedRecord(db, RECORD_ID, { owners: [], administrators: [ADMIN], subjects: [SUBJECT] });
      setCaller(ADMIN);

      const result = await SubjectRemovalService.requestRemoval(RECORD_ID, SUBJECT);
      expect(result.success).toBe(true);
    });

    it('allows a fresh request once a previous one was already accepted', async () => {
      await seedRecord(db, RECORD_ID, { owners: [OWNER], subjects: [SUBJECT] });
      await seedRemovalRequest('accepted');
      setCaller(OWNER);

      const result = await SubjectRemovalService.requestRemoval(RECORD_ID, SUBJECT);
      expect(result.success).toBe(true);
    });
  });

  describe('cancelRequest', () => {
    it('throws when not authenticated', async () => {
      await expect(SubjectRemovalService.cancelRequest(RECORD_ID, SUBJECT)).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('throws when no removal request exists', async () => {
      setCaller(OWNER);
      await expect(SubjectRemovalService.cancelRequest(RECORD_ID, SUBJECT)).rejects.toThrow(
        'No removal request found'
      );
    });

    it('throws when the request is not pending', async () => {
      await seedRecord(db, RECORD_ID, { owners: [OWNER] });
      await seedRemovalRequest('accepted');
      setCaller(OWNER);

      await expect(SubjectRemovalService.cancelRequest(RECORD_ID, SUBJECT)).rejects.toThrow(
        'Request has already been accepted'
      );
    });

    it('denies a caller who is neither the original requester nor able to manage the record', async () => {
      await seedRecord(db, RECORD_ID, { owners: [OWNER] });
      await seedRemovalRequest('pending', { requestedBy: OWNER });
      setCaller(STRANGER);

      await expect(SubjectRemovalService.cancelRequest(RECORD_ID, SUBJECT)).rejects.toThrow(
        'You do not have permission to cancel this request'
      );
    });

    it('allows the original requester to cancel', async () => {
      await seedRecord(db, RECORD_ID, { owners: [OWNER], administrators: [ADMIN] });
      await seedRemovalRequest('pending', { requestedBy: ADMIN });
      setCaller(ADMIN);

      const result = await SubjectRemovalService.cancelRequest(RECORD_ID, SUBJECT);
      expect(result.success).toBe(true);

      const snap = await getDoc(
        doc(db, 'subjectRemovalRequests', getRemovalRequestId(RECORD_ID, SUBJECT))
      );
      expect(snap.exists()).toBe(false);
    });

    it("allows an owner to cancel someone else's request", async () => {
      await seedRecord(db, RECORD_ID, { owners: [OWNER], administrators: [ADMIN] });
      await seedRemovalRequest('pending', { requestedBy: ADMIN });
      setCaller(OWNER);

      const result = await SubjectRemovalService.cancelRequest(RECORD_ID, SUBJECT);
      expect(result.success).toBe(true);
    });
  });

  describe('acceptRemoval', () => {
    it('throws when not authenticated', async () => {
      await expect(SubjectRemovalService.acceptRemoval(RECORD_ID)).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('throws when there is no removal request for the caller', async () => {
      setCaller(SUBJECT);
      await expect(SubjectRemovalService.acceptRemoval(RECORD_ID)).rejects.toThrow(
        'No removal request found for you'
      );
    });

    it('throws when the request is not pending', async () => {
      await seedRemovalRequest('rejected');
      setCaller(SUBJECT);

      await expect(SubjectRemovalService.acceptRemoval(RECORD_ID)).rejects.toThrow(
        'Request has already been rejected'
      );
    });

    it('accepts a pending request', async () => {
      await seedRemovalRequest('pending');
      setCaller(SUBJECT);

      const result = await SubjectRemovalService.acceptRemoval(RECORD_ID);
      expect(result.success).toBe(true);
      expect(result.requestData.status).toBe('accepted');

      const snap = await getDoc(
        doc(db, 'subjectRemovalRequests', getRemovalRequestId(RECORD_ID, SUBJECT))
      );
      expect(snap.data()?.status).toBe('accepted');
      expect(snap.data()?.respondedAt).toBeDefined();
    });
  });

  describe('rejectRemoval', () => {
    it('throws when not authenticated', async () => {
      await expect(SubjectRemovalService.rejectRemoval(RECORD_ID)).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('throws when there is no removal request for the caller', async () => {
      setCaller(SUBJECT);
      await expect(SubjectRemovalService.rejectRemoval(RECORD_ID)).rejects.toThrow(
        'No removal request found for you'
      );
    });

    it('throws when the request is not pending', async () => {
      await seedRemovalRequest('accepted');
      setCaller(SUBJECT);

      await expect(SubjectRemovalService.rejectRemoval(RECORD_ID)).rejects.toThrow(
        'Request has already been accepted'
      );
    });

    it('rejects a pending request with a response message', async () => {
      await seedRemovalRequest('pending');
      setCaller(SUBJECT);

      const result = await SubjectRemovalService.rejectRemoval(RECORD_ID, 'I disagree');
      expect(result.success).toBe(true);

      const snap = await getDoc(
        doc(db, 'subjectRemovalRequests', getRemovalRequestId(RECORD_ID, SUBJECT))
      );
      expect(snap.data()?.status).toBe('rejected');
      expect(snap.data()?.subjectResponse).toBe('I disagree');
      expect(snap.data()?.respondedAt).toBeDefined();
    });
  });
});
