import { Clipboard, Activity, FilePlus2, LucideIcon, Link, Hash, House } from 'lucide-react';

export interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

export interface NavigationSection {
  label?: string;
  items: NavigationItem[];
}

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
      { title: 'Home', url: '/app', icon: House },
      { title: 'All Records', url: '/app/all-records', icon: Clipboard },
      { title: 'Add Record', url: '/app/add-record', icon: FilePlus2 },
    ],
  },
];
