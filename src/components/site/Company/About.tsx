// src/components/site/AboutUs.tsx

import React, { useEffect, useRef, useState } from 'react';
import Values from '@/components/site/Home/Values';
import ProblemCard from './ui/ProblemCard';
import problemData from './data/problemData';

// ─── Main component ───────────────────────────────────────────────────────────

const About: React.FC = () => {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeCard, setActiveCard] = useState(0);

  // IntersectionObserver — highlight the active dot and fade cards in
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-index'));
            setActiveCard(idx);
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-30', 'translate-y-5');
          } else {
            entry.target.classList.remove('opacity-100', 'translate-y-0');
            entry.target.classList.add('opacity-30', 'translate-y-5');
          }
        });
      },
      { threshold: 0.45 }
    );

    cardRefs.current.forEach(ref => {
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* ── 1. Declaration ─────────────────────────────────────────────────── */}
      <section className="relative h-[calc(100dvh-4rem)] bg-primary flex flex-col justify-between p-8 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-[480px] h-[480px] rounded-full bg-white/[0.03] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-pink-500/10 translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="flex flex-col w-full max-w-5xl mx-auto items-center justify-center flex-1">
          <h1 className="text-[clamp(2.4rem,5vw,5.5rem)] font-bold text-white leading-[1.15] max-w-[820px] mb-10 tracking-tight">
            Belrose Health is
          </h1>

          <h2 className="text-[clamp(1.8rem,3.5vw,3.3rem)] font-bold text-white leading-[1.15] max-w-[820px] mb-10 tracking-tight">
            a <em className="not-italic text-accent">technology</em> and{' '}
            <em className="not-italic text-accent">incentivization</em> infrastructure that gives
            people <em className="not-italic text-accent">sovereignty</em> over their health
            data{' '}
          </h2>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 mb-1">
              <div className="flex-1 h-px bg-white/20" />
              <p className="text-[13px] tracking-[0.2em] uppercase text-white/50 font-medium">
                because
              </p>
              <div className="flex-1 h-px bg-white/20" />
            </div>
            {[
              'Health records do not truly exist',
              'Without health records, HealthTech will never achieve its potential to save lives',
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-4 text-left">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-500/25 text-pink-300 text-[11px] font-semibold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-white text-[18px] leading-relaxed">{point}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Scroll hint */}
        <div className="flex flex-col items-center gap-2 text-white/25 text-[11px] tracking-widest uppercase animate-bounce pb-6 pt-4">
          <span>Scroll</span>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── 2. Problem scroll ──────────────────────────────────────────────── */}
      <div className="bg-gray-50">
        <div className="flex max-w-7xl mx-auto">
          {/* Sticky left */}
          <div className="hidden md:flex w-[42%] sticky top-16 h-[calc(100vh-4rem)] flex-col justify-center px-[6vw] md:pl-8">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-pink-500 mb-5">
              The Problem
            </p>
            <h2 className="text-[clamp(2rem,3vw,2.8rem)] font-black text-gray-900 leading-[1.15] mb-6">
              Health records
              <br />
              do not
              <br />
              <em className="not-italic text-blue-700">truly exist</em>
            </h2>

            {/* Progress dots */}
            <div className="flex gap-2 mt-10">
              {problemData.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeCard === i ? 'w-7 bg-blue-600' : 'w-1.5 bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Scrolling right cards */}
          <div className="w-full md:w-[58%] py-16 px-8 md:pr-[8vw] md:pl-8 flex flex-col gap-0">
            {problemData.map((card, i) => (
              <ProblemCard
                key={i}
                card={card}
                index={i}
                cardRef={el => {
                  cardRefs.current[i] = el;
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── 3. Values (reused component) ───────────────────────────────────── */}
      <Values />
    </div>
  );
};

export default About;
