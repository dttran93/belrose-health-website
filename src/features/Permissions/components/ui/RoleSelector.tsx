// src/features/Permissions/components/RoleSelector.tsx

/**
 * RoleSelector
 *
 * Standalone radio-card list for picking owner / administrator / viewer.
 * Extracted from SelectRoleGrantContent in PermissionActionDialog so it
 * can be reused in LinkRecordModal and anywhere else.
 */

import { Shield, ShieldCheck, Crown, Share2 } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Role } from '@/features/Permissions/services/permissionsService';

export interface RoleEligibility {
  enabled: boolean;
  reason?: string;
}

interface RoleSelectorProps {
  value: Role;
  onChange: (role: Role) => void;
  /** Marks a role as the user's existing role — rendered as a non-interactive "Current" row. */
  currentRole?: Role;
  /** Grays out and disables roles the caller isn't eligible to pick, with a tooltip reason. */
  eligibility?: Record<Role, RoleEligibility>;
}

export const ROLE_CONFIG: Record<
  Role,
  {
    label: string;
    description: string;
    icon: React.ElementType;
    textColor: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  viewer: {
    label: 'Viewer',
    description: 'Can decrypt and view the record.',
    icon: Shield,
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
  },
  sharer: {
    label: 'Sharer',
    description: 'Can view and share the record, but cannot edit it.',
    icon: Share2,
    textColor: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
  },
  administrator: {
    label: 'Administrator',
    description: 'Can view, edit, share, and manage the record.',
    icon: ShieldCheck,
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
  },
  owner: {
    label: 'Owner',
    description: 'Full control including deletion and adding other owners.',
    icon: Crown,
    textColor: 'text-destructive',
    bgColor: 'bg-accent/20',
    borderColor: 'border-destructive',
  },
};

const RoleSelector: React.FC<RoleSelectorProps> = ({
  value,
  onChange,
  currentRole,
  eligibility,
}) => (
  <div className="space-y-2">
    {(Object.entries(ROLE_CONFIG) as [Role, (typeof ROLE_CONFIG)[Role]][]).map(([role, config]) => {
      const Icon = config.icon;
      const isSelected = value === role;
      const isCurrent = currentRole === role;
      const roleEligibility = eligibility?.[role];
      const isDisabled = !isCurrent && roleEligibility?.enabled === false;

      const row = (
        <label
          key={role}
          className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
            isDisabled
              ? 'cursor-not-allowed opacity-50 border-slate-200 bg-slate-50'
              : 'cursor-pointer'
          } ${
            !isDisabled && isSelected
              ? `${config.borderColor} ${config.bgColor}`
              : !isDisabled
                ? 'border-slate-200 hover:border-slate-300 bg-white'
                : ''
          }`}
        >
          <input
            type="radio"
            name="linkRole"
            value={role}
            checked={isSelected}
            disabled={isDisabled}
            onChange={() => onChange(role)}
            className="w-4 h-4 accent-slate-800"
          />
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected && !isDisabled ? config.bgColor : 'bg-slate-100'}`}
          >
            <Icon
              className={`w-4 h-4 ${isSelected && !isDisabled ? config.textColor : 'text-slate-500'}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p
                className={`text-sm font-medium ${isSelected && !isDisabled ? config.textColor : 'text-slate-900'}`}
              >
                {config.label}
              </p>
              {isCurrent && (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
                  Current
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
          </div>
        </label>
      );

      if (isDisabled && roleEligibility?.reason) {
        return (
          <Tooltip.Provider key={role}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>{row}</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-gray-900 text-white rounded-lg px-3 py-2 text-xs max-w-xs shadow-xl z-[110]"
                  sideOffset={5}
                >
                  {roleEligibility.reason}
                  <Tooltip.Arrow className="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        );
      }

      return row;
    })}
  </div>
);

export default RoleSelector;
