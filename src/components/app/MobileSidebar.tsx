import { X } from 'lucide-react';
import NavItem from '../ui/NavItem';
import UserMenuButton from '../ui/UserMenuButton';
import { NavigationSection } from './navigation';
import { User } from '@/types/core';
import { Chat } from '@/features/Ai/service/chatService';
import { ChatHistoryList } from '@/features/Ai/components/ui/ChatHistoryList';
import QuickActions from '../ui/QuickActions';
import { useAuthContext } from '@/features/Auth/AuthContext';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  navigationSections: NavigationSection[];
  onLogout?: () => void;
  onSettings?: () => void;
  onHelp?: () => void;
  onNewAiChat: () => void;
  chats: Chat[];
  chatsLoading: boolean;
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onViewAllChats: () => void;
}

function MobileSidebar({
  isOpen,
  onClose,
  navigationSections,
  onLogout,
  onSettings,
  onHelp,
  onNewAiChat,
  chats,
  chatsLoading,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onViewAllChats,
}: MobileSidebarProps) {
  const handleNewAiChat = () => {
    onNewAiChat();
    onClose();
  };

  const { user } = useAuthContext(); // already imported, just use it

  const visibleSections = navigationSections.filter(section => {
    if (section.label === 'Admin') return user?.isPlatformAdmin;
    return true;
  });

  return (
    <div>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed top-0 left-0 h-full w-80 bg-primary text-white z-50 
        transform transition-transform duration-300 lg:hidden flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-left">Belrose</h2>
            <p className="text-xs text-gray-400">Medical Records</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick action buttons */}
        <QuickActions onNewAiChat={handleNewAiChat} />

        {/* Navigation - Scrollable */}
        <div className="flex-1 overflow-y-auto dark-scroll">
          <div className="p-4 space-y-6">
            {visibleSections.map((section, index) => (
              <div key={section.label ?? `section-${index}`}>
                {section.label && (
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-gray-400">
                    {section.label}
                  </h3>
                )}
                <div className="space-y-1">
                  {section.items.map(item => (
                    <NavItem key={item.title} item={item} onClick={onClose} />
                  ))}
                </div>
              </div>
            ))}

            {/* Chat History */}
            <div className="border-t border-gray-700 pt-2">
              <ChatHistoryList
                chats={chats}
                isLoading={chatsLoading}
                currentChatId={currentChatId}
                onSelectChat={chatId => {
                  onSelectChat(chatId);
                  onClose();
                }}
                onNewChat={() => {
                  onNewChat();
                  onClose();
                }}
                onDeleteChat={onDeleteChat}
                onViewAll={() => {
                  onViewAllChats();
                  onClose();
                }}
              />
            </div>
          </div>
        </div>

        {/* User Info */}
        <div>
          <UserMenuButton
            user={user}
            isCollapsed={false}
            onLogout={onLogout}
            onSettings={onSettings}
            onHelp={onHelp}
          />
        </div>
      </div>
    </div>
  );
}

export default MobileSidebar;
