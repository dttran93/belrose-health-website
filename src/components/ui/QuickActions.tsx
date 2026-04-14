/**
 * QuickActions.tsx
 *
 * Four circular shortcut buttons shown at the top of the sidebar.
 * Provides one-tap access to Home, Notifications, Messages, and AI Chat.
 *
 * Each button shows a tooltip on hover with the action title.
 * The active route is highlighted using useLocation.
 * AI button triggers onNewAiChat callback rather than navigating.
 *
 * Usage:
 *   <QuickActions onNewAiChat={handleNewChat} />
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { quickActions } from '../app/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuickActionsProps {
  /** Called when the AI chat button is tapped — wires to AIChatContext */
  onNewAiChat: () => void;
  /** When true (desktop collapsed), stacks buttons vertically instead of horizontally */
  isCollapsed?: boolean;
  unreadNotifications?: number;
  unreadMessages?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const QuickActions: React.FC<QuickActionsProps> = ({
  onNewAiChat,
  isCollapsed = false,
  unreadNotifications = 0,
  unreadMessages = 0,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = (id: (typeof quickActions)[number]['id'], url?: string) => {
    if (id === 'ai') {
      onNewAiChat();
      navigate('/app');
    } else if (url) {
      navigate(url);
    }
  };

  return (
    <div
      className={`
      ${
        isCollapsed
          ? 'flex flex-col items-center py-2'
          : 'flex items-center justify-around px-2 py-3'
      }
    `}
    >
      {quickActions.map(action => {
        const Icon = action.icon;
        const badge =
          action.id === 'activity'
            ? unreadNotifications
            : action.id === 'messages'
              ? unreadMessages
              : 0;
        const isActive = action.url
          ? action.url === '/app'
            ? location.pathname === '/app' // exact match for home
            : location.pathname.startsWith(action.url) // prefix match for others
          : false;

        return (
          <div key={action.id} className="relative group">
            <button
              onClick={() => handleClick(action.id, action.url)}
              aria-label={action.title}
              className={`
                w-10 h-10 rounded-full flex items-center justify-center
                transition-all duration-150
                ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              {badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold px-0.5">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>

            {/* Tooltip */}
            <div
              className="
              absolute left-1/2 -translate-x-1/2 top-full mt-2
              px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap
              bg-gray-900 text-white
              opacity-0 group-hover:opacity-100
              pointer-events-none transition-opacity duration-150
              z-50
            "
            >
              {action.title}
              {/* Tooltip arrow */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default QuickActions;
