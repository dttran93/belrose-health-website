//src/components/site/ui/NavArrow.tsx

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

interface NavArrowProps {
  direction: 'left' | 'right';
  label: string | undefined;
  onClick: () => void;
  dark?: boolean;
}

const NavArrow: React.FC<NavArrowProps> = ({ direction, label, onClick, dark }) => (
  <button
    onClick={onClick}
    aria-label={label}
    className={`
      fixed ${direction === 'left' ? 'left-6' : 'right-6'} top-1/2 -translate-y-1/2
      z-50 hidden md:flex flex-col items-center gap-2 group opacity-30 hover:opacity-100 transition-opacity duration-300
    `}
  >
    <div
      className={`
      rounded-full w-10 h-10 flex items-center justify-center shadow-lg
      group-hover:scale-110 transition-transform
      ${
        dark
          ? 'bg-white/10 text-white border border-white/20 group-hover:bg-white/20'
          : 'bg-white text-primary border border-primary/20 group-hover:border-primary/40'
      }
    `}
    >
      {direction === 'left' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </div>
    <span
      className={`
      text-[10px] font-semibold tracking-wide whitespace-nowrap transition-colors
      ${dark ? 'text-white/40 group-hover:text-white/80' : 'text-gray-400 group-hover:text-gray-700'}
    `}
    >
      {label}
    </span>
  </button>
);

export default NavArrow;
