import { Clipboard, Activity, BookOpenCheck, FilePlus2, Flame, Heart, PersonStanding, Smile, CircleEllipsisIcon } from "lucide-react";

export const healthRecords = [
  { title: "Overview", url: "/dashboard", icon: Activity },
  { title: "Activity", url: "/dashboard/activity", icon: Clipboard },
  { title: "Add Record", url: "/dashboard/addrecord", icon: FilePlus2 },
  { title: "Testing", url: "/dashboard/fhirtesting", icon: BookOpenCheck },
];

export const healthCategories = [
  { title: "Exercise", url: "/dashboard/exercise", icon: Flame },
  { title: "Heart", url: "/dashboard/heart", icon: Heart},
  { title: "Body Measurements", url: "/dashboard/bodymeasurements", icon: PersonStanding},
  { title: "Mental Health", url: "/dashboard/mentalhealth", icon: Smile},
  { title: "Other Data", url: "/dashboard/otherdata", icon: CircleEllipsisIcon},
];