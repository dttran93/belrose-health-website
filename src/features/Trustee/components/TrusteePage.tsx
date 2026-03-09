// src/features/Trustee/components/TrusteePage.tsx

import React, { useState } from 'react';
import { Shield, Users, Clock } from 'lucide-react';
import { MyTrusteesTab } from './MyTrusteesTab';
import { MyTrustorsTab } from './MyTrustorsTab';

type TrusteeTab = 'my-trustees' | 'my-trustors';

export const TrusteePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TrusteeTab>('my-trustees');

  return (
    <div className="w-full max-w-3xl mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Trustee Relationships</h1>
          <p className="text-sm text-gray-500">
            Manage who can act on your behalf and whose records you manage
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('my-trustees')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'my-trustees'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          My Trustees
        </button>
        <button
          onClick={() => setActiveTab('my-trustors')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'my-trustors'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          Accounts I Manage
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'my-trustees' ? <MyTrusteesTab /> : <MyTrustorsTab />}
    </div>
  );
};

export default TrusteePage;
