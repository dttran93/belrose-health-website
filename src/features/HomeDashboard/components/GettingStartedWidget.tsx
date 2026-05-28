// src/features/HomeDashboard/components/GettingStartedWidget.tsx

/**
 * GettingStartedWidget
 *
 * Shows the user's setup progress as a list of actionable steps.
 * Each step checks a real condition from props to mark itself complete.
 *
 * States:
 *  - Expanded (default for new users): full step list with progress bar
 *  - Collapsed (all steps done OR user dismisses): small green banner
 *  - Hidden: once fully complete AND dismissed
 *
 * Steps:
 *  1. Create account           — always done by the time they see this
 *  2. Request records          — hasOutboundRequests
 *  3. Upload own records       — hasRecords
 *  4. Complete health profile  — hasProfile
 *  5. Connect a wearable       — coming soon (always shows as todo)
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
} from 'lucide-react';

interface GettingStartedWidgetProps {
  hasRecords: boolean;
  hasOutboundRequests: boolean;
  hasProfile: boolean;
}

interface Step {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  done: boolean;
  href?: string;
  comingSoon?: boolean;
}

export const GettingStartedWidget: React.FC<GettingStartedWidgetProps> = ({
  hasRecords,
  hasOutboundRequests,
  hasProfile,
}) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  const steps: Step[] = [
    {
      id: 'account',
      label: 'Create your account',
      description: 'Done',
      icon: <UserCircle className="w-4 h-4" />,
      done: true,
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
      done: hasRecords,
      href: '/app/add-record',
    },
    {
      id: 'profile',
      label: 'Complete your health profile',
      description: 'Helps the AI give you better answers',
      icon: <UserCircle className="w-4 h-4" />,
      done: hasProfile,
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
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const allDone = completedCount === totalCount;

  // Hide entirely if dismissed after completion
  if (isDismissed) return null;

  // Collapsed banner (user toggled or all done)
  if (!isExpanded || allDone) {
    return (
      <div className="flex items-center justify-between bg-complement-3/10 border border-complement-3/30 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-complement-3 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Getting started — {completedCount} of {totalCount} complete
            </p>
            {!allDone && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {steps.find(s => !s.done)?.label} is next
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

  // Expanded state
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

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-muted rounded-full mb-1">
        <div
          className="h-1.5 bg-complement-3 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Complete these steps to unlock your AI health assistant
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
    </div>
  );
};

export default GettingStartedWidget;
