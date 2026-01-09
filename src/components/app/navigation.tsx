import {
  Clipboard,
  Activity,
  FilePlus2,
  Flame,
  Heart,
  PersonStanding,
  Smile,
  CircleEllipsisIcon,
  LucideIcon,
  Share2,
  Link,
  Hash,
} from 'lucide-react';

export interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

export const healthRecords: NavigationItem[] = [
  { title: 'Admin Dashboard', url: '/dashboard/blockchain-admin', icon: Link },
  { title: 'Overview', url: '/dashboard', icon: Activity },
  { title: 'All Records', url: '/dashboard/all-records', icon: Clipboard },
  { title: 'Add Record', url: '/dashboard/add-record', icon: FilePlus2 },
  { title: 'Share Records', url: '/dashboard/share-records', icon: Share2 },
  { title: 'HashTester', url: '/dashboard/hash-tester', icon: Hash },
];

export const healthCategories: NavigationItem[] = [
  { title: 'Exercise', url: '/dashboard/exercise', icon: Flame },
  { title: 'Heart', url: '/dashboard/heart', icon: Heart },
  { title: 'Body Measurements', url: '/dashboard/bodymeasurements', icon: PersonStanding },
  { title: 'Mental Health', url: '/dashboard/mentalhealth', icon: Smile },
  { title: 'Other Data', url: '/dashboard/otherdata', icon: CircleEllipsisIcon },
];
