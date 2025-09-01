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
  ShieldCheck
} from "lucide-react";

export interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

export const healthRecords: NavigationItem[] = [
  { title: "Overview", url: "/dashboard", icon: Activity },
  { title: "Activity", url: "/dashboard/activity", icon: Clipboard },
  { title: "Add Record", url: "/dashboard/addrecord", icon: FilePlus2 },
  { title: "Verification", url: "/dashboard/verification", icon: ShieldCheck },
];

export const healthCategories: NavigationItem[] = [
  { title: "Exercise", url: "/dashboard/exercise", icon: Flame },
  { title: "Heart", url: "/dashboard/heart", icon: Heart},
  { title: "Body Measurements", url: "/dashboard/bodymeasurements", icon: PersonStanding},
  { title: "Mental Health", url: "/dashboard/mentalhealth", icon: Smile},
  { title: "Other Data", url: "/dashboard/otherdata", icon: CircleEllipsisIcon},
];