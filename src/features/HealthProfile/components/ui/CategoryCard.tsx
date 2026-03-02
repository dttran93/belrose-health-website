// src/features/HealthProfile/components/overview/CategoryCard.tsx

/**
 * CategoryCard
 *
 * Displays a single health category (e.g. "Medications", "Conditions")
 * as a card with:
 * - Icon + label header with resource count badge
 * - Up to MAX_VISIBLE items rendered as ResourceItem rows
 * - "Show X more" overflow indicator when there are more items
 * - Empty state when a category has zero resources (shouldn't normally
 *   render — HealthCategoryGrid filters these out — but safe fallback)
 *
 * Each category gets a distinct accent colour from the Belrose palette
 * so the grid is visually scannable at a glance.
 */

import React, { useState } from 'react';
import {
  Activity,
  Pill,
  AlertTriangle,
  BarChart2,
  Scissors,
  Shield,
  Calendar,
  Users,
  UserCheck,
  Building2,
  MapPin,
  FileText,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  FHIRResourceWithProvenance,
  HealthProfileCategory,
  getCategoryConfig,
} from '../../utils/fhirGroupingUtils';
import ResourceItem from './ResourceItem';

// ============================================================================
// ICON MAP
// ============================================================================

/**
 * Maps the icon string from CategoryConfig → actual Lucide component.
 * Keeps fhirGroupingUtils free of React/Lucide imports (it's a pure util).
 */
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  activity: Activity,
  pill: Pill,
  'alert-triangle': AlertTriangle,
  'bar-chart-2': BarChart2,
  scissors: Scissors,
  shield: Shield,
  calendar: Calendar,
  users: Users,
  'user-check': UserCheck,
  'building-2': Building2,
  'map-pin': MapPin,
  'file-text': FileText,
  'more-horizontal': MoreHorizontal,
};

// ============================================================================
// COLOUR MAP
// ============================================================================

/**
 * Each category gets a distinct colour pair: [icon bg + text, border accent].
 * Uses the Belrose design system (complement/supplement palette).
 * "other" and any unknown keys fall back to a neutral style.
 */
const CATEGORY_COLOURS: Record<
  HealthProfileCategory,
  { iconBg: string; iconColor: string; borderAccent: string; countBg: string }
> = {
  conditions: {
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    borderAccent: 'border-t-red-400',
    countBg: 'bg-red-50 text-red-600',
  },
  medications: {
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    borderAccent: 'border-t-blue-400',
    countBg: 'bg-blue-50 text-blue-600',
  },
  allergies: {
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-500',
    borderAccent: 'border-t-orange-400',
    countBg: 'bg-orange-50 text-orange-600',
  },
  observations: {
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-500',
    borderAccent: 'border-t-violet-400',
    countBg: 'bg-violet-50 text-violet-600',
  },
  procedures: {
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
    borderAccent: 'border-t-cyan-400',
    countBg: 'bg-cyan-50 text-cyan-700',
  },
  immunizations: {
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    borderAccent: 'border-t-emerald-400',
    countBg: 'bg-emerald-50 text-emerald-700',
  },
  visits: {
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-500',
    borderAccent: 'border-t-indigo-400',
    countBg: 'bg-indigo-50 text-indigo-600',
  },
  family_history: {
    iconBg: 'bg-pink-50',
    iconColor: 'text-pink-500',
    borderAccent: 'border-t-pink-400',
    countBg: 'bg-pink-50 text-pink-600',
  },
  care_team: {
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
    borderAccent: 'border-t-teal-400',
    countBg: 'bg-teal-50 text-teal-700',
  },
  providers: {
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    borderAccent: 'border-t-slate-400',
    countBg: 'bg-slate-100 text-slate-700',
  },
  locations: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    borderAccent: 'border-t-amber-400',
    countBg: 'bg-amber-50 text-amber-700',
  },
  documents: {
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-500',
    borderAccent: 'border-t-gray-400',
    countBg: 'bg-gray-100 text-gray-600',
  },
  other: {
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-400',
    borderAccent: 'border-t-gray-300',
    countBg: 'bg-gray-100 text-gray-500',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

const MAX_VISIBLE = 4; // Items shown before "show more"

interface CategoryCardProps {
  category: HealthProfileCategory;
  items: FHIRResourceWithProvenance[];
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category, items }) => {
  const [expanded, setExpanded] = useState(false);

  const config = getCategoryConfig(category);
  const colours = CATEGORY_COLOURS[category] ?? CATEGORY_COLOURS.other;
  const IconComponent = ICON_MAP[config.icon] ?? MoreHorizontal;

  const visibleItems = expanded ? items : items.slice(0, MAX_VISIBLE);
  const overflowCount = items.length - MAX_VISIBLE;
  const hasOverflow = overflowCount > 0;

  return (
    <div
      className={`
        bg-white rounded-xl border border-border shadow-sm
        border-t-2 ${colours.borderAccent}
        flex flex-col overflow-hidden
        hover:shadow-md transition-shadow duration-200
      `}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${colours.iconBg}`}>
            <IconComponent className={`w-4 h-4 ${colours.iconColor}`} />
          </div>
          <h3 className="text-sm font-semibold text-card-foreground">{config.label}</h3>
        </div>

        {/* Count badge */}
        <span
          className={`
            text-xs font-semibold px-2 py-0.5 rounded-full
            ${colours.countBg}
          `}
        >
          {items.length}
        </span>
      </div>

      {/* ── Divider ── */}
      <div className="h-px bg-border/50 mx-4" />

      {/* ── Items ── */}
      <div className="flex-1 px-1 py-1">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-3">No records found.</p>
        ) : (
          <>
            {visibleItems.map((item, idx) => (
              <ResourceItem
                key={`${item.sourceRecordId}-${item.resource.resourceType}-${idx}`}
                item={item}
              />
            ))}
          </>
        )}
      </div>

      {/* ── Show more / less ── */}
      {hasOverflow && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="
            flex items-center justify-center gap-1.5
            w-full py-2.5 px-4
            text-xs font-medium text-muted-foreground
            hover:text-card-foreground hover:bg-muted/40
            border-t border-border/50 transition-colors
          "
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              {overflowCount} more
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default CategoryCard;
