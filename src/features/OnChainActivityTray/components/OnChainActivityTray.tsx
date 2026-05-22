// src/features/OnChainActivityTray/OnChainActivityTray.tsx

/**
 * OnChainActivityTray
 *
 * Fixed bottom-right panel that shows live on-chain transaction status.
 * Appears only when there are active/recent transactions; hides completely when empty.
 *
 * Each activity card shows:
 *   - Spinner (pending) / check (confirmed) / X (failed)
 *   - Human-readable label
 *   - Elapsed time or "Confirmed" / "Failed"
 *   - Optional link to Etherscan (when txHash is present)
 *   - Dismiss button (only on resolved items)
 *
 * Drop this into Layout.tsx alongside the existing footer/header slots.
 */

import React, { useEffect, useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  X,
  ChevronDown,
  ChevronUp,
  GlobeLock,
} from 'lucide-react';
import {
  useOnChainActivityTray,
  OnChainActivity,
  OnChainActivityStatus,
} from '../OnChainActivityTrayContext';
import { useNavigate } from 'react-router-dom';
import { NETWORK } from '@/config/blockchainAddresses';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Returns a live "Xm Ys ago" style string that updates every second for pending
 * items, and a static "just now" / timestamp for resolved ones.
 */
function useElapsed(startedAt: Date, status: OnChainActivityStatus): string {
  const [elapsed, setElapsed] = useState('just now');

  useEffect(() => {
    const update = () => {
      const seconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      if (seconds < 60) setElapsed(`${seconds}s`);
      else setElapsed(`${Math.floor(seconds / 60)}m ${seconds % 60}s`);
    };

    update();

    // Only keep ticking for pending transactions
    if (status !== 'pending') return;
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt, status]);

  return elapsed;
}

// ============================================================================
// ACTIVITY CARD
// ============================================================================

interface ActivityCardProps {
  activity: OnChainActivity;
  onDismiss: (id: string) => void;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity, onDismiss }) => {
  const navigate = useNavigate();
  const elapsed = useElapsed(activity.startedAt, activity.status);

  const isPending = activity.status === 'pending';
  const isConfirmed = activity.status === 'confirmed';
  const isFailed = activity.status === 'failed';
  const isClickable = isConfirmed && !!activity.link;

  const handleCardClick = () => {
    if (isClickable) navigate(activity.link!);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`
        flex items-start gap-3 p-3 rounded-lg border text-sm transition-all duration-300
        ${isPending ? 'bg-white border-gray-200' : ''}
        ${isConfirmed ? 'bg-green-50 border-green-200' : ''}
        ${isFailed ? 'bg-red-50 border-red-200' : ''}
        ${isClickable ? 'cursor-pointer hover:bg-green-100 hover:border-green-300' : ''}
      `}
    >
      {/* Status icon */}
      <div className="mt-0.5 flex-shrink-0">
        {isPending && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
        {isConfirmed && <CheckCircle2 className="w-4 h-4 text-green-600" />}
        {isFailed && <XCircle className="w-4 h-4 text-red-500" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`font-medium leading-tight truncate ${isFailed ? 'text-red-700' : 'text-gray-800'}`}
        >
          {activity.label}
        </p>

        {/* Status line */}
        <p
          className={`text-xs mt-0.5 ${isPending ? 'text-gray-400' : isConfirmed ? 'text-green-600' : 'text-red-500'}`}
        >
          {isPending && `Processing · ${elapsed}`}
          {isConfirmed && 'Confirmed on-network'}
          {isFailed && (activity.errorMessage ?? 'Transaction failed')}
        </p>

        {/* Etherscan link — only when we have a txHash */}
        {activity.txHash && (
          <a
            href={`${NETWORK.publicRpcUrl}/tx/${activity.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
          >
            <ExternalLink className="w-3 h-3" />
            View on network
          </a>
        )}
      </div>

      {/* Dismiss button — only for resolved items */}
      {!isPending && (
        <button
          onClick={e => {
            e.stopPropagation();
            onDismiss(activity.id);
          }}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// ============================================================================
// TRAY
// ============================================================================

export const OnChainActivityTray: React.FC = () => {
  const { activities, dismissActivity, dismissAll } = useOnChainActivityTray();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Hide entirely when there's nothing to show
  if (activities.length === 0) return null;

  const pendingCount = activities.filter(a => a.status === 'pending').length;
  const resolvedCount = activities.filter(a => a.status !== 'pending').length;

  return (
    <div
      className="fixed bottom-4 right-4 z-[200] w-80 shadow-xl rounded-xl overflow-hidden border border-gray-200 bg-white"
      style={{ maxHeight: '420px' }}
    >
      {/* Tray header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          {/* Blockchain icon */}
          <GlobeLock className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-gray-700">Distributed Network Activity</span>
          {pendingCount > 0 && (
            <span className="text-xs bg-primary text-white rounded-full px-1.5 py-0.5 leading-none font-medium">
              {pendingCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Dismiss all resolved */}
          {resolvedCount > 0 && (
            <button
              onClick={dismissAll}
              className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
            >
              Clear all
            </button>
          )}

          {/* Collapse / expand */}
          <button
            onClick={() => setIsCollapsed(c => !c)}
            className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded hover:bg-gray-100"
            aria-label={isCollapsed ? 'Expand tray' : 'Collapse tray'}
          >
            {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Activity list */}
      {!isCollapsed && (
        <div className="overflow-y-auto p-2 flex flex-col gap-2" style={{ maxHeight: '360px' }}>
          {/* Show newest first */}
          {[...activities].reverse().map(activity => (
            <ActivityCard key={activity.id} activity={activity} onDismiss={dismissActivity} />
          ))}
        </div>
      )}
    </div>
  );
};

export default OnChainActivityTray;
