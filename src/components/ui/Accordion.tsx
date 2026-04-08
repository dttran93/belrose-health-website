import React, { createContext, useContext, useState, useEffect } from 'react';

// Type definitions
type AccordionType = 'single' | 'multiple';
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
  type = 'single',
  collapsible = false,
  children,
  className = '',
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
    if (type === 'single') {
      // Single accordion - only one item can be open
      if (openItems.includes(value)) {
        setOpenItems(collapsible ? [] : openItems);
      } else {
        setOpenItems([value]);
      }
    } else {
      // Multiple accordion - multiple items can be open
      setOpenItems(prev =>
        prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]
      );
    }
  };

  const isOpen = (value: AccordionValue): boolean => openItems.includes(value);

  return (
    <AccordionContext.Provider value={{ toggleItem, isOpen, type, collapsible }}>
      <div className={`accordion ${className}`} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
};

// ─── AccordionTrigger ────────────────────────────────────────────────────────

const AccordionTrigger: React.FC<AccordionTriggerProps> = ({
  children,
  className = '',
  ...props
}) => {
  const context = useContext(AccordionContext);
  const item = useContext(AccordionItemContext);

  if (!context) throw new Error('AccordionTrigger must be used within an Accordion');

  const isOpen = context.isOpen(item?.value || '');

  const handleClick = (): void => {
    if (item?.value) context.toggleItem(item.value);
  };

  return (
    <button
      className={`accordion-trigger group w-full text-left flex justify-between items-center gap-4
        transition-all duration-200 py-4
        ${className}`}
      onClick={handleClick}
      type="button"
      {...props}
    >
      <span className="flex-1">{children}</span>

      {/* Circle icon: filled blue when open, light gray when closed; + rotates to × */}
      <span
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
          transition-all duration-300 ease-in-out
          ${isOpen ? 'bg-primary text-white rotate-45' : 'bg-gray-100 text-gray-500'}`}
        aria-hidden="true"
      >
        <span
          className="relative"
          style={{
            top: '-1px', // Vertical nudge: Adjust this if it still looks low/high
            lineHeight: 0, // Prevents the character box from pushing the icon down
          }}
        >
          +
        </span>
      </span>
    </button>
  );
};

// ─── AccordionContent ────────────────────────────────────────────────────────

const AccordionContent: React.FC<AccordionContentProps> = ({
  children,
  className = '',
  ...props
}) => {
  const context = useContext(AccordionContext);
  const item = useContext(AccordionItemContext);
  const isOpen = context?.isOpen(item?.value || '');

  return (
    // Smooth glide via maxHeight + opacity transition
    <div
      className={`accordion-content overflow-hidden transition-all duration-300 ease-in-out border-t border-blue-100 ${className}`}
      style={{
        maxHeight: isOpen ? '500px' : '0px',
        opacity: isOpen ? 1 : 0,
        paddingTop: isOpen ? '16px' : '0px',
        paddingBottom: isOpen ? '16px' : '0px',
      }}
      {...props}
    >
      <div className="accordion-content-inner">{children}</div>
    </div>
  );
};

// Enhanced AccordionItem with proper value handling
const EnhancedAccordionItem: React.FC<AccordionItemProps> = ({
  value,
  children,
  className = '',
  ...props
}) => {
  const context = useContext(AccordionContext);
  const isOpen = context?.isOpen(value);

  useEffect(() => {
    const item = document.querySelector(`[data-value="${value}"]`) as HTMLElement;
    if (item) {
      const content = item.querySelector('.accordion-content') as HTMLElement;
      item.style.setProperty(
        '--accordion-content-height',
        isOpen ? `${content?.scrollHeight || 0}px` : '0px'
      );
      item.style.setProperty('--accordion-content-opacity', isOpen ? '1' : '0');
      item.style.setProperty(
        '--accordion-chevron-transform',
        isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
      );
    }
  }, [isOpen, value]);

  return (
    <div
      className={`accordion-item rounded-xl transition-colors duration-200
        ring-1 ${isOpen ? 'ring-blue-200 bg-blue-50/30' : 'ring-gray-100 bg-white'}
        ${className}`}
      data-state={isOpen ? 'open' : 'closed'}
      data-value={value}
      {...props}
    >
      {children}
    </div>
  );
};

// ─── FinalAccordionItem (provides AccordionItemContext) ──────────────────────

const FinalAccordionItem: React.FC<AccordionItemProps> = ({
  value,
  children,
  className = '',
  ...props
}) => (
  <AccordionItemContext.Provider value={{ value }}>
    <EnhancedAccordionItem value={value} className={className} {...props}>
      {children}
    </EnhancedAccordionItem>
  </AccordionItemContext.Provider>
);

export { Accordion, FinalAccordionItem as AccordionItem, AccordionTrigger, AccordionContent };
