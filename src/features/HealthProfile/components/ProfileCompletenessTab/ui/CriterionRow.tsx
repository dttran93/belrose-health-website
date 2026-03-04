import { CheckCircle2, Circle } from 'lucide-react';
import { CompletnessCriterion } from '../../../hooks/useProfileCompleteness';

/** Single criterion row */
const CriterionRow: React.FC<{
  criterion: CompletnessCriterion;
  color: string;
  bgColor: string;
}> = ({ criterion, color, bgColor }) => (
  <div
    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors"
    style={{
      background: criterion.done ? bgColor : 'hsl(var(--background))',
      borderColor: criterion.done ? color + '33' : 'hsl(var(--border))',
    }}
  >
    {/* Check icon */}
    {criterion.done ? (
      <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color }} />
    ) : (
      <Circle className="w-4 h-4 flex-shrink-0 text-muted-foreground/40" />
    )}

    {/* Label + hint */}
    <div className="flex-1 min-w-0">
      <p
        className="text-sm font-medium"
        style={{
          color: criterion.done ? 'hsl(var(--card-foreground))' : 'hsl(var(--muted-foreground))',
        }}
      >
        {criterion.label}
      </p>
      {!criterion.done && criterion.hint && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{criterion.hint}</p>
      )}
    </div>

    {/* Points badge */}
    <span
      className="text-xs font-semibold flex-shrink-0"
      style={{ color: criterion.done ? color : 'hsl(var(--muted-foreground) / 0.4)' }}
    >
      +{criterion.points}
    </span>
  </div>
);

export default CriterionRow;
