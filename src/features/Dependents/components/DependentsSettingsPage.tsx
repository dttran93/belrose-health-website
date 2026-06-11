// src/features/Dependents/components/DependentsSettingsPage.tsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { Users, Loader2, HelpCircle, Plus, ShieldCheck } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import { UserCard } from '@/features/Users/components/ui/UserCard';
import type { TrusteeRelationship } from '@/features/Trustee/services/trusteeRelationshipService';
import type { BelroseUserProfile } from '@/types/core';

interface DependentEntry {
  relationship: TrusteeRelationship;
  profile: BelroseUserProfile | null;
}

const DependentTooltip = () => (
  <Tooltip.Provider>
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button className="inline-flex items-center">
          <HelpCircle className="w-4 h-4 text-gray-500" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="bg-gray-900 text-white rounded-lg p-4 max-w-sm shadow-xl z-50"
          sideOffset={5}
        >
          <p className="font-semibold mb-2 text-sm">Dependent accounts</p>
          <p className="text-xs text-gray-300">
            These are Belrose accounts you created and manage on behalf of someone in your care —
            such as a child or elderly parent. You hold Controller access to their records until
            they're ready to manage their own account.
          </p>
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
);

export const DependentsSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [dependents, setDependents] = useState<DependentEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const currentUser = getAuth().currentUser;
      if (!currentUser) return;

      const db = getFirestore();
      const snap = await getDocs(
        query(
          collection(db, 'trusteeRelationships'),
          where('trusteeId', '==', currentUser.uid),
          where('isDependentRelationship', '==', true),
          where('isActive', '==', true)
        )
      );

      const relationships = snap.docs.map(d => d.data() as TrusteeRelationship);

      const entries = await Promise.all(
        relationships.map(async rel => ({
          relationship: rel,
          profile: await getUserProfile(rel.trustorId),
        }))
      );

      setDependents(entries);
      setIsLoading(false);
    };

    load();
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div className="flex flex-col items-center w-full">
          <h1 className="text-xl font-semibold text-gray-900">Dependents</h1>
          <p className="text-sm text-gray-500">
            Trustee accounts created and managed by you on behalf of someone in your care, such as a
            child or elderly parent.
          </p>
        </div>
      </div>
      {/*Container*/}
      <div className="border border-accent rounded-lg">
        <div className="px-4 py-3 bg-accent flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-700" />
            <span className="font-semibold text-gray-900">Dependent Accounts</span>
            {dependents.length > 0 && (
              <span className="text-xs border border-primary/40 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {dependents.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DependentTooltip />
            <button
              onClick={() => navigate('/app/dependents/create')}
              className="rounded-full hover:bg-gray-300 p-1 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 bg-secondary space-y-2 rounded-b-lg">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <p className="text-gray-500">Loading dependents...</p>
            </div>
          ) : dependents.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">No dependent accounts yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Create an account for a child, elderly parent, or anyone in your care.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {dependents.map(({ relationship, profile }) => (
                <UserCard
                  key={relationship.trustorId}
                  user={profile}
                  userId={relationship.trustorId}
                  color="primary"
                  showAffiliations={false}
                  menuType="none"
                  content={
                    <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                      <ShieldCheck className="w-3 h-3" />
                      Controller
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DependentsSettingsPage;
