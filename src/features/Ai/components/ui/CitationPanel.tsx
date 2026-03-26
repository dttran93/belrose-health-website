// src/features/Ai/components/ui/CitationPanel.tsx

import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export interface Citation {
  index: number;
  text: string;
  url: string;
  domain: string;
}

/**
 * Function for extracting citations from AI's return message
 */
export function extractCitations(content: string): Citation[] {
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const seen = new Set<string>();
  const citations: Citation[] = [];
  let match;
  let index = 1;

  while ((match = linkPattern.exec(content)) !== null) {
    const [, text, url] = match;
    if (!text || !url) continue;
    if (!seen.has(url)) {
      seen.add(url);
      try {
        citations.push({
          index,
          text,
          url,
          domain: new URL(url).hostname.replace('www.', ''),
        });
        index++;
      } catch {
        // skip malformed URLs
      }
    }
  }

  return citations;
}

export function CitationPanel({ citations }: { citations: Citation[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (citations.length === 0) return null;

  const previewDomains = citations.slice(0, 2).map(c => c.domain);
  const remaining = citations.length - 2;

  return (
    <div className="mt-3 border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs">Sources:</span>
          <div className="flex -space-x-1">
            {citations.slice(0, 3).map(c => (
              <img
                key={c.url}
                src={`https://www.google.com/s2/favicons?domain=${c.domain}&sz=16`}
                className="w-4 h-4 rounded-sm ring-1 ring-white bg-gray-200"
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ))}
          </div>
          <span className="text-xs text-gray-600 font-medium">
            {previewDomains.join(' · ')}
            {remaining > 0 && <span className="ml-1 text-gray-400">+{remaining}</span>}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp size={14} className="text-gray-400 shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-gray-400 shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="divide-y divide-gray-50">
          {citations.map(citation => (
            <a
              key={citation.url}
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors no-underline group"
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center">
                {citation.index}
              </span>
              <img
                src={`https://www.google.com/s2/favicons?domain=${citation.domain}&sz=16`}
                className="w-4 h-4 rounded-sm bg-gray-200 shrink-0"
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 font-medium truncate group-hover:text-blue-600 transition-colors">
                  {citation.text}
                </p>
                <p className="text-xs text-gray-400 truncate">{citation.domain}</p>
              </div>
              <ExternalLink
                size={12}
                className="text-gray-300 group-hover:text-blue-400 shrink-0 transition-colors"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
