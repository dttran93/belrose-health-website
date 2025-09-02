import React, { useState, useRef, useEffect } from 'react';
import { 
  MoreHorizontal, 
  Edit3, 
  Share2, 
  Download, 
  Copy, 
  Eye,
  Archive, 
  Trash2,
  LucideIcon, 
  GitBranch,
  Shield,
} from 'lucide-react';

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

interface HealthRecordMenuProps {
  // Required props
  record: any; // Your FileObject type
  
  // Action handlers - parent provides these
  onEdit?: (record: any) => void;
  onShare?: (record: any) => void;
  onDelete?: (record: any) => void;
  onArchive?: (record: any) => void;
  onView?: (record: any) => void;
  onVersion?: (record: any) => void;
  onViewVerification?: (record: any) => void;
  
  // Customization props
  triggerIcon?: LucideIcon;
  triggerClassName?: string;
  menuClassName?: string;
  
  // Configuration - what actions to show
  showEdit?: boolean;
  showShare?: boolean;
  showDownload?: boolean;
  showCopy?: boolean;
  showView?: boolean;
  showArchive?: boolean;
  showDelete?: boolean;
  showVersions?: boolean;
  showVerification?: boolean;
  
  // Additional menu items from parent
  additionalItems?: MenuItem[];
}

const HealthRecordMenu: React.FC<HealthRecordMenuProps> = ({
  record,
  onView,
  onEdit,
  onShare,
  onDelete,
  onVersion,
  onViewVerification,
  triggerIcon: TriggerIcon = MoreHorizontal,
  triggerClassName = "p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors",
  menuClassName = "absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[160px]",
  showEdit = true,
  showShare = true,
  showDownload = true,
  showCopy = true,
  showView = false, // Usually false for full view, true for cards
  showDelete = true,
  showVersions = true,
  showVerification = true,
  additionalItems = []
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

  // Internal handlers for UI-only operations
  const handleDownload = () => {
    if (record.downloadURL) {
      const link = document.createElement('a');
      link.href = record.downloadURL;
      link.download = record.fileName || record.name || 'document';
      link.click();
    }
    setIsOpen(false);
  };

  const handleCopyData = async () => {
    try {
      if (record.fhirData) {
        await navigator.clipboard.writeText(JSON.stringify(record.fhirData, null, 2));
        // You could add a toast notification here
        console.log('FHIR data copied to clipboard');
      }
    } catch (error) {
      console.error('Failed to copy data:', error);
    }
    setIsOpen(false);
  };

  const handleViewVerification = () => {
    setIsOpen(false);
    if (onViewVerification) {
      onViewVerification(record);
    }
  }

  // Wrapper for parent handlers
  const createHandler = (handler?: (record: any) => void) => {
    return () => {
      if (handler) {
        handler(record);
      }
      setIsOpen(false);
    };
  };

  // Build menu items based on props
  const buildMenuItems = (): MenuItem[] => {
    const items: MenuItem[] = [];

    // View action (usually for cards)
    if (showView && onView) {
      items.push({
        key: 'view',
        label: 'View Record',
        icon: Eye,
        onClick: createHandler(onView)
      });
    }

    // Edit action
    if (showEdit && onEdit) {
      items.push({
        key: 'edit',
        label: 'Edit Record',
        icon: Edit3,
        onClick: createHandler(onEdit)
      });
    }

    // Versions action
    if (showVersions) {
      items.push({
        key: 'versions',
        label: 'View Versions',
        icon: GitBranch,
        onClick: createHandler(onVersion)
      });
    }

    // Share action
    if (showShare && onShare) {
      items.push({
        key: 'share',
        label: 'Share Record',
        icon: Share2,
        onClick: createHandler(onShare)
      });
    }

    // Download action (internal handler)
    if (showDownload && record.downloadURL) {
      items.push({
        key: 'download',
        label: 'Download File',
        icon: Download,
        onClick: handleDownload
      });
    }

    // Copy action (internal handler)
    if (showCopy && record.fhirData) {
      items.push({
        key: 'copy',
        label: 'Copy FHIR Data',
        icon: Copy,
        onClick: handleCopyData
      });
    }

    if (showVerification) {
      items.push({
        key: 'verification',
        label: 'View Verification',
        icon: Shield,
        onClick:handleViewVerification
      })
    }

    // Add any additional items from parent
    if (additionalItems.length > 0) {
      items.push(...additionalItems);
    }

    // Add divider before destructive actions if we have any non-destructive items
    if (items.length > 0 && ( showDelete)) {
      items.push({ type: 'divider', key: 'divider-1' });
    }

    // Delete action
    if (showDelete && onDelete) {
      items.push({
        key: 'delete',
        label: 'Delete Record',
        icon: Trash2,
        onClick: createHandler(onDelete),
        destructive: true
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
              return (
                <hr 
                  key={item.key || `divider-${index}`} 
                  className="my-1 border-gray-200" 
                />
              );
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
                  ${menuOption.destructive 
                    ? 'text-red-600 hover:bg-red-50' 
                    : 'text-gray-700'
                  }
                  ${menuOption.disabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'cursor-pointer'
                  }
                  ${menuOption.className || ''}
                `}
              >
                {menuOption.icon && (
                  <menuOption.icon className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{menuOption.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HealthRecordMenu;