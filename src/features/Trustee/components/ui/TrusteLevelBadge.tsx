// ─── Trust level badge ────────────────────────────────────────────────────────

import { Eye, ShieldAlert, ShieldCheck } from 'lucide-react';
import { TrustLevel } from '../../services/trusteeRelationshipService';

export const trustLevelConfig: Record<
  TrustLevel,
  { label: string; icon: React.ReactNode; color: string }
> = {
  observer: {
    label: 'Observer',
    icon: <Eye className="w-3 h-3" />,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  custodian: {
    label: 'Custodian',
    icon: <ShieldCheck className="w-3 h-3" />,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  controller: {
    label: 'Controller',
    icon: <ShieldAlert className="w-3 h-3" />,
    color: 'bg-red-100 text-red-700 border-red-200',
  },
};

export const TrustLevelBadge: React.FC<{ level: TrustLevel }> = ({ level }) => {
  const config = trustLevelConfig[level];
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${config.color}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
};
