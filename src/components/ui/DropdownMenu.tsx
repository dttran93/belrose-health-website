import React from 'react';
import NavCard from "@/components/site/ui/NavCard";
import { DropdownName } from '@/components/site/Navbar';

export interface DropdownItem {
  icon: React.ReactElement;
  title: string;
  description: string;
  link: string;
  color: string;
}

interface DropdownMenuProps {
  name: DropdownName;
  label: string;
  href: string;
  items: DropdownItem[]
  isOpen: boolean;
  onMouseEnter: (name: DropdownName) => void;
  onMouseLeave: () => void;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ 
  name, 
  label, 
  href = "#", 
  items = [],
  isOpen,
  onMouseEnter,
  onMouseLeave 
}) => {
  return (
    <div 
      className="relative h-full flex items-center py-2" 
      onMouseEnter={() => onMouseEnter(name)}
      onMouseLeave={onMouseLeave}
    > 
      <div className="flex flex-row">
        <a href={href} className="nav-link">{label}</a>
      </div>

      {/* Invisible bridge to prevent gap */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 h-4 bg-transparent" />
      )}

      {/* Dropdown content */}
      <div className={`fixed left-0 top-full w-screen bg-background/80 border-t border-gray-200 shadow-lg z-50 transition-all duration-300 ease-in-out ${
        isOpen
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 -translate-y-4 pointer-events-none'
      }`} 
      style={{left: 'calc(-50vw + 50%)'}}
      >
        <div className="flex items-center justify-center p-6">
          <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-1">
            {items.map((item: DropdownItem, index: number) => (
              <div 
                key={index} 
                className={`transition-all duration-300 ease-in-out ${
                  isOpen
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4'
                }`}
                style={{
                  transitionDelay: isOpen ? `${index * 100}ms` : '0ms'
                }}
              >
                <NavCard 
                  icon={item.icon} 
                  title={item.title} 
                  description={item.description}
                  link={item.link} 
                  color={item.color}
                />
              </div>
            ))}
          </div>
        </div>              
      </div>
    </div>
  );
};

export default DropdownMenu;