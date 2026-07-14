// test/orchestration/subjectMembershipService.test.ts
//
// Layer 3 (orchestration) — SubjectMembershipService. Real Firestore emulator, no mocking at
// all: this service has no auth checks and no cross-service calls, just reads/writes on the
// record's `subjects` array.

import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { doc, getDoc } from 'firebase/firestore';
import { deleteApp, getApps } from 'firebase/app';
import { connectTestFirestore, clearTestFirestore, seedRecord } from './helpers/testFirestore';
import { SubjectMembershipService } from '../../src/features/Subject/services/subjectMembershipService';

const RECORD_ID = 'subject-membership-record';
const SUBJECT = 'subject-membership-subject';
const OTHER_SUBJECT = 'subject-membership-other-subject';

const db = connectTestFirestore('belrose-orchestration-subject-membership');

describe('SubjectMembershipService (orchestration)', () => {
  beforeEach(async () => {
    await clearTestFirestore();
  });

  afterAll(() => {
    getApps().forEach(app => deleteApp(app));
  });

  describe('isSubject', () => {
    it('throws when the record does not exist', async () => {
      await expect(SubjectMembershipService.isSubject(RECORD_ID, SUBJECT)).rejects.toThrow(
        'Record not found'
      );
    });

    it('returns true when the user is in the subjects array', async () => {
      await seedRecord(db, RECORD_ID, { subjects: [SUBJECT] });
      await expect(SubjectMembershipService.isSubject(RECORD_ID, SUBJECT)).resolves.toBe(true);
    });

    it('returns false when the user is not in the subjects array', async () => {
      await seedRecord(db, RECORD_ID, { subjects: [OTHER_SUBJECT] });
      await expect(SubjectMembershipService.isSubject(RECORD_ID, SUBJECT)).resolves.toBe(false);
    });
  });

  describe('addSubject', () => {
    it('adds the user to the subjects array and stamps lastModified', async () => {
      await seedRecord(db, RECORD_ID, {});
      await SubjectMembershipService.addSubject(RECORD_ID, SUBJECT);

      const snap = await getDoc(doc(db, 'records', RECORD_ID));
      expect(snap.data()?.subjects).toEqual([SUBJECT]);
      expect(snap.data()?.lastModified).toBeDefined();
    });

    it('is idempotent — adding the same subject twice does not duplicate them', async () => {
      await seedRecord(db, RECORD_ID, { subjects: [SUBJECT] });
      await SubjectMembershipService.addSubject(RECORD_ID, SUBJECT);

      const snap = await getDoc(doc(db, 'records', RECORD_ID));
      expect(snap.data()?.subjects).toEqual([SUBJECT]);
    });

    it('preserves existing subjects when adding another', async () => {
      await seedRecord(db, RECORD_ID, { subjects: [OTHER_SUBJECT] });
      await SubjectMembershipService.addSubject(RECORD_ID, SUBJECT);

      const snap = await getDoc(doc(db, 'records', RECORD_ID));
      expect(snap.data()?.subjects).toEqual(expect.arrayContaining([OTHER_SUBJECT, SUBJECT]));
      expect(snap.data()?.subjects).toHaveLength(2);
    });
  });

  describe('addSubjectAsController', () => {
    it('adds the user to subjects and leaves no controllerAnchorFor field behind', async () => {
      await seedRecord(db, RECORD_ID, {});
      await SubjectMembershipService.addSubjectAsController(RECORD_ID, SUBJECT);

      const snap = await getDoc(doc(db, 'records', RECORD_ID));
      expect(snap.data()?.subjects).toEqual([SUBJECT]);
      expect(snap.data()?.controllerAnchorFor).toBeUndefined();
    });
  });

  describe('removeSubject', () => {
    it('removes the user from the subjects array and stamps lastModified', async () => {
      await seedRecord(db, RECORD_ID, { subjects: [SUBJECT, OTHER_SUBJECT] });
      await SubjectMembershipService.removeSubject(RECORD_ID, SUBJECT);

      const snap = await getDoc(doc(db, 'records', RECORD_ID));
      expect(snap.data()?.subjects).toEqual([OTHER_SUBJECT]);
      expect(snap.data()?.lastModified).toBeDefined();
    });

    it('is a no-op when the user is not in the subjects array', async () => {
      await seedRecord(db, RECORD_ID, { subjects: [OTHER_SUBJECT] });
      await SubjectMembershipService.removeSubject(RECORD_ID, SUBJECT);

      const snap = await getDoc(doc(db, 'records', RECORD_ID));
      expect(snap.data()?.subjects).toEqual([OTHER_SUBJECT]);
    });
  });
});
