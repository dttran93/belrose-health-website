import React from 'react';

interface HowItWorksCardProps {
  id: number | string;
  title: string;
  description: string;
  delay?: string;
  className?: string;
  selectedStep: string;
  onSelect: (id: string) => void;
}

const HowItWorksCard: React.FC<HowItWorksCardProps> = ({
  id,
  title,
  description,
  delay,
  className = '',
  selectedStep,
  onSelect,
}) => {
  const isSelected = selectedStep === id.toString();

  return (
    <a
      className={`group relative overflow-hidden rounded-xl w-full transform transition-all duration-700 hover:scale-[1.02] cursor-pointer block transition-colors duration-30
        ${isSelected ? 'bg-gray-100 border-gray-300' : 'bg-transparent'} ${className}`}
      onClick={() => onSelect(id.toString())}
      style={{
        animationDelay: delay,
        animation: `fadeInUp 0.8s ease-out forwards ${delay}`,
      }}
    >
      <div className="relative z-10 flex items-stretch text-foreground p-4 gap-3">
        {/* LEFT COLUMN (full height) */}
        <div className="flex flex-col items-center justify-center h-full mr-4 relative">
          {/* optional decorative full-height connector line */}
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-full bg-gray-300 opacity-30" />

          {/* Step Number Circle */}
          <span className="z-10 flex items-center justify-center w-8 h-8 text-xs font-semibold bg-secondary backdrop-blur-sm rounded-full">
            {id}
          </span>
        </div>

        {/* RIGHT COLUMN: Content */}
        <div className="flex flex-col flex-1">
          <h3 className="text-base text-left sm:text-xl font-bold mb-1 group-hover:scale-105 transition-transform duration-300">
            {title}
          </h3>
          {isSelected && (
            <p className="text-xs sm:text-sm opacity-90 leading-relaxed text-left">{description}</p>
          )}
        </div>
      </div>

      {/* Hover Overlay + Border */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </a>
  );
};

export default HowItWorksCard;
