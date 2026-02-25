// src/components/site/Company/OpenRoles.tsx

import React from 'react';
import jobsData from './data/jobListingData';
import JobListingCard from './ui/JobListingCard';

const OpenRoles: React.FC = () => {
  return (
    <section className="px-8 md:px-[10vw] py-16 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="font-serif text-[1.8rem] font-bold text-gray-900">Join Us</h2>
          </div>
          <span
            className="text-[13px] text-gray-400 bg-white px-3 py-1.5
                 rounded-full border border-gray-200"
          >
            {jobsData.length} open positions
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {jobsData.map(job => (
            <JobListingCard key={job.title} {...job} />
          ))}
        </div>

        <p
          className="mt-6 text-center text-[14px] text-gray-400 bg-white
               border border-dashed border-gray-200 rounded-xl py-4 px-6"
        >
          Don't see your role?{' '}
          <a
            href="mailto:dennis@belrosehealth.com"
            className="text-blue-600 font-medium hover:underline"
          >
            Write to us directly →
          </a>
        </p>
      </div>
    </section>
  );
};

export default OpenRoles;
