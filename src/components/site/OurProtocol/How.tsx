// src/components/site/OurProtocol/How.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HowStepDetail from './HowStepDetails';
import HowStepList from './HowStepList';

// ─── Main component ───────────────────────────────────────────────────────────

interface HowProps {
  initialSlug?: string;
}

const How: React.FC<HowProps> = ({ initialSlug }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSlug, setActiveSlug] = useState<string | null>(initialSlug ?? null);

  // Sync with browser back/forward
  useEffect(() => {
    const parts = location.hash.replace('#', '').split('/');
    if (parts[0] === 'how') {
      setActiveSlug(parts[1] ?? null);
    }
  }, [location.hash]);

  const openStep = (slug: string) => navigate(`#how/${slug}`);
  const closeStep = () => navigate('#how');

  return (
    <div className="relative min-h-full overflow-hidden">
      {/* List — slides out left when detail is open */}
      <div
        className={`transition-all ease-in-out ${
          activeSlug
            ? 'opacity-0 pointer-events-none absolute inset-0 -translate-x-6'
            : 'opacity-100 translate-x-0 relative'
        }`}
        style={{ transitionDuration: '380ms' }}
      >
        <HowStepList onSelect={openStep} />
      </div>

      {/* Detail — slides in from right */}
      <div
        className={`transition-all ease-in-out ${
          activeSlug
            ? 'opacity-100 translate-x-0 relative'
            : 'opacity-0 pointer-events-none absolute inset-0 translate-x-6'
        }`}
        style={{ transitionDuration: '380ms' }}
      >
        {activeSlug && <HowStepDetail slug={activeSlug} onBack={closeStep} onNavigate={openStep} />}
      </div>
    </div>
  );
};

export default How;
