// src/services/userService.ts
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  getFirestore,
  serverTimestamp 
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserProfile } from '@/types/core';

export class UserService {
  /**
   * Create a new user document in Firestore after registration
   */
  static async createUserDocument(user: User): Promise<void> {
    const db = getFirestore();
    const userRef = doc(db, 'users', user.uid);

    // Check if document already exists
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      console.log('User document already exists for:', user.uid);
      return;
    }

    const userData: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      preferences: {
        blockchainVerificationEnabled: true,
        autoConnectWallet: false
      }
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
   * Get user profile from Firestore
   */
  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    const db = getFirestore();
    const userRef = doc(db, 'users', uid);

    try {
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile;
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
  static async updateUserProfile(
    uid: string, 
    updates: Partial<UserProfile>
  ): Promise<void> {
    const db = getFirestore();
    const userRef = doc(db, 'users', uid);

    try {
      await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp()
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