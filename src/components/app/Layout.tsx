import { useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import DesktopSidebar from '@/components/app/DesktopSidebar';
import MobileSidebar from '@/components/app/MobileSidebar';
import MobileHeader from '@/components/app/MobileHeader';
import ResizeHandle from '@/components/ui/ResizeHandle';
import AIChatPanel from '@/features/ai/AIChatPanel';
import useMediaQuery from '@/hooks/useMediaQuery';
import { healthRecords, healthCategories } from '@/components/app/navigation';
import { useAuthContext } from '@/components/auth/AuthContext';
import { authService } from '@/components/auth/services/authServices';
import { useLayout } from '@/components/app/LayoutProvider';

interface AppLayoutProps {
  children: ReactNode;
}

// Main Layout Component
function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuthContext();
  const { header, footer } = useLayout();

  // If no user, something went wrong. Error message just in case. But should be hanlded by ProtectedRoute.tsx
  if (!user) return null;

  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [aiPanelWidth, setAIPanelWidth] = useState(400);
  const [isAIFullscreen, setIsAIFullscreen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authService.signOut();
      navigate('/'); // Navigate after successful logout
    } catch (error) {
      toast.error('Failed to sign out. Please try again.');
    }
  };

  const handleSettings = () => {
    navigate('/dashboard/settings');
  };

  const handleHelp = () => {
    window.open('https://help.example.com', '_blank');
  };

  const handleAIPanelResize = (deltaX: number) => {
    setAIPanelWidth(prev => {
      const newWidth = prev + deltaX;
      return Math.min(Math.max(newWidth, 300), 800); // Min 300px, Max 800px
    });
  };

  // Close mobile sidebar when switching to desktop
  useEffect(() => {
    if (isDesktop) {
      setIsMobileOpen(false);
    }
  }, [isDesktop]);

  if (isDesktop) {
    // Desktop Layout with AI Panel
    return (
      <div className="h-screen flex overflow-hidden">
        {/* Sidebar */}
        <div className="flex-shrink-0">
          <DesktopSidebar
            isCollapsed={isDesktopCollapsed}
            onToggle={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
            user={user}
            onLogout={handleLogout}
            healthRecords={healthRecords}
            healthCategories={healthCategories}
            onSettings={handleSettings}
            onHelp={handleHelp}
            onCloseAI={() => setIsMobileOpen(false)}
            onToggleAI={() => setIsAIOpen(!isAIOpen)}
            isAIOpen={isAIOpen}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Conditional Header */}
          {header && <div className="border-b border-gray-200 bg-white shadow-sm">{header}</div>}

          {/* Content and AI Panel */}
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 p-6 overflow-auto bg-gray-50">{children}</main>

            {/* Resize Handle */}
            {isAIOpen && !isAIFullscreen && <ResizeHandle onResize={handleAIPanelResize} />}

            {/* AI Panel */}
            <AIChatPanel
              isOpen={isAIOpen}
              onToggle={() => setIsAIOpen(!isAIOpen)}
              width={aiPanelWidth}
              onWidthChange={setAIPanelWidth}
              isFullscreen={isAIFullscreen}
              onFullscreenToggle={() => setIsAIFullscreen(!isAIFullscreen)}
            />
          </div>

          {/* Conditional Footer */}
          {footer && <div className="border-t border-gray-200 bg-white shadow-sm">{footer}</div>}
        </div>
      </div>
    );
  }

  // Mobile Layout
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/*Mobile Header */}
      <MobileHeader
        user={user}
        onMenuToggle={() => setIsMobileOpen(true)}
        onLogout={handleLogout}
        onToggleAI={() => setIsAIOpen(!isAIOpen)}
        isAIOpen={isAIOpen}
        additionalContent={header}
      />

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        user={user}
        onToggleAI={() => setIsAIOpen(!isAIOpen)}
        isAIOpen={isAIOpen}
        healthRecords={healthRecords}
        healthCategories={healthCategories}
        onLogout={handleLogout}
        onSettings={handleSettings}
        onHelp={handleHelp}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {!isAIOpen ? (
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        ) : (
          <>
            <main className="flex-1 p-6 overflow-auto lg:block hidden">{children}</main>
            <AIChatPanel
              isOpen={isAIOpen}
              onToggle={() => setIsAIOpen(!isAIOpen)}
              width={aiPanelWidth}
              onWidthChange={setAIPanelWidth}
              isFullscreen={true} // Always fullscreen on mobile
              onFullscreenToggle={() => setIsAIFullscreen(!isAIFullscreen)}
            />
          </>
        )}
      </div>

      {/* Conditional Footer */}
      {footer && <div className="border-t border-gray-200 bg-white shadow-sm">{footer}</div>}
    </div>
  );
}

export default AppLayout;
