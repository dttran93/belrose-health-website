import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// Type definitions
type AccordionType = "single" | "multiple";
type AccordionValue = string;

// Context type definitions
interface AccordionContextType {
  toggleItem: (value: AccordionValue) => void;
  isOpen: (value: AccordionValue) => boolean;
  type: AccordionType;
  collapsible: boolean;
}

interface AccordionItemContextType {
  value: AccordionValue;
}

// Props interfaces
interface AccordionProps {
  type?: AccordionType;
  collapsible?: boolean;
  children: React.ReactNode;
  className?: string;
  defaultValue?: AccordionValue | AccordionValue[] | null;
  [key: string]: any; // For spread props
}

interface AccordionItemProps {
  value: AccordionValue;
  children: React.ReactNode;
  className?: string;
  [key: string]: any; // For spread props
}

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
  [key: string]: any; // For spread props
}

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
  [key: string]: any; // For spread props
}

// Create contexts with proper typing
const AccordionContext = createContext<AccordionContextType | null>(null);
const AccordionItemContext = createContext<AccordionItemContextType | null>(null);

// Main Accordion Component
const Accordion: React.FC<AccordionProps> = ({ 
  type = "single", 
  collapsible = false, 
  children, 
  className = "",
  defaultValue = null,
  ...props 
}) => {
  const [openItems, setOpenItems] = useState<AccordionValue[]>(() => {
    if (defaultValue) {
      return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
    }
    return [];
  });

  const toggleItem = (value: AccordionValue): void => {
    if (type === "single") {
      // Single accordion - only one item can be open
      if (openItems.includes(value)) {
        setOpenItems(collapsible ? [] : openItems);
      } else {
        setOpenItems([value]);
      }
    } else {
      // Multiple accordion - multiple items can be open
      setOpenItems(prev => 
        prev.includes(value) 
          ? prev.filter(item => item !== value)
          : [...prev, value]
      );
    }
  };

  const isOpen = (value: AccordionValue): boolean => openItems.includes(value);

  const contextValue: AccordionContextType = {
    toggleItem,
    isOpen,
    type,
    collapsible
  };

  return (
    <AccordionContext.Provider value={contextValue}>
      <div className={`accordion ${className}`} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
};

// Accordion Item Component (basic version)
const AccordionItem: React.FC<AccordionItemProps> = ({ 
  value, 
  children, 
  className = "",
  ...props 
}) => {
  const context = useContext(AccordionContext);
  
  if (!context) {
    throw new Error('AccordionItem must be used within an Accordion');
  }

  const isOpen = context.isOpen(value);

  return (
    <div 
      className={`accordion-item ${className}`}
      data-state={isOpen ? "open" : "closed"}
      {...props}
    >
      {children}
    </div>
  );
};

// Accordion Trigger Component
const AccordionTrigger: React.FC<AccordionTriggerProps> = ({ 
  children, 
  className = "",
  ...props 
}) => {
  const context = useContext(AccordionContext);
  const item = useContext(AccordionItemContext);
  
  if (!context) {
    throw new Error('AccordionTrigger must be used within an Accordion');
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const itemElement = (e.target as HTMLElement).closest('.accordion-item') as HTMLElement;
    const value = itemElement?.getAttribute('data-value') || 
                  itemElement?.querySelector('[data-value]')?.getAttribute('data-value');
    
    if (value) {
      context.toggleItem(value);
    }
  };

  return (
    <button
      className={`accordion-trigger w-full text-left flex justify-between items-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${className}`}
      onClick={handleClick}
      type="button"
      {...props}
    >
      <span className="flex-1">{children}</span>
      <svg
        className="accordion-chevron w-4 h-4 shrink-0 transition-transform duration-200"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        style={{
          transform: 'var(--accordion-chevron-transform, rotate(0deg))'
        }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
};

// Accordion Content Component
const AccordionContent: React.FC<AccordionContentProps> = ({ 
  children, 
  className = "",
  ...props 
}) => {
  const context = useContext(AccordionContext);
  const item = useContext(AccordionItemContext);
  const isOpen = context?.isOpen(item?.value || '');
  
  return (
    <div
      className={`accordion-content overflow-hidden transition-all duration-300 ease-in-out ${className}`}
      style={{
        maxHeight: isOpen ? '500px' : '0px',
        opacity: isOpen ? 1 : 0,
        paddingTop: isOpen ? '16px' : '0px',
        paddingBottom: isOpen ? '16px' : '0px'
      }}
      {...props}
    >
      <div className="accordion-content-inner">
        {children}
      </div>
    </div>
  );
};

// Enhanced AccordionItem with proper value handling
const EnhancedAccordionItem: React.FC<AccordionItemProps> = ({ 
  value, 
  children, 
  className = "", 
  ...props 
}) => {
  const context = useContext(AccordionContext);
  const isOpen = context?.isOpen(value);
  
  useEffect(() => {
    const item = document.querySelector(`[data-value="${value}"]`) as HTMLElement;
    if (item) {
      const content = item.querySelector('.accordion-content') as HTMLElement;
      
      if (isOpen) {
        item.style.setProperty('--accordion-content-height', `${content?.scrollHeight || 0}px`);
        item.style.setProperty('--accordion-content-opacity', '1');
        item.style.setProperty('--accordion-chevron-transform', 'rotate(180deg)');
      } else {
        item.style.setProperty('--accordion-content-height', '0px');
        item.style.setProperty('--accordion-content-opacity', '0');
        item.style.setProperty('--accordion-chevron-transform', 'rotate(0deg)');
      }
    }
  }, [isOpen, value]);

  return (
    <div 
      className={`accordion-item ${className}`}
      data-state={isOpen ? "open" : "closed"}
      data-value={value}
      {...props}
    >
      {children}
    </div>
  );
};

// Final AccordionItem that provides context
const FinalAccordionItem: React.FC<AccordionItemProps> = ({ 
  value, 
  children, 
  className = "", 
  ...props 
}) => {
  const contextValue: AccordionItemContextType = { value };

  return (
    <AccordionItemContext.Provider value={contextValue}>
      <EnhancedAccordionItem value={value} className={className} {...props}>
        {children}
      </EnhancedAccordionItem>
    </AccordionItemContext.Provider>
  );
};

export {
  Accordion,
  FinalAccordionItem as AccordionItem,
  AccordionTrigger,
  AccordionContent
};