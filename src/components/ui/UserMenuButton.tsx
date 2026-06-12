import React, { useState, useRef, useEffect } from 'react';
import { Settings, LogOut, HelpCircle, ChevronUp, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BelroseUserProfile } from '@/types/core';
import { useSwitchableAccounts } from '@/features/Dependents/hooks/useSwitchableAccounts';
import { AccountSwitcherModal } from '@/features/Dependents/components/AccountSwitcherModal';

type MenuAction = 'logout' | 'settings' | 'notifications' | 'help';

interface UserMenuButtonProps {
  user?: BelroseUserProfile | null;
  isCollapsed: boolean;
  onLogout?: () => void;
  onSettings?: () => void;
  onNotifications?: () => void;
  onHelp?: () => void;
}

const UserMenuButton: React.FC<UserMenuButtonProps> = ({
  user,
  isCollapsed,
  onLogout,
  onSettings,
  onNotifications,
  onHelp,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    dependents,
    guardian,
    isLoading: accountsLoading,
    isSwitching,
    switchToDependent,
    switchToGuardian,
    hasMultipleAccounts,
  } = useSwitchableAccounts();

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'U';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuItemClick = (action: MenuAction) => {
    setIsMenuOpen(false);
    switch (action) {
      case 'logout':
        onLogout?.();
        break;
      case 'settings':
        onSettings?.();
        break;
      case 'notifications':
        onNotifications?.();
        break;
      case 'help':
        onHelp?.();
        break;
    }
  };

  const handleOpenSwitcher = () => {
    setIsMenuOpen(false);
    setIsSwitcherOpen(true);
  };

  const getDropdownClasses = () =>
    isCollapsed
      ? 'absolute bottom-full mb-2 left-0 w-48'
      : 'absolute bottom-full mb-2 left-4 right-4';

  return (
    <>
      <div className="relative p-2">
        <Button
          ref={buttonRef}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`w-full p-4 flex items-center gap-3 hover:bg-gray-700 transition-colors ${
            isCollapsed ? 'justify-center' : ''
          } ${isMenuOpen ? 'bg-gray-700' : ''}`}
        >
          {/* Avatar — dependent accounts get a subtle ring to distinguish them */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              user?.isDependent ? 'bg-primary/30 ring-2 ring-complement-4' : 'bg-gray-600'
            }`}
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-sm font-semibold">{initials}</span>
            )}
          </div>

          {!isCollapsed && (
            <>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium text-white truncate">
                  {user?.displayName || 'User'}
                </p>
                {user?.isDependent && (
                  <p className="text-xs text-complement-4 truncate">Dependent account</p>
                )}
                {!user?.isDependent && (
                  <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                )}
              </div>
              <ChevronUp
                className={`w-4 h-4 text-gray-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
              />
            </>
          )}
        </Button>

        {isMenuOpen && (
          <div
            ref={menuRef}
            className={`${getDropdownClasses()} bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-2 z-50`}
          >
            {hasMultipleAccounts && (
              <>
                <button
                  onClick={handleOpenSwitcher}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-3 text-gray-300 hover:text-white transition-colors"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span className="text-sm">Switch Account</span>
                </button>
                <div className="border-t border-gray-700 my-2" />
              </>
            )}

            <button
              onClick={() => handleMenuItemClick('settings')}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-3 text-gray-300 hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">Settings</span>
            </button>

            <button
              onClick={() => handleMenuItemClick('help')}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-3 text-gray-300 hover:text-white transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="text-sm">Learn more</span>
            </button>

            <div className="border-t border-gray-700 my-2" />

            <button
              onClick={() => handleMenuItemClick('logout')}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-3 text-red-400 hover:text-red-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Log out</span>
            </button>
          </div>
        )}
      </div>

      {user && (
        <AccountSwitcherModal
          isOpen={isSwitcherOpen}
          onClose={() => setIsSwitcherOpen(false)}
          currentUser={user}
          dependents={dependents}
          guardian={guardian}
          isLoading={accountsLoading}
          isSwitching={isSwitching}
          onSwitchToDependent={async uid => {
            await switchToDependent(uid);
            setIsSwitcherOpen(false);
          }}
          onSwitchToGuardian={async () => {
            await switchToGuardian();
            setIsSwitcherOpen(false);
          }}
        />
      )}
    </>
  );
};

export default UserMenuButton;
