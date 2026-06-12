// src/features/Dependents/components/AccountSwitcherModal.tsx

import React, { useState, useMemo } from 'react';
import { X, Search, Check, ArrowLeft, Loader2, User } from 'lucide-react';
import type { BelroseUserProfile } from '@/types/core';
import type { SwitchableAccount } from '../hooks/useSwitchableAccounts';

interface AccountSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: BelroseUserProfile;
  dependents: SwitchableAccount[];
  guardian: SwitchableAccount | null;
  isLoading: boolean;
  isSwitching: boolean;
  onSwitchToDependent: (uid: string) => void;
  onSwitchToGuardian: () => void;
}

function AccountAvatar({ profile, size = 'md' }: { profile: BelroseUserProfile | null; size?: 'sm' | 'md' }) {
  const initials = profile
    ? `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : '?';
  const sizeClasses = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';

  if (profile?.photoURL) {
    return (
      <img
        src={profile.photoURL}
        alt={profile.displayName ?? ''}
        className={`${sizeClasses} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  return (
    <div className={`${sizeClasses} rounded-full bg-primary/20 text-primary font-semibold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  );
}

function AccountRow({
  profile,
  uid,
  isCurrent,
  isLoading,
  onClick,
}: {
  profile: BelroseUserProfile | null;
  uid: string;
  isCurrent?: boolean;
  isLoading?: boolean;
  onClick: () => void;
}) {
  const displayEmail = profile?.email?.endsWith('@placeholder.belrose.health')
    ? 'Placeholder account'
    : (profile?.email ?? uid.slice(0, 12) + '…');

  return (
    <button
      onClick={onClick}
      disabled={isCurrent || isLoading}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left rounded-lg ${
        isCurrent
          ? 'cursor-default'
          : 'hover:bg-slate-50 cursor-pointer'
      }`}
    >
      <AccountAvatar profile={profile} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {profile?.displayName ?? 'Unknown'}
        </p>
        <p className="text-xs text-slate-400 truncate">{displayEmail}</p>
      </div>
      {isCurrent && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
      {isLoading && !isCurrent && <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />}
    </button>
  );
}

export const AccountSwitcherModal: React.FC<AccountSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  dependents,
  guardian,
  isLoading,
  isSwitching,
  onSwitchToDependent,
  onSwitchToGuardian,
}) => {
  const [search, setSearch] = useState('');

  const filteredDependents = useMemo(() => {
    if (!search.trim()) return dependents;
    const lower = search.toLowerCase();
    return dependents.filter(d =>
      d.profile?.displayName?.toLowerCase().includes(lower) ||
      d.profile?.firstName?.toLowerCase().includes(lower) ||
      d.profile?.lastName?.toLowerCase().includes(lower)
    );
  }, [dependents, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Switch Account</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Switching overlay */}
        {isSwitching && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm text-slate-600">Switching account…</p>
          </div>
        )}

        <div className="p-2">
          {/* Current account */}
          <div className="mb-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-1">
              Current account
            </p>
            <AccountRow
              profile={currentUser}
              uid={currentUser.uid}
              isCurrent
              onClick={() => {}}
            />
          </div>

          <div className="h-px bg-slate-100 mx-2 my-1" />

          {/* Loading state */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading accounts…</span>
            </div>
          ) : currentUser.isDependent && guardian ? (
            /* Dependent view: single "return to guardian" row */
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-1">
                Switch to
              </p>
              <button
                onClick={onSwitchToGuardian}
                disabled={isSwitching}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors rounded-lg text-left"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <ArrowLeft className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {guardian.profile?.displayName ?? 'Guardian account'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {guardian.profile?.email ?? ''}
                  </p>
                </div>
              </button>
            </div>
          ) : dependents.length === 0 ? (
            /* No dependents */
            <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
              <User className="w-6 h-6" />
              <p className="text-sm">No managed accounts</p>
            </div>
          ) : (
            /* Guardian view: searchable list of dependents */
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-1">
                Managed accounts
              </p>

              {dependents.length > 4 && (
                <div className="relative mx-2 mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search accounts…"
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50"
                    autoFocus
                  />
                </div>
              )}

              <div className="max-h-64 overflow-y-auto">
                {filteredDependents.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No accounts match "{search}"</p>
                ) : (
                  filteredDependents.map(({ uid, profile }) => (
                    <AccountRow
                      key={uid}
                      profile={profile}
                      uid={uid}
                      onClick={() => onSwitchToDependent(uid)}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
