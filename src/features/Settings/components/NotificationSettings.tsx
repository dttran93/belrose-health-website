// src/features/Settings/components/NotificationSettings.tsx

import React, { useState } from 'react';
import { ChevronDown, Bell, Mail } from 'lucide-react';
import {
  NOTIFICATION_CATEGORIES,
  NotificationCategory,
  NotificationType,
  ChannelPrefs,
} from '@belrose/shared';
import { useNotificationSettings } from '../hooks/useNotificationSettings';
import { Button } from '@/components/ui/Button';

// ── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<NotificationCategory, { desc: string }> = {
  recordEditing: { desc: 'When records you are connected to are edited' },
  recordDeletion: { desc: 'When records you manage are deleted' },
  subjectRequests: { desc: 'Consent requests and responses' },
  permissions: { desc: 'When your access on a record changes' },
  credibility: { desc: 'Verifications or disputes on your records' },
  trustee: { desc: 'Trustee invites and status changes' },
  recordRequests: { desc: 'Responses to your record requests' },
  system: { desc: 'Platform updates and announcements' },
};

function formatTypeName(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
}

// ── Toggle component ─────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}

const Toggle: React.FC<ToggleProps> = ({ checked, indeterminate, onChange, label }) => {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate ?? false;
  }, [indeterminate]);

  return (
    <button
      role="switch"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
        checked && !indeterminate ? 'bg-primary' : indeterminate ? 'bg-primary/40' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
          checked && !indeterminate
            ? 'translate-x-4'
            : indeterminate
              ? 'translate-x-2'
              : 'translate-x-0'
        }`}
      />
    </button>
  );
};

// ── Category row ─────────────────────────────────────────────────────────────

interface CategoryRowProps {
  category: NotificationCategory;
  getCategoryState: (cat: NotificationCategory, ch: keyof ChannelPrefs) => 'all' | 'none' | 'mixed';
  toggleCategory: (cat: NotificationCategory, ch: keyof ChannelPrefs) => void;
  toggleType: (type: NotificationType, ch: keyof ChannelPrefs) => void;
  prefs: Partial<Record<NotificationType, ChannelPrefs>>;
}

const CategoryRow: React.FC<CategoryRowProps> = ({
  category,
  getCategoryState,
  toggleCategory,
  toggleType,
  prefs,
}) => {
  const [open, setOpen] = useState(false);
  const catData = NOTIFICATION_CATEGORIES[category];
  const config = CATEGORY_CONFIG[category];
  const inAppState = getCategoryState(category, 'inApp');
  const emailState = getCategoryState(category, 'email');
  const isMixed = inAppState === 'mixed' || emailState === 'mixed';

  return (
    <div className="border border-border rounded-lg mb-2 overflow-hidden">
      {/* Category header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{catData.label}</span>
            {isMixed && (
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                partial
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{config.desc}</p>
        </div>

        {/* Category-level toggles */}
        <div className="flex items-center gap-6 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">In-app</span>
            <Toggle
              checked={inAppState === 'all'}
              indeterminate={inAppState === 'mixed'}
              onChange={() => toggleCategory(category, 'inApp')}
              label={`In-app notifications for ${catData.label}`}
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">Email</span>
            <Toggle
              checked={emailState === 'all'}
              indeterminate={emailState === 'mixed'}
              onChange={() => toggleCategory(category, 'email')}
              label={`Email notifications for ${catData.label}`}
            />
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Per-type rows */}
      {open && (
        <div className="border-t border-border">
          {(catData.notificationTypes as readonly NotificationType[]).map(type => (
            <div
              key={type}
              className="flex items-center gap-3 px-4 py-2.5 pl-8 border-b border-border last:border-b-0 bg-muted/20"
            >
              <span className="flex-1 text-xs text-muted-foreground">{formatTypeName(type)}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex justify-center" style={{ width: '52px' }}>
                  <Toggle
                    checked={prefs[type]?.inApp ?? true}
                    onChange={() => toggleType(type, 'inApp')}
                    label={`In-app for ${type}`}
                  />
                </div>
                <div className="flex justify-center" style={{ width: '52px' }}>
                  <Toggle
                    checked={prefs[type]?.email ?? true}
                    onChange={() => toggleType(type, 'email')}
                    label={`Email for ${type}`}
                  />
                </div>
              </div>
              <div style={{ width: '8px' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────────────

const NotificationSettings: React.FC = () => {
  const {
    prefs,
    loading,
    saving,
    saved,
    error,
    toggleType,
    toggleCategory,
    getCategoryState,
    save,
  } = useNotificationSettings();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Control which notifications you receive and how. Click a category to configure individual
          types.
        </p>
      </div>

      {/* Column headers */}
      <div className="flex items-center justify-end gap-4 pb-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bell className="w-3 h-3" /> In-app
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="w-3 h-3" /> Email
        </div>
        <div style={{ width: '16px' }} />
      </div>

      {/* Categories */}
      {(Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[]).map(category => (
        <CategoryRow
          key={category}
          category={category}
          getCategoryState={getCategoryState}
          toggleCategory={toggleCategory}
          toggleType={toggleType}
          prefs={prefs}
        />
      ))}

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Save bar */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <span
          className={`text-sm text-green-600 transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`}
        >
          Preferences saved
        </span>
        <Button onClick={save} disabled={saving} variant="outline" size="sm">
          {saving ? 'Saving...' : 'Save preferences'}
        </Button>
      </div>
    </div>
  );
};

export default NotificationSettings;
