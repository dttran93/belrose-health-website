import {
  Clipboard,
  FilePlus2,
  LucideIcon,
  Link,
  Hash,
  House,
  CircleUser,
  MessageSquare,
  Bell,
  Sparkles,
} from 'lucide-react';

export interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

export interface NavigationSection {
  label?: string;
  items: NavigationItem[];
}

/**
 * Quick action buttons shown at the top of the sidebar.
 * Always visible, icon-only, and distinct from the full nav sections.
 * Some are simple routes (url provided); AI triggers a context callback.
 */
export interface QuickActionItem {
  id: 'home' | 'notifications' | 'messages' | 'ai';
  title: string;
  url?: string;
  icon: LucideIcon;
}

export const quickActions: QuickActionItem[] = [
  { id: 'home', title: 'Home', url: '/app', icon: House },
  { id: 'notifications', title: 'Notifications', url: '/app/notifications', icon: Bell },
  { id: 'messages', title: 'Messages', url: '/app/messages', icon: MessageSquare },
  { id: 'ai', title: 'AI Assistant', icon: Sparkles },
];

export const navigationSections: NavigationSection[] = [
  {
    label: 'Admin',
    items: [
      { title: 'Admin Dashboard', url: '/app/blockchain-admin', icon: Link },
      { title: 'HashTester', url: '/app/hash-tester', icon: Hash },
    ],
  },
  {
    items: [
      { title: 'Health Profile', url: '/app/health-profile/me', icon: CircleUser },
      { title: 'All Records', url: '/app/all-records', icon: Clipboard },
      { title: 'Add Record', url: '/app/add-record', icon: FilePlus2 },
    ],
  },
];
