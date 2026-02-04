// src/features/MemberManagement/components/StatsCard.tsx

import React from 'react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string; // Tailwind classes for bg, border, text colors
}

/**
 * Card displaying a single statistic with an icon
 *
 * Usage:
 * ```tsx
 * <StatsCard
 *   title="Total Users"
 *   value={42}
 *   icon={<Users className="w-6 h-6 text-blue-600" />}
 *   color="bg-blue-50 border-blue-200 text-blue-900"
 * />
 * ```
 */
export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color }) => (
  <div className={`rounded-xl p-5 ${color} border shadow-sm h-full`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium opacity-80">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </div>
      <div className="p-3 rounded-full bg-white/50">{icon}</div>
    </div>
  </div>
);
