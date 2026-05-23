// src/features/Trustee/components/TrusteePage.tsx

import React, { useEffect, useState } from 'react';
import { Users, ShieldUser, HeartHandshake } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import MyTrusteesTab from './MyTrusteesTab';
import MyTrustorsTab from './MyTrustorsTab';

type TrusteeTab = 'my-trustees' | 'my-trustors';

interface PendingCounts {
  myTrustees: number; // pending invites I sent (action: they haven't accepted)
  myTrustors: number; // pending invites I received (action: I need to respond)
}

export const TrusteePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingCounts, setPendingCounts] = useState<PendingCounts>({
    myTrustees: 0,
    myTrustors: 0,
  });
  const [countsLoaded, setCountsLoaded] = useState(false);

  // Fetch pending counts and determine default tab
  useEffect(() => {
    const fetchCounts = async () => {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const db = getFirestore();

      const [trusteesSnap, trustorsSnap] = await Promise.all([
        // Invites I sent that are still pending
        getDocs(
          query(
            collection(db, 'trusteeRelationships'),
            where('trustorId', '==', currentUser.uid),
            where('status', '==', 'pending')
          )
        ),
        // Invites I received that are still pending
        getDocs(
          query(
            collection(db, 'trusteeRelationships'),
            where('trusteeId', '==', currentUser.uid),
            where('status', '==', 'pending')
          )
        ),
      ]);

      const counts = {
        myTrustees: trusteesSnap.size,
        myTrustors: trustorsSnap.size,
      };

      setPendingCounts(counts);
      setCountsLoaded(true);

      // Auto-navigate to my-trustors if there are pending invites and no explicit tab in URL
      if (!searchParams.get('tab') && counts.myTrustors > 0) {
        setSearchParams({ tab: 'my-trustors' }, { replace: true });
      }
    };

    fetchCounts();
  }, []);

  // Derive active tab from URL, defaulting to my-trustees
  const tabParam = searchParams.get('tab') as TrusteeTab | null;
  const activeTab: TrusteeTab = tabParam === 'my-trustors' ? 'my-trustors' : 'my-trustees';

  const handleTabChange = (tab: TrusteeTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
          <HeartHandshake className="w-5 h-5 text-primary" />
        </div>
        <div className="flex flex-col items-center w-full">
          <h1 className="text-xl font-semibold text-gray-900">Trustee Relationships</h1>
          <p className="text-sm text-gray-500">
            Manage who can act on your behalf and whose records you manage
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => handleTabChange('my-trustees')}
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
          onClick={() => handleTabChange('my-trustors')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'my-trustors'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldUser className="w-4 h-4" />
          My Trustors
          {countsLoaded && pendingCounts.myTrustors > 0 && (
            <span className="ml-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
              {pendingCounts.myTrustors}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'my-trustees' ? <MyTrusteesTab /> : <MyTrustorsTab />}
    </div>
  );
};

export default TrusteePage;
