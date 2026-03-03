// src/features/HealthProfile/hooks/useHealthProfile.ts

/**
 * useHealthProfile.ts
 *
 * The primary data hook for the HealthProfile feature. Given a subjectId,
 * it loads all records where that person is a subject, then processes the
 * FHIR data into a grouped, UI-ready structure.
 *
 * This hook is the single source of truth for the HealthProfile page.
 * Components never touch raw records directly — they consume this hook's output.
 *
 * Architecture note:
 * This hook is a "smart" hook — it composes two concerns:
 *   1. Data fetching  → via useUserRecords (existing hook, reused as-is)
 *   2. Data transformation → via groupResourcesByCategory (pure util)
 *
 * Keeping these separate makes both easier to test and change independently.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { useUserRecords } from '@/features/ViewEditRecord/hooks/useUserRecords';
import { FileObject } from '@/types/core';
import {
  groupResourcesByCategory,
  getPopulatedCategoriesSorted,
  GroupedHealthData,
  HealthProfileSummary,
  HealthProfileCategory,
  FHIRResourceWithProvenance,
  getCategoryConfig,
  CategoryConfig,
} from '../utils/fhirGroupingUtils';
import { getUserProfile } from '@/features/Users/services/userProfileService';

// ============================================================================
// TYPES
// ============================================================================

export interface UseHealthProfileReturn {
  // --- Core data ---

  /**
   * The raw FileObject records for this subject — the same records that
   * feed the FHIR grouping. Exposed so the Records tab can render them
   * directly via RecordsList without a second Firestore fetch.
   */
  records: FileObject[];

  /**
   * Resources grouped by display category.
   * e.g. grouped.get('medications') → [{ resource, sourceRecordId, ... }]
   *
   * Always returns all 8 category keys, even if empty — so the UI
   * never has to handle missing keys.
   */
  grouped: GroupedHealthData;

  /**
   * Categories that have at least one resource, sorted by display priority.
   * Use this to render the grid — only populated buckets get a card.
   */
  populatedCategories: HealthProfileCategory[];

  /**
   * Summary stats: total records processed, total resources extracted,
   * per-category counts, and which records had no parseable FHIR.
   */
  summary: HealthProfileSummary;

  // --- Convenience accessors ---

  /**
   * Quick helper: get all resources for a specific category.
   * Equivalent to grouped.get(category) ?? [].
   *
   * Usage in a component:
   *   const medications = getCategory('medications');
   */
  getCategory: (category: HealthProfileCategory) => FHIRResourceWithProvenance[];

  /**
   * Get the display config (label, icon, priority) for a category.
   * Convenience wrapper over getCategoryConfig from fhirGroupingUtils.
   */
  getCategoryMeta: (category: HealthProfileCategory) => CategoryConfig;

  // --- Context ---

  /**
   * Whether the logged-in user is viewing their own profile,
   * or someone else's. Useful for showing/hiding owner-only UI.
   */
  isOwnProfile: boolean;

  /**
   * The subjectId this profile is for (mirrors the param passed in).
   */
  subjectId: string;

  // --- Loading / error states ---
  isLoading: boolean;
  error: Error | null;

  /**
   * How many records were loaded for this subject.
   * The UI can show "X records" in the header.
   */
  recordCount: number;
  subjectName: string;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Load and process health profile data for a subject.
 *
 * @param subjectId - The Belrose user ID of the person whose profile to load.
 *                    This is typically from the URL param: useParams().subjectId
 *
 * Example usage in HealthProfile.tsx:
 *   const { grouped, populatedCategories, isLoading, isOwnProfile } = useHealthProfile(subjectId);
 */
