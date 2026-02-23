// src/components/site/ui/JobListingCard.tsx
import React from 'react';
import { ArrowRight } from 'lucide-react';

export interface JobListing {
  department: string;
  title: string;
  meta: string;
  tagColor: string; // tailwind bg + text classes
}

const JobListingCard: React.FC<JobListing> = ({ department, title, meta, tagColor }) => (
  <button
    className="group w-full text-left flex justify-between items-center
      px-6 py-5 rounded-2xl border border-gray-200 bg-white
      hover:border-blue-200 hover:shadow-md transition-all duration-200"
  >
    <div>
      <span
        className={`inline-block text-[11px] font-semibold tracking-[0.1em]
        uppercase px-2.5 py-0.5 rounded-full mb-2 ${tagColor}`}
      >
        {department}
      </span>
      <div className="font-bold text-[16px] text-gray-900 mb-1">{title}</div>
      <div className="text-[13px] text-gray-400">{meta}</div>
    </div>
    <div
      className="w-10 h-10 rounded-full border border-gray-200 flex items-center
      justify-center text-gray-300 flex-shrink-0
      group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white
      transition-all duration-200"
    >
      <ArrowRight size={15} />
    </div>
  </button>
);

export default JobListingCard;
