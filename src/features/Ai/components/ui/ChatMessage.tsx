// src/features/Ai/components/ui/ChatMessage

import React from 'react';
import { User, Bot } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';

export interface ChatMessageProps {
  message: ChatMessage;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Timestamp;
  model?: string;
  isStreaming?: boolean;
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
        </div>
      </div>
    );
  }

  // Assistant messages: full-width with content centered
  return (
    <div className="flex gap-3 p-4">
      <div className="w-full max-w-3xl mx-auto flex gap-3">
        {/* Message content */}
        <div className="flex-1 min-w-0">
          <div className="text-left text-gray-800">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => (
                  <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>
                ),
                li: ({ children }) => <li className="text-gray-800">{children}</li>,
                h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-gray-800 ml-0.5 align-middle animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
