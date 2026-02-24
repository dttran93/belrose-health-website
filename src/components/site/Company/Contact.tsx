// src/components/site/Company/Contact.tsx

import { Mail } from 'lucide-react';
import React from 'react';

const contactInfo = [
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
];

const Contact: React.FC = () => {
  return (
    <section className="px-8 md:px-[10vw] py-16 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          {/* Contact details */}
          <div className="flex flex-col gap-6 text-left">
            {contactInfo.map(item => (
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
                <strong className="text-gray-700">Media or press enquiries?</strong> We're happy to
                speak about the health data landscape, patient sovereignty, and our technology.
                Reach us at{' '}
                <a href="mailto:press@belrosehealth.com" className="text-blue-600 hover:underline">
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
  );
};

export default Contact;
