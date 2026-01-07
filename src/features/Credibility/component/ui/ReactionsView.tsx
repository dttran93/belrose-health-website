// src/features/Credibility/components/ui/ReactionsView.tsx

import React, { useState, useEffect } from 'react';
import { ArrowLeft, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { cn } from '@/utils/utils';
import { BelroseUserProfile } from '@/types/core';
import UserCard from '@/features/Users/components/ui/UserCard';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { getDisputeReactions, ReactionDoc } from '../../services/disputeService';

// ============================================================
// TYPES
// ============================================================

interface ReactionsViewProps {
  recordId: string;
  recordHash: string;
  disputerId: string;
  initialTab: 'support' | 'oppose';
  supportCount: number;
  opposeCount: number;
  onBack: () => void;
}

// ============================================================
// COMPONENT
// ============================================================

const ReactionsView: React.FC<ReactionsViewProps> = ({
  recordId,
  recordHash,
  disputerId,
  initialTab,
  supportCount,
  opposeCount,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'support' | 'oppose'>(initialTab);
  const [reactions, setReactions] = useState<ReactionDoc[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Fetch reactions and user profiles
  useEffect(() => {
    const fetchReactions = async () => {
      setIsLoading(true);
      try {
        const allReactions = await getDisputeReactions(recordId, recordHash, disputerId);
        setReactions(allReactions.filter(r => r.isActive));

        // Get unique reactor IDs and fetch profiles
        const reactorIds = [...new Set(allReactions.map(r => r.reactorId))];
        if (reactorIds.length > 0) {
          const profiles = await getUserProfiles(reactorIds);
          setUserProfiles(profiles);
        }
      } catch (error) {
        console.error('Failed to load reactions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReactions();
  }, [recordHash, disputerId]);

  // Filter reactions by current tab
  const filteredReactions = reactions.filter(r =>
    activeTab === 'support' ? r.supportsDispute : !r.supportsDispute
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <button onClick={onBack} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Community Reactions</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('support')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all',
            activeTab === 'support'
              ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          )}
        >
          <ThumbsUp className="w-4 h-4" />
          Supporters
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs',
              activeTab === 'support' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            )}
          >
            {supportCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('oppose')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all',
            activeTab === 'oppose'
              ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          )}
        >
          <ThumbsDown className="w-4 h-4" />
          Opposers
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs',
              activeTab === 'oppose' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
            )}
          >
            {opposeCount}
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-sm">Loading reactions...</p>
          </div>
        ) : filteredReactions.length > 0 ? (
          <div className="space-y-2">
            {filteredReactions.map(reaction => {
              const profile = userProfiles.get(reaction.reactorId);
              return (
                <UserCard
                  key={reaction.reactorId}
                  user={profile}
                  userId={reaction.reactorId}
                  variant="compact"
                  color={activeTab === 'support' ? 'green' : 'red'}
                  menuType="none"
                  metadata={[
                    {
                      label: 'Reacted',
                      value: new Date(reaction.createdAt.toDate()).toLocaleDateString(),
                    },
                  ]}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            {activeTab === 'support' ? (
              <ThumbsUp className="w-10 h-10 text-gray-300 mb-3" />
            ) : (
              <ThumbsDown className="w-10 h-10 text-gray-300 mb-3" />
            )}
            <p className="text-sm font-medium">
              No {activeTab === 'support' ? 'supporters' : 'opposers'} yet
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Be the first to {activeTab === 'support' ? 'support' : 'oppose'} this dispute
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReactionsView;
