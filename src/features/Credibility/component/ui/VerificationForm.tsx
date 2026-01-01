import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/utils';
import { CheckCircle, FileText, Lock, MapPin } from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

export type VerificationLevel = 1 | 2 | 3;

export interface VerificationData {
  recordId: string;
  recordHash: string;
  level: VerificationLevel;
}

export interface ExistingVerification {
  level: VerificationLevel;
  createdAt: string;
  isActive: boolean;
}

interface VerificationFormProps {
  selectedLevel: VerificationLevel | null;
  onSelectLevel: (level: VerificationLevel) => void;
  existingVerification: ExistingVerification | null;
}

// ============================================================
// CONSTANTS
// ============================================================

interface VerificationLevelConfig {
  value: VerificationLevel;
  name: string;
  icon: React.ReactNode;
  description: string;
  examples: string;
}

const VERIFICATION_LEVELS: VerificationLevelConfig[] = [
  {
    value: 3,
    name: 'Full',
    icon: <Lock className="w-5 h-5" />,
    description:
      'I created this record or am willing to vouch for both the content and provenance of the record',
    examples:
      'You are the original provider who created this record or directly observed the interaction.',
  },
  {
    value: 2,
    name: 'Content',
    icon: <FileText className="w-5 h-5" />,
    description: 'I vouch for the medical accuracy of this record',
    examples:
      "You reviewed the diagnosis and agree with it, even if you weren't the original provider.",
  },
  {
    value: 1,
    name: 'Provenance',
    icon: <MapPin className="w-5 h-5" />,
    description: 'I can verify where this record came from',
    examples:
      'You confirmed the origin of the record by viewing a paper trail, confirming it came from the stated hospital, etc.',
  },
];

const VerificationForm: React.FC<VerificationFormProps> = ({
  selectedLevel,
  onSelectLevel,
  existingVerification,
}) => {
  if (existingVerification) {
    const level = VERIFICATION_LEVELS.find(l => l.value === existingVerification.level);
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 mx-auto mb-5 bg-chart-3/10 text-chart-3 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-primary mb-2">
          You've already verified this record
        </h3>
        <p className="text-sm text-foreground mb-6">
          Level: <strong>{level?.name}</strong>
        </p>
        <Button variant="outline" className="border-chart-3 text-chart-3 hover:bg-chart-3/10">
          Modify Verification
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-primary mb-1">What can you verify?</h3>
      <p className="text-sm text-foreground mb-5">
        Select the level of verification you can provide for this record.
      </p>

      <div className="space-y-3">
        {VERIFICATION_LEVELS.map(level => (
          <button
            key={level.value}
            className={cn(
              'w-full p-4 text-left border-2 rounded-xl transition-all',
              selectedLevel === level.value
                ? 'border-chart-3 bg-chart-3/5'
                : 'border-border hover:border-chart-3/50 bg-background'
            )}
            onClick={() => onSelectLevel(level.value)}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center',
                  selectedLevel === level.value
                    ? 'bg-chart-3/20 text-chart-3'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {level.icon}
              </div>
              <span className="flex-1 font-semibold text-primary">{level.name}</span>
              {selectedLevel === level.value && (
                <div className="w-6 h-6 bg-chart-3 text-white rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4" />
                </div>
              )}
            </div>
            <p className="text-sm text-foreground mb-1">{level.description}</p>
            <p className="text-xs text-muted-foreground italic">{level.examples}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default VerificationForm;
