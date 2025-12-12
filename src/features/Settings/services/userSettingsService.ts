// src/features/Settings/services/userSettingsService.ts

import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  getAuth,
  updateEmail,
  updateProfile,
  sendEmailVerification,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { BelroseUserProfile } from '@/types/core';

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
   * Requires re-authentication and will reset email verification status
   */
  static async updateEmail(uid: string, newEmail: string, currentPassword: string): Promise<void> {
    const auth = getAuth();
    const db = getFirestore();
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

      // Update email in Firebase Auth
      await updateEmail(user, newEmail);

      // Send verification email to new address
      await sendEmailVerification(user);

      // Update Firestore document
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        email: newEmail,
        emailVerified: false,
        emailVerifiedAt: null,
        updatedAt: serverTimestamp(),
      });

      console.log('Email updated successfully, verification email sent');
    } catch (error: any) {
      console.error('Error updating email:', error);

      // Handle specific Firebase errors
      if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password');
      } else if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email is already in use by another account');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address');
      } else if (error.code === 'auth/requires-recent-login') {
        throw new Error('Please log out and log back in before changing your email');
      }

      throw new Error(error.message || 'Failed to update email');
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
