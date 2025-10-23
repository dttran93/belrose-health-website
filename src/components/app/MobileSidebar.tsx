import { X, Bot } from 'lucide-react';
import NavItem from '../ui/NavItem';
import UserMenuButton from '../ui/UserMenuButton';
import { NavigationItem } from './navigation';
import { User } from '@/types/core';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onToggleAI: () => void;
  isAIOpen: boolean;
  healthRecords: NavigationItem[];
  healthCategories: NavigationItem[];
  onLogout?: () => void;
  onSettings?: () => void;
  onHelp?: () => void;
}

function MobileSidebar({
  isOpen,
  onClose,
  user,
  onToggleAI,
  isAIOpen,
  healthRecords,
  healthCategories,
  onLogout,
  onSettings,
  onHelp,
}: MobileSidebarProps) {
  return (
    <div>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed top-0 left-0 h-full w-80 bg-primary text-white z-50 
        transform transition-transform duration-300 lg:hidden flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="font-bold text-lg text-left">Belrose</h2>
              <p className="text-xs text-gray-400">Medical Records</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* AI Assistant Button */}
            <div className="mb-4">
              <button
                onClick={() => {
                  onToggleAI();
                  onClose();
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                  ${
                    isAIOpen
                      ? 'bg-blue-500 text-white font-medium'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }
                `}
              >
                <Bot className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">AI Assistant</span>
              </button>
            </div>

            {/* Health Records Section */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-gray-400">
                Health Records
              </h3>
              <div className="space-y-1">
                {healthRecords.map(item => (
                  <NavItem key={item.title} item={item} onClick={onClose} />
                ))}
              </div>
            </div>

            {/* Health Categories Section */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-gray-400">
                Health Categories
              </h3>
              <div className="space-y-1">
                {healthCategories.map(item => (
                  <NavItem key={item.title} item={item} onClick={onClose} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile User Info */}
        <div className="">
          <UserMenuButton
            user={user}
            isCollapsed={false}
            onLogout={onLogout}
            onSettings={onSettings}
            onHelp={onHelp}
          />
        </div>
      </div>
    </div>
  );
}

export default MobileSidebar;
