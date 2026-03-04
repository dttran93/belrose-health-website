// src/pages/Index.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '@/components/site/Navbar';
import Footer from '@/components/site/Footer';
import Home from '@/components/site/Home/Home';
import How from '@/components/site/OurProtocol/How';
import Why from '@/components/site/OurProtocol/Why';
import Who from '@/components/site/Company/Who';
import About from '@/components/site/Company/About';
import NavArrow from '@/components/site/ui/NavArrow';
import FAQFull from '@/components/site/FAQ/FAQFull';
import CitationModal from '@/components/site/Citations/CitationModal';
import WaitlistBanner from '@/components/site/WaitlistBanner';

// ─── Section config ───────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'home', label: 'Home', component: Home },
  { id: 'about', label: "What We're About", component: About },
  { id: 'how', label: 'See How It Works', component: How },
  { id: 'why', label: 'See Why It Works', component: Why },
  { id: 'who', label: 'Who We Are', component: Who },
  { id: 'faq', label: 'Questions?', component: FAQFull },
] as const;

const COUNT = SECTIONS.length;
type SectionIndex = 0 | 1 | 2 | 3 | 4 | 5;

// Parse '#how/collect' → { sectionId: 'how', subSlug: 'collect' }
// Parse '#about'      → { sectionId: 'about', subSlug: null }
const parseHash = (hash: string): { sectionId: string; subSlug: string | null } => {
  const parts = hash.replace('#', '').split('/');
  return { sectionId: parts[0] ?? 'home', subSlug: parts[1] ?? null };
};

const indexById = (id: string): SectionIndex => {
  const idx = SECTIONS.findIndex(s => s.id === id);
  return (idx >= 0 ? idx : 0) as SectionIndex;
};

// ─── Shell ────────────────────────────────────────────────────────────────────

const Index: React.FC = () => {
  const location = useLocation();

  const [active, setActive] = useState<SectionIndex>(0);
  const [prev, setPrev] = useState<SectionIndex | null>(null);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [footerOffset, setFooterOffset] = useState(24);
  const [howInitialSlug, setHowInitialSlug] = useState<string | undefined>(undefined);

  const footerRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── Parse hash on mount for deep-linking ──
  useEffect(() => {
    const { sectionId, subSlug } = parseHash(location.hash);
    const idx = indexById(sectionId);
    setActive(idx);
    if (sectionId === 'how' && subSlug) setHowInitialSlug(subSlug);
  }, [location.hash]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll active panel to top on section change ──
  useEffect(() => {
    panelRefs.current[active]?.scrollTo({ top: 0, behavior: 'instant' });
  }, [active]);

  // ── Footer observer — push dots up when footer scrolls into view ──
  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
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
    observer.observe(el);
    return () => observer.disconnect();
  }, [active]);

  // ── Navigate between sections ──
  const goTo = useCallback(
    (idx: SectionIndex) => {
      if (idx === active) return;
      const isForward = idx === (active + 1) % COUNT || (active === COUNT - 1 && idx === 0);
      setDirection(isForward ? 'forward' : 'back');
      setPrev(active);
      setActive(idx);
      if (active === 2) setHowInitialSlug(undefined);

      const targetId = SECTIONS[idx]?.id ?? 'home';
      const { sectionId, subSlug } = parseHash(window.location.hash);

      if (sectionId !== targetId) {
        window.location.hash = targetId;
      }
    },
    [active]
  );

  const goNext = useCallback(() => goTo(((active + 1) % COUNT) as SectionIndex), [active, goTo]);
  const goPrev = useCallback(
    () => goTo(((active + COUNT - 1) % COUNT) as SectionIndex),
    [active, goTo]
  );

  // ── Slide classes ──
  const getSlideClass = (i: number) => {
    if (i === active) return 'opacity-100 translate-x-0 pointer-events-auto';
    if (i === prev)
      return `opacity-0 ${direction === 'forward' ? '-translate-x-6' : 'translate-x-6'} pointer-events-none`;
    return 'opacity-0 translate-x-6 pointer-events-none';
  };

  // ── Derived ──
  const isDark = active === 3;
  const prevLabel = SECTIONS[(active + COUNT - 1) % COUNT]?.label ?? '';
  const nextLabel = SECTIONS[(active + 1) % COUNT]?.label ?? '';

  return (
    <>
      {/* ══════════════════════════════════════════════
          DESKTOP — fixed viewport, panel-switching
          ══════════════════════════════════════════════ */}
      <div className="hidden md:flex fixed inset-0 flex-col bg-white">
        {/* Navbar */}
        <div className="flex-shrink-0 z-40 relative">
          <WaitlistBanner />
          <Navbar />
        </div>

        {/* Section panels */}
        <div className="relative flex-1 overflow-hidden">
          {SECTIONS.map(({ id, component: Section }, i) => (
            <div
              key={id}
              ref={el => {
                panelRefs.current[i] = el;
              }}
              className={`
                absolute inset-0 overflow-y-auto
                transition-all ease-in-out
                ${getSlideClass(i)}
              `}
              style={{ transitionDuration: '380ms' }}
            >
              {/* Pass initialSlug only to the How panel */}
              {id === 'how' ? <How initialSlug={howInitialSlug} /> : <Section />}
              <div ref={i === active ? footerRef : undefined}>
                <Footer />
              </div>
            </div>
          ))}
        </div>

        <NavArrow direction="left" label={prevLabel} onClick={goPrev} dark={isDark} />
        <NavArrow direction="right" label={nextLabel} onClick={goNext} dark={isDark} />

        {/* Dot indicators */}
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 flex gap-1.5 transition-all duration-150 ease-out"
          style={{ bottom: `${footerOffset}px` }}
        >
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i as SectionIndex)}
              aria-label={`Go to ${s.label}`}
              className={`
                h-1 rounded-full transition-all duration-300
                ${
                  i === active
                    ? `w-5 ${isDark ? 'bg-white' : 'bg-primary'}`
                    : `w-1 ${isDark ? 'bg-white/30 hover:bg-white/60' : 'bg-gray-300 hover:bg-gray-500'}`
                }
              `}
            />
          ))}
        </div>
      </div>
      {/* ══════════════════════════════════════════════
          MOBILE — normal vertical scroll, sections stack
          ══════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          {SECTIONS.map(({ id, component: Section }) => (
            <section key={id} id={id}>
              {id === 'how' ? <How /> : <Section />}
            </section>
          ))}
        </main>
        <Footer />
      </div>
      <CitationModal />;
    </>
  );
};

export default Index;
