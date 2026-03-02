//src/features/HealthProfile/components/ui/HashRow.tsx

import { UserBadge } from '@/features/Users/components/ui/UserBadge';

/**
 * Hash row in the hash history section of the Health Profile
 */

function HashRow({
  hash,
  index,
  isCurrent,
  isMatched,
  matchType,
}: {
  hash: string;
  index: number;
  isCurrent: boolean;
  isMatched: boolean;
  matchType: 'current' | 'previous';
}) {
  const matchedGreen = isMatched && matchType === 'current';
  const matchedBlue = isMatched && matchType === 'previous';

  return (
    <div className="flex items-center gap-3 py-1.5 last:border-0">
      <span className="text-[10px] text-muted-foreground w-8 shrink-0">v{index + 1}</span>
      <span className="font-mono text-xs text-foreground flex-1 truncate">{hash}</span>
      <div className="flex gap-1.5 shrink-0 w-40 justify-end">
        {isCurrent && (
          <UserBadge text="Current" color="blue" tooltip="This is the current Firestore hash" />
        )}
        {matchedGreen && (
          <UserBadge text="On-chain" color="green" tooltip="Matches on-chain hash" />
        )}
        {matchedBlue && (
          <UserBadge text="On-chain ←" color="blue" tooltip="Previous version matched on-chain" />
        )}
        {!isCurrent && !isMatched && (
          <UserBadge text="Self-Reported" color="gray" tooltip="Not found on-chain" />
        )}
      </div>
    </div>
  );
}

export default HashRow;
