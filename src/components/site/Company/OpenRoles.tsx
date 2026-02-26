// src/components/site/Company/OpenRoles.tsx

import React from 'react';
import jobsData from './data/jobListingData';
import JobListingCard from './ui/JobListingCard';

const OpenRoles: React.FC = () => {
  const hasJobs = jobsData.length > 0;

  return (
    <section className="px-8 md:px-[10vw] py-16 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-[1.8rem] font-bold text-gray-900">Join Us</h2>
          </div>
          {hasJobs && (
            <span className="text-[13px] text-gray-400 bg-white px-3 py-1.5 rounded-full border border-gray-200">
              {jobsData.length} open positions
            </span>
          )}
        </div>

        {hasJobs ? (
          <>
            <div className="flex flex-col gap-3">
              {jobsData.map(job => (
                <JobListingCard key={job.title} {...job} />
              ))}
            </div>
            <p className="mt-6 text-center text-[14px] text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl py-4 px-6">
              Don't see your role?{' '}
              <a
                href="mailto:hello@belrosehealth.com"
                className="text-blue-600 font-medium hover:underline"
              >
                Write to us directly →
              </a>
            </p>
          </>
        ) : (
          <div className="text-center bg-white border border-dashed border-gray-200 rounded-xl py-12 px-6">
            <p className="text-gray-500 text-[15px] mb-1">We're not actively hiring right now.</p>
            <p className="text-gray-400 text-[14px]">
              But we'd still love to hear from you —{' '}
              <a
                href="mailto:dennis@belrosehealth.com"
                className="text-blue-600 font-medium hover:underline"
              >
                reach out directly
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default OpenRoles;
