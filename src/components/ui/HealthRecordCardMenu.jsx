import React, { useState, useRef, useEffect } from 'react';
import { Ellipsis } from 'lucide-react';

// Reusable Options Menu Component
const HealthRecordCardMenu = ({ 
  options = [], 
  triggerIcon = Ellipsis, 
  triggerClassName = "p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100",
  menuClassName = "absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]",
  buttonClassName = "w-full px-4 py-1 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const TriggerIcon = triggerIcon;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOptionClick = (option) => {
    setIsOpen(false);
    if (option.onClick) {
      option.onClick();
    }
  };

  if (options.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClassName}
        title="Options"
      >
        <TriggerIcon className="w-4 h-4" />
      </button>
      
      {isOpen && (
        <div className={menuClassName}>
          {options.map((option, index) => (
            <React.Fragment key={option.key || index}>
              {option.type === 'divider' ? (
                <hr className="my-1" />
              ) : (
                <button
                  onClick={() => handleOptionClick(option)}
                  className={`${buttonClassName} ${option.className || ''} ${option.destructive ? 'text-red-600 hover:bg-red-50' : ''}`}
                  disabled={option.disabled}
                >
                  {option.icon && <option.icon className="w-4 h-4" />}
                  {option.label}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default HealthRecordCardMenu;