// src/features/MemberManagement/utils.ts

import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Crown, Shield, Eye, Users } from 'lucide-react';
import { UserStatus } from './types';

/**
 * Truncate a hash for display
 * Shows first `startChars` and last `endChars` characters
 */
export function truncateHash(hash: string, startChars = 6, endChars = 4): string {
  if (hash.length <= startChars + endChars + 2) return hash;
  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`;
}

/**
 * Copy text to clipboard
 */
export function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text);
}

/**
 * Get status display info (label, color, icon)
 */
export function getStatusInfo(status: UserStatus): {
  label: string;
  color: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case UserStatus.Verified:
      return {
        label: 'Verified',
        color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        icon: React.createElement(CheckCircle, { className: 'w-3 h-3' }),
      };
    case UserStatus.Active:
      return {
        label: 'Active',
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: React.createElement(CheckCircle, { className: 'w-3 h-3' }),
      };
    case UserStatus.Inactive:
      return {
        label: 'Inactive',
        color: 'bg-gray-100 text-gray-500 border-gray-200',
        icon: React.createElement(XCircle, { className: 'w-3 h-3' }),
      };
    case UserStatus.NotRegistered:
      return {
        label: 'Not Registered',
        color: 'bg-red-100 text-red-500 border-red-200',
        icon: React.createElement(AlertCircle, { className: 'w-3 h-3' }),
      };
    default:
      return {
        label: 'Unknown',
        color: 'bg-gray-100 text-gray-500 border-gray-200',
        icon: React.createElement(AlertCircle, { className: 'w-3 h-3' }),
      };
  }
}

/**
 * Get role display info (color, icon)
 */
export function getRoleInfo(role: string): {
  color: string;
  icon: React.ReactNode;
} {
  switch (role.toLowerCase()) {
    case 'owner':
      return {
        color: 'bg-amber-100 text-amber-700 border-amber-200',
        icon: React.createElement(Crown, { className: 'w-3 h-3' }),
      };
    case 'administrator':
      return {
        color: 'bg-purple-100 text-purple-700 border-purple-200',
        icon: React.createElement(Shield, { className: 'w-3 h-3' }),
      };
    case 'viewer':
      return {
        color: 'bg-sky-100 text-sky-700 border-sky-200',
        icon: React.createElement(Eye, { className: 'w-3 h-3' }),
      };
    default:
      return {
        color: 'bg-gray-100 text-gray-500 border-gray-200',
        icon: React.createElement(Users, { className: 'w-3 h-3' }),
      };
  }
}

/**
 * Capitalize first letter of a string
 */
export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
