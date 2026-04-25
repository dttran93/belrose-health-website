// src/features/IdentityVerification/components/StepIndicator.tsx

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export type StepStatus = 'complete' | 'current' | 'upcoming';

interface Step {
  label: string;
  status: StepStatus;
}

interface StepIndicatorProps {
  steps: Step[];
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ steps }) => (
  <div className="flex items-center justify-center gap-0 mb-6">
    {steps.map((step, i) => (
      <React.Fragment key={step.label}>
        <div className="flex flex-col items-center gap-1">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              step.status === 'complete'
                ? 'bg-complement-3 text-white'
                : step.status === 'current'
                  ? 'bg-primary text-white ring-4 ring-primary/20'
                  : 'bg-gray-100 text-gray-400'
            }`}
          >
            {step.status === 'complete' ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          <span
            className={`text-xs ${
              step.status === 'current'
                ? 'text-primary font-medium'
                : step.status === 'complete'
                  ? 'text-complement-3'
                  : 'text-gray-400'
            }`}
          >
            {step.label}
          </span>
        </div>

        {/* Connector line */}
        {i < steps.length - 1 && (
          <div
            className={`h-0.5 w-12 mb-5 mx-1 transition-all ${
              steps[i + 1]?.status !== 'upcoming' ? 'bg-complement-3' : 'bg-gray-200'
            }`}
          />
        )}
      </React.Fragment>
    ))}
  </div>
);

export default StepIndicator;
