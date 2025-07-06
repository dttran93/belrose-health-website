import React from 'react';

export const TabNavigation = ({ activeTab, onTabChange, tabs }) => (
    <div className="flex space-x-1 mb-4 bg-gray-100 p-1 rounded-lg">
        {tabs.map(({ id, label }) => (
            <button
                key={id}
                onClick={() => onTabChange(id)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === id 
                        ? 'bg-white text-gray-900 shadow' 
                        : 'text-gray-600 hover:text-gray-900'
                }`}
            >
                {label}
            </button>
        ))}
    </div>
);