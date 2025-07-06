import React, { createContext, useContext, useState } from 'react';

// Accordion Context
const AccordionContext = createContext();

// Main Accordion Component
const Accordion = ({ 
  type = "single", 
  collapsible = false, 
  children, 
  className = "",
  defaultValue = null,
  ...props 
}) => {
  const [openItems, setOpenItems] = useState(
    defaultValue ? (Array.isArray(defaultValue) ? defaultValue : [defaultValue]) : []
  );

  const toggleItem = (value) => {
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

  const isOpen = (value) => openItems.includes(value);

  return (
    <AccordionContext.Provider value={{ toggleItem, isOpen, type, collapsible }}>
      <div className={`accordion ${className}`} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
};

// Accordion Item Component
const AccordionItem = ({ 
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
const AccordionTrigger = ({ 
  children, 
  className = "",
  ...props 
}) => {
  const context = useContext(AccordionContext);
  const item = useContext(AccordionItemContext);
  
  if (!context) {
    throw new Error('AccordionTrigger must be used within an Accordion');
  }

  // Get the value from the parent AccordionItem
  const getItemValue = () => {
    const itemElement = document.activeElement?.closest('[data-state]');
    return itemElement?.previousElementSibling?.getAttribute('data-value') || 
           itemElement?.getAttribute('data-value');
  };

  const handleClick = (e) => {
    const itemElement = e.target.closest('.accordion-item');
    const value = itemElement?.getAttribute('data-value') || 
                  itemElement?.querySelector('[data-value]')?.getAttribute('data-value');
    
    if (value) {
      context.toggleItem(value);
    }
  };

  // Find the parent AccordionItem to get its value
  const parentItem = React.useRef();
  React.useEffect(() => {
    parentItem.current = document.querySelector(`[data-value]`);
  });

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
const AccordionContent = ({ 
  children, 
  className = "",
  ...props 
}) => {
  const context = useContext(AccordionContext);
  const item = useContext(AccordionItemContext);
  const isOpen = context?.isOpen(item?.value);
  
  return (
    <div
      className={`accordion-content overflow-hidden transition-all duration-300 ease-in-out ${className}`}
      style={{
        maxHeight: isOpen ? '500px' : '0px', // Set a reasonable max height when open
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
const EnhancedAccordionItem = ({ value, children, className = "", ...props }) => {
  const context = useContext(AccordionContext);
  const isOpen = context?.isOpen(value);
  
  React.useEffect(() => {
    const item = document.querySelector(`[data-value="${value}"]`);
    if (item) {
      const trigger = item.querySelector('.accordion-trigger');
      const content = item.querySelector('.accordion-content');
      const chevron = item.querySelector('.accordion-chevron');
      
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

// Create context for AccordionItem
const AccordionItemContext = createContext();

// Final AccordionItem that provides context
const FinalAccordionItem = ({ value, children, className = "", ...props }) => {
  return (
    <AccordionItemContext.Provider value={{ value }}>
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