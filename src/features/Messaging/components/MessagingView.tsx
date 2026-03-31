/**
 * MessagingView.tsx
 *
 * Top-level messaging UI. Composes ConversationList, MessageThread,
 * and MessageInput into a two-pane layout.
 *
 * Left pane:  conversation list
 * Right pane: active message thread + input
 *
 * Reads recipientId from the URL via useParams so navigation from
 * NewConversationPanel (navigate('/app/messages/:id')) correctly
 * opens the right thread even when already on the messages page.
 *
 * Usage:
 *   <MessagingView />   — standalone page, reads param from URL
 */

import React, { useState, useEffect } from 'react';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { ConversationList } from './ConversationList';
import { NewConversationPanel } from './NewConversationPanel';
import { MessageThread } from './MessageThread';
import { MessageInput } from './MessageInput';
import { useMessaging } from '../hooks/useMessaging';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import Avatar from '@/features/Users/components/Avatar';
import type { BelroseUserProfile } from '@/types/core';
import { SignalSetupStatus, useSignalSetup } from '../hooks/useSignalSetup';
import SignalDevPanel from './SignalDevPanel';
import { useAuthContext } from '@/features/Auth/AuthContext';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MessagingView: React.FC = () => {
  const { user } = useAuthContext();
  const { isReady: signalReady, status: signalStatus } = useSignalSetup();
  const { recipientId: urlRecipientId } = useParams<{ recipientId?: string }>();
  const navigate = useNavigate();

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [recipientUserId, setRecipientUserId] = useState<string>(urlRecipientId ?? '');
  const [recipientProfile, setRecipientProfile] = useState<BelroseUserProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Suppress the slide transition on first render — without this the panels
  // animate from their default positions on page load/refresh, causing a
  // visible flash where NewConversationPanel partially slides into view.
  // Must be useState (not useRef) so the re-render actually applies the class.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // React to URL changes from deep links or browser back/forward
  useEffect(() => {
    if (urlRecipientId && urlRecipientId !== recipientUserId) {
      setRecipientUserId(urlRecipientId);
      setSelectedConversationId(null);
      setIsSearching(false);
    }
  }, [urlRecipientId]);

  // Load recipient profile whenever selected recipient changes
  useEffect(() => {
    if (!recipientUserId) {
      setRecipientProfile(null);
      return;
    }
    getUserProfile(recipientUserId).then(setRecipientProfile);
  }, [recipientUserId]);

  /**
   * Called when user selects from ConversationList or NewConversationPanel.
   * Updates state directly (no navigation needed — avoids React Router
   * param-change detection issues when already on the messages page).
   * Also updates the URL so the conversation is deep-linkable.
   */
  const handleSelectUser = (userId: string) => {
    setRecipientUserId(userId);
    setSelectedConversationId(null);
    setIsSearching(false);
    // Update URL for deep-linking without triggering a remount
    navigate(`/app/messages/${userId}`, { replace: true });
  };

  const handleSelectConversation = (conversationId: string, userId: string) => {
    setSelectedConversationId(conversationId);
    handleSelectUser(userId);
  };

  const recipientName = recipientProfile
    ? `${recipientProfile.firstName ?? ''} ${recipientProfile.lastName ?? ''}`.trim() ||
      recipientProfile.displayName ||
      'Unknown User'
    : '';

  const hasActiveConversation = !!recipientUserId;

  return (
    <div className="flex h-full bg-background rounded-2xl border border-border/20 overflow-hidden shadow-sm">
      {/* ------------------------------------------------------------------ */}
      {/* LEFT PANE — Conversation list / New conversation panel             */}
      {/* ------------------------------------------------------------------ */}

      <div
        className={`
          flex flex-col border-r border-border/20 bg-card
          w-full md:w-80 lg:w-96 flex-shrink-0 min-h-0
          ${hasActiveConversation ? 'hidden md:flex' : 'flex'}
        `}
      >
        {/* Slide between ConversationList and NewConversationPanel */}
        <div className="flex-1 grid grid-cols-1 grid-rows-1 overflow-hidden min-h-0 w-full">
          {/* ConversationList — slides out left when searching */}
          <div
            className={`
              col-start-1 row-start-1 flex flex-col overflow-hidden w-full
               ${isMounted ? 'transition-all duration-300 ease-in-out' : ''}
              ${isSearching ? '-translate-x-full invisible' : 'translate-x-0 visible'}
          `}
          >
            <ConversationList
              selectedConversationId={selectedConversationId}
              onSelectConversation={handleSelectConversation}
              onNewConversation={() => setIsSearching(true)}
            />
          </div>

          {/* NewConversationPanel — slides in from right when searching */}
          <div
            className={`
            col-start-1 row-start-1 flex flex-col overflow-hidden w-full
            ${isMounted ? 'transition-all duration-300 ease-in-out' : ''}
            ${isSearching ? 'translate-x-0 visible' : 'translate-x-full invisible'}
          `}
          >
            <NewConversationPanel
              onClose={() => setIsSearching(false)}
              onSelectUser={handleSelectUser}
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT PANE — Active thread                                         */}
      {/* ------------------------------------------------------------------ */}

      <div
        className={`
          flex-1 flex flex-col min-w-0
          ${hasActiveConversation ? 'flex' : 'hidden md:flex'}
        `}
      >
        {hasActiveConversation ? (
          <ActiveThread
            recipientUserId={recipientUserId}
            recipientProfile={recipientProfile}
            recipientName={recipientName}
            onConversationReady={setSelectedConversationId}
            onBack={() => {
              setSelectedConversationId(null);
              setRecipientUserId('');
            }}
            signalReady={signalReady}
            signalStatus={signalStatus}
          />
        ) : (
          <EmptyThreadState />
        )}
      </div>

      {import.meta.env.DEV && (
        <SignalDevPanel
          currentUserId={user?.uid ?? null}
          recipientUserId={recipientUserId || null}
          signalStatus={signalStatus}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ActiveThread — mounts useMessaging for the selected recipient
// ---------------------------------------------------------------------------

interface ActiveThreadProps {
  recipientUserId: string;
  recipientProfile: BelroseUserProfile | null;
  recipientName: string;
  onConversationReady: (conversationId: string) => void;
  onBack: () => void;
  signalReady: boolean;
  signalStatus: SignalSetupStatus;
}

const ActiveThread: React.FC<ActiveThreadProps> = ({
  recipientUserId,
  recipientProfile,
  recipientName,
  onConversationReady,
  onBack,
  signalReady,
  signalStatus,
}) => {
  const { messages, isLoading, isSending, sendMessage, markAllRead, conversationId } = useMessaging(
    recipientUserId,
    signalReady
  );

  const isSettingUp = signalStatus === 'checking' || signalStatus === 'registering';

  // Sync the resolved conversationId back up to MessagingView so
  // ConversationList can highlight the correct item — works for both
  // DMs and future group conversations since it's always ID-based
  useEffect(() => {
    if (conversationId) onConversationReady(conversationId);
  }, [conversationId]);

  useEffect(() => {
    markAllRead();
  }, [recipientUserId]);

  return (
    <>
      {/* Thread header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/20 bg-card flex-shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>

        <Avatar profile={recipientProfile} size="sm" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {recipientName || 'Loading...'}
          </p>
          {isSettingUp && (
            <p className="text-xs text-complement-4 truncate">Setting up secure messaging…</p>
          )}
          {recipientProfile?.affiliations &&
            recipientProfile.affiliations.length > 0 &&
            !isSettingUp && (
              <p className="text-xs text-muted-foreground truncate">
                {recipientProfile.affiliations[0]}
              </p>
            )}
        </div>
      </div>

      {/* Message thread */}
      <MessageThread
        messages={messages}
        isLoading={isLoading || isSettingUp}
        recipientName={recipientName}
      />

      {/* Input — disabled while setting up so user can't send before keys exist */}
      <MessageInput
        onSend={sendMessage}
        isSending={isSending}
        disabled={isLoading || isSettingUp}
        placeholder={isSettingUp ? 'Setting up secure messaging…' : 'Message...'}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// EmptyThreadState — shown on desktop when no conversation selected
// ---------------------------------------------------------------------------

const EmptyThreadState: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
      <MessageSquare className="w-8 h-8 text-muted-foreground" />
    </div>
    <div>
      <p className="font-semibold text-foreground">Select a conversation</p>
      <p className="text-sm text-muted-foreground mt-1">
        Choose a conversation from the list to start messaging
      </p>
    </div>
  </div>
);

export default MessagingView;
