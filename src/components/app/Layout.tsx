import { useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import DesktopSidebar from '@/components/app/DesktopSidebar';
import MobileSidebar from '@/components/app/MobileSidebar';
import MobileHeader from '@/components/app/MobileHeader';
import useMediaQuery from '@/hooks/useMediaQuery';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { authService } from '@/features/Auth/services/authServices';
import { useLayout } from '@/components/app/LayoutProvider';
import { useAIChatContext } from '@/features/Ai/components/AIChatContext';
import { navigationSections } from './navigation';

interface AppLayoutProps {
  children: ReactNode;
}

// Main Layout Component
function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuthContext();
  const { header, footer } = useLayout();
  const navigate = useNavigate();

  // Pull chat history + current chat state from context
  const { chats, chatsLoading, currentChatId, handleLoadChat, handleNewChat, deleteChat } =
    useAIChatContext();

  if (!user) return null;

  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Sidebar chat handlers
  const handleSelectChat = (chatId: string) => {
    handleLoadChat(chatId);
    navigate(`/app/ai/chat/${chatId}`);
    setIsMobileOpen(false);
  };

  const handleNewChatClick = () => {
    handleNewChat();
    navigate('/app', { replace: true });
    setIsMobileOpen(false);
  };

  const handleViewAllChats = () => {
    navigate('/app/ai/history');
    setIsMobileOpen(false);
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      navigate('/'); // Navigate after successful logout
    } catch (error) {
      toast.error('Failed to sign out. Please try again.');
    }
  };

  const handleSettings = () => {
    navigate('/app/settings');
  };

  const handleNotifications = () => {
    navigate('/app/notifications');
  };

  const handleHelp = () => {
    window.open('https://help.example.com', '_blank');
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
            navigationSections={navigationSections}
            onSettings={handleSettings}
            onNotifications={handleNotifications}
            onHelp={handleHelp}
            onNewAiChat={handleNewChatClick}
            chats={chats}
            chatsLoading={chatsLoading}
            currentChatId={currentChatId}
            onSelectChat={handleSelectChat}
            onNewChat={handleNewChatClick}
            onDeleteChat={deleteChat}
            onViewAllChats={handleViewAllChats}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Conditional Header */}
          {header && <div>{header}</div>}

          {/* Content and AI Panel */}
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-auto">{children}</main>
          </div>

          {/* Conditional Footer */}
          {footer && <div>{footer}</div>}
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
        additionalContent={header}
      />

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        user={user}
        navigationSections={navigationSections}
        onLogout={handleLogout}
        onSettings={handleSettings}
        onHelp={handleHelp}
        onNewAiChat={handleNewChatClick}
        chats={chats}
        chatsLoading={chatsLoading}
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChatClick}
        onDeleteChat={deleteChat}
        onViewAllChats={handleViewAllChats}
      />

      <div className="flex flex-1 overflow-hidden">
        {!isAIOpen ? (
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        ) : (
          <>
            <main className="flex-1 p-6 overflow-auto lg:block hidden">{children}</main>
          </>
        )}
      </div>

      {/* Conditional Footer */}
      {footer && <div className="border-t border-gray-200 bg-white shadow-sm">{footer}</div>}
    </div>
  );
}

export default AppLayout;
