// src/services/authService.ts
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  FacebookAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  UserCredential,
  Unsubscribe
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { UserService } from './userService';

const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();
const githubProvider = new GithubAuthProvider();

export interface AuthError {
  code: string;
  message: string;
}

export const authService = {
  /**
   * Sign up with email and password
   */
  signUp: async (email: string, password: string, displayName?: string): Promise<User> => {
    try {
      const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }

      // Create Firestore user document
      await UserService.createUserDocument(userCredential.user);
      
      console.log('User registered and profile created successfully');
      return userCredential.user;
    } catch (error) {
      console.error('Sign up failed:', error);
      throw error;
    }
  },

  /**
   * Sign in with email and password
   */
  signIn: async (email: string, password: string): Promise<User> => {
    try {
      const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Ensure user document exists (safety net for existing users)
      await UserService.createUserDocument(userCredential.user);
      
      return userCredential.user;
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  },

  /**
   * Sign in with Google
   */
  signInWithGoogle: async (): Promise<User> => {
    try {
      const result: UserCredential = await signInWithPopup(auth, googleProvider);
      
      // Create or update user document for social login
      await UserService.createUserDocument(result.user);
      
      return result.user;
    } catch (error) {
      console.error('Google sign in failed:', error);
      throw error;
    }
  },

  /**
   * Sign in with Facebook
   */
  signInWithFacebook: async (): Promise<User> => {
    try {
      const result: UserCredential = await signInWithPopup(auth, facebookProvider);
      
      // Create or update user document for social login
      await UserService.createUserDocument(result.user);
      
      return result.user;
    } catch (error) {
      console.error('Facebook sign in failed:', error);
      throw error;
    }
  },

  /**
   * Sign in with GitHub
   */
  signInWithGitHub: async (): Promise<User> => {
    try {
      const result: UserCredential = await signInWithPopup(auth, githubProvider);
      
      // Create or update user document for social login
      await UserService.createUserDocument(result.user);
      
      return result.user;
    } catch (error) {
      console.error('GitHub sign in failed:', error);
      throw error;
    }
  },

  /**
   * Get current authenticated user
   */
  getCurrentUser: (): User | null => {
    return auth.currentUser;
  },

  /**
   * Listen for auth state changes
   */
  onAuthStateChanged: (callback: (user: User | null) => void): Unsubscribe => {
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Sign out method
   */
  signOut: async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  },

  /**
   * Reset password
   */
  resetPassword: async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset failed:', error);
      throw error;
    }
  },

  /**
   * Get user token for API calls
   */
  getToken: async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (user) {
      try {
        return await user.getIdToken();
      } catch (error) {
        console.error('Failed to get token:', error);
        return null;
      }
    }
    return null;
  },

  /**
   * Update user profile
   */
  updateUserProfile: async (updates: {
    displayName?: string;
    photoURL?: string;
  }): Promise<void> => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }

    try {
      await updateProfile(user, updates);
      
      // Also update Firestore document
      if (updates.displayName) {
        await UserService.updateUserProfile(user.uid, {
          displayName: updates.displayName
        });
      }
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  },

  /**
   * Check if user is signed in
   */
  isSignedIn: (): boolean => {
    return !!auth.currentUser;
  },

  /**
   * Get user ID
   */
  getCurrentUserId: (): string | null => {
    return auth.currentUser?.uid || null;
  },

  /**
   * Get user email
   */
  getCurrentUserEmail: (): string | null => {
    return auth.currentUser?.email || null;
  },

  /**
   * Wait for auth to initialize
   */
  waitForAuth: (): Promise<User | null> => {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }
};