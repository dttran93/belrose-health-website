// src/pages/how-it-works/HowItWorksIndex.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronRight, ChevronLeft } from 'lucide-react';
import { steps } from '../components/site/OurProtocol/howItWorksData';
import Navbar from '@/components/site/Navbar';
import Footer from '@/components/site/Footer';
import { whySections } from '../components/site/OurProtocol/whyItWorksData';

// ─── Main component ───────────────────────────────────────────────────────────

const HowItWorksIndex: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activePanel, setActivePanel] = useState<0 | 1>(0);
  const [footerOffset, setFooterOffset] = useState(24);
  const footerRef = useRef<HTMLDivElement>(null);

  // Support deep-linking to Why panel: /how-it-works?panel=why
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('panel') === 'why') setActivePanel(1);
  }, [location.search]);

  // Push dots up smoothly as footer scrolls into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          const fromBottom = window.innerHeight - entry.boundingClientRect.top;
          setFooterOffset(Math.max(24, fromBottom + 8));
        } else {
          setFooterOffset(24);
        }
      },
      { threshold: Array.from({ length: 101 }, (_, i) => i / 100) }
    );
    if (footerRef.current) observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, []);

  const goTo = (panel: 0 | 1) => {
    setActivePanel(panel);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* ════════════════════════════════════════════════
          DESKTOP — horizontal two-panel slide
          ════════════════════════════════════════════════ */}
      <div className="hidden md:block flex-1 overflow-hidden relative">
        {/* Sliding track */}
        <div
          className="flex w-[200vw] transition-transform duration-700 ease-[cubic-bezier(0.76,0,0.24,1)]"
          style={{ transform: activePanel === 1 ? 'translateX(-50%)' : 'translateX(0)' }}
        >
          {/* ── Panel 1: HOW ── */}
          <div className="w-screen min-h-screen flex flex-col bg-white">
            <div className="bg-gray-50 py-16 px-8">
              <div className="max-w-4xl mx-auto text-center text-primary">
                <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">
                  The Belrose Protocol
                </p>
                <h1 className="text-4xl font-bold mb-3">How Belrose Works</h1>
                <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                  The pillars of our protocol give you true ownership of your data.
                </p>
              </div>
            </div>

            <div className="flex-1 py-12 px-8">
              <div className="max-w-4xl mx-auto space-y-4">
                {steps.map(step => {
                  const Icon = step.icon;
                  return (
                    <button
                      key={step.slug}
                      onClick={() => navigate(`/how-it-works/${step.slug}`)}
                      className={`w-full text-left rounded-2xl border ${step.borderColor} ${step.bgColor} p-6 group transition-all hover:shadow-md`}
                    >
                      <div className="flex items-start gap-5">
                        <div className="flex-shrink-0 flex flex-col items-center gap-1">
                          <div
                            className={`w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center ${step.accentColor}`}
                          >
                            <Icon size={20} />
                          </div>
                          <span className="text-xs text-gray-400">{step.id}/5</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <p
                                className={`text-xs font-semibold tracking-widest uppercase mb-0.5 ${step.accentColor}`}
                              >
                                {step.label}
                              </p>
                              <h2 className="text-lg font-bold text-gray-900">{step.title}</h2>
                            </div>
                            <ArrowRight
                              size={16}
                              className={`flex-shrink-0 ${step.accentColor} opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1`}
                            />
                          </div>
                          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                            {step.summary}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* footerRef lives here so the observer watches panel 1's footer */}
            <div ref={footerRef}>
              <Footer />
            </div>
          </div>

          {/* ── Panel 2: WHY ── */}
          <div className="w-screen min-h-screen flex flex-col bg-primary text-primary-foreground">
            <div className="border-border border-b py-16 px-8">
              <div className="max-w-4xl mx-auto text-white">
                <p className="text-xs font-semibold tracking-widest uppercase opacity-50 mb-3">
                  Data Sovereignty
                </p>
                <h1 className="text-4xl font-bold mb-3">Why Belrose Works</h1>
                <p className="text-lg opacity-70 max-w-2xl mx-auto">
                  Our pillars aren't just features. They're the foundation for something bigger —
                  returning the value of health data to the people who generate it.
                </p>
              </div>
            </div>

            <div className="flex-1 py-12 px-8">
              <div className="max-w-4xl mx-auto space-y-10">
                {whySections.map((section, i) => {
                  const Icon = section.icon;
                  return (
                    <div
                      key={i}
                      className="flex gap-10 items-center border-b border-white/10 pb-10 last:border-0 last:pb-0"
                    >
                      <div className="flex-shrink-0 w-36 text-center pt-1">
                        <div className="text-4xl font-bold text-accent leading-none mb-1">
                          {section.stat}
                        </div>
                        <div className="text-xs opacity-50 leading-snug">{section.statLabel}</div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon size={14} className="opacity-60" />
                          <p className="text-xs font-semibold tracking-widest uppercase opacity-60">
                            {section.label}
                          </p>
                        </div>
                        <h2 className="text-xl font-bold mb-3 leading-snug">{section.heading}</h2>
                        <p className="text-sm opacity-70 leading-relaxed">{section.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Footer />
          </div>
        </div>

        {/* ── Fixed dots — float above footer via footerOffset ── */}
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 flex gap-2 transition-all duration-150 ease-out"
          style={{ bottom: `${footerOffset}px` }}
        >
          <button
            onClick={() => goTo(0)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              activePanel === 0 ? 'w-6 bg-primary' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
            }`}
          />
          <button
            onClick={() => goTo(1)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              activePanel === 1 ? 'w-6 bg-primary shadow' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
            }`}
          />
        </div>

        {/* ── Left arrow: panel 0 → back to About Us ── */}
        <button
          onClick={() => navigate('/about')}
          aria-label="Back to About Us"
          className={`fixed left-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2 group transition-all duration-500 ${
            activePanel === 0
              ? 'opacity-100 translate-x-0 pointer-events-auto'
              : 'opacity-0 -translate-x-4 pointer-events-none'
          }`}
        >
          <div className="bg-white text-primary border border-primary/20 rounded-full w-12 h-12 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
            <ChevronLeft size={22} />
          </div>
          <span className="text-xs font-semibold text-gray-500 group-hover:text-gray-900 transition-colors tracking-wide whitespace-nowrap">
            Our Story
          </span>
        </button>

        {/* ── Right arrow: How → Why ── */}
        <button
          onClick={() => goTo(1)}
          aria-label="See Why Belrose Works"
          className={`fixed right-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2 group transition-all duration-500 ${
            activePanel === 0
              ? 'opacity-100 translate-x-0 pointer-events-auto'
              : 'opacity-0 translate-x-4 pointer-events-none'
          }`}
        >
          <div className="bg-primary text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
            <ChevronRight size={22} />
          </div>
          <span className="text-xs font-semibold text-gray-500 group-hover:text-gray-900 transition-colors tracking-wide whitespace-nowrap">
            Why Belrose
          </span>
        </button>

        {/* ── Left arrow: Why → How (panel 1 only) ── */}
        <button
          onClick={() => goTo(0)}
          aria-label="See How Belrose Works"
          className={`fixed left-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2 group transition-all duration-500 ${
            activePanel === 1
              ? 'opacity-100 translate-x-0 pointer-events-auto'
              : 'opacity-0 -translate-x-4 pointer-events-none'
          }`}
        >
          <div className="bg-white text-primary border border-primary/20 rounded-full w-12 h-12 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
            <ChevronLeft size={22} />
          </div>
          <span className="text-xs font-semibold text-white/70 group-hover:text-white transition-colors tracking-wide whitespace-nowrap">
            How It Works
          </span>
        </button>
      </div>

      {/* ════════════════════════════════════════════════
          MOBILE — stacked vertically
          ════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col">
        {/* How */}
        <div className="bg-white py-12 px-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
            The Belrose Protocol
          </p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">How Belrose Works</h1>
          <p className="text-gray-500 text-sm mb-8">
            Five pillars that give you complete ownership of your health records.
          </p>
          <div className="space-y-3">
            {steps.map(step => {
              const Icon = step.icon;
              return (
                <button
                  key={step.slug}
                  onClick={() => navigate(`/how-it-works/${step.slug}`)}
                  className={`w-full text-left rounded-xl border ${step.borderColor} ${step.bgColor} p-4 group`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center ${step.accentColor}`}
                    >
                      <Icon size={16} />
                    </div>
                    <p
                      className={`text-xs font-semibold tracking-widest uppercase ${step.accentColor}`}
                    >
                      {step.label}
                    </p>
                    <ArrowRight size={14} className={`ml-auto ${step.accentColor}`} />
                  </div>
                  <h2 className="text-base font-bold text-gray-900">{step.title}</h2>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{step.summary}</p>
                </button>
              );
            })}
          </div>
          {/* Mobile: back to About */}
          <button
            onClick={() => navigate('/about')}
            className="mt-8 flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors group"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Our Story
          </button>
        </div>

        {/* Why */}
        <div className="bg-primary text-primary-foreground py-12 px-4">
          <p className="text-xs font-semibold tracking-widest uppercase opacity-50 mb-2">
            Data Sovereignty
          </p>
          <h2 className="text-3xl font-bold mb-2">Why Belrose Works</h2>
          <p className="text-sm opacity-70 mb-8">
            The pillars serve a bigger purpose — returning the value of health data to you.
          </p>
          <div className="space-y-8">
            {whySections.map((section, i) => {
              const Icon = section.icon;
              return (
                <div key={i} className="border-b border-white/10 pb-8 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={13} className="opacity-60" />
                    <p className="text-xs font-semibold tracking-widest uppercase opacity-60">
                      {section.label}
                    </p>
                  </div>
                  <div className="text-3xl font-bold text-accent mt-2 mb-0.5">{section.stat}</div>
                  <p className="text-xs opacity-50 mb-3">{section.statLabel}</p>
                  <h3 className="text-lg font-bold mb-2">{section.heading}</h3>
                  <p className="text-sm opacity-70 leading-relaxed">{section.body}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-10 text-center">
            <button
              onClick={() => navigate('/auth')}
              className="bg-white text-primary font-semibold px-6 py-3 rounded-xl text-sm"
            >
              Get Started Free
            </button>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default HowItWorksIndex;
