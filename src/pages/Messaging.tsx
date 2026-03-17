// src/pages/Messaging.tsx

import MessagingView from '@/features/Messaging/components/MessagingView';
import React from 'react';
import { useParams } from 'react-router-dom';

/**
 * Messaging page — wraps MessagingView inside the app Layout.
 *
 * Routes:
 *   /app/messages              → conversation list, no thread selected
 *   /app/messages/:recipientId → conversation list + thread open to recipient
 *
 * The recipientId param allows deep-linking directly into a conversation
 * from anywhere in the app (e.g. a "Message this provider" button on a record).
 */
const Messaging: React.FC = () => {
  const { recipientId } = useParams<{ recipientId?: string }>();

  return (
    <div className="h-full p-4 md:p-6">
      <MessagingView initialRecipientId={recipientId} />
    </div>
  );
};

export default Messaging;
