// src/components/ui/Avatar.tsx

/**
 * Avatar
 *
 * Reusable avatar component used across the app wherever a user's
 * identity needs a visual representation.
 *
 * Priority order:
 *   1. photoURL  — actual profile photo
 *   2. Initials  — derived from firstName + lastName (or displayName)
 *   3. Icon      — generic User icon fallback
 *
 * Sizes: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 *
 * Usage:
 *   <Avatar profile={profile} size="md" />
 *   <Avatar profile={null} size="sm" />          ← shows icon skeleton
 *   <Avatar profile={profile} size="lg" className="ring-2 ring-primary" />
 */

import React from 'react';
import { User } from 'lucide-react';
import { BelroseUserProfile } from '@/types/core';

// ============================================================================
// TYPES
// ============================================================================

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  /** User profile to derive photo/initials from. Pass null while loading. */
  profile: BelroseUserProfile | null;
  size?: AvatarSize;
  className?: string;
}

// ============================================================================
// SIZE CONFIG
// ============================================================================

const SIZE_CONFIG: Record<AvatarSize, { container: string; text: string; icon: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]', icon: 'w-3 h-3' },
  sm: { container: 'w-8 h-8', text: 'text-xs', icon: 'w-4 h-4' },
  md: { container: 'w-10 h-10', text: 'text-sm', icon: 'w-5 h-5' },
  lg: { container: 'w-12 h-12', text: 'text-base', icon: 'w-6 h-6' },
  xl: { container: 'w-16 h-16', text: 'text-xl', icon: 'w-8 h-8' },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Derive initials from a profile.
 * Prefers firstName + lastName. Falls back to first two chars of displayName.
 * Returns null if nothing useful is available.
 */
function getInitials(profile: BelroseUserProfile): string | null {
  const fromName = `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`
    .trim()
    .toUpperCase();
  if (fromName) return fromName;

  const fromDisplay = profile.displayName?.trim().toUpperCase().slice(0, 2);
  return fromDisplay || null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const Avatar: React.FC<AvatarProps> = ({ profile, size = 'sm', className = '' }) => {
  const { container, text, icon } = SIZE_CONFIG[size];
  const base = `${container} rounded-full flex items-center justify-center flex-shrink-0 ${className}`;

  // 1. Photo
  if (profile?.photoURL) {
    return (
      <img
        src={profile.photoURL}
        alt={profile.displayName || 'User avatar'}
        className={`${base} object-cover`}
      />
    );
  }

  // 2. Initials
  const initials = profile ? getInitials(profile) : null;
  if (initials) {
    return (
      <div className={`${base} bg-primary text-primary-foreground font-semibold ${text}`}>
        {initials}
      </div>
    );
  }

  // 3. Generic icon fallback
  return (
    <div className={`${base} bg-muted`}>
      <User className={`${icon} text-muted-foreground`} />
    </div>
  );
};

export default Avatar;
