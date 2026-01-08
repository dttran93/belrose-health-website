// src/features/Users/components/ui/UserBadge.tsx

/**
 * Standardize User Badge containing information f
 */

import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

export type BadgeColor = 'primary' | 'pink' | 'green' | 'red' | 'blue' | 'purple' | 'yellow';

export const badgeColorClasses: Record<BadgeColor, { bg: string; text: string; border: string }> = {
  primary: { bg: 'bg-primary/20', text: 'text-primary', border: 'border-primary' },
  pink: { bg: 'bg-secondary', text: 'text-destructive', border: 'border-destructive' },
  green: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-700' },
  red: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-700' },
  blue: { bg: 'bg-chart-2/30', text: 'text-chart-2', border: 'border-chart-2' },
  purple: { bg: 'bg-chart-5/20', text: 'text-chart-5', border: 'border-chart-5' },
  yellow: { bg: 'bg-yellow-200', text: 'text-yellow-800', border: 'border-chart-4' },
};

interface UserBadgeProps {
  text: string;
  color: BadgeColor;
  icon?: React.ReactNode;
  tooltip?: string;
  className?: string;
}

export const UserBadge: React.FC<UserBadgeProps> = ({
  text,
  color,
  icon,
  tooltip,
  className = '',
}) => {
  const badgeColors = badgeColorClasses[color];

  const badgeElement = (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full 
        ${badgeColors.bg} ${badgeColors.text} border ${badgeColors.border} ${className}
        ${tooltip ? 'cursor-help' : ''}`}
    >
      {icon}
      {text}
    </span>
  );

  if (!tooltip) return badgeElement;

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{badgeElement}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 z-50 max-w-xs"
            sideOffset={5}
          >
            {tooltip}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
