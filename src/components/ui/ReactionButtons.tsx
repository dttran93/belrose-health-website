import React from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/utils/utils';
import * as Tooltip from '@radix-ui/react-tooltip';

export type ReactionType = 'support' | 'oppose' | null;

export interface ReactionButtonsProps {
  supportCount: number;
  opposeCount: number;
  userReaction?: ReactionType;
  onSupport?: () => void;
  onOppose?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  supportTooltip?: string;
  opposeTooltip?: string;
}

export const ReactionButtons: React.FC<ReactionButtonsProps> = ({
  supportCount,
  opposeCount,
  userReaction = null,
  onSupport,
  onOppose,
  disabled = false,
  isLoading = false,
  className,
  supportTooltip = 'Support this',
  opposeTooltip = 'Oppose this',
}) => {
  const isDisabled = disabled || isLoading;

  // Shared button styles
  const btnBase = 'inline-flex items-center px-2 py-1 gap-1 transition-all duration-200 border';
  const btnDisabled = 'opacity-50 cursor-not-allowed hover:bg-gray-50';

  const handleAction = (e: React.MouseEvent, callback?: () => void) => {
    e.stopPropagation();
    if (!isDisabled && callback) callback();
  };

  return (
    <div className={cn('inline-flex items-center bg-gray-50 rounded-full', className)}>
      {/* Support Button */}
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={e => handleAction(e, onSupport)}
              disabled={isDisabled}
              className={cn(
                btnBase,
                'rounded-l-full border-r-0',
                userReaction === 'support'
                  ? 'bg-green-100 border-green-500 text-green-700 border-r-1 z-10'
                  : 'bg-gray-50 border-gray-500 text-gray-600 hover:bg-gray-100',
                isDisabled && btnDisabled
              )}
            >
              <ThumbsUp
                className={cn('w-3.5 h-3.5', userReaction === 'support' && 'fill-green-600')}
              />
              <span className="text-xs font-medium tabular-nums">{supportCount}</span>
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 z-50">
            {supportTooltip}
          </Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>

      {/* Oppose Button */}
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={e => handleAction(e, onOppose)}
              disabled={isDisabled}
              className={cn(
                btnBase,
                'rounded-r-full border-l-0',
                userReaction === 'oppose'
                  ? 'bg-red-100 border-red-500 text-red-700 z-10 border-l-1'
                  : 'bg-gray-50 border-gray-500 text-gray-600 hover:bg-gray-100',
                isDisabled && btnDisabled
              )}
            >
              <ThumbsDown
                className={cn('w-3.5 h-3.5', userReaction === 'oppose' && 'fill-red-600')}
              />
              <span className="text-xs font-medium tabular-nums">{opposeCount}</span>
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 z-50">
            {opposeTooltip}
          </Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    </div>
  );
};

export default ReactionButtons;
