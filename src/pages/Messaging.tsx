// src/pages/Messaging.tsx

import { GuestFeatureGate } from '@/features/GuestAccess/components/GuestFeatureGate';
import MessagingView from '@/features/Messaging/components/MessagingView';
import React from 'react';

/**
 * Messaging page — wraps MessagingView inside the app Layout.
 *
 * Routes:
 *   /app/messages → conversation list, no thread selected
 *
 * The recipientId param allows deep-linking directly into a conversation
 * from anywhere in the app (e.g. a "Message this provider" button on a record).
 */
const Messaging: React.FC = () => {
  return (
    <GuestFeatureGate
      featureName="message users"
      featureDescription="End-to-end encrypted messaging with any other Belrose users."
    >
      <div className="h-full p-4 md:p-6">
        <MessagingView />
      </div>
    </GuestFeatureGate>
  );
};

export default Messaging;
