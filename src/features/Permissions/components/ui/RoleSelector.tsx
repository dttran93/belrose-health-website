// src/features/Permissions/components/RoleSelector.tsx

/**
 * RoleSelector
 *
 * Standalone radio-card list for picking owner / administrator / viewer.
 * Extracted from SelectRoleGrantContent in PermissionActionDialog so it
 * can be reused in LinkRecordModal and anywhere else.
 */

import { Shield, ShieldCheck, Crown } from 'lucide-react';
import { Role } from '@/features/Permissions/services/permissionsService';

interface RoleSelectorProps {
  value: Role;
  onChange: (role: Role) => void;
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

const RoleSelector: React.FC<RoleSelectorProps> = ({ value, onChange }) => (
  <div className="space-y-2">
    {(Object.entries(ROLE_CONFIG) as [Role, (typeof ROLE_CONFIG)[Role]][]).map(([role, config]) => {
      const Icon = config.icon;
      const isSelected = value === role;
      return (
        <label
          key={role}
          className={`flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer ${
            isSelected
              ? `${config.borderColor} ${config.bgColor}`
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <input
            type="radio"
            name="linkRole"
            value={role}
            checked={isSelected}
            onChange={() => onChange(role)}
            className="w-4 h-4 accent-slate-800"
          />
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? config.bgColor : 'bg-slate-100'}`}
          >
            <Icon className={`w-4 h-4 ${isSelected ? config.textColor : 'text-slate-500'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-medium ${isSelected ? config.textColor : 'text-slate-900'}`}
            >
              {config.label}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
          </div>
        </label>
      );
    })}
  </div>
);

export default RoleSelector;
