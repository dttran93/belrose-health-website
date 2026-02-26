//src/components/site/Company/jobListingData.ts

import { JobListing } from '../ui/JobListingCard';

export const jobsDataDraft: JobListing[] = [
  {
    department: 'Engineering',
    title: 'Full-Stack Engineer (React / Firebase)',
    meta: 'Remote · Full-time · Founding team equity',
    tagColor: 'bg-blue-50 text-blue-700',
  },
  {
    department: 'Business Development',
    title: 'Healthcare Partnerships Lead',
    meta: 'London / Remote · Full-time · Founding team equity',
    tagColor: 'bg-pink-50 text-pink-700',
  },
  {
    department: 'Clinical',
    title: 'Clinical Advisor (GP or hospital medicine)',
    meta: 'Advisory · Flexible · Equity',
    tagColor: 'bg-emerald-50 text-emerald-700',
  },
];

const jobsData: JobListing[] = [];

export default jobsData;
