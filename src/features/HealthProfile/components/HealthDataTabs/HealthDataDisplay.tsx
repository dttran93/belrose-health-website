// src/features/HealthProfile/components/overview/HealthDataDisplay.tsx

/**
 * HealthData Display
 *
 * Renders the main overview grid of CategoryCards for the HealthProfile page.
 * Handles all three states: loading skeleton, empty, and populated.
 *
 * Only populated categories are shown — categories with zero resources are
 * filtered out by useHealthProfile via getPopulatedCategoriesSorted().
 */

import React from 'react';
import { FileX } from 'lucide-react';
import { GroupedHealthData } from '../../utils/fhirGroupingUtils';
import CategoryCard from './ui/CategoryCard';
import { HealthDataView } from '../../configs/healthDataViews';

// ============================================================================
// LOADING SKELETON
// ============================================================================

/**
 * Placeholder cards shown while data is loading.
 * Mimics the shape of real CategoryCards so the layout doesn't jump.
 */
const SkeletonCard: React.FC = () => (
  <div className="bg-white rounded-xl border border-border shadow-sm border-t-2 border-t-gray-200 overflow-hidden animate-pulse">
    {/* Header */}
    <div className="flex items-center justify-between px-4 pt-4 pb-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gray-100" />
        <div className="w-24 h-4 rounded bg-gray-100" />
      </div>
      <div className="w-6 h-5 rounded-full bg-gray-100" />
    </div>
    <div className="h-px bg-border/50 mx-4" />
    {/* Rows */}
    <div className="px-3 py-2 space-y-2.5">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex justify-between items-center py-1">
          <div className="w-3/5 h-3.5 rounded bg-gray-100" />
          <div className="w-12 h-3 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  </div>
);

// ============================================================================
// EMPTY STATE
// ============================================================================

const EmptyState: React.FC<{ isOwnProfile: boolean }> = ({ isOwnProfile }) => (
  <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
      <FileX className="w-7 h-7 text-muted-foreground" />
    </div>
    <h3 className="text-base font-semibold text-card-foreground mb-1">No health data yet</h3>
    <p className="text-sm text-muted-foreground max-w-xs">
      {isOwnProfile
        ? 'Add your first health record to start building your profile.'
        : 'No accessible records have been shared for this profile.'}
    </p>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface HealthDataDisplayProps {
  grouped: GroupedHealthData;
  view: HealthDataView;
  isLoading: boolean;
  isOwnProfile: boolean;
}

export const HealthDataDisplay: React.FC<HealthDataDisplayProps> = ({
  grouped,
  view,
  isLoading,
  isOwnProfile,
}) => {
  const isSCR = view.id === 'scr';

  // SCR: always show all sections so clinicians see "not recorded" explicitly
  // All other views: only show categories that have data
  const visibleCategories = isSCR
    ? view.sections
    : view.sections.filter(cat => (grouped.get(cat)?.length ?? 0) > 0);

  // Overall empty state only applies to non-SCR views
  const isEmpty = !isSCR && visibleCategories.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        Array.from({ length: isSCR ? view.sections.length : 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))
      ) : isEmpty ? (
        <EmptyState isOwnProfile={isOwnProfile} />
      ) : (
        visibleCategories.map(category => (
          <CategoryCard
            key={category}
            category={category}
            items={grouped.get(category) ?? []}
            isOwnProfile={isOwnProfile}
            alwaysShow={isSCR}
          />
        ))
      )}
    </div>
  );
};

export default HealthDataDisplay;
