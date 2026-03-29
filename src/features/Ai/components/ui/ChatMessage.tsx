// src/features/Ai/components/ui/ChatMessage

import { Button } from '@/components/ui/Button';
import { copyToClipboard } from '@/utils/browserUtils';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import { Check, Copy, GitBranch, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../../service/chatService';
import { Citation, CitationPanel, extractCitations } from './CitationPanel';
import { CitationBadge } from './CitationBadge';
import remarkGfm from 'remark-gfm';

export interface ChatMessageProps {
  message: Message;
  onEdit?: (messageId: string, newContent: string) => void;
}

export function ChatMessage({ message, onEdit }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);

  // Extract citations once per message content change
  const citations = useMemo(
    () => (isUser ? [] : extractCitations(message.content)),
    [message.content, isUser]
  );

  // Build a URL → index map for the inline superscript renderer
  const citationMap = useMemo(() => new Map(citations.map(c => [c.url, c])), [citations]);

  function groupConsecutiveCitations(
    children: React.ReactNode,
    citationMap: Map<string, Citation>
  ): React.ReactNode {
    const nodes = Array.isArray(children) ? children : [children];
    const result: React.ReactNode[] = [];
    let pendingCitations: Citation[] = [];

    const flushPending = () => {
      if (pendingCitations.length > 0) {
        const first = pendingCitations[0];
        if (!first) return;
        result.push(<CitationBadge key={`group-${first.index}`} citations={pendingCitations} />);
        pendingCitations = [];
      }
    };

    nodes.forEach(node => {
      // Check if this node is a citation anchor element
      if (
        node &&
        typeof node === 'object' &&
        'props' in node &&
        (node as any).props?.href &&
        citationMap.has((node as any).props.href)
      ) {
        const citation = citationMap.get((node as any).props.href)!;
        pendingCitations.push(citation);
      } else {
        flushPending();
        result.push(node);
      }
    });

    flushPending();
    return result;
  }

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
            {/* Thinking indicator — always shows while waiting for first content */}
            {message.isStreaming && (
              <div className="flex items-center gap-2 py-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                <span className="text-sm text-gray-500">
                  {message.streamingStatus === 'searching' ? 'Searching the web...' : 'Thinking...'}
                </span>
              </div>
            )}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <div className="mb-2 last:mb-0">
                    {groupConsecutiveCitations(children, citationMap)}
                  </div>
                ),
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => (
                  <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>
                ),
                li: ({ children }) => <li className="text-gray-800">{children}</li>,
                h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full border-collapse text-sm">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
                tbody: ({ children }) => (
                  <tbody className="divide-y divide-gray-200">{children}</tbody>
                ),
                tr: ({ children }) => (
                  <tr className="hover:bg-gray-50 transition-colors">{children}</tr>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide border-b border-gray-200">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 text-gray-800 border-b border-gray-100">{children}</td>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
            {/* Streaming cursor */}
            {message.isStreaming && !message.streamingStatus && (
              <span className="inline-block w-0.5 h-4 bg-gray-800 ml-0.5 align-middle animate-pulse" />
            )}

            {/* ✅ Citation panel — only renders when message is done streaming */}
            {!message.isStreaming && citations.length > 0 && (
              <CitationPanel citations={citations} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
