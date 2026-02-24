// src/components/site/OurProtocol/HowStepDetails.tsx
import React from 'react';
import { ArrowRight } from 'lucide-react';
import { steps } from './howItWorksData';

const HowStepList: React.FC<{ onSelect: (slug: string) => void }> = ({ onSelect }) => (
  <div className="flex flex-col bg-white">
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
              onClick={() => onSelect(step.slug)}
              className={`w-full text-left rounded-2xl border ${step.borderColor} ${step.bgColor}
                p-6 group transition-all hover:shadow-md`}
            >
              <div className="flex items-start gap-5">
                <div className="flex-shrink-0 flex flex-col items-center gap-1">
                  <div
                    className={`w-11 h-11 rounded-full bg-white shadow-sm flex items-center
                    justify-center ${step.accentColor}`}
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
                      className={`flex-shrink-0 ${step.accentColor} opacity-0
                        group-hover:opacity-100 transition-all group-hover:translate-x-1`}
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{step.summary}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

export default HowStepList;
