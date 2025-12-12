// src/features/Settings/services/userSettingsService.ts

import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  getAuth,
  verifyBeforeUpdateEmail,
  updateProfile,
  sendEmailVerification,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';

/**
 * Service for updating user settings/profile data
 */
export class UserSettingsService {
  /**
   * Update user's name (firstName, lastName, displayName)
   * Updates both Firebase Auth profile and Firestore document
   */
  static async updateName(uid: string, firstName: string, lastName: string): Promise<void> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user || user.uid !== uid) {
      throw new Error('User not authenticated or UID mismatch');
    }

    const displayName = `${firstName} ${lastName}`.trim();

    // Validate
    if (!firstName.trim()) {
      throw new Error('First name is required');
    }
    if (!lastName.trim()) {
      throw new Error('Last name is required');
    }

    try {
      // Update Firebase Auth profile
      await updateProfile(user, { displayName });

      // Update Firestore document
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName,
        updatedAt: serverTimestamp(),
      });

      console.log('Name updated successfully');
    } catch (error) {
      console.error('Error updating name:', error);
      throw new Error('Failed to update name');
    }
  }

  /**
   * Update user's email address
   *
   * Firebase flow:
   * 1. Re-authenticate user
   * 2. Send verification email to NEW address via verifyBeforeUpdateEmail()
   * 3. User clicks link in new email
   * 4. Firebase automatically updates the email after verification
   * 5. Sync Firestore separately (via auth state listener)
   *
   * Update of email requires user to verify new address
   * */
  static async updateEmail(uid: string, newEmail: string, currentPassword: string): Promise<void> {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user || user.uid !== uid) {
      throw new Error('User not authenticated or UID mismatch');
    }

    if (!user.email) {
      throw new Error('Current user has no email');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new Error('Invalid email format');
    }

    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      throw new Error('New email is the same as current email');
    }

    try {
      // Re-authenticate user first (required for sensitive operations)
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      //Send verification email to new email
      await verifyBeforeUpdateEmail(user, newEmail);
      console.log('Verification email sent to new address. Email will update after verification.');
    } catch (error: any) {
      console.error('Error initiate email change:', error);

      // Handle specific Firebase errors
      if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password');
      } else if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email is already in use by another account');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address');
      } else if (error.code === 'auth/requires-recent-login') {
        throw new Error('Please log out and log back in before changing your email');
      } else if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Email change not allowed. Please contact support.');
      }

      throw new Error(error.message || 'Failed to update email');
    }
  }

  /**
   * Sync email from Firebase Auth to Firestore
   * Call this when you detect the email has changed (e.g., in auth state listener)
   */
  static async syncEmailToFirestore(
    uid: string,
    newEmail: string,
    isVerified: boolean
  ): Promise<void> {
    const db = getFirestore();

    try {
      // Update Firestore document
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        email: newEmail,
        emailVerified: isVerified,
        emailVerifiedAt: isVerified ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });

      console.log('Email synced to Firestore:', newEmail);
    } catch (error: any) {
      console.error('Error syncing email to Firestore:', error);
      throw new Error('Failed to sync email to database');
    }
  }

  /**
   * Update user's profile photo URL
   */
  static async updateProfilePhoto(uid: string, photoURL: string | null): Promise<void> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user || user.uid !== uid) {
      throw new Error('User not authenticated or UID mismatch');
    }

    try {
      // Update Firebase Auth profile
      await updateProfile(user, { photoURL });

      // Update Firestore document
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        photoURL,
        updatedAt: serverTimestamp(),
      });

      console.log('Profile photo updated successfully');
    } catch (error) {
      console.error('Error updating profile photo:', error);
      throw new Error('Failed to update profile photo');
    }
  }

  /**
   * Resend email verification
   */
  static async resendEmailVerification(): Promise<void> {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    if (user.emailVerified) {
      throw new Error('Email is already verified');
    }

    try {
      await sendEmailVerification(user);
      console.log('Verification email sent');
    } catch (error: any) {
      console.error('Error sending verification email:', error);

      if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many requests. Please wait before trying again.');
      }

      throw new Error('Failed to send verification email');
    }
  }
}
