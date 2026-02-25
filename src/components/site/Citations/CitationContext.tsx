// src/context/CitationContext.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Citation, citations } from './citationsData';

interface CitationContextValue {
  activeCitation: Citation | null;
  openCitation: (id: string) => void;
  closeCitation: () => void;
}

const CitationContext = createContext<CitationContextValue | null>(null);

export const CitationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  const openCitation = (id: string) => {
    const citation = citations[id];
    if (citation) setActiveCitation(citation);
    else console.warn(`Citation "${id}" not found in citationsData.ts`);
  };

  const closeCitation = () => setActiveCitation(null);

  return (
    <CitationContext.Provider value={{ activeCitation, openCitation, closeCitation }}>
      {children}
    </CitationContext.Provider>
  );
};

export const useCitation = (): CitationContextValue => {
  const ctx = useContext(CitationContext);
  if (!ctx) throw new Error('useCitation must be used inside <CitationProvider>');
  return ctx;
};
