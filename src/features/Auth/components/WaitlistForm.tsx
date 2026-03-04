// /features/Auth/components/WaitlistForm.tsx
//
// Shown to users who aren't on the invites allowlist.
// Collects: email (pre-filled), full name, how they heard about Belrose, why they want access.
// Writes to Firestore `waitlist` collection, keyed by email.

import React, { useState } from 'react';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface WaitlistFormProps {
  prefillEmail?: string;
  onBackToLogin: () => void;
}

interface WaitlistFormData {
  email: string;
  fullName: string;
  heardFrom: string;
  reason: string;
  region: string;
  ukCity: string; // only required when region === 'United Kingdom'
}

type SubmitState = 'idle' | 'submitting' | 'success';

const HEARD_FROM_OPTIONS = [
  'Friend or colleague',
  'Social media',
  'Search engine',
  'Healthcare provider',
  'News article or blog',
  'Conference or event',
  'Other',
];

const REGION_OPTIONS = [
  'United Kingdom',
  'United States',
  'Europe',
  'Asia Pacific',
  'Latin America',
  'Africa',
  'Other',
];

// Covers major NHS trust / population centres — good signal for hospital partnerships
const UK_CITY_OPTIONS = [
  'London',
  'Manchester',
  'Birmingham',
  'Leeds',
  'Bristol',
  'Edinburgh',
  'Glasgow',
  'Liverpool',
  'Newcastle',
  'Sheffield',
  'Nottingham',
  'Cardiff',
  'Belfast',
  'Oxford',
  'Cambridge',
  'Other (UK)',
];

const WaitlistForm: React.FC<WaitlistFormProps> = ({ prefillEmail = '', onBackToLogin }) => {
  const [form, setForm] = useState<WaitlistFormData>({
    email: prefillEmail,
    fullName: '',
    heardFrom: '',
    reason: '',
    region: '',
    ukCity: '',
  });
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errors, setErrors] = useState<Partial<WaitlistFormData>>({});

  const isUK = form.region === 'United Kingdom';

  const validate = (): boolean => {
    const newErrors: Partial<WaitlistFormData> = {};
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (!form.fullName.trim()) {
      newErrors.fullName = 'Please enter your name.';
    }
    if (!form.region) {
      newErrors.region = 'Please select your region.';
    }
    if (isUK && !form.ukCity) {
      newErrors.ukCity = 'Please select your city.';
    }
    if (!form.heardFrom) {
      newErrors.heardFrom = 'Please select an option.';
    }
    if (!form.reason.trim() || form.reason.trim().length < 20) {
      newErrors.reason = 'Please tell us a bit more (at least 20 characters).';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitState('submitting');

    try {
      const db = getFirestore();
      const normalised = form.email.trim().toLowerCase();

      await setDoc(doc(db, 'waitlist', normalised), {
        email: normalised,
        fullName: form.fullName.trim(),
        heardFrom: form.heardFrom,
        reason: form.reason.trim(),
        region: form.region,
        // Only store ukCity when relevant — keeps data clean
        ...(isUK && { ukCity: form.ukCity }),
        signedUpAt: serverTimestamp(),
        status: 'pending',
      });

      setSubmitState('success');
    } catch (err) {
      console.error('Error submitting to waitlist:', err);
      setErrors({ email: 'Something went wrong. Please try again.' });
      setSubmitState('idle');
    }
  };

  const handleChange = (field: keyof WaitlistFormData, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // Clear ukCity if they switch away from UK
      if (field === 'region' && value !== 'United Kingdom') {
        next.ukCity = '';
      }
      return next;
    });
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  // Shared input/select className
  const inputCls = `w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50
    text-gray-900 placeholder:text-gray-400
    focus:outline-none focus:ring-2 focus:ring-complement-4 focus:border-transparent transition`;

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitState === 'success') {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-complement-3/20 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-complement-3" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">You're on the list!</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              Thanks for your interest in Belrose. We review our list regularly and will send you an
              invite code when your access is approved.
            </p>
            <Button onClick={onBackToLogin} className="w-full py-3 rounded-xl">
              Back to sign in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-primary px-8 pt-10 pb-8">
            <h1 className="text-3xl font-bold text-secondary leading-tight">Join the waitlist</h1>
            <p className="text-secondary/70 mt-3 text-sm leading-relaxed">
              We're carefully selecting our alpha testers. Tell us about yourself and we'll send you
              an invite code when you're approved.
            </p>
          </div>

          <div className="px-8 py-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => handleChange('email', e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
                {errors.email && <p className="mt-1.5 text-sm text-destructive">{errors.email}</p>}
              </div>

              {/* Full name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={e => handleChange('fullName', e.target.value)}
                  placeholder="Jane Smith"
                  className={inputCls}
                />
                {errors.fullName && (
                  <p className="mt-1.5 text-sm text-destructive">{errors.fullName}</p>
                )}
              </div>

              {/* Region + conditional UK city — side by side when UK selected */}
              <div className={`grid gap-4 ${isUK ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Where are you based?
                  </label>
                  <select
                    value={form.region}
                    onChange={e => handleChange('region', e.target.value)}
                    className={`${inputCls} appearance-none cursor-pointer`}
                  >
                    <option value="" disabled>
                      Select region…
                    </option>
                    {REGION_OPTIONS.map(r => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {errors.region && (
                    <p className="mt-1.5 text-sm text-destructive">{errors.region}</p>
                  )}
                </div>

                {/* UK city — slides in when UK is selected */}
                {isUK && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      City / region
                    </label>
                    <select
                      value={form.ukCity}
                      onChange={e => handleChange('ukCity', e.target.value)}
                      className={`${inputCls} appearance-none cursor-pointer`}
                    >
                      <option value="" disabled>
                        Select city…
                      </option>
                      {UK_CITY_OPTIONS.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {errors.ukCity && (
                      <p className="mt-1.5 text-sm text-destructive">{errors.ukCity}</p>
                    )}
                  </div>
                )}
              </div>

              {/* How they heard about Belrose */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  How did you hear about Belrose?
                </label>
                <select
                  value={form.heardFrom}
                  onChange={e => handleChange('heardFrom', e.target.value)}
                  className={`${inputCls} appearance-none cursor-pointer`}
                >
                  <option value="" disabled>
                    Select an option…
                  </option>
                  {HEARD_FROM_OPTIONS.map(o => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                {errors.heardFrom && (
                  <p className="mt-1.5 text-sm text-destructive">{errors.heardFrom}</p>
                )}
              </div>

              {/* Why they want access */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Why do you want access to Belrose?
                </label>
                <textarea
                  value={form.reason}
                  onChange={e => handleChange('reason', e.target.value)}
                  placeholder="Tell us how you'd use Belrose and what problems you're hoping it solves…"
                  rows={4}
                  className={`${inputCls} resize-none`}
                />
                <div className="flex items-center justify-between mt-1">
                  {errors.reason ? (
                    <p className="text-sm text-destructive">{errors.reason}</p>
                  ) : (
                    <span />
                  )}
                  <span
                    className={`text-xs ml-auto ${form.reason.length < 20 ? 'text-gray-400' : 'text-complement-3'}`}
                  >
                    {form.reason.length} / 20 min
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitState === 'submitting'}
                className="w-full py-3 rounded-xl flex items-center justify-center gap-2
                           disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {submitState === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting…</span>
                  </>
                ) : (
                  <span>Request access</span>
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 pt-4">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-complement-4 font-medium hover:underline transition-colors"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaitlistForm;
