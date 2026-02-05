import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface Tab {
  id: string;
  label: string;
  icon?: LucideIcon; // Optional icon
}

export interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  tabs: Tab[];
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange, tabs }) => (
  <div className="flex space-x-1 mb-4 bg-background p-1 rounded-lg">
    {tabs.map(({ id, label, icon: Icon }) => (
      <button
        key={id}
        onClick={() => onTabChange(id)}
        className={`px-3 py-2 text-sm font-medium transition-colors ${
          activeTab === id
            ? 'bg-background text-complement-1 border-b border-complement-1'
            : 'text-gray-600 hover:text-complement-1'
        }`}
      >
        <div className="flex items-center space-x-2">
          {Icon && <Icon className="w-4 h-4" />}
          <span>{label}</span>
        </div>
      </button>
    ))}
  </div>
);
