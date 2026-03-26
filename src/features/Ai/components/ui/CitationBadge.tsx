import { ChevronDown, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Citation } from './CitationPanel';

interface CitationBadgeProps {
  citations: Citation[]; // all citations for this group (consecutive links)
}

export function CitationBadge({ citations }: CitationBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const first = citations[0];
  const extra = citations.length - 1;

  if (!first) return null;

  // Single citation — just a pill with the source name
  if (citations.length === 1) {
    return (
      <a
        href={first.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-full text-xs font-medium bg-primary/75 text-white hover:bg-primary/50 transition-colors no-underline align-middle"
      >
        {first.text}
      </a>
    );
  }

  // Multiple consecutive citations — grouped pill with dropdown
  return (
    <span ref={ref} className="relative inline-flex align-middle mx-0.5">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/75 text-white hover:bg-primary/50 transition-colors"
      >
        {first.text}
        <span>+{extra}</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <span className="absolute bottom-full left-0 mb-1 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden block">
          {citations.map(citation => (
            <a
              key={citation.url}
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors no-underline group"
              onClick={() => setIsOpen(false)}
            >
              <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium flex items-center justify-center">
                {citation.index}
              </span>
              <img
                src={`https://www.google.com/s2/favicons?domain=${citation.domain}&sz=14`}
                className="w-3.5 h-3.5 rounded-sm bg-gray-100 shrink-0"
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-800 font-medium truncate group-hover:text-blue-600 transition-colors">
                  {citation.text}
                </p>
                <p className="text-xs text-gray-400 truncate">{citation.domain}</p>
              </div>
              <ExternalLink
                size={10}
                className="text-gray-300 group-hover:text-blue-400 shrink-0"
              />
            </a>
          ))}
        </span>
      )}
    </span>
  );
}
