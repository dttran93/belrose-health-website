// src/features/Messaging/components/MessageBubble.tsx

import { DecryptedMessage } from '../hooks/useMessaging';

interface MessageBubbleProps {
  message: DecryptedMessage;
  isGrouped: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isGrouped }) => {
  const getDate = (ts: any) => {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    return new Date(ts);
  };

  const date = getDate(message.sentAt);
  const timestamp = date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  const isDecryptionError = message.text === '[Unable to decrypt message]';

  if (message.isOwn) {
    return (
      <div className={`flex justify-end ${isGrouped ? 'mt-0.5' : 'mt-3'}`}>
        <div className="max-w-[70%] flex flex-col items-end gap-0.5">
          <div
            className={`
              px-4 py-2.5 rounded-2xl text-sm
              bg-primary text-primary-foreground
              ${isGrouped ? 'rounded-tr-md' : ''}
            `}
          >
            {message.text}
          </div>
          {!isGrouped && (
            <span className="text-xs text-muted-foreground px-1">
              {timestamp}
              {message.readAt && <span className="ml-1 text-complement-3">· Read</span>}
              {!message.readAt && message.deliveredAt && (
                <span className="ml-1 text-muted-foreground">· Delivered</span>
              )}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex justify-start ${isGrouped ? 'mt-0.5' : 'mt-3'}`}>
      <div className="max-w-[70%] flex flex-col items-start gap-0.5">
        <div
          className={`
            px-4 py-2.5 rounded-2xl text-sm
            ${
              isDecryptionError
                ? 'bg-destructive/10 text-destructive italic'
                : 'bg-muted text-foreground'
            }
            ${isGrouped ? 'rounded-tl-md' : ''}
          `}
        >
          {message.text}
        </div>
        {!isGrouped && <span className="text-xs text-muted-foreground px-1">{timestamp}</span>}
      </div>
    </div>
  );
};

export default MessageBubble;
