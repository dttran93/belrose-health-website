// src/features/Ai/components/ui/ChatMessage

import React from 'react';
import { User, Bot } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

export interface ChatMessageProps {
  message: ChatMessage;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Timestamp;
  model?: string;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    // User messages: compact bubble on the right
    return (
      <div className="flex justify-end p-4 bg-white">
        <div className="flex gap-3 max-w-3xl">
          <div className="flex-1 min-w-0">
            <div className="bg-gray-100 rounded-l-2xl rounded-b-2xl px-4 py-2.5 inline-block">
              <div className="text-gray-900 whitespace-pre-wrap break-words">{message.content}</div>
            </div>
            <div className="text-xs text-gray-500 mt-1 text-right">
              {message.timestamp.toDate().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          {/* Avatar */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    );
  }

  // Assistant messages: full-width with content centered
  return (
    <div className="flex gap-3 p-4">
      <div className="w-full max-w-3xl mx-auto flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>

        {/* Message content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-semibold text-sm text-gray-900">
              {message.model || 'Assistant'}
            </span>
            <span className="text-xs text-gray-500">
              {message.timestamp.toDate().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          <div className="text-gray-800 whitespace-pre-wrap break-words">{message.content}</div>
        </div>
      </div>
    </div>
  );
}
