// src/features/Users/hooks/useUserProfiles.ts

/**
 * useUserProfiles - Loads and caches display profiles for a list of Belrose user IDs.
 *
 * Solves a different problem than useAuth: while useAuth tells you WHO the logged-in
 * user is, this hook answers "given these other user IDs, what are their names/profiles?"
 *
 * Primary use case: health records store subjects as raw user IDs (e.g. ["uid_abc", "uid_xyz"]).
 * This hook fetches their profiles so the UI can show human-readable names instead.
 *
 * @param subjectIds - Array of Belrose user IDs to load profiles for.
 *
 * @returns
 *  - profiles   - Map of userId → BelroseUserProfile for direct access
 *  - loading    - True while profiles are being fetched
 *  - getDisplayName(id) - Helper that resolves a userId to a display name,
 *                         falling back to firstName+lastName, then the raw ID
 *
 * @example
 *  const { loading, getDisplayName } = useUserProfiles(uniqueSubjectIds);
 *  // "uid_abc123" → "Sarah Johnson"
 */

import { useState, useEffect } from 'react';
import { getUserProfiles, preloadUserProfiles } from '../services/userProfileService';
import { BelroseUserProfile } from '@/types/core';

export const useUserProfiles = (subjectIds: string[]) => {
  const [profiles, setProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (subjectIds.length === 0) {
      setProfiles(new Map());
      return;
    }

    const loadProfiles = async () => {
      setLoading(true);
      try {
        await preloadUserProfiles(subjectIds);
        const loadedProfiles = await getUserProfiles(subjectIds);
        setProfiles(loadedProfiles);
      } catch (error) {
        console.error('❌ Error loading subject profiles:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfiles();
  }, [subjectIds.join(',')]);

  const getDisplayName = (subjectId: string): string => {
    const profile = profiles.get(subjectId);
    if (profile) {
      return profile.displayName || `${profile.firstName} ${profile.lastName}`.trim() || subjectId;
    }
    return subjectId;
  };

  return { profiles, loading, getDisplayName };
};

export default useUserProfiles;
