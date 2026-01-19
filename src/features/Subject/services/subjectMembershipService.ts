//src/features/Subject/services/subjectMembershipService.ts

/**
 * This service manages subject array for records
 * - Checking if a user is a subject
 * - Adding subjects after consent acceptance
 * - Removing a subject
 */

import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

export class SubjectMembershipService {
  // ============================================================================
  // CHECK
  // ============================================================================

  static async isSubject(recordId: string, subjectId: string): Promise<boolean> {
    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);
    const recordDoc = await getDoc(recordRef);

    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    const subjects: string[] = recordDoc.data().subjects || [];
    return subjects.includes(subjectId);
  }

  // ============================================================================
  // ADD / REMOVE
  // ============================================================================

  static async addSubject(recordId: string, subjectId: string): Promise<void> {
    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);

    await updateDoc(recordRef, {
      subjects: arrayUnion(subjectId),
      lastModified: serverTimestamp(),
    });
  }

  static async removeSubject(recordId: string, subjectId: string): Promise<void> {
    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);

    await updateDoc(recordRef, {
      subjects: arrayRemove(subjectId),
      lastModified: serverTimestamp(),
    });
  }
}

export default SubjectMembershipService;
