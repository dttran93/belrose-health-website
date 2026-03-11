import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  startAt,
  endAt,
  limit,
  getDocs,
  where,
} from 'firebase/firestore';
import { BelroseUserProfile } from '@/types/core';
import { getAuth } from 'firebase/auth';
import { TrusteeRelationshipService } from '@/features/Trustee/services/trusteeRelationshipService';

// ============================================================================
// CACHE
// ============================================================================

const userCache = new Map<string, { data: BelroseUserProfile; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

export async function getUserProfile(
  userId: string,
  forceRefresh: boolean = false
): Promise<BelroseUserProfile | null> {
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

    const userData = userDoc.data() as BelroseUserProfile;
    const profile: BelroseUserProfile = {
      uid: userId,
      firstName: userData.firstName,
      lastName: userData.lastName,
      updatedAt: userData.updatedAt,
      wallet: userData.wallet,
      emailVerified: userData.emailVerified,
      emailVerifiedAt: userData.emailVerifiedAt,
      identityVerified: userData.identityVerified,
      identityVerifiedAt: userData.identityVerifiedAt,
      displayName: userData.displayName || 'Unknown User',
      email: userData.email,
      photoURL: userData.photoURL,
      affiliations: userData.affiliations || [],
      createdAt: userData.createdAt,
      encryption: userData.encryption,
      onChainIdentity: userData.onChainIdentity,
      searchDiscoverable: userData.searchDiscoverable ?? false,
    };

    userCache.set(userId, { data: profile, timestamp: Date.now() });
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
export async function getUserProfiles(userIds: string[]): Promise<Map<string, BelroseUserProfile>> {
  const profiles = new Map<string, BelroseUserProfile>();

  // Use Promise.all to fetch all profiles in parallel
  const results = await Promise.all(
    userIds.map(async userId => ({ userId, profile: await getUserProfile(userId) }))
  );

  // Build the map
  results.forEach(({ userId, profile }) => {
    if (profile) profiles.set(userId, profile);
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

// ============================================================================
// SEARCH FUNCTION
// ============================================================================

export type SearchType = 'all' | 'id' | 'email' | 'name';

const SEARCH_LIMIT = 10;

/**
 * Returns the set of UIDs that the current user has a 1st-degree connection with.
 * A connection is defined as:
 *   - An active trustee relationship (either direction)
 *   - A shared record (owners, administrators, viewers, subjects arrays)
 *
 * Used to determine whether a fuzzy search result should be shown even if
 * the target user has searchDiscoverable = false.
 *
 * Note: We intentionally do NOT use this to gate exact UID / exact email lookups —
 * those are "you already know this person" signals and always resolve.
 */
async function getFirstDegreeConnectionIds(currentUserId: string): Promise<Set<string>> {
  const db = getFirestore();
  const connectedIds = new Set<string>();

  // --- Trustee relationships (both directions) ---
  // "I am the trustor" and "I am the trustee"
  try {
    const [asTrustor, asTrustee] = await Promise.all([
      TrusteeRelationshipService.getTrusteesForTrustor(currentUserId),
      TrusteeRelationshipService.getTrustorAccountsForTrustee(),
    ]);

    asTrustor.forEach(r => connectedIds.add(r.trusteeId));
    asTrustee.forEach(r => connectedIds.add(r.trustorId));
  } catch (err) {
    console.warn('Could not fetch trustee connections for search filter:', err);
  }

  // --- Shared records ---
  // Find all records the current user is on, extract all other participants
  try {
    const recordsRef = collection(db, 'records');

    // We only need the role arrays, not the full record — but Firestore doesn't
    // support field projections in the web SDK, so we fetch and read the arrays.
    // Using a single 'or' query to keep this to one round-trip.
    const { or, where: firestoreWhere } = await import('firebase/firestore');
    const recordsQuery = query(
      recordsRef,
      or(
        firestoreWhere('owners', 'array-contains', currentUserId),
        firestoreWhere('administrators', 'array-contains', currentUserId),
        firestoreWhere('viewers', 'array-contains', currentUserId),
        firestoreWhere('subjects', 'array-contains', currentUserId),
        firestoreWhere('uploadedBy', '==', currentUserId)
      ),
      limit(200) // cap to avoid huge reads for very active users
    );
    const snapshot = await getDocs(recordsQuery);

    snapshot.docs.forEach(d => {
      const data = d.data();
      const allParticipants: string[] = [
        ...(data.owners || []),
        ...(data.administrators || []),
        ...(data.viewers || []),
        ...(data.subjects || []),
        ...(data.uploadedBy ? [data.uploadedBy] : []),
      ];
      allParticipants.forEach(uid => {
        if (uid !== currentUserId) connectedIds.add(uid);
      });
    });
  } catch (err) {
    console.warn('Could not fetch record connections for search filter:', err);
  }

  return connectedIds;
}

/**
 * Search users by name prefix, email prefix, or exact UID/email.
 *
 * PRIVACY MODEL:
 * ─────────────
 * "Always-on" lookups (you demonstrably know this person):
 *   - Exact UID match
 *   - Exact email match
 *
 * Connection-aware fuzzy search (name/email prefix):
 *   - Always returns results for 1st-degree connections (shared records, trustees)
 *   - Only returns other users if they have opted in via searchDiscoverable = true
 *
 * Explicitly excluded:
 *   - keccak hash lookup — the hash IS the on-chain public identifier and can
 *     be enumerated from the contract. Allowing hash → profile breaks the
 *     privacy boundary between on-chain and off-chain identity.
 *
 * @param searchQuery   The text the user typed
 * @param searchType    Which field(s) to search
 * @param currentUserId The logged-in user's UID (needed for connection filtering)
 */
export async function searchUsers(
  searchQuery: string,
  searchType: SearchType = 'all',
  currentUserId?: string
): Promise<BelroseUserProfile[]> {
  const db = getFirestore();
  const usersRef = collection(db, 'users');
  const q = searchQuery.trim().toLowerCase();
  const qEnd = q + '\uf8ff'; // high unicode boundary for prefix range queries

  const searchPromises: Promise<BelroseUserProfile[]>[] = [];

  // ── Exact UID lookup (always-on) ──────────────────────────────────────────
  if (searchType === 'all' || searchType === 'id') {
    searchPromises.push(getUserProfile(searchQuery.trim()).then(p => (p ? [p] : [])));
  }

  // ── Exact email lookup (always-on) ────────────────────────────────────────
  if (searchType === 'all' || searchType === 'email') {
    const exactEmailQuery = query(usersRef, where('email', '==', q), limit(1));
    searchPromises.push(
      getDocs(exactEmailQuery).then(snap =>
        snap.docs.map(d => ({ uid: d.id, ...d.data() }) as BelroseUserProfile)
      )
    );
  }

  // ── Prefix searches (connection/discoverability gated) ────────────────────
  const isPrefixSearch = searchType === 'all' || searchType === 'name' || searchType === 'email';

  if (isPrefixSearch) {
    if (searchType === 'all' || searchType === 'name') {
      const nameQuery = query(
        usersRef,
        orderBy('displayNameLower'),
        startAt(q),
        endAt(qEnd),
        limit(SEARCH_LIMIT)
      );
      searchPromises.push(
        getDocs(nameQuery).then(snap =>
          snap.docs.map(d => ({ uid: d.id, ...d.data() }) as BelroseUserProfile)
        )
      );
    }

    // --- Search by email prefix ---
    if (searchType === 'all' || searchType === 'email') {
      const emailPrefixQuery = query(
        usersRef,
        orderBy('email'),
        startAt(q),
        endAt(qEnd),
        limit(SEARCH_LIMIT)
      );
      searchPromises.push(
        getDocs(emailPrefixQuery).then(snap =>
          snap.docs.map(d => ({ uid: d.id, ...d.data() }) as BelroseUserProfile)
        )
      );
    }
  }

  // ── Run all searches in parallel, then deduplicate ────────────────────────
  const resultsArrays = await Promise.all(searchPromises);
  const allResults = resultsArrays.flat();

  const seen = new Set<string>();
  const deduplicated = allResults.filter(user => {
    if (seen.has(user.uid)) return false;
    seen.add(user.uid);
    return true;
  });

  // ── Apply privacy filter to prefix search results ─────────────────────────
  // Exact matches (UID, exact email) bypass this — they're in `seen` already
  // but we need to know which results came from prefix queries to filter them.
  // Simpler approach: re-run the filter based on whether the result was an
  // exact match.
  if (!isPrefixSearch || !currentUserId) {
    return deduplicated;
  }

  const connectionIds = await getFirstDegreeConnectionIds(currentUserId);

  return deduplicated.filter(user => {
    // Always show exact UID match
    if (user.uid === searchQuery.trim()) return true;

    // Always show exact email match
    if (user.email?.toLowerCase() === q) return true;

    // For prefix results: show if connected OR opted into discoverability
    return connectionIds.has(user.uid) || user.searchDiscoverable === true;
  });
}

/**
 * Update the current user's search discoverability preference.
 */
export async function updateSearchDiscoverable(discoverable: boolean): Promise<void> {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const { updateDoc, serverTimestamp } = await import('firebase/firestore');
  const db = getFirestore();
  const userRef = doc(db, 'users', currentUser.uid);

  await updateDoc(userRef, {
    searchDiscoverable: discoverable,
    updatedAt: serverTimestamp(),
  });

  // Bust the cache so the next getUserProfile call reflects the change
  clearUserCache(currentUser.uid);
}
