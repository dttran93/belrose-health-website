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
  deleteField,
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

  // Controller trustee variant: includes a `controllerAnchorFor` proof field so the
  // Firestore security rule can verify the specific trustee relationship without needing
  // to compute an array diff (which rules cannot do). The field is cleaned up immediately
  // after; if cleanup fails it persists harmlessly as metadata.
  static async addSubjectAsController(recordId: string, subjectId: string): Promise<void> {
    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);

    await updateDoc(recordRef, {
      subjects: arrayUnion(subjectId),
      controllerAnchorFor: subjectId,
      lastModified: serverTimestamp(),
    });

    try {
      await updateDoc(recordRef, { controllerAnchorFor: deleteField() });
    } catch {
      // Non-fatal — field persists as benign metadata
    }
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
