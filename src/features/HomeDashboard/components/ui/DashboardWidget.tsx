// src/features/HomeDashboard/components/DashboardWidget.tsx

/**
 * Shared wrapper for every HomeDashboard widget.
 *
 * Handles:
 *  - Consistent card shell (border, radius, padding)
 *  - Optional header with icon, title, badge, and action link
 *  - Loading skeleton state
 *  - Conditional visibility (isVisible=false → renders nothing)
 *
 * Usage:
 *   <DashboardWidget title="Notifications" icon={Bell} badge={3} isVisible={unreadCount > 0}>
 *     <NotificationsWidget />
 *   </DashboardWidget>
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DashboardWidgetProps {
  title?: string;
  icon?: LucideIcon;
  /** Red badge count shown next to title */
  badge?: number;
  /** "View all →" link in the top-right corner */
  actionLabel?: string;
  actionHref?: string;
  /** When false the widget renders nothing — use for conditional widgets */
  isVisible?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
  /** Extra Tailwind classes on the outer card */
  className?: string;
}

// Simple pulsing skeleton block
const SkeletonLine = ({
  width = 'w-full',
  height = 'h-4',
}: {
  width?: string;
  height?: string;
}) => <div className={`${width} ${height} bg-muted animate-pulse rounded`} />;

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  title,
  icon: Icon,
  badge,
  actionLabel = 'View all',
  actionHref,
  isVisible = true,
  isLoading = false,
  children,
  className = '',
}) => {
  const navigate = useNavigate();

  // Conditional widgets: render nothing when there's nothing to show
  if (!isVisible) return null;

  return (
    <div
      className={`
        bg-card rounded-xl border border-border
        p-4 flex flex-col gap-3
        ${className}
      `}
    >
      {/* Header — only rendered if a title is provided */}
      {title && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
            <span className="text-sm font-medium text-foreground">{title}</span>
            {badge != null && badge > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive/10 text-destructive text-[10px] font-medium">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </div>
          {actionHref && (
            <button
              onClick={() => navigate(actionHref)}
              className="text-xs text-complement-1 hover:underline"
            >
              {actionLabel} →
            </button>
          )}
        </div>
      )}

      {/* Content or skeleton */}
      {isLoading ? (
        <div className="flex flex-col gap-2 py-1">
          <SkeletonLine width="w-3/4" />
          <SkeletonLine width="w-full" />
          <SkeletonLine width="w-5/6" />
        </div>
      ) : (
        children
      )}
    </div>
  );
};

export default DashboardWidget;
