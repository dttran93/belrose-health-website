// src/features/Settings/hooks/useNotificationSettings.ts

import { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  NotificationPrefs,
  NotificationType,
  ChannelPrefs,
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_CATEGORIES,
  NotificationCategory,
} from '@belrose/shared';

function buildOnlyOverrides(
  prefs: NotificationPrefs
): Partial<Record<NotificationType, ChannelPrefs>> {
  const overrides: Partial<Record<NotificationType, ChannelPrefs>> = {};
  Object.entries(prefs).forEach(([type, val]) => {
    const t = type as NotificationType;
    const def = DEFAULT_NOTIFICATION_PREFS[t] ?? { inApp: true, email: true };
    if (val.inApp !== def.inApp || val.email !== def.email) {
      overrides[t] = val;
    }
  });
  return overrides;
}

export function useNotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => {
    // Start from full defaults
    const initial: NotificationPrefs = {};
    Object.values(NOTIFICATION_CATEGORIES).forEach(cat => {
      cat.notificationTypes.forEach(t => {
        initial[t as NotificationType] = { inApp: true, email: true };
      });
    });
    return initial;
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load from Firestore on mount
  useEffect(() => {
    const load = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      try {
        const db = getFirestore();
        const snap = await getDoc(doc(db, 'users', user.uid));
        const stored = snap.data()?.notificationPrefs as
          | Partial<Record<NotificationType, ChannelPrefs>>
          | undefined;

        if (stored) {
          // Merge stored overrides onto full defaults
          setPrefs(prev => ({ ...prev, ...stored }));
        }
      } catch (err) {
        console.error('Failed to load notification prefs:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Toggle a single notification type
  const toggleType = useCallback((type: NotificationType, channel: keyof ChannelPrefs) => {
    setPrefs(prev => ({
      ...prev,
      [type]: { ...prev[type]!, [channel]: !prev[type]![channel] },
    }));
    setSaved(false);
  }, []);

  // Toggle all types in a category
  const toggleCategory = useCallback(
    (category: NotificationCategory, channel: keyof ChannelPrefs) => {
      const types = NOTIFICATION_CATEGORIES[category]
        .notificationTypes as readonly NotificationType[];
      setPrefs(prev => {
        const allOn = types.every(t => prev[t]?.[channel]);
        const newVal = !allOn;
        const updated = { ...prev };
        types.forEach(t => {
          updated[t] = { ...updated[t]!, [channel]: newVal };
        });
        return updated;
      });
      setSaved(false);
    },
    []
  );

  // Derive category state — 'all' | 'none' | 'mixed'
  const getCategoryState = useCallback(
    (category: NotificationCategory, channel: keyof ChannelPrefs): 'all' | 'none' | 'mixed' => {
      const types = NOTIFICATION_CATEGORIES[category]
        .notificationTypes as readonly NotificationType[];
      const vals = types.map(t => prefs[t]?.[channel] ?? true);
      if (vals.every(v => v)) return 'all';
      if (vals.every(v => !v)) return 'none';
      return 'mixed';
    },
    [prefs]
  );

  // Save to Firestore — only store overrides from defaults
  const save = useCallback(async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    setError(null);

    try {
      const db = getFirestore();
      const overrides = buildOnlyOverrides(prefs);

      await updateDoc(doc(db, 'users', user.uid), {
        notificationPrefs: overrides,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Failed to save preferences. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  return {
    prefs,
    loading,
    saving,
    saved,
    error,
    toggleType,
    toggleCategory,
    getCategoryState,
    save,
  };
}
