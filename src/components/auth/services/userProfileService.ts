import { getFirestore, doc, getDoc, DocumentData } from 'firebase/firestore';

// Type for user profile data
export interface UserProfile {
  uid: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  affiliations?: string[];
  createdAt?: any;
  // Add any other fields you have in your user documents
}

/**
 * In-memory cache for user profiles to reduce database calls
 * Cache expires after 5 minutes
 */
const userCache = new Map<string, { data: UserProfile; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Fetch a user's profile information by their userId
 * Uses caching to reduce database calls
 *
 * @param userId - The Firebase Auth UID of the user
 * @param forceRefresh - Skip cache and fetch fresh data
 * @returns UserProfile or null if user not found
 */
export async function getUserProfile(
  userId: string,
  forceRefresh: boolean = false
): Promise<UserProfile | null> {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = userCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
  }

  try {
    const db = getFirestore();
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.warn(`User profile not found for userId: ${userId}`);
      return null;
    }

    const userData = userDoc.data() as UserProfile;
    const profile: UserProfile = {
      uid: userId,
      displayName: userData.displayName || 'Unknown User',
      email: userData.email,
      photoURL: userData.photoURL,
      affiliations: userData.affiliations || [],
      createdAt: userData.createdAt,
    };

    // Store in cache
    userCache.set(userId, {
      data: profile,
      timestamp: Date.now(),
    });

    return profile;
  } catch (error) {
    console.error(`Error fetching user profile for ${userId}:`, error);
    return null;
  }
}

/**
 * Fetch multiple user profiles at once
 * More efficient than calling getUserProfile multiple times
 *
 * @param userIds - Array of Firebase Auth UIDs
 * @returns Map of userId to UserProfile
 */
export async function getUserProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
  const profiles = new Map<string, UserProfile>();

  // Use Promise.all to fetch all profiles in parallel
  const results = await Promise.all(
    userIds.map(async userId => {
      const profile = await getUserProfile(userId);
      return { userId, profile };
    })
  );

  // Build the map
  results.forEach(({ userId, profile }) => {
    if (profile) {
      profiles.set(userId, profile);
    }
  });

  return profiles;
}

/**
 * Get just the display name for a user (convenience function)
 * Falls back to userId if no display name is set
 *
 * @param userId - The Firebase Auth UID
 * @returns Display name or userId as fallback
 */
export async function getUserDisplayName(userId: string): Promise<string> {
  const profile = await getUserProfile(userId);
  return profile?.displayName || userId;
}

/**
 * Clear the user cache (useful when you know a user updated their profile)
 *
 * @param userId - Optional. If provided, only clears that user. Otherwise clears all.
 */
export function clearUserCache(userId?: string): void {
  if (userId) {
    userCache.delete(userId);
  } else {
    userCache.clear();
  }
}

/**
 * Preload user profiles into cache (useful for lists of users)
 *
 * @param userIds - Array of user IDs to preload
 */
export async function preloadUserProfiles(userIds: string[]): Promise<void> {
  await getUserProfiles(userIds);
}
