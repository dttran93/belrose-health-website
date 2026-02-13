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
  Link,
  Hash,
} from 'lucide-react';

export interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

export const healthRecords: NavigationItem[] = [
  { title: 'Admin Dashboard', url: '/app/blockchain-admin', icon: Link },
  { title: 'Home', url: '/app', icon: Activity },
  { title: 'All Records', url: '/app/all-records', icon: Clipboard },
  { title: 'Add Record', url: '/app/add-record', icon: FilePlus2 },
  { title: 'HashTester', url: '/app/hash-tester', icon: Hash },
];

export const healthCategories: NavigationItem[] = [
  { title: 'Exercise', url: '/app/exercise', icon: Flame },
  { title: 'Heart', url: '/app/heart', icon: Heart },
  { title: 'Body Measurements', url: '/app/bodymeasurements', icon: PersonStanding },
  { title: 'Mental Health', url: '/app/mentalhealth', icon: Smile },
  { title: 'Other Data', url: '/app/otherdata', icon: CircleEllipsisIcon },
];
