import { PanelLeft, ArrowLeftToLine, ArrowRightToLine } from 'lucide-react';
import UserMenuButton from '@/components/ui/UserMenuButton';
import NavItem from '@/components/ui/NavItem';
import { NavigationSection } from './navigation';
import { User } from '@/types/core';
import { Chat } from '@/features/Ai/service/chatService';
import { ChatHistoryList } from '@/features/Ai/components/ui/ChatHistoryList';
import QuickActions from '../ui/QuickActions';

interface DesktopSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  user: User;
  onLogout: () => void;
  navigationSections: NavigationSection[];
  onSettings: () => void;
  onNotifications: () => void;
  onHelp: () => void;
  onNewAiChat: () => void;
  chats: Chat[];
  chatsLoading: boolean;
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onViewAllChats: () => void;
}

function DesktopSidebar({
  isCollapsed,
  onToggle,
  user,
  onLogout,
  navigationSections,
  onSettings,
  onNotifications,
  onHelp,
  onNewAiChat,
  chats,
  chatsLoading,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onViewAllChats,
}: DesktopSidebarProps) {
  return (
    <div
      className={`
      bg-primary text-white flex flex-col 
      transition-all duration-300 h-full
      ${isCollapsed ? 'w-20' : 'w-64'}
    `}
    >
      {/* Header */}
      <div className="p-4">
        <div
          className={`flex justify-between items-center ${
            isCollapsed ? 'justify-center' : 'gap-3'
          }`}
        >
          {!isCollapsed && (
            <div className="flex flex-col text-left min-w-0">
              <h2 className="font-bold text-lg">Belrose</h2>
              <p className="text-xs text-gray-400">Medical Records</p>
            </div>
          )}

          {/* Toggle Button */}
          <div className="p-4 relative">
            <button
              onClick={onToggle}
              className="w-full flex items-center justify-center py-2 rounded-lg group relative"
            >
              <PanelLeft
                className={`w-5 h-5 transition-transform duration-300 ${
                  isCollapsed ? 'rotate-180' : ''
                }`}
              />

              {/* Hover tooltip */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                {isCollapsed ? (
                  <ArrowRightToLine className="w-5 h-5 text-white bg-primary" />
                ) : (
                  <ArrowLeftToLine className="w-5 h-5 text-white bg-primary" />
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Quick action buttons — stacks vertically when sidebar is collapsed */}
      <QuickActions onNewAiChat={onNewAiChat} isCollapsed={isCollapsed} />

      {/* Navigation — hidden labels when collapsed */}
      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {navigationSections.map(section => (
          <div key={section.label}>
            {!isCollapsed && section.label && (
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-gray-400">
                {section.label}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map(item => (
                <NavItem key={item.title} item={item} isCollapsed={isCollapsed} />
              ))}
            </div>
          </div>
        ))}

        {/* Chat History — hidden when collapsed */}
        {!isCollapsed && (
          <div className="border-t border-gray-700 pt-4">
            <ChatHistoryList
              chats={chats}
              isLoading={chatsLoading}
              currentChatId={currentChatId}
              onSelectChat={onSelectChat}
              onNewChat={onNewChat}
              onDeleteChat={onDeleteChat}
              onViewAll={onViewAllChats}
            />
          </div>
        )}
      </div>

      {/* User Info */}
      <div>
        <UserMenuButton
          user={user}
          isCollapsed={isCollapsed}
          onLogout={onLogout}
          onSettings={onSettings}
          onNotifications={onNotifications}
          onHelp={onHelp}
        />
      </div>
    </div>
  );
}

export default DesktopSidebar;
