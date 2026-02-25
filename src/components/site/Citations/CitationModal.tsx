// src/components/ui/CitationModal.tsx

/**
 * Component that creates an overlay with citations on the website
 * Called once in index.tsx and then link is called in other components which activates
 */

import React, { useEffect } from 'react';
import { useCitation } from './CitationContext';
import { ExternalLink, X } from 'lucide-react';

const CitationModal: React.FC = () => {
  const { activeCitation, closeCitation } = useCitation();

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCitation();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [closeCitation]);

  if (!activeCitation) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100]
          animate-in fade-in duration-200"
        onClick={closeCitation}
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 bottom-8 -translate-x-1/2 z-[101]
          w-full max-w-lg mx-4
          bg-white rounded-2xl shadow-2xl border border-gray-100
          p-6 animate-in slide-in-from-bottom-4 duration-300"
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-start gap-2.5">
            <span
              className="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0
              bg-blue-50 border border-blue-200 text-blue-600 text-[11px] font-bold mt-0.5"
            >
              {activeCitation.num}
            </span>
            {/* Citation title — describes what claim this supports */}
            <p className="text-[14px] font-semibold text-gray-800 leading-snug">
              {activeCitation.title}
            </p>
          </div>
          <button
            onClick={closeCitation}
            className="text-gray-300 hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5"
            aria-label="Close citation"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Optional JSX content slot ── */}
        {activeCitation.content && <div className="mb-4 pl-8">{activeCitation.content}</div>}

        <div className="h-px bg-gray-100 mb-4" />

        {/* ── APA string ── */}
        <p className="text-[12px] text-gray-500 leading-relaxed mb-4 font-serif pl-8">
          {activeCitation.apaCitation}
        </p>

        {/* ── Metadata row ── */}
        <div className="flex items-center justify-between gap-4 pl-8">
          <div className="flex gap-4">
            {activeCitation.year && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Year
                </p>
                <p className="text-[13px] font-medium text-gray-700">{activeCitation.year}</p>
              </div>
            )}
            {activeCitation.source && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Source
                </p>
                <p className="text-[13px] font-medium text-gray-700">{activeCitation.source}</p>
              </div>
            )}
          </div>

          {/* External link */}
          {activeCitation.url && (
            <a
              href={activeCitation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-600
                hover:text-blue-800 transition-colors flex-shrink-0
                px-3 py-1.5 rounded-lg border border-blue-200 hover:border-blue-400 hover:bg-blue-50"
            >
              View Source
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </>
  );
};

export default CitationModal;
