//src/features/Users/components/ui/UserMenu.tsx

import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Share2, Eye, Trash2, LucideIcon } from 'lucide-react';
import { BelroseUserProfile } from '@/types/core';

// Types for the menu system
interface MenuOption {
  key: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
  className?: string;
  type?: 'option';
}

interface MenuDivider {
  type: 'divider';
  key?: string;
}

type MenuItem = MenuOption | MenuDivider;

interface UserMenuProps {
  // Required props
  user: BelroseUserProfile | null | undefined;

  // Action handlers - parent provides these
  onView?: (record: any) => void;
  onShare?: (record: any) => void;
  onDelete?: (record: any) => void;

  // Customization props
  triggerIcon?: LucideIcon;
  triggerClassName?: string;
  menuClassName?: string;

  // Configuration - what actions to show
  showView?: boolean;
  showShare?: boolean;
  showDelete?: boolean;

  // Additional menu items from parent
  additionalItems?: MenuItem[];
}

/**
 * View User Details
 * Share Record with User
 * ---------------
 * Delete/Remove
 */

const UserMenu: React.FC<UserMenuProps> = ({
  user,
  onView,
  onShare,
  onDelete,
  triggerIcon: TriggerIcon = MoreHorizontal,
  triggerClassName = 'p-2 text-primary hover:text-primary hover:bg-gray-100 rounded-lg transition-colors',
  menuClassName = 'absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[160px]',
  showShare = true,
  showView = true,
  showDelete = true,
  additionalItems = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Wrapper for parent handlers
  const createHandler = (handler?: (user: any) => void) => {
    return () => {
      if (handler) {
        handler(user);
      }
      setIsOpen(false);
    };
  };

  // Build menu items based on props
  const buildMenuItems = (): MenuItem[] => {
    const items: MenuItem[] = [];

    // View action
    if (showView && onView) {
      items.push({
        key: 'view',
        label: 'View User Details',
        icon: Eye,
        onClick: createHandler(onView),
      });
    }

    // Share action
    if (showShare && onShare) {
      items.push({
        key: 'share',
        label: 'Share Records with User',
        icon: Share2,
        onClick: createHandler(onShare),
      });
    }

    // Add any additional items from parent
    if (additionalItems.length > 0) {
      items.push(...additionalItems);
    }

    // Add divider before destructive actions if we have any non-destructive items
    if (items.length > 0 && showDelete) {
      items.push({ type: 'divider', key: 'divider-1' });
    }

    // Delete action
    if (showDelete && onDelete) {
      items.push({
        key: 'remove',
        label: 'Remove User',
        icon: Trash2,
        onClick: createHandler(onDelete),
        destructive: true,
      });
    }

    return items;
  };

  const menuItems = buildMenuItems();

  // Don't render if no items
  if (menuItems.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClassName}
        title="More options"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <TriggerIcon className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className={menuClassName}>
          {menuItems.map((item, index) => {
            if (item.type === 'divider') {
              return <hr key={item.key || `divider-${index}`} className="my-1 border-gray-200" />;
            }

            const menuOption = item as MenuOption;

            return (
              <button
                key={menuOption.key}
                onClick={menuOption.onClick}
                disabled={menuOption.disabled}
                className={`
                  w-full px-4 py-2 text-left text-sm hover:bg-gray-100 
                  flex items-center gap-3 transition-colors
                  ${menuOption.destructive ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'}
                  ${menuOption.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  ${menuOption.className || ''}
                `}
              >
                {menuOption.icon && <menuOption.icon className="w-4 h-4 flex-shrink-0" />}
                <span>{menuOption.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserMenu;
