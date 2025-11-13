import React from 'react';
import { User, Mail, Hash, X, Check, BadgeCheck, CircleCheck } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import UserMenu from './UserMenu';
import { BelroseUserProfile } from '@/types/core';
import { copyToClipboard } from '@/utils/browserUtils';

export type UserCardVariant = 'compact' | 'default' | 'detailed';
export type UserCardColor = 'default' | 'primary' | 'green' | 'red' | 'purple' | 'amber';

interface UserCardProps {
  user: BelroseUserProfile | null | undefined;
  userId?: string; // Fallback if user profile not loaded
  variant?: UserCardVariant;
  color?: UserCardColor;

  // Optional badges/indicators
  badge?: {
    text: string;
    color: 'primary' | 'green' | 'red' | 'yellow' | 'purple';
    icon?: React.ReactNode;
  };

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
  actions?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'danger';
  }[];

  // Display options
  menuType?: 'default' | 'cancel' | 'acceptOrCancel';
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
  default: {
    bg: 'bg-gray-50',
    iconBg: 'bg-gray-200',
    icon: 'text-gray-700',
    border: 'border-gray-200',
  },
  primary: {
    bg: 'bg-primary/10',
    iconBg: 'bg-primary/20',
    icon: 'text-primary',
    border: 'border-primary/30',
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
  purple: {
    bg: 'bg-purple-50',
    iconBg: 'bg-purple-200',
    icon: 'text-purple-700',
    border: 'border-purple-200',
  },
  amber: {
    bg: 'bg-chart-4/20',
    iconBg: 'bg-chart-4/50',
    icon: 'text-chart-4',
    border: 'border-chart-4',
  },
};

export const UserCard: React.FC<UserCardProps> = ({
  user,
  userId,
  variant = 'default',
  color = 'default',
  badge,
  metadata,
  onView,
  onShare,
  onDelete,
  onCardClick,
  onCancel,
  onAccept,
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

  // Compact variant - just name and icon
  if (variant === 'compact') {
    return (
      <div
        onClick={onCardClick}
        className={`flex items-center justify-between p-4 ${colors.bg} rounded-lg border ${
          colors.border
        } ${isClickable ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
      >
        <span className="text-sm font-medium text-gray-900 truncate">{displayName}</span>
        {/*Verified Badge*/}
        {user?.emailVerified && user?.isIdentityVerified && (
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
        )}
        {badge && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full bg-${badge.color}-100 text-${badge.color}-800`}
          >
            {badge.text}
          </span>
        )}
        {/* Actions Menu - Full Menu */}
        {menuType === 'default' && (
          <UserMenu user={user} onView={onView} onShare={onShare} onDelete={onDelete} />
        )}

        {/* Actions Menu - Cancel / AcceptOrCancel Menu */}
        <div className="flex justify-between z-50">
          {(menuType === 'acceptOrCancel' || menuType === 'cancel') && (
            <div className="mx-1">
              <button
                onClick={onCancel}
                className="flex items-center bg-red-200 rounded-full p-2 hover:bg-red-300"
              >
                <X className="text-red-700 w-4 h-4 " />
              </button>
            </div>
          )}
          {menuType === 'acceptOrCancel' && (
            <div className="mx-1">
              <button
                onClick={onAccept}
                className="flex items-center bg-green-200 rounded-full p-2 hover:bg-green-400"
              >
                <Check className="text-green-900 w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default variant - standard card
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
          <div
            className={`w-10 h-10 ${colors.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}
          >
            <User className={`w-5 h-5 ${colors.icon}`} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1">
              <p className="text-base font-semibold text-gray-900 truncate">{displayName}</p>{' '}
              {/*Verified Badge*/}
              {user?.emailVerified && user?.isIdentityVerified && (
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
              )}
              {badge && (
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-${badge.color}-100 text-${badge.color}-800 flex-shrink-0`}
                >
                  {badge.icon}
                  {badge.text}
                </span>
              )}
            </div>
            {/* Email with tooltip */}
            {showEmail && email && (
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <div
                      onClick={() => copyToClipboard(email)}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 cursor-help mb-1"
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
            {/* User ID with tooltip */}
            {showUserId && uid && (
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <div
                      onClick={() => copyToClipboard(uid)}
                      className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 cursor-help"
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
          {/* Actions Menu - Full Menu */}
          {menuType === 'default' && (
            <UserMenu user={user} onView={onView} onShare={onShare} onDelete={onDelete} />
          )}

          {/* Actions Menu - Cancel / AcceptOrCancel Menu */}
          <div className="flex justify-between z-50">
            {(menuType === 'acceptOrCancel' || menuType === 'cancel') && (
              <div className="mx-1">
                <button
                  onClick={onCancel}
                  className="flex items-center bg-red-200 rounded-full p-2 hover:bg-red-300"
                >
                  <X className="text-red-700 w-4 h-4 " />
                </button>
              </div>
            )}
            {menuType === 'acceptOrCancel' && (
              <div className="mx-1">
                <button
                  onClick={onAccept}
                  className="flex items-center bg-green-200 rounded-full p-2 hover:bg-green-400"
                >
                  <Check className="text-green-900 w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Detailed variant - full profile card
  return (
    <div
      onClick={onCardClick}
      className={`
        ${colors.bg} rounded-lg border ${colors.border} p-4
        ${isClickable ? 'cursor-pointer hover:shadow-lg' : ''}
        transition-shadow ${className}
      `}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className={`w-16 h-16 ${colors.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={displayName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <User className={`w-8 h-8 ${colors.icon}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name and Badge */}
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900 truncate">{displayName}</h3>
            {/*Verified Badge*/}
            {user?.emailVerified && user?.isIdentityVerified && (
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
            )}
            {badge && (
              <span
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-${badge.color}-100 text-${badge.color}-800 flex-shrink-0`}
              >
                {badge.icon}
                {badge.text}
              </span>
            )}
          </div>

          {/* Email with tooltip */}
          {showEmail && email && (
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div
                    onClick={() => copyToClipboard(email)}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 cursor-help mb-1"
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

          {/* User ID with tooltip */}
          {showUserId && uid && (
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div
                    onClick={() => copyToClipboard(uid)}
                    className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 cursor-help mb-2"
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

          {/* Affiliations */}
          {showAffiliations && user?.affiliations && user.affiliations.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {user.affiliations.map((affiliation, idx) => (
                <span key={idx} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                  {affiliation}
                </span>
              ))}
            </div>
          )}

          {/* Metadata */}
          {metadata && metadata.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-200">
              {metadata.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  {item.icon && <span className="text-gray-500">{item.icon}</span>}
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500">{item.label}</span>
                    <span className="text-sm font-medium text-gray-900">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Actions Menu - Full Menu */}
        {menuType === 'default' && (
          <UserMenu user={user} onView={onView} onShare={onShare} onDelete={onDelete} />
        )}

        {/* Actions Menu - Cancel / AcceptOrCancel Menu */}
        <div className="flex justify-between z-50">
          {(menuType === 'acceptOrCancel' || menuType === 'cancel') && (
            <div className="mx-1">
              <button
                onClick={onCancel}
                className="flex items-center bg-red-200 rounded-full p-2 hover:bg-red-300"
              >
                <X className="text-red-700 w-4 h-4 " />
              </button>
            </div>
          )}
          {menuType === 'acceptOrCancel' && (
            <div className="mx-1">
              <button
                onClick={onAccept}
                className="flex items-center bg-green-200 rounded-full p-2 hover:bg-green-400"
              >
                <Check className="text-green-900 w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserCard;
