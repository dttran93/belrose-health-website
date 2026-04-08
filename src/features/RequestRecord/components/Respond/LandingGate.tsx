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
import { ArrowRight, Lock, ExternalLink, UserPlus, Loader2, Upload, LogIn } from 'lucide-react';
import type { RecordRequest } from '../../services/fulfillRequestService';

interface LandingGateProps {
  recordRequest: RecordRequest;
  // State 1: matching email already signed in
  isAlreadyLoggedIn: boolean;
  // State 2: target email has a full Belrose account but isn't signed in
  targetIsRegistered: boolean;
  signingIn?: boolean;
  onContinueWithAccount: () => void; // State 3: new provider — guest + modal
  onContinueWithoutAccount: () => void; // Anonymous path
  onContinueAsExistingUser: () => void; // State 1: already signed in → upload
}

const LandingGate: React.FC<LandingGateProps> = ({
  recordRequest,
  isAlreadyLoggedIn,
  targetIsRegistered,
  signingIn = false,
  onContinueWithAccount,
  onContinueWithoutAccount,
  onContinueAsExistingUser,
}) => {
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

  const loginUrl = `/auth`;

  // ── Derive primary button config from state ───────────────────────────────
  const primaryConfig = isAlreadyLoggedIn
    ? {
        label: 'Continue with your account',
        sublabel: "You're signed in — you'll retain record access",
        icon: <UserPlus className="w-4 h-4 text-white" />,
        onClick: onContinueAsExistingUser,
        disabled: false,
      }
    : targetIsRegistered
      ? {
          label: 'Sign in to your Belrose account',
          sublabel: 'You already have an account — sign in to upload and retain record access',
          icon: <LogIn className="w-4 h-4 text-white" />,
          onClick: () => {
            window.location.href = loginUrl;
          },
          disabled: false,
        }
      : {
          label: signingIn ? 'Setting up your account...' : 'Create a free account & upload',
          sublabel: signingIn ? '' : 'Recommended · keep record access · verified compliance',
          icon: signingIn ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          ) : (
            <UserPlus className="w-4 h-4 text-white" />
          ),
          onClick: onContinueWithAccount,
          disabled: signingIn,
        };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Hero header */}
        <div className="bg-primary px-8 py-7 text-center">
          <p className="text-xs font-semibold tracking-widest text-white/40 uppercase mb-4">
            Belrose Health · Record Request
          </p>
          <h1 className="text-xl font-semibold text-white leading-snug mb-2">
            {recordRequest.requesterName} is requesting their health records
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
            {deadline && <span className="text-xs text-white/50">Respond by {deadline}</span>}
            <span className="text-white/20">·</span>
            <span className="text-xs text-white/50">GDPR Art. 15</span>
            <span className="text-white/20">·</span>
            <span className="inline-flex items-center gap-1 text-xs text-white/50">
              <Lock className="w-2.5 h-2.5" />
              End-to-End Encryption
            </span>
          </div>
        </div>

        <div className="px-8 py-7 space-y-4">
          {/* Info link */}
          <a
            href="https://belrosehealth.com/for-providers"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            Have questions? More information for healthcare professionals
            <ExternalLink className="w-3 h-3" />
          </a>

          {/* Primary button — varies by state */}
          <button
            onClick={primaryConfig.onClick}
            disabled={primaryConfig.disabled}
            className="w-full bg-complement-3 hover:bg-complement-3/90 disabled:opacity-70 disabled:cursor-not-allowed transition-colors rounded-xl px-5 py-4 text-left flex items-center gap-4 group"
          >
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              {primaryConfig.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{primaryConfig.label}</p>
              {primaryConfig.sublabel && (
                <p className="text-xs text-white/70 mt-0.5">{primaryConfig.sublabel}</p>
              )}
            </div>
            {!signingIn && (
              <ArrowRight className="w-4 h-4 text-white/70 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
            )}
          </button>

          {/* Divider + anonymous path — only for non-logged-in states */}
          {!isAlreadyLoggedIn && !targetIsRegistered && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-100" />
                <p className="text-xs text-slate-400">or</p>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              <button
                onClick={onContinueWithoutAccount}
                disabled={signingIn}
                className="w-full bg-slate-50 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-xl px-5 py-4 text-left flex items-center gap-4 border border-slate-200 group"
              >
                <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <Upload className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700">Upload without an account</p>
                  <p className="text-xs text-slate-400 mt-0.5">No record access after upload</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </>
          )}

          {/* Sign-in nudge for new providers who actually have an account
              (edge case: targetIsRegistered was false but they do have one) */}
          {!isAlreadyLoggedIn && !targetIsRegistered && (
            <p className="text-center">
              <a
                href={loginUrl}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Already have a Belrose account? Sign in →
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingGate;
