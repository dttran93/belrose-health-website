// src/components/site/AboutUs.tsx

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/site/Navbar';
import Footer from '@/components/site/Footer';
import Values from '@/components/site/Home/Values';
import { ChevronRight } from 'lucide-react';

// ─── Problem card data ────────────────────────────────────────────────────────

interface ProblemCard {
  num: string;
  title: string;
  body: string;
  stat: {
    text: string;
    highlight: string; // the fragment to render in blue
  };
}

const problemCards: ProblemCard[] = [
  {
    num: '01',
    title: 'Records are siloed across providers, cities, and countries',
    body: 'Your GP holds one fragment. The hospital holds another. The specialist across town holds a third. None of them talk to each other. When you move, emigrate, or simply see a new doctor, your history goes dark. The current system is a patchwork of hardcopy records and siloed servers — often in conflicting formats that cannot be merged.',
    stat: {
      text: 'At worst, this leads to the unnecessary death of patients and eroded trust in the medical profession.',
      highlight: 'unnecessary death of patients',
    },
  },
  {
    num: '02',
    title: 'Without complete records, the promise of HealthTech cannot be kept',
    body: 'AI diagnostics, genomic medicine, and personalised treatment protocols all share a single dependency: comprehensive longitudinal health data. That data does not exist in usable form today. Healthcare technology has been starved of what it needs to become truly transformative — the way finance and other industries already have.',
    stat: {
      text: '25% of new FDA drug approvals are now personalised medicines — up from 5% in 2005. None of it scales without better records.',
      highlight: '25% of new FDA drug approvals',
    },
  },
  {
    num: '03',
    title: 'Centralisation has failed everywhere it has been tried',
    body: "The UK's NHS IT programme — the largest civilian IT project in history — was abandoned after a decade and over £10 billion spent. Similar efforts in the US and Europe have stalled repeatedly. The problem is not technical. It is structural: centralised systems require patients to trust governments and corporations with their most intimate data. That trust has been repeatedly broken.",
    stat: {
      text: 'The NHS IT programme cost over £10 billion and was ultimately abandoned in 2013.',
      highlight: 'over £10 billion',
    },
  },
];

// ─── Stat component: bolds the highlight fragment ────────────────────────────

const StatCallout: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  const parts = text.split(highlight);
  return (
    <div className="mt-6 px-5 py-4 bg-white border-l-[3px] border-pink-400 rounded-r-xl text-sm text-gray-700 leading-relaxed">
      {parts[0]}
      <strong className="text-blue-700">{highlight}</strong>
      {parts[1]}
    </div>
  );
};

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
      <section className="relative min-h-screen bg-primary flex flex-col justify-center px-8 py-24 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-[480px] h-[480px] rounded-full bg-white/[0.03] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-pink-500/10 translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="flex flex-col w-full max-w-5xl mx-auto items-center">
          <h1 className="font-serif text-[clamp(2.4rem,5vw,4.2rem)] font-bold text-white leading-[1.15] max-w-[820px] mb-10 tracking-tight">
            Belrose Health is
          </h1>

          <h2 className="font-serif text-[clamp(1.8rem,3.5vw,3rem)] font-bold text-white leading-[1.15] max-w-[820px] mb-10 tracking-tight">
            a <em className="text-accent">technology</em> and{' '}
            <em className="text-accent">incentivization</em> infrastructure that gives people{' '}
            <em className="text-accent">sovereignty</em> over their health data
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

          {/* Scroll hint */}
          <div className="absolute bottom-[130px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/25 text-[11px] tracking-widest uppercase animate-bounce">
            <span>Scroll</span>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
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
            <h2 className="font-serif text-[clamp(2rem,3vw,2.8rem)] font-black text-gray-900 leading-[1.15] mb-6">
              Health records
              <br />
              do not
              <br />
              <em className="not-italic text-blue-700">truly exist</em>
            </h2>
            <p className="text-[15px] text-gray-500 leading-relaxed max-w-[360px]">
              The system that should be the foundation of modern medicine is fractured,
              inaccessible, and failing patients every day.
            </p>

            {/* Progress dots */}
            <div className="flex gap-2 mt-10">
              {problemCards.map((_, i) => (
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
            {problemCards.map((card, i) => (
              <div
                key={i}
                ref={el => {
                  cardRefs.current[i] = el;
                }}
                data-index={i}
                className="min-h-[75vh] flex flex-col justify-center py-16 border-b border-gray-200 last:border-0
                opacity-30 translate-y-5 transition-all duration-500 ease-out"
              >
                <div className="text-left font-serif text-[5rem] font-black text-gray-300 leading-none mb-4 tracking-tight select-none">
                  {card.num}
                </div>
                <h3 className="text-left font-serif text-[1.55rem] font-bold text-gray-900 leading-snug mb-5">
                  {card.title}
                </h3>
                <p className="text-left text-[15px] text-gray-500 leading-[1.85] max-w-[480px]">
                  {card.body}
                </p>
                <StatCallout text={card.stat.text} highlight={card.stat.highlight} />
              </div>
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
