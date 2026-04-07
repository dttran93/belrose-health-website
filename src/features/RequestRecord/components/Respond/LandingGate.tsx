// src/features/RequestRecord/components/LandingGate.tsx

/**
 * LandingGate
 *
 * First thing a provider sees when they click a record request link.
 * Structured like a formal letter — establishes legal context first,
 * then presents the account creation CTA prominently.
 *
 * Two goals in priority order:
 *   1. Make the provider understand their legal obligation (builds legitimacy)
 *   2. Get them to create a Belrose account before uploading
 */

import React from 'react';
import { ArrowRight, Lock, ExternalLink, UserPlus, Shield } from 'lucide-react';
import type { RecordRequest } from '../../services/fulfillRequestService';

interface LandingGateProps {
  recordRequest: RecordRequest;
  isAlreadyLoggedIn: boolean;
  onContinueWithAccount: () => void;
  onContinueWithoutAccount: () => void;
}

const LandingGate: React.FC<LandingGateProps> = ({
  recordRequest,
  isAlreadyLoggedIn,
  onContinueWithAccount,
  onContinueWithoutAccount,
}) => {
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const requestDate = recordRequest.createdAt
    ? new Date(recordRequest.createdAt.seconds * 1000).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : today;

  const deadline = recordRequest.createdAt
    ? new Date((recordRequest.createdAt.seconds + 30 * 24 * 60 * 60) * 1000).toLocaleDateString(
        'en-GB',
        {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }
      )
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* ── Letter card ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Letterhead */}
        <div className="bg-primary px-8 py-6 flex items-center justify-between">
          <div className="text-left">
            <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              Belrose Health
            </span>
            <p className="text-white/60 text-xs mt-0.5">Secure Health Record Transfer</p>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 text-white/70 text-xs px-3 py-1.5 rounded-full">
            <Lock className="w-3 h-3" />
            End-to-end encrypted
          </div>
        </div>

        {/* Letter body */}
        <div className="text-left px-8 py-7 space-y-5">
          {/* Date + salutation */}
          <div className="space-y-4">
            <p className="text-xs text-slate-400">{requestDate}</p>
            <p className="text-slate-700 text-sm leading-relaxed">Dear healthcare provider,</p>
          </div>

          {/* Core legal statement */}
          <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
            <p>
              Your patient, <strong className="text-primary">{recordRequest.requesterName}</strong>{' '}
              (cc'd on this email), has submitted a <strong>GDPR Article 15</strong> subject access
              request via the Belrose Health platform for their personal health records. Under GDPR,
              covered entities are required to provide patients with access to their records within
              30 days of a written request.
            </p>

            <p>
              This request was submitted on <strong className="text-primary">{requestDate}</strong>.
              Please respond by <strong className="text-primary">{deadline}</strong>. Our platform
              can accept PDFs, handwritten notes, images, and any other format as long as it is
              accurate and legible.
            </p>
          </div>

          {/* Security note */}
          <div className="bg-complement-3/5 border border-complement-3/20 rounded-xl px-4 py-3 flex gap-3">
            <Shield className="w-4 h-4 text-complement-3 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-0.5">
                Your upload is protected
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Files are encrypted in your browser before leaving your device. Only you and{' '}
                {recordRequest.requesterName} can decrypt and read the contents — Belrose cannot
                access them.
              </p>
            </div>
          </div>

          {/* Learn more */}
          <a
            href="https://www.belrosehealth.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Learn more about Belrose Health
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* ── Account CTA card ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">How would you like to proceed?</h2>
        </div>

        <div className="p-5 space-y-3">
          {/* Primary CTA — create account / continue with account */}
          <button
            onClick={isAlreadyLoggedIn ? onContinueWithoutAccount : onContinueWithAccount}
            className="w-full text-left border-2 border-complement-3 bg-complement-3/5 rounded-xl p-5 hover:bg-complement-3/10 transition-colors group"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-complement-3 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-complement-3/90 transition-colors">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <p className="font-semibold text-slate-900">
                    {isAlreadyLoggedIn
                      ? 'Continue with your Belrose account'
                      : 'Create a free Belrose account first'}
                  </p>
                  {!isAlreadyLoggedIn && (
                    <div className="rounded-xl border border-complement-3 px-1 bg-complement-3 text-white text-xs flex items-center font-bold">
                      Recommended
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  {isAlreadyLoggedIn
                    ? "You're signed in — you'll keep full access to the record you upload."
                    : "You'll have verifiable compliance with GDPR regulations, keep access to records you upload, and patients can send their other records directly to you."}
                </p>
                {!isAlreadyLoggedIn && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {[
                      'Keep record access',
                      'Reduced admin overhead',
                      'Compliance verification',
                    ].map(f => (
                      <span
                        key={f}
                        className="text-xs bg-complement-3/10 text-complement-3 px-2 py-0.5 rounded-full font-medium"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <ArrowRight className="w-5 h-5 text-complement-3 flex-shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Secondary — upload without account */}
          {!isAlreadyLoggedIn && (
            <div className="text-center">
              <button
                onClick={onContinueWithoutAccount}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors py-1"
              >
                Upload without creating an account →
              </button>
              <p className="text-xs text-slate-300 mt-0.5">
                You won't be able to access this record on Belrose after uploading
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingGate;
