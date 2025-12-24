import React from 'react';
import { User, Mail, Hash, X, Check, BadgeCheck, CircleCheck } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import UserMenu from './UserMenu';
import { BelroseUserProfile } from '@/types/core';
import { copyToClipboard } from '@/utils/browserUtils';

export type UserCardVariant = 'compact' | 'default';
export type UserCardColor = 'primary' | 'green' | 'red' | 'blue' | 'purple' | 'yellow';
export type BadgeColor = 'primary' | 'pink' | 'green' | 'red' | 'blue' | 'purple' | 'yellow';

export interface BadgeConfig {
  text: string;
  color: BadgeColor;
  icon?: React.ReactNode;
  tooltip?: string;
}

interface UserCardProps {
  user: BelroseUserProfile | null | undefined;
  userId?: string; // Fallback if user profile not loaded
  variant?: UserCardVariant;
  color?: UserCardColor;

  // Optional badges/indicators
  badges?: BadgeConfig[];

  // Optional metadata to display
  metadata?: {
    label: string;
    value: string;
    icon?: React.ReactNode;
  }[];

  // Actions
  onCardClick?: () => void;
  onView: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
  onAccept?: () => void;
  onVerifyBlockchain?: () => void;
  actions?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'danger';
  }[];

  // Display options
  menuType?: 'default' | 'cancel' | 'acceptOrCancel' | 'none';
  showEmail?: boolean;
  showUserId?: boolean;
  showAffiliations?: boolean;
  clickable?: boolean;
  className?: string;
}

const colorClasses: Record<
  UserCardColor,
  { bg: string; iconBg: string; icon: string; border: string }
> = {
  primary: {
    bg: 'bg-primary/20',
    iconBg: 'bg-primary/50',
    icon: 'text-primary',
    border: 'border-primary',
  },
  green: {
    bg: 'bg-chart-3/20',
    iconBg: 'bg-chart-3/50',
    icon: 'text-chart-3',
    border: 'border-chart-3',
  },
  red: {
    bg: 'bg-red-100',
    iconBg: 'bg-red-200',
    icon: 'text-red-700',
    border: 'border-red-200',
  },
  blue: {
    bg: 'bg-chart-2/20',
    iconBg: 'bg-chart-2/50',
    icon: 'text-chart-2',
    border: 'border-chart-2',
  },
  purple: {
    bg: 'bg-chart-5/20',
    iconBg: 'bg-chart-5/50',
    icon: 'text-chart-5',
    border: 'border-chart-5',
  },
  yellow: {
    bg: 'bg-chart-4/20',
    iconBg: 'bg-chart-4/50',
    icon: 'text-chart-4',
    border: 'border-chart-4',
  },
};

const badgeColorClasses: Record<BadgeColor, { bg: string; text: string; border: string }> = {
  primary: { bg: 'bg-primary/20', text: 'text-primary', border: 'border-primary' },
  pink: { bg: 'bg-secondary', text: 'text-destructive', border: 'border-destructive' },
  green: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-700' },
  red: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-700' },
  blue: { bg: 'bg-chart-2/30', text: 'text-chart-2', border: 'border-chart-2' },
  purple: { bg: 'bg-chart-5/20', text: 'text-chart-5', border: 'border-chart-5' },
  yellow: { bg: 'bg-yellow-200', text: 'text-yellow-800', border: 'border-chart-4' },
};

