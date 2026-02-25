// src/components/ui/CitationLink.tsx

import React from 'react';
import { useCitation } from './CitationContext';
import { citations } from './citationsData';

interface CitationLinkProps {
  id: string;
}

const CitationLink: React.FC<CitationLinkProps> = ({ id }) => {
  const { openCitation } = useCitation();
  const citation = citations[id];

  if (!citation) return null;

  return (
    <button
      onClick={() => openCitation(id)}
      aria-label={`View citation ${citation.num}`}
      className="inline-flex items-center justify-center
        text-[10px] font-bold text-blue-600 hover:text-blue-800
        bg-blue-50 hover:bg-blue-100
        w-4 h-4 rounded-full
        align-super ml-0.5 leading-none
        transition-colors duration-150
        cursor-pointer border border-blue-200 hover:border-blue-400"
    >
      {citation.num}
    </button>
  );
};

export default CitationLink;
