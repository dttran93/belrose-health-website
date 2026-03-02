// features/HealthProfile/components/ui/ProfileTab.tsx

import { Clipboard, IdCard, LayoutGrid, List, ShieldCheck } from 'lucide-react';

export type ProfileTab = 'summary' | 'details' | 'blockchain' | 'records' | 'identity';

/** Tab switcher between Overview and Blockchain Verification */
const ProfileTabs: React.FC<{
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}> = ({ activeTab, onTabChange }) => {
  const tabs: { key: ProfileTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: 'summary', label: 'Summary', icon: LayoutGrid },
    { key: 'details', label: 'Details', icon: List },
    { key: 'records', label: 'Records', icon: Clipboard },
    { key: 'identity', label: 'Identity', icon: IdCard },
    { key: 'blockchain', label: 'Credibility', icon: ShieldCheck },
  ];

  return (
    <div className="flex border-b border-border bg-white px-6">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          className={`
            flex items-center gap-2 px-1 py-3 mr-6 text-sm font-medium
            border-b-2 transition-colors
            ${
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-card-foreground hover:border-border'
            }
          `}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
};

export default ProfileTabs;
