// src/features/HomeDashboard/components/GettingStartedWidget.tsx

/**
 * GettingStartedWidget
 *
 * Onboarding checklist driven by the real ProfileCompletenessResult.
 * Uses completeness.criteria to evaluate each step — same data that
 * powers the Health Profile completeness tab, so the % always matches.
 *
 * Steps and the criteria IDs they map to:
 *   1. Create account          — always done
 *   2. Request records         — hasOutboundRequests prop (not in completeness hook)
 *   3. Upload records          — criteria 'hasRecords'    (≥3 clinical records)
 *   4. Complete health profile — criteria 'dob' + 'gender' + 'location'
 *   5. Connect a wearable      — coming soon (always todo)
 *
 * Collapsed banner shows: tier name + real % (e.g. "Well Documented · 74%")
 * Next step nudge uses completeness.nextStep.label for free.
 *
 * States:
 *   expanded  → full step list with progress bar (default for new users)
 *   collapsed → small banner (user toggled, or all onboarding steps done)
 *   hidden    → dismissed after all steps complete
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Upload,
  UserCircle,
  Watch,
  Rocket,
  User,
} from 'lucide-react';
import { ProfileCompletenessResult } from '@/features/HealthProfile/hooks/useProfileCompleteness';
import useAuth from '@/features/Auth/hooks/useAuth';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GettingStartedWidgetProps {
  completeness: ProfileCompletenessResult;
  /** Whether the user has sent at least one outbound record request */
  hasOutboundRequests: boolean;
  isGuest: boolean;
  isLoading?: boolean;
}

interface DisplayStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  done: boolean;
  href?: string;
  comingSoon?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Look up a single criterion's done status by ID.
 * Returns false if the criterion isn't found (safe default).
 */
function criterionDone(completeness: ProfileCompletenessResult, id: string): boolean {
  return completeness.criteria.find(c => c.id === id)?.done ?? false;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const GettingStartedWidget: React.FC<GettingStartedWidgetProps> = ({
  completeness,
  hasOutboundRequests,
  isGuest,
  isLoading = false,
}) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  // Build display steps, each mapped to real completeness data
  const steps: DisplayStep[] = [
    {
      id: 'account',
      label: 'Create your account',
      description: 'Done',
      icon: <UserCircle className="w-4 h-4" />,
      done: !isGuest,
      href: '/app/auth/register',
    },
    {
      id: 'request',
      label: 'Request records from a provider',
      description: 'Use your legal rights under HIPAA / GDPR',
      icon: <FileSearch className="w-4 h-4" />,
      done: hasOutboundRequests,
      href: '/app/record-requests',
    },
    {
      id: 'upload',
      label: 'Upload your own records',
      description: 'PDFs, images, typed notes — any format',
      icon: <Upload className="w-4 h-4" />,
      // 'hasRecords' criterion requires ≥3 clinical records
      done: criterionDone(completeness, 'hasRecords'),
      href: '/app/add-record',
    },
    {
      id: 'profile',
      label: 'Complete your health profile',
      description: 'Update identity, clinical, and reliability information in your profile',
      icon: <UserCircle className="w-4 h-4" />,
      done: completeness.pct >= 100,
      href: '/app/health-profile/me',
    },
    {
      id: 'wearable',
      label: 'Connect wearables or other apps',
      description: 'Apple Health, Whoop, and more',
      icon: <Watch className="w-4 h-4" />,
      done: false,
      comingSoon: true,
    },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const totalCount = steps.length;

  // "All done" means all non-coming-soon steps are complete
  const allDone = steps.filter(s => !s.comingSoon).every(s => s.done);

  // Hide entirely once dismissed
  if (isDismissed) return null;

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        <div className="h-1.5 w-full bg-muted animate-pulse rounded-full" />
        <div className="space-y-2.5 pt-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ── Collapsed banner ────────────────────────────────────────────────────
  if (!isExpanded || allDone) {
    return (
      <div className="flex items-center justify-between bg-complement-3/10 border border-complement-3/30 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-complement-3 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {/* Show the real tier + % from completeness hook */}
              {completeness.tier} · {completeness.pct}% complete
            </p>
            {!allDone && completeness.nextStep && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Next: {completeness.nextStep.label}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {allDone ? (
            <button
              onClick={() => setIsDismissed(true)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          ) : (
            <button
              onClick={() => setIsExpanded(true)}
              className="text-xs text-complement-1 hover:underline flex items-center gap-1"
            >
              Expand <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Expanded state ──────────────────────────────────────────────────────
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Set up your health record</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {completedCount} of {totalCount} done
          </span>
          <button onClick={() => setIsExpanded(false)}>
            <ChevronUp className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      </div>

      {/* Progress bar — driven by real completeness % not just step count */}
      <div className="w-full h-1.5 bg-muted rounded-full mb-1">
        <div
          className="h-1.5 bg-complement-3 rounded-full transition-all duration-500"
          style={{ width: `${completeness.pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {completeness.tier} · {completeness.pct}% — complete these steps to get the most from
        Belrose
      </p>

      {/* Step list */}
      <div className="flex flex-col divide-y divide-border">
        {steps.map(step => (
          <div key={step.id} className="flex text-left items-center gap-3 py-2.5">
            {/* Status icon */}
            <div
              className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
                ${
                  step.done
                    ? 'bg-complement-3/15 text-complement-3'
                    : 'bg-muted text-muted-foreground'
                }`}
            >
              {step.done ? <CheckCircle2 className="w-4 h-4" /> : step.icon}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}
              >
                {step.label}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {step.done ? 'Done' : step.description}
              </p>
            </div>

            {/* Action */}
            {!step.done &&
              (step.comingSoon ? (
                <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full flex-shrink-0">
                  Soon
                </span>
              ) : (
                <button
                  onClick={() => step.href && navigate(step.href)}
                  className="text-xs text-complement-1 font-medium hover:underline flex-shrink-0"
                >
                  Start →
                </button>
              ))}
          </div>
        ))}
      </div>

      {/* Link to full completeness tab */}
      <div className="mt-3 pt-3 border-t border-border">
        <button
          onClick={() => navigate('/app/health-profile/me?tab=completeness')}
          className="text-xs text-complement-1 hover:underline"
        >
          View full profile completeness →
        </button>
      </div>
    </div>
  );
};

export default GettingStartedWidget;
