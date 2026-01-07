// src/pages/BlockchainAdminDashboard.tsx

import React, { useState } from 'react';
import { Users, FileText } from 'lucide-react';
import MemberDashboard from '@/features/MemberBlockchainViewer/components/MemberBlockchainDashboard';
import RecordDashboard from '@/features/RecordBlockchainViewer/components/RecordDashboard';

type TabId = 'members' | 'records';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const tabs: Tab[] = [
  {
    id: 'members',
    label: 'Members & Roles',
    icon: <Users className="w-4 h-4" />,
    description: 'View registered identities, wallets, and role assignments',
  },
  {
    id: 'records',
    label: 'Health Records',
    icon: <FileText className="w-4 h-4" />,
    description: 'View anchored records, verifications, and disputes',
  },
];

/**
 * Unified Blockchain Admin Dashboard
 *
 * Provides a tabbed interface for viewing:
 * - MemberRoleManager contract data (users, wallets, roles)
 * - HealthRecordCore contract data (anchored records, verifications, disputes)
 */
const BlockchainAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('members');
  const [refreshKey, setRefreshKey] = useState(0);
  const activeTabInfo = tabs.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 max-w-7xl mx-auto">
        {/* Tab Navigation */}
        <div className="mt-6 border-b border-gray-200 p-2 text-left">
          <nav className="-mb-px flex space-x-8">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                      flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                      ${
                        isActive
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Description */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <p className="text-sm text-gray-600">{activeTabInfo?.description}</p>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {activeTab === 'members' && <MemberDashboard key={`members-${refreshKey}`} />}
        {activeTab === 'records' && <RecordDashboard key={`records-${refreshKey}`} />}
      </div>
    </div>
  );
};

export default BlockchainAdminDashboard;
