// src/pages/FAQFull.tsx

import React, { useState } from 'react';
import { faqs } from './faqData';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/Accordion';

type FAQCategory = keyof typeof faqs;
const categories = Object.keys(faqs);

// ─── Component ───────────────────────────────────────────────────────────────

const FAQFull: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<FAQCategory>(categories[0] as FAQCategory);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat as FAQCategory);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Hero ── */}
      <section className="bg-primary py-20 px-4 text-center relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-pink-500/10 translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <span className="inline-block bg-pink-500/20 text-pink-300 text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">
          Help Centre
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-white/70 text-lg max-w-xl mx-auto">
          Everything you need to know about Belrose.
        </p>
      </section>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-12 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
        {/* Category sidebar */}
        <aside className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 md:sticky md:top-24">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 px-3 pt-3 pb-2">
            Topics
          </p>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-0.5
                ${
                  activeCategory === cat
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
            >
              {activeCategory === cat && <span className="text-pink-500 mr-1.5">›</span>}
              {cat}
            </button>
          ))}
        </aside>

        {/* Accordion panel */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{activeCategory}</h2>
          <div className="w-10 h-0.5 bg-gradient-to-r from-blue-600 to-pink-500 rounded mb-8" />

          <Accordion type="single" collapsible defaultValue="0" className="space-y-3">
            {faqs[activeCategory]?.map((item, i) => (
              <AccordionItem key={i} value={String(i)}>
                <AccordionTrigger className="px-5 py-4 text-sm font-semibold text-gray-900 leading-snug">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="px-5 text-sm text-gray-600 leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>

      {/* ── Still have questions CTA ── */}
      <section id="contact" className="max-w-5xl mx-auto w-full px-4 pb-16">
        <div className="bg-primary rounded-2xl px-10 py-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h3 className="text-2xl font-bold text-white mb-1 text-left">Still have questions?</h3>
            <p className="text-white/70 text-sm">
              Reach out to us. We will respond as soon as possible.
            </p>
          </div>
          <a
            href="mailto:hello@belrosehealth.com"
            className="shrink-0 bg-white text-primary font-semibold text-sm px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Contact Us
          </a>
        </div>
      </section>
    </div>
  );
};

export default FAQFull;
