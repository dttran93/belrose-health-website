import React from 'react';
import { cn } from '@/utils/utils';
import { Button } from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';
import {
  CULPABILITY_OPTIONS,
  DisputeCulpability,
  DisputeDoc,
  DisputeSeverity,
  SEVERITY_OPTIONS,
} from '../../services/disputeService';

// ============================================================
// TYPES
// ============================================================

interface DisputeFormProps {
  severity: DisputeSeverity | null;
  culpability: DisputeCulpability | null;
  notes: string;
  onSelectSeverity: (severity: DisputeSeverity) => void;
  onSelectCulpability: (culpability: DisputeCulpability) => void;
  onNotesChange: (notes: string) => void;
  existingDispute: DisputeDoc | null;
}

// ============================================================
// CONSTANTS
// ============================================================

const DisputeForm: React.FC<DisputeFormProps> = ({
  severity,
  culpability,
  notes,
  onSelectSeverity,
  onSelectCulpability,
  onNotesChange,
  existingDispute,
}) => {
  if (existingDispute) {
    const severityLevel = SEVERITY_OPTIONS.find(l => l.value === existingDispute.severity);
    const culpabilityLevel = CULPABILITY_OPTIONS.find(l => l.value === existingDispute.culpability);
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 mx-auto mb-5 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-primary mb-2">
          You've already disputed this record
        </h3>
        <p className="text-sm text-foreground mb-1">
          Severity: <strong>{severityLevel?.name}</strong>
        </p>
        <p className="text-sm text-foreground mb-6">
          Culpability: <strong>{culpabilityLevel?.name}</strong>
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" className="border-red-600 text-red-600 hover:bg-red-50">
            Modify Dispute
          </Button>
          <Button>Retract Dispute</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Severity Selection */}
      <div>
        <h3 className="text-base font-semibold text-primary mb-3">How severe is the issue?</h3>
        <div className="grid grid-cols-3 gap-3">
          {SEVERITY_OPTIONS.map(level => (
            <button
              key={level.value}
              className={cn(
                'p-4 text-center border-2 rounded-xl transition-all',
                severity === level.value
                  ? 'border-red-500 bg-red-100'
                  : 'border-border hover:border-red-300 bg-background'
              )}
              onClick={() => onSelectSeverity(level.value)}
            >
              <span className="block text-sm font-semibold text-primary">{level.name}</span>
              <span className="block text-[10px] text-muted-foreground mt-1 leading-tight">
                {level.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Culpability Selection */}
      <div>
        <h3 className="text-base font-semibold text-primary mb-3">What caused this issue?</h3>
        <div className="space-y-2">
          {CULPABILITY_OPTIONS.map(level => (
            <button
              key={level.value}
              className={cn(
                'w-full flex items-center gap-3 p-3 border-2 rounded-xl transition-all text-left',
                culpability === level.value
                  ? 'border-red-700 bg-red-100'
                  : 'border-border hover:border-red-300 bg-background'
              )}
              onClick={() => onSelectCulpability(level.value)}
            >
              <div
                className={cn(
                  'w-3 h-3 rounded-full shrink-0',
                  culpability === level.value ? 'bg-red-700' : 'bg-border'
                )}
              />
              <div className="flex-1">
                <span className="block text-sm font-semibold text-primary">{level.name}</span>
                <span className="block text-xs text-muted-foreground">{level.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Notes Field */}
      <div>
        <h3 className="text-base font-semibold text-primary mb-1">Additional Details (Optional)</h3>
        <p className="text-sm text-foreground mb-3">
          Provide context about the issue. This will be encrypted and stored securely.
        </p>
        <textarea
          className={cn(
            'w-full p-4 text-sm border-2 border-border rounded-xl bg-background',
            'focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-transparent',
            'placeholder-muted-foreground resize-y transition-all'
          )}
          placeholder="Describe the issue in detail..."
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          rows={3}
        />
        <p className="mt-2 text-xs text-muted-foreground text-right">{notes.length} characters</p>
      </div>
    </div>
  );
};

export default DisputeForm;
