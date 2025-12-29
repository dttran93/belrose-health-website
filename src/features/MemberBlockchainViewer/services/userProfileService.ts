// src/features/MemberManagement/services/userProfileService.ts

import { collection, query, where, getDocs, getFirestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import type { FirebaseUserProfile, UserProfile } from '../lib/types';

/**
 * Service for fetching user profiles from Firebase Firestore
 */

const db = getFirestore(getApp());

/**
 * Fetch a user profile by their on-chain userIdHash
 *
 * @param userIdHash - The on-chain identity hash (bytes32)
 * @returns The Firebase user profile or null if not found
 */
export async function getProfileByUserIdHash(
  userIdHash: string
): Promise<FirebaseUserProfile | null> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('onChainIdentity.userIdHash', '==', userIdHash));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(`No Firebase profile found for ${userIdHash}`);
      return null;
    }

    const doc = snapshot.docs[0];

    if (!doc || !doc.exists()) {
      console.log(`No Firebase profile found for ${userIdHash}`);
      return null;
    }

    return { uid: doc.id, ...doc.data() } as FirebaseUserProfile;
  } catch (error) {
    console.error(`Failed to fetch Firebase profile for ${userIdHash}:`, error);
    return null;
  }
}

/**
 * Fetch multiple user profiles by their userIdHashes
 * More efficient than calling getProfileByUserIdHash in a loop
 *
 * @param userIdHashes - Array of on-chain identity hashes
 * @returns Map of userIdHash to profile
 */
export async function getProfilesByUserIdHashes(
  userIdHashes: string[]
): Promise<Map<string, FirebaseUserProfile>> {
  const profileMap = new Map<string, FirebaseUserProfile>();

  if (userIdHashes.length === 0) return profileMap;

  try {
    // Firestore 'in' queries are limited to 30 items, so we batch
    const batchSize = 30;
    const batches: string[][] = [];

    for (let i = 0; i < userIdHashes.length; i += batchSize) {
      batches.push(userIdHashes.slice(i, i + batchSize));
    }

    const usersRef = collection(db, 'users');

    await Promise.all(
      batches.map(async batch => {
        const q = query(usersRef, where('onChainIdentity.userIdHash', 'in', batch));
        const snapshot = await getDocs(q);

        snapshot.docs.forEach(doc => {
          const data = doc.data() as FirebaseUserProfile;
          const hash = data.onChainIdentity?.userIdHash;
          if (hash) {
            profileMap.set(hash, { ...data, uid: doc.id });
          }
        });
      })
    );

    console.log(`📋 Fetched ${profileMap.size}/${userIdHashes.length} Firebase profiles`);
    return profileMap;
  } catch (error) {
    console.error('Failed to batch fetch Firebase profiles:', error);
    return profileMap;
  }
}

/**
 * Transform a FirebaseUserProfile into a simplified UserProfile
 */
export function transformToUserProfile(fbProfile: FirebaseUserProfile): UserProfile {
  return {
    uid: fbProfile.uid,
    displayName:
      fbProfile.displayName ||
      `${fbProfile.firstName || ''} ${fbProfile.lastName || ''}`.trim() ||
      'Unknown',
    email: fbProfile.email || '',
    emailVerified: fbProfile.emailVerified || false,
    identityVerified: fbProfile.identityVerified || false,
  };
}
