// src/features/ViewEditRecord/hooks/useUserProfiles.ts

/**
 * useUserProfiles.ts - Custom hook to manage loading and caching of user profiles for record subjects
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
