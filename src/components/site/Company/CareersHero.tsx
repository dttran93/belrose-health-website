// src/components/site/Company/CareersHero.tsx

import React from 'react';

const CareersHero: React.FC = () => {
  return (
    <section className="relative bg-primary px-8 py-10 overflow-hidden">
      {/* Decorative blobs */}
      <div
        className="absolute top-0 right-0 w-[480px] h-[480px] rounded-full
          bg-white/[0.03] -translate-y-1/2 translate-x-1/2 pointer-events-none"
      />
      <div
        className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full
          bg-pink-500/10 translate-y-1/2 -translate-x-1/2 pointer-events-none"
      />

      <div className="flex flex-col max-w-5xl mx-auto text-left">
        <p
          className="text-[11px] font-semibold tracking-[0.2em] uppercase
            text-pink-300/70 mb-6"
        >
          Careers at Belrose
        </p>
        <h1
          className="text-[clamp(2.2rem,4vw,3.4rem)] font-bold text-white
            leading-[1.15] max-w-[680px] mb-6 tracking-tight"
        >
          We're building infrastructure for{' '}
          <em className="not-italic text-accent">health data sovereignty</em>
        </h1>
        <p className="text-white/60 text-[16px] leading-[1.8] max-w-[520px] mb-10">
          We are a mission driven team that cares about making the world healthier and more
          equitable. We want to work with people who do too.
        </p>
      </div>
    </section>
  );
};

export default CareersHero;
