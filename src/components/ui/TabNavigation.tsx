import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface Tab {
  id: string;
  label: string;
  shortLabel?: string; // Optional shorter label for compact display
  icon?: LucideIcon;
}

export interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  tabs: Tab[];
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange, tabs }) => (
  <div className="flex overflow-x-auto scrollbar-hide bg-background mx-3 mt-3 rounded-lg">
    {tabs.map(({ id, label, shortLabel, icon: Icon }) => (
      <button
        key={id}
        onClick={() => onTabChange(id)}
        className={`flex-shrink-0 flex flex-col items-center gap-1 md:flex-row md:gap-2 px-3 md:px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
          activeTab === id
            ? 'border-complement-1 text-complement-1'
            : 'border-transparent text-muted-foreground hover:text-complement-1'
        }`}
      >
        {Icon && <Icon className="w-4 h-4" />}
        <span>{shortLabel ?? label}</span>
      </button>
    ))}
  </div>
);
