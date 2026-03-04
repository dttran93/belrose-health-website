// src/features/HealthProfile/components/identity/UserIdentityForm.tsx

import React, { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { UserIdentity } from '../../utils/parseUserIdentity';
import { saveUserIdentityRecord } from '../../services/userIdentityService';
import { toast } from 'sonner';
import { FileObject } from '@/types/core';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import mapFirestoreToFileObject from '@/features/ViewEditRecord/utils/firestoreMapping';

interface UserIdentityFormProps {
  userId: string;
  initial?: UserIdentity; // pre-populated when editing existing record
  onSaved?: (record: FileObject) => void;
}

const GENDER_OPTIONS = ['male', 'female', 'other', 'unknown'];

const FIELD_CLASSES = `
  w-full px-3 py-2 text-sm rounded-lg border border-border
  bg-background text-card-foreground
  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
  placeholder:text-muted-foreground/50
  transition-colors
`;

const LABEL_CLASSES = 'block text-xs font-medium text-muted-foreground mb-1';

export const UserIdentityForm: React.FC<UserIdentityFormProps> = ({
  userId,
  initial = {},
  onSaved,
}) => {
  const [form, setForm] = useState<UserIdentity>(initial);
  const [saving, setSaving] = useState(false);

  const set = (field: keyof UserIdentity, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await saveUserIdentityRecord(userId, form);

      // Fetch the just-saved record to pass back
      const recordId = `${userId}_u_id`;
      const db = getFirestore();
      const snap = await getDoc(doc(db, 'records', recordId));
      const record = mapFirestoreToFileObject(snap.id, snap.data()!);
      onSaved?.(record);

      toast.success('Identity saved', {
        description: 'Your identity record has been updated.',
      });
    } catch (err: any) {
      toast.error('Failed to save identity', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Core Identity ─────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Core Identity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={LABEL_CLASSES}>Full Name</label>
            <input
              className={FIELD_CLASSES}
              placeholder="e.g. Jane Smith"
              value={form.fullName ?? ''}
              onChange={e => set('fullName', e.target.value || undefined)}
            />
          </div>

          <div>
            <label className={LABEL_CLASSES}>Date of Birth</label>
            <input
              type="date"
              className={FIELD_CLASSES}
              value={form.dateOfBirth ? form.dateOfBirth.toISOString().split('T')[0] : ''}
              onChange={e =>
                set('dateOfBirth', e.target.value ? new Date(e.target.value) : undefined)
              }
            />
          </div>

          <div>
            <label className={LABEL_CLASSES}>Gender</label>
            <select
              className={FIELD_CLASSES}
              value={form.gender ?? ''}
              onChange={e => set('gender', e.target.value || undefined)}
            >
              <option value="">Select...</option>
              {GENDER_OPTIONS.map(g => (
                <option key={g} value={g} className="capitalize">
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── Location ──────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Location</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={LABEL_CLASSES}>Address</label>
            <input
              className={FIELD_CLASSES}
              placeholder="e.g. 123 High Street"
              value={form.address ?? ''}
              onChange={e => set('address', e.target.value || undefined)}
            />
          </div>

          <div>
            <label className={LABEL_CLASSES}>City</label>
            <input
              className={FIELD_CLASSES}
              placeholder="e.g. London"
              value={form.city ?? ''}
              onChange={e => set('city', e.target.value || undefined)}
            />
          </div>

          <div>
            <label className={LABEL_CLASSES}>Country</label>
            <input
              className={FIELD_CLASSES}
              placeholder="e.g. United Kingdom"
              value={form.country ?? ''}
              onChange={e => set('country', e.target.value || undefined)}
            />
          </div>
        </div>
      </section>

      {/* ── Contact ───────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASSES}>Phone</label>
            <input
              className={FIELD_CLASSES}
              placeholder="e.g. +44 7911 123456"
              value={form.phone ?? ''}
              onChange={e => set('phone', e.target.value || undefined)}
            />
          </div>

          <div>
            <label className={LABEL_CLASSES}>Email</label>
            <input
              type="email"
              className={FIELD_CLASSES}
              placeholder="e.g. jane@example.com"
              value={form.email ?? ''}
              onChange={e => set('email', e.target.value || undefined)}
            />
          </div>
        </div>
      </section>

      {/* ── Additional Context ────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Additional Context</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASSES}>Marital Status</label>
            <input
              className={FIELD_CLASSES}
              placeholder="e.g. Married"
              value={form.maritalStatus ?? ''}
              onChange={e => set('maritalStatus', e.target.value || undefined)}
            />
          </div>

          <div>
            <label className={LABEL_CLASSES}>Occupation</label>
            <input
              className={FIELD_CLASSES}
              placeholder="e.g. Software Engineer"
              value={form.occupation ?? ''}
              onChange={e => set('occupation', e.target.value || undefined)}
            />
          </div>

          <div>
            <label className={LABEL_CLASSES}>Emergency Contact</label>
            <input
              className={FIELD_CLASSES}
              placeholder="e.g. John Smith +44 7911 000000"
              value={form.emergencyContact ?? ''}
              onChange={e => set('emergencyContact', e.target.value || undefined)}
            />
          </div>

          <div>
            <label className={LABEL_CLASSES}>Languages</label>
            <input
              className={FIELD_CLASSES}
              placeholder="e.g. English, French"
              value={form.languages?.join(', ') ?? ''}
              onChange={e =>
                set(
                  'languages',
                  e.target.value
                    ? e.target.value
                        .split(',')
                        .map(l => l.trim())
                        .filter(Boolean)
                    : undefined
                )
              }
            />
            <p className="text-[11px] text-muted-foreground/60 mt-1">Comma-separated</p>
          </div>
        </div>
      </section>

      {/* ── Save button ───────────────────────────────────────────────── */}
      <div className="flex justify-end pt-2 border-t border-border">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Identity'}
        </button>
      </div>
    </div>
  );
};