export function useHealthProfile(subjectId: string): UseHealthProfileReturn {
  const { user } = useAuthContext();

  // =========================================================================
  // STEP 1: FETCH RECORDS
  // =========================================================================
  //
  // We reuse the existing useUserRecords hook with filterType: 'subject'.
  //
  // How this works under the hood (from useUserRecords.ts):
  // - If subjectId === current user's uid → Firestore query: subjects array-contains subjectId
  // - If subjectId !== current user → query all records the current user can access,
  //   then client-side filter to records where subjects includes subjectId
  //
  // Records are already decrypted by the time this hook returns them —
  // useUserRecords calls RecordDecryptionService internally.

  const {
    records,
    loading: recordsLoading,
    error: recordsError,
  } = useUserRecords(
    user?.uid, // The logged-in user — determines what they're ALLOWED to see
    {
      filterType: 'subject',
      subjectId: subjectId, // The person whose profile we're building
    }
  );

  const [subjectName, setSubjectName] = useState<string>('');

  // =========================================================================
  // STEP 2: DETERMINE CONTEXT
  // =========================================================================

  const isOwnProfile = user?.uid === subjectId;

  useEffect(() => {
    if (!subjectId) return;
    // If it's the logged-in user's own profile, we already have the name
    if (isOwnProfile && user) {
      const name =
        user.displayName || `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'You';
      setSubjectName(name);
      return;
    }
    // Otherwise fetch the subject's profile
    getUserProfile(subjectId).then(profile => {
      const name =
        profile?.displayName ||
        `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() ||
        'this user';
      setSubjectName(name);
    });
  }, [subjectId, isOwnProfile, user]);

  // =========================================================================
  // STEP 3: TRANSFORM DATA
  // =========================================================================
  //
  // useMemo means this only re-runs when `records` actually changes,
  // not on every render. Important since groupResourcesByCategory
  // iterates over all records and all their FHIR entries.
  //
  // "Memoisation" = caching a computed result and only recomputing
  // when its dependencies change. Think of it like a spreadsheet cell
  // that only recalculates when its input cells change.

  const { grouped, summary } = useMemo(() => {
    if (records.length === 0) {
      // Return empty structure rather than running grouping on nothing
      return {
        grouped: new Map([
          ['conditions', []],
          ['medications', []],
          ['allergies', []],
          ['observations', []],
          ['procedures', []],
          ['immunizations', []],
          ['visits', []],
          ['family_history', []],
          ['care_team', []],
          ['patients', []],
          ['providers', []],
          ['locations', []],
          ['documents', []],
          ['other', []],
        ]) as GroupedHealthData,
        summary: {
          totalRecordsProcessed: 0,
          totalResourcesExtracted: 0,
          categoryCounts: {
            conditions: 0,
            medications: 0,
            allergies: 0,
            observations: 0,
            procedures: 0,
            immunizations: 0,
            visits: 0,
            family_history: 0,
            care_team: 0,
            patients: 0,
            providers: 0,
            locations: 0,
            documents: 0,
            other: 0,
          },
          recordsWithNoFhir: [],
        } as HealthProfileSummary,
      };
    }

    return groupResourcesByCategory(records);
  }, [records]);

  // =========================================================================
  // STEP 4: DERIVE SORTED CATEGORY LIST
  // =========================================================================

  const populatedCategories = useMemo(() => getPopulatedCategoriesSorted(grouped), [grouped]);

  // =========================================================================
  // CONVENIENCE HELPERS
  // =========================================================================

  /**
   * Get all resources for a given category, defaulting to empty array.
   * Defined inside the hook so it closes over `grouped` without needing
   * to be passed as a prop.
   */
  const getCategory = (category: HealthProfileCategory): FHIRResourceWithProvenance[] => {
    return grouped.get(category) ?? [];
  };

  // =========================================================================
  // RETURN
  // =========================================================================

  return {
    // Core data
    records,
    grouped,
    populatedCategories,
    summary,

    // Convenience accessors
    getCategory,
    getCategoryMeta: getCategoryConfig,

    // Context
    isOwnProfile,
    subjectId,
    subjectName,

    // Loading state
    isLoading: recordsLoading,
    error: recordsError,
    recordCount: records.length,
  };
}

export default useHealthProfile;
