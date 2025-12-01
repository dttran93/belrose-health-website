// src/services/userService.ts
import { doc, setDoc, getDoc, updateDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { BelroseUserProfile } from '@/types/core';

export class UserService {
  /**
   * Create a new user document in Firestore after registration
   */
  static async createUserDocument(user: FirebaseUser): Promise<void> {
    const db = getFirestore();
    const userRef = doc(db, 'users', user.uid);

    // Check if document already exists
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      console.log('User document already exists for:', user.uid);

      // Update email verification status
      await updateDoc(userRef, {
        emailVerified: user.emailVerified,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    // parse displayName to get firstName and lastName
    const nameParts = (user.displayName || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const userData: Partial<BelroseUserProfile> = {
      uid: user.uid,
      email: user.email || '',
      emailVerified: user.emailVerified,
      displayName: user.displayName || '',
      firstName: firstName || '',
      lastName: lastName || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      preferences: {
        blockchainVerificationEnabled: true,
        autoConnectWallet: false,
      },
    };

    try {
      await setDoc(userRef, userData);
      console.log('User document created successfully for:', user.uid);
    } catch (error) {
      console.error('Error creating user document:', error);
      throw new Error('Failed to create user profile');
    }
  }

  /**
   * Update email verification status
   */
  static async updateEmailVerificationStatus(uid: string, verified: boolean): Promise<void> {
    const db = getFirestore();
    const userRef = doc(db, 'users', uid);

    try {
      await updateDoc(userRef, {
        emailVerified: verified,
        emailVerifiedAt: verified ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
      console.log('Email verification status updated for:', uid);
    } catch (error) {
      console.error('Error updating email verification status:', error);
      throw error;
    }
  }

  /**
   * Get user profile from Firestore
   */
  static async getUserProfile(uid: string): Promise<BelroseUserProfile | null> {
    const db = getFirestore();
    const userRef = doc(db, 'users', uid);

    try {
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        return userDoc.data() as BelroseUserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw new Error('Failed to get user profile');
    }
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(uid: string, updates: Partial<BelroseUserProfile>): Promise<void> {
    const db = getFirestore();
    const userRef = doc(db, 'users', uid);

    try {
      await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      console.log('User profile updated successfully for:', uid);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('Failed to update user profile');
    }
  }

  /**
   * Check if user document exists
   */
  static async userDocumentExists(uid: string): Promise<boolean> {
    const db = getFirestore();
    const userRef = doc(db, 'users', uid);

    try {
      const userDoc = await getDoc(userRef);
      return userDoc.exists();
    } catch (error) {
      console.error('Error checking user document:', error);
      return false;
    }
  }
}
