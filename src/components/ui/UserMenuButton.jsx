import { User, Settings, LogOut, HelpCircle, ChevronUp } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

const UserMenuButton = ({ user, isCollapsed, onLogout, onSettings, onHelp }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && 
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuItemClick = (action) => {
    setIsMenuOpen(false);
    // Handle the action (logout, settings, etc.)
    switch (action) {
      case 'logout': onLogout?.();
        break;
      case 'settings': onSettings?.();
        break;
      case 'help' : onHelp?.();
        break;
      default:
        console.log(`${action} clicked`);
    }
  };

  // Determine dropdown positioning based on collapsed state
  const getDropdownClasses = () => {
    if (isCollapsed) {
      // Collapsed: position dropdown to the right to avoid cutoff
      return 'absolute bottom-full mb-2 left-0 w-48';
    } else {
      // Expanded: center the dropdown with margins
      return 'absolute bottom-full mb-2 left-4 right-4';
    }
  };

  return (
    <div className="relative p-2">
      {/* User Info Button */}
      <Button
        ref={buttonRef}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className={`w-full p-4 flex items-center gap-3 hover:bg-gray-700 transition-colors ${
          isCollapsed ? 'justify-center' : ''
        } ${isMenuOpen ? 'bg-gray-700' : ''}`}
      >
        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-gray-300" />
        </div>
        {!isCollapsed && (
          <>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-medium text-white truncate">
                {user?.displayName || "User"}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {user?.email || "user@example.com"}
              </p>
            </div>
            <ChevronUp className={`w-4 h-4 text-gray-400 transition-transform ${
              isMenuOpen ? 'rotate-180' : ''
            }`} />
          </>
        )}
      </Button>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div
          ref={menuRef}
          className={`${getDropdownClasses()} bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-2 z-50`}
        >
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

          <div className="border-t border-gray-700 my-2"></div>
          
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
  );
};

export default UserMenuButton;