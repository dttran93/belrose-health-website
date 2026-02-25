// src/components/site/OurProtocol/Why.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { whySections } from './whyItWorksData';

const Why: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col bg-primary text-primary-foreground">
      {/* Header */}
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

      {/* Why sections */}
      <div className="flex-1 py-12 px-8">
        <div className="max-w-4xl mx-auto space-y-10">
          {whySections.map((section, i) => {
            const Icon = section.icon;
            return (
              <div
                key={i}
                className="flex gap-10 items-center border-b border-white/10 pb-10 last:border-0 last:pb-0"
              >
                {/* Stat */}
                <div className="flex-shrink-0 w-36 text-center pt-1">
                  <div className="text-4xl font-bold text-accent leading-none mb-1">
                    {section.stat}
                  </div>
                  <div className="text-xs opacity-50 leading-snug">{section.statLabel}</div>
                </div>
                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={14} className="opacity-60" />
                    <p className="text-xs font-semibold tracking-widest uppercase opacity-60">
                      {section.label}
                    </p>
                  </div>
                  <h2 className="text-xl font-bold mb-3 leading-snug">{section.heading}</h2>
                  <div className="text-sm opacity-70 leading-relaxed">{section.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile-only: CTA */}
      <div className="md:hidden px-4 pb-12 pt-2 text-center">
        <button
          onClick={() => navigate('/auth')}
          className="bg-white text-primary font-semibold px-6 py-3 rounded-xl text-sm"
        >
          Get Started Free
        </button>
      </div>
    </div>
  );
};

export default Why;
