import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
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
import { GuestBanner, GuestFooter } from './GuestBanner';
import useNotifications from '@/features/Notifications/hooks/useNotifications';
import { useUnreadMessageCount } from '@/features/Messaging/hooks/useUnreadMessageCount';
import { useInboundRequests } from '@/features/RequestRecord/hooks/usePendingInboundRequests';
import { useActionsCount } from '@/features/RefineRecord/hooks/useActionsCount';

// ── No longer accepts children — nested routes render via <Outlet /> ──────────

function AppLayout() {
  const { user } = useAuthContext();
  const { header, footer } = useLayout();
  const navigate = useNavigate();
  const isGuest = user?.isGuest === true;

  const { count: actionsCount } = useActionsCount();
  const { unreadCount } = useNotifications(user?.uid);

  const { counts } = useInboundRequests();
  const pendingRequests = counts.pending;

  const navSectionsWithBadges = navigationSections.map(section => ({
    ...section,
    items: section.items.map(item =>
      item.url === '/app/record-requests' ? { ...item, badge: pendingRequests } : item
    ),
  }));

  const unreadMessages = useUnreadMessageCount(user?.uid);

  const { chats, chatsLoading, currentChatId, handleLoadChat, handleNewChat, deleteChat } =
    useAIChatContext();

  if (!user) return null;

  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

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
      navigate('/');
    } catch (error) {
      toast.error('Failed to sign out. Please try again.');
    }
  };

  const handleSettings = () => navigate('/app/settings');
  const handleNotifications = () => navigate('/app/notifications');
  const handleHelp = () => window.open('https://help.example.com', '_blank');

  useEffect(() => {
    if (isDesktop) setIsMobileOpen(false);
  }, [isDesktop]);

  if (isDesktop) {
    return (
      <div className="h-screen flex overflow-hidden">
        <div className="flex-shrink-0">
          <DesktopSidebar
            isCollapsed={isDesktopCollapsed}
            onToggle={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
            onLogout={handleLogout}
            navigationSections={navSectionsWithBadges}
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
            unreadNotifications={unreadCount + actionsCount}
            unreadMessages={unreadMessages}
          />
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          {isGuest && <GuestBanner />}
          {header && <div>{header}</div>}

          <div className="flex flex-1 overflow-hidden">
            {/* Outlet replaces {children} — the matched child route renders here */}
            <main className="flex-1 overflow-auto">
              <Outlet />
            </main>
          </div>

          {isGuest && <GuestFooter />}
          {footer && <div>{footer}</div>}
        </div>
      </div>
    );
  }

  // Mobile Layout
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <MobileHeader
        user={user}
        onMenuToggle={() => setIsMobileOpen(true)}
        additionalContent={header}
      />

      {isGuest && <GuestBanner />}

      <MobileSidebar
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        navigationSections={navSectionsWithBadges}
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
        unreadNotifications={unreadCount}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Outlet replaces {children} — the matched child route renders here */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {isGuest && <GuestFooter />}
      {footer && <div className="border-t border-gray-200 bg-white shadow-sm">{footer}</div>}
    </div>
  );
}

export default AppLayout;
