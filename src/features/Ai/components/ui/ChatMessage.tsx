// src/features/Ai/components/ui/ChatMessage

import { Button } from '@/components/ui/Button';
import { copyToClipboard } from '@/utils/browserUtils';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import { Timestamp } from 'firebase/firestore';
import { Check, Copy, GitBranch, Pencil } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

export interface ChatMessageProps {
  message: ChatMessage;
  onEdit?: (messageId: string, newContent: string) => void;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Timestamp;
  model?: string;
  isStreaming?: boolean;
}

export function ChatMessage({ message, onEdit }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);

  const handleCopy = async () => {
    await copyToClipboard(message.content, 'Prompt');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditSubmit = () => {
    if (editValue.trim() && editValue !== message.content) {
      onEdit?.(message.id, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    }
    if (e.key === 'Escape') {
      setEditValue(message.content);
      setIsEditing(false);
    }
  };

  if (isUser) {
    // User messages: compact bubble on the right
    return (
      <div className={`flex p-4 bg-white group ${isEditing ? '' : 'justify-end'}`}>
        <div className={`flex gap-3 ${isEditing ? 'w-full' : 'max-w-[90%] md:max-w-[80%]'}`}>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="border border-border/20 w-full rounded-2xl overflow-hidden shadow-sm">
                {/* Textarea */}
                <div className="pt-3 px-3">
                  <textarea
                    className="w-full px-4 py-3 rounded-xl text-foreground resize-none focus:outline-none bg-gray-50 border border-gray-200 focus:border-complement-1 focus:bg-white transition-colors"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    rows={Math.max(2, editValue.split('\n').length)}
                    autoFocus
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 px-3 pb-2">
                  {/* Branch notice */}
                  <div className="flex items-center gap-1.5 px-1">
                    <GitBranch size={12} className="text-foreground shrink-0" />
                    <span className="text-xs text-foreground">
                      Editing creates a new conversation branch
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditValue(message.content);
                        setIsEditing(false);
                      }}
                      className="px-3 py-1 rounded-lg text-xs border-none bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleEditSubmit} size="sm" className="px-4 py-1 text-xs">
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-gray-100 rounded-l-2xl rounded-b-2xl px-4 py-2.5 inline-block">
                  <div className="text-gray-900 whitespace-pre-wrap break-words text-left">
                    {message.content}
                  </div>
                </div>

                <div className="flex justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-xs text-gray-500 mt-0.5 text-right">
                    {formatTimestamp(message.timestamp, 'date-short')}
                  </div>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Edit message"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Copy message"
                  >
                    {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Assistant messages unchanged
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
