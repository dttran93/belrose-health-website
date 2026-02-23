// src/pages/Company.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/site/Navbar';
import Footer from '@/components/site/Footer';
import { Mail, ArrowRight } from 'lucide-react';
import TeamCard from './ui/TeamCard';
import { team } from './teamMemberData';
import JobListingCard from './ui/JobListingCard';
import jobsData from './jobListingData';

const Company: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* ── 1. Careers Hero ──────────────────────────────────────────────────── */}
      <section className="relative bg-primary px-8 md:px-[10vw] py-10 overflow-hidden">
        {/* Decorative blobs */}
        <div
          className="absolute top-0 right-0 w-[480px] h-[480px] rounded-full
          bg-white/[0.03] -translate-y-1/2 translate-x-1/2 pointer-events-none"
        />
        <div
          className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full
          bg-pink-500/10 translate-y-1/2 -translate-x-1/2 pointer-events-none"
        />

        <div className="relative max-w-5xl text-left">
          <p
            className="text-[11px] font-semibold tracking-[0.2em] uppercase
            text-pink-300/70 mb-6"
          >
            Careers at Belrose
          </p>
          <h1
            className="font-serif text-[clamp(2.2rem,4vw,3.4rem)] font-bold text-white
            leading-[1.15] max-w-[680px] mb-6 tracking-tight"
          >
            We're building infrastructure for{' '}
            <em className="not-italic text-accent">health data sovereignty</em>
          </h1>
          <p className="text-white/60 text-[16px] leading-[1.8] max-w-[520px] mb-10">
            We are a mission driven team that cares about making the world healthier and more
            equitable. We want to work with people who do too.
          </p>
        </div>
      </section>

      {/* ── 2. Open Roles ────────────────────────────────────────────────────── */}
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

      {/* ── 3. Team ──────────────────────────────────────────────────────────── */}
      <section className="px-8 md:px-[10vw] py-16 bg-white">
        <div className="max-w-5xl mx-auto text-left">
          <p
            className="text-[11px] font-semibold tracking-[0.18em] uppercase
            text-pink-500 mb-3"
          >
            The Team
          </p>
          <h2
            className="font-serif text-[clamp(1.6rem,2.5vw,2.4rem)] font-bold
            text-gray-900 mb-3"
          >
            Multi-disciplinary. Mission-aligned.
          </h2>
          <p className="text-[15px] text-gray-500 leading-relaxed max-w-[500px] mb-12">
            Built from clinical medicine, enterprise pharma, venture capital, and software
            engineering — because the problem demands all of it.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map(member => (
              <TeamCard key={member.name} {...member} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Contact ───────────────────────────────────────────────────────── */}
      <section className="px-8 md:px-[10vw] py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <p
            className="text-[11px] font-semibold tracking-[0.18em] uppercase
            text-pink-500 mb-3"
          >
            Contact
          </p>
          <h2
            className="font-serif text-[clamp(1.6rem,2.5vw,2.4rem)] font-bold
            text-gray-900 mb-3"
          >
            Get in touch
          </h2>
          <p className="text-[15px] text-gray-500 leading-relaxed max-w-[480px] mb-12">
            Whether you're a patient, provider, researcher, or investor — we want to hear from you.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            {/* Contact details */}
            <div className="flex flex-col gap-6">
              {[
                {
                  label: 'General Enquiries',
                  value: 'hello@belrosehealth.com',
                  href: 'mailto:hello@belrosehealth.com',
                },
                {
                  label: 'Partnerships & Investment',
                  value: 'dennis@belrosehealth.com',
                  href: 'mailto:dennis@belrosehealth.com',
                },
                {
                  label: 'Location',
                  value: 'London, United Kingdom',
                  href: null,
                },
              ].map(item => (
                <div key={item.label} className="flex gap-4 items-start">
                  <div
                    className="w-10 h-10 rounded-xl bg-white border border-gray-200
                    flex items-center justify-center flex-shrink-0"
                  >
                    <Mail size={14} className="text-gray-400" />
                  </div>
                  <div>
                    <p
                      className="text-[11px] font-semibold tracking-[0.1em] uppercase
                      text-gray-400 mb-1"
                    >
                      {item.label}
                    </p>
                    {item.href ? (
                      <a
                        href={item.href}
                        className="text-[15px] font-medium text-blue-600 hover:underline"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-[15px] font-medium text-gray-800">{item.value}</p>
                    )}
                  </div>
                </div>
              ))}

              <div className="mt-2 p-5 bg-white rounded-xl border border-gray-200">
                <p className="text-[13px] text-gray-500 leading-relaxed">
                  <strong className="text-gray-700">Media or press enquiries?</strong> We're happy
                  to speak about the health data landscape, patient sovereignty, and our technology.
                  Reach us at{' '}
                  <a
                    href="mailto:press@belrosehealth.com"
                    className="text-blue-600 hover:underline"
                  >
                    press@belrosehealth.com
                  </a>
                  .
                </p>
              </div>
            </div>

            {/* Map placeholder */}
            <div
              className="rounded-2xl overflow-hidden border border-gray-200
              bg-gradient-to-br from-blue-50 via-indigo-50 to-pink-50
              h-[380px] flex flex-col items-center justify-center gap-3"
            >
              <span className="text-4xl">📍</span>
              <p className="text-[14px] font-semibold text-primary/50">London, United Kingdom</p>
              <p className="text-[12px] text-gray-400">Google Maps embed goes here</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Company;
