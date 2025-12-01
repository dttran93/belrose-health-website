import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LayoutContextType {
  header: ReactNode | null;
  footer: ReactNode | null;
  setHeader: (content: ReactNode | null) => void;
  setFooter: (content: ReactNode | null) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [header, setHeader] = useState<ReactNode | null>(null);
  const [footer, setFooter] = useState<ReactNode | null>(null);

  return (
    <LayoutContext.Provider value={{ header, footer, setHeader, setFooter }}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};

// Convenient hook for controlling layout
interface UseLayoutControlReturn {
  showHeader: (content: ReactNode) => void;
  showFooter: (content: ReactNode) => void;
  hideHeader: () => void;
  hideFooter: () => void;
  clearAll: () => void;
}

export const useLayoutControl = (): UseLayoutControlReturn => {
  const { setHeader, setFooter } = useLayout();

  return {
    showHeader: (content: ReactNode) => setHeader(content),
    showFooter: (content: ReactNode) => setFooter(content),
    hideHeader: () => setHeader(null),
    hideFooter: () => setFooter(null),
    clearAll: () => {
      setHeader(null);
      setFooter(null);
    }
  };
};

// Optional: Component-based layout slots
interface LayoutSlotProps {
  children: ReactNode;
  slot: 'header' | 'footer';
}

export const LayoutSlot: React.FC<LayoutSlotProps> = ({ children, slot }) => {
  const { setHeader, setFooter } = useLayout();

  React.useEffect(() => {
    if (slot === 'header') {
      setHeader(children);
    } else if (slot === 'footer') {
      setFooter(children);
    }

    // Cleanup when component unmounts
    return () => {
      if (slot === 'header') {
        setHeader(null);
      } else if (slot === 'footer') {
        setFooter(null);
      }
    };
  }, [children, slot, setHeader, setFooter]);

  return null;
};