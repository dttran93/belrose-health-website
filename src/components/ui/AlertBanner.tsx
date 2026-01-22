// src/components/ui/AlertBanner.tsx

import { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertCircle, LucideIcon } from 'lucide-react';

export type AlertBannerVariant = 'warning' | 'info' | 'success' | 'error';

export interface AlertBannerAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline';
  disabled?: boolean;
}

export interface AlertBannerProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actions?: AlertBannerAction[];
  variant?: AlertBannerVariant;
  onDismiss?: () => void;
}

const VARIANT_STYLES: Record<
  AlertBannerVariant,
  { bg: string; border: string; iconBg: string; iconColor: string }
> = {
  warning: {
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/30',
    iconBg: 'bg-yellow-500/30',
    iconColor: 'text-yellow-700',
  },
  info: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    iconBg: 'bg-blue-500/30',
    iconColor: 'text-blue-700',
  },
  success: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/30',
    iconBg: 'bg-green-500/30',
    iconColor: 'text-green-700',
  },
  error: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
    iconBg: 'bg-red-500/30',
    iconColor: 'text-red-700',
  },
};

export const AlertBanner: React.FC<AlertBannerProps> = ({
  icon: Icon = AlertCircle,
  title,
  description,
  actions = [],
  variant = 'warning',
  onDismiss,
}) => {
  const styles = VARIANT_STYLES[variant];

  return (
    <div className={`p-3 ${styles.bg} border ${styles.border} rounded-lg`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 ${styles.iconBg} rounded-lg flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${styles.iconColor}`} />
          </div>
          <div className="text-left min-w-0">
            <p className="font-semibold text-sm text-primary">{title}</p>
            <p className="text-xs text-gray-600 truncate">{description}</p>
          </div>
        </div>

        {actions.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'default'}
                size="sm"
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
