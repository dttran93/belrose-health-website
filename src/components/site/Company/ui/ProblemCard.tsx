import React, { ReactNode } from 'react';

// ─── Type ─────────────────────────────────────────────────────────────────────

export interface ProblemCard {
  num: string;
  title: string;
  body: ReactNode;
  highlight: ReactNode;
}

const StatCallout: React.FC<{ highlight: ReactNode }> = ({ highlight }) => (
  <div className="mt-6 px-5 py-4 bg-white border-l-[3px] border-pink-400 rounded-r-xl text-sm text-gray-700 leading-relaxed">
    <div>{highlight}</div>
  </div>
);

interface ProblemCardProps {
  card: ProblemCard;
  index: number;
  cardRef: (el: HTMLDivElement | null) => void;
}

const ProblemCard: React.FC<ProblemCardProps> = ({ card, index, cardRef }) => (
  <div
    ref={cardRef}
    data-index={index}
    className="min-h-[75vh] flex flex-col justify-center py-16 border-b border-gray-200 last:border-0
    opacity-30 translate-y-5 transition-all duration-500 ease-out"
  >
    <div className="text-left font-serif text-[5rem] font-black text-gray-300 leading-none mb-4 tracking-tight select-none">
      {card.num}
    </div>
    <h3 className="text-left font-serif text-[1.55rem] font-bold text-gray-900 leading-snug mb-5">
      {card.title}
    </h3>
    <p className="text-left text-[15px] text-gray-500 leading-[1.85] max-w-[480px]">{card.body}</p>
    <StatCallout highlight={card.highlight} />
  </div>
);

export default ProblemCard;
