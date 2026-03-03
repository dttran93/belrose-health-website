// src/features/HealthProfile/components/overview/renderers/RowBadge.tsx

import React from 'react';

interface RowBadgeProps {
  label: string;
  variant?: 'default' | 'green' | 'red' | 'amber' | 'blue';
}

const VARIANTS = {
  default: 'bg-muted text-muted-foreground',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-blue-50 text-blue-600',
};

export const RowBadge: React.FC<RowBadgeProps> = ({ label, variant = 'default' }) => (
  <span
    className={`text-[11px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${VARIANTS[variant]}`}
  >
    {label}
  </span>
);
