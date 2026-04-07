// src/pages/ForProviders.tsx

/**
 * /for-providers — public marketing page for healthcare professionals.
 *
 * Desktop: two full-viewport panels with opacity/translate-x transitions,
 * matching the panel-switching pattern from src/pages/index.tsx.
 * Mobile: normal vertical scroll, panels stack.
 *
 * Panel 1 — Legal obligations
 * Panel 2 — How the upload works
 */

import React, { useCallback, useState } from 'react';
import { Scale } from 'lucide-react';
import Navbar from '@/components/site/Navbar';
import Footer from '@/components/site/Footer';
import WaitlistBanner from '@/components/site/WaitlistBanner';
import CitationModal from '@/components/site/Citations/CitationModal';
import LegalObligations from '@/components/site/ForProviders/LegalObligations';
import HowRequestsWork from '@/components/site/ForProviders/HowRequestsWork';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';

// ── Sliding pill selector ─────────────────────────────────────────────────────

const PANELS = [
  { id: 'obligations', label: 'Legal obligations' },
  { id: 'how-it-works', label: 'How it works' },
] as const;

type PanelIndex = 0 | 1;

const PanelSelector: React.FC<{
  active: PanelIndex;
  onSelect: (i: PanelIndex) => void;
}> = ({ active, onSelect }) => (
  <div className="relative inline-flex bg-white/10 rounded-full p-1">
    {/* Sliding background pill */}
    <div
      className="absolute top-1 bottom-1 rounded-full bg-white transition-all duration-300 ease-in-out"
      style={{
        width: 'calc(50% - 4px)',
        left: active === 0 ? '4px' : 'calc(50%)',
      }}
    />
    {PANELS.map(({ label }, i) => (
      <button
        key={i}
        onClick={() => onSelect(i as PanelIndex)}
        className={`relative z-10 px-7 py-2 text-sm font-medium rounded-full transition-colors duration-300 ${
          active === i ? 'text-primary' : 'text-white/70 hover:text-white'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────

const ForProviders: React.FC = () => {
  const [active, setActive] = useState<PanelIndex>(0);
  const navigate = useNavigate();

  const goTo = useCallback((idx: PanelIndex) => {
    setActive(idx);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <WaitlistBanner />
      <Navbar />

      {/* Hero — scrolls naturally with the page */}
      <div className="bg-primary px-6 py-14">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/70 text-xs font-medium px-3 py-1.5 rounded-full">
            <Scale className="w-3.5 h-3.5" />
            For Healthcare Professionals
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight tracking-tight">
            Responding to a record request
          </h1>
          <p className="text-white/60 text-sm max-w-xl leading-relaxed">
            Your patient submitted a Subject Access Request via Belrose Health. Here's what you need
            to know.
          </p>
          <PanelSelector active={active} onSelect={goTo} />
        </div>
      </div>

      {/* Panel content */}
      <main className="flex-1">
        {active === 0 ? (
          <LegalObligations onNext={() => goTo(1)} />
        ) : (
          <HowRequestsWork onBack={() => goTo(0)} />
        )}
      </main>

      {/* Contact strip */}
      <div className="border-t border-slate-100 px-6 py-3">
        <div className="max-w-4xl m-auto bg-primary rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-white font-semibold text-sm">
              Let's change the world's medical system together
            </p>
            <p className="text-white/60 text-xs mt-0.5">
              Creating an account takes under 2 minutes. No payment required.
            </p>
          </div>
          <div className="space-x-2">
            <Button variant="ghost" onClick={() => navigate('/#faq')} className="text-white">
              Learn More
            </Button>

            <Button variant="secondary" onClick={() => navigate('/auth')}>
              Get Started
            </Button>
          </div>
        </div>
      </div>

      <Footer />
      <CitationModal />
    </div>
  );
};

export default ForProviders;