export const UserCard: React.FC<UserCardProps> = ({
  user,
  userId,
  variant = 'default',
  color = 'primary',
  badges,
  onView,
  onShare,
  onDelete,
  onCardClick,
  onCancel,
  onAccept,
  onVerifyBlockchain,
  menuType = 'default',
  showEmail = true,
  showUserId = true,
  showAffiliations = true,
  clickable = false,
  className = '',
}) => {
  const colors = colorClasses[color];
  const displayName = user?.displayName || 'Unknown User';
  const email = user?.email || '';
  const uid = user?.uid || userId || '';
  const isClickable = clickable || !!onCardClick;

  //==============================================================
  // HELPER FUNCITONS
  //==============================================================

  const renderBadge = (badgeItem: BadgeConfig, index: number) => {
    const badgeColors = badgeColorClasses[badgeItem.color];

    const badgeElement = (
      <span
        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full 
          ${badgeColors.bg} ${badgeColors.text} border ${badgeColors.border}
          ${badgeItem.tooltip ? 'cursor-help' : ''}`}
      >
        {badgeItem.icon}
        {badgeItem.text}
      </span>
    );

    if (badgeItem.tooltip) {
      return (
        <Tooltip.Provider key={index}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>{badgeElement}</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 z-50 max-w-xs"
                sideOffset={5}
              >
                {badgeItem.tooltip}
                <Tooltip.Arrow className="fill-gray-900" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      );
    }

    return <React.Fragment key={index}>{badgeElement}</React.Fragment>;
  };

  // Helper function to render the verified badge
  const renderVerifiedBadge = () => {
    if (!user?.emailVerified || !user?.identityVerified) return null;

    return (
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <div>
              <CircleCheck className="text-blue-500 w-4 h-4" />
            </div>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="bg-gray-900 text-white text-xs rounded px-2 py-1 z-50"
              sideOffset={5}
            >
              User identity and email have been verified!
              <Tooltip.Arrow className="fill-gray-900" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
  };

  const renderActionButtons = () => {
    if (menuType !== 'cancel' && menuType !== 'acceptOrCancel') return null;

    return (
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={e => {
            e.stopPropagation();
            onCancel?.();
          }}
          className="flex items-center bg-red-200 rounded-full p-2 hover:bg-red-300"
        >
          <X className="text-red-700 w-4 h-4" />
        </button>
        {menuType === 'acceptOrCancel' && (
          <button
            onClick={e => {
              e.stopPropagation();
              onAccept?.();
            }}
            className="flex items-center bg-green-200 rounded-full p-2 hover:bg-green-400"
          >
            <Check className="text-green-900 w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  // Helper function to render the menu
  const renderMenu = () => {
    if (menuType !== 'default') return null;

    return (
      <UserMenu
        user={user}
        onView={onView}
        onShare={onShare}
        onDelete={onDelete}
        onVerifyBlockchain={onVerifyBlockchain}
      />
    );
  };

  //Helper function to pull cycle through array of badges
  const renderBadges = () => {
    if (!badges || badges.length === 0) return null;

    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        {badges.map((b, i) => renderBadge(b, i))}
      </div>
    );
  };

  //==============================================================
  // COMPACT USER CARD
  //==============================================================

  if (variant === 'compact') {
    return (
      <div
        onClick={onCardClick}
        className={`flex items-center justify-between p-4 ${colors.bg} rounded-lg border ${
          colors.border
        } ${isClickable ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-900 truncate">{displayName}</span>
          {renderVerifiedBadge()}
        </div>

        {renderBadges()}
        {renderMenu()}
        {renderActionButtons()}
      </div>
    );
  }

  //==============================================================
  // DEFAULT USER CARD
  //==============================================================
  if (variant === 'default') {
    return (
      <div
        onClick={onCardClick}
        className={`
          flex items-center justify-between p-4 ${colors.bg} rounded-lg border ${colors.border}
          ${isClickable ? 'cursor-pointer hover:shadow-md' : ''}
          transition-shadow ${className}
        `}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Avatar */}
          <div
            className={`w-10 h-10 ${colors.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}
          >
            <User className={`w-5 h-5 ${colors.icon}`} />
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1">
              <p className="text-base font-semibold text-gray-900 truncate">{displayName}</p>
              {renderVerifiedBadge()}
            </div>

            {showEmail && email && (
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <div
                      onClick={e => {
                        e.stopPropagation();
                        copyToClipboard(email);
                      }}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 cursor-pointer mb-1"
                    >
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{email}</span>
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-900 text-white text-xs rounded px-2 py-1 z-50"
                      sideOffset={5}
                    >
                      Click to copy email
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            )}

            {showUserId && uid && (
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <div
                      onClick={e => {
                        e.stopPropagation();
                        copyToClipboard(uid);
                      }}
                      className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                    >
                      <Hash className="w-3 h-3" />
                      <span className="truncate font-mono">{uid}</span>
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-900 text-white text-xs rounded px-2 py-1 z-50"
                      sideOffset={5}
                    >
                      User ID - Click to copy
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            )}

            {showAffiliations && user?.affiliations && user.affiliations.length > 0 && (
              <p className="text-xs text-gray-500 truncate mt-1">{user.affiliations.join(', ')}</p>
            )}
          </div>

          {/* Badges */}
          {renderBadges()}

          {/* Menu */}
          {renderMenu()}

          {/* Action Buttons */}
          {renderActionButtons()}
        </div>
      </div>
    );
  }

  return null;
};

export default UserCard;
