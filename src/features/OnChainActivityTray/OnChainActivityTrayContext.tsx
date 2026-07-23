// src/features/OnChainActivityTray/OnChainActivityTrayContext.tsx

/**
 * OnChainActivityTrayContext
 *
 * Global store for tracking on-chain transactions, and generic long-running
 * background tasks (e.g. record processing/upload), across the app.
 * Completely separate from the Sonner toast system — this persists
 * in the bottom-right tray until the user dismisses it.
 *
 * Usage:
 *   const { addActivity, updateActivity } = useOnChainActivityTray();
 *
 *   // When you fire a transaction (kind defaults to 'blockchain'):
 *   const activityId = addActivity({ label: 'Updating permissions' });
 *
 *   // When it confirms:
 *   updateActivity(activityId, { status: 'confirmed', txHash: '0x...' });
 *
 *   // If it fails:
 *   updateActivity(activityId, { status: 'failed', errorMessage: 'Gas error' });
 *
 *   // A generic background task instead:
 *   const activityId = addActivity({ label: 'Processing "file.pdf"', kind: 'task' });
 *   updateActivity(activityId, { label: 'Converting to FHIR...' }); // intermediate progress
 *   updateActivity(activityId, { status: 'confirmed' }); // done
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type OnChainActivityStatus = 'pending' | 'confirmed' | 'failed';

// 'blockchain' (default, for backward compatibility) is an on-chain transaction;
// 'task' is a generic background operation (e.g. record processing/upload) with no tx of its own.
export type OnChainActivityKind = 'blockchain' | 'task';

export interface OnChainActivity {
  id: string;
  label: string; // Human-readable description, e.g. "Updating permissions"
  status: OnChainActivityStatus;
  kind: OnChainActivityKind;
  txHash?: string; // Optional: populated once confirmed
  errorMessage?: string; // Optional: populated on failure
  startedAt: Date;
  resolvedAt?: Date;
  link?: string;
}

interface AddActivityInput {
  label: string;
  link?: string;
  kind?: OnChainActivityKind;
}

interface UpdateActivityInput {
  status?: OnChainActivityStatus;
  label?: string;
  link?: string;
  txHash?: string;
  errorMessage?: string;
}

interface OnChainActivityTrayContextType {
  activities: OnChainActivity[];
  addActivity: (input: AddActivityInput) => string; // Returns the new activity's id
  updateActivity: (id: string, update: UpdateActivityInput) => void;
  dismissActivity: (id: string) => void;
  dismissAll: () => void;
  hasPending: boolean;
}

// ============================================================================
// CONTEXT
// ============================================================================

const OnChainActivityTrayContext = createContext<OnChainActivityTrayContextType | undefined>(
  undefined
);

// ============================================================================
// PROVIDER
// ============================================================================

export const OnChainActivityTrayProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activities, setActivities] = useState<OnChainActivity[]>([]);

  // Add a new pending activity. Returns the generated id so callers can update it later.
  const addActivity = useCallback((input: AddActivityInput): string => {
    const id = `onchain-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newActivity: OnChainActivity = {
      id,
      label: input.label,
      status: 'pending',
      kind: input.kind ?? 'blockchain',
      startedAt: new Date(),
      link: input.link,
    };
    setActivities(prev => [...prev, newActivity]);
    return id;
  }, []);

  // Update an existing activity (e.g. mark as confirmed/failed, attach txHash)
  const updateActivity = useCallback((id: string, update: UpdateActivityInput) => {
    setActivities(prev =>
      prev.map(activity =>
        activity.id === id
          ? {
              ...activity,
              ...update,
              // Only stamp resolvedAt on a terminal status — intermediate label-only
              // updates (e.g. multi-stage task progress) shouldn't mark the card resolved.
              resolvedAt:
                update.status && update.status !== 'pending' ? new Date() : activity.resolvedAt,
            }
          : activity
      )
    );
  }, []);

  // Remove a single activity from the tray
  const dismissActivity = useCallback((id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
  }, []);

  // Clear all activities (e.g. a "dismiss all" button)
  const dismissAll = useCallback(() => {
    setActivities([]);
  }, []);

  const hasPending = activities.some(a => a.status === 'pending');

  return (
    <OnChainActivityTrayContext.Provider
      value={{ activities, addActivity, updateActivity, dismissActivity, dismissAll, hasPending }}
    >
      {children}
    </OnChainActivityTrayContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

export const useOnChainActivityTray = (): OnChainActivityTrayContextType => {
  const context = useContext(OnChainActivityTrayContext);
  if (!context) {
    throw new Error('useOnChainActivityTray must be used within OnChainActivityTrayProvider');
  }
  return context;
};
