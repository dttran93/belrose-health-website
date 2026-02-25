import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/Accordion';
import { Button } from '@/components/ui/Button';
import { FAQItem, faqs } from '../FAQ/faqData';

const FAQ: React.FC = () => {
  const homepageFaqs = Object.values(faqs)
    .flat()
    .filter(faq => faq.homepage);

  return (
    <section id="faq" className="py-20 bg-muted">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Common Questions</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Find answers to frequently asked questions about our platform, security measures, and
            how to get started.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {homepageFaqs.map((faq: FAQItem, index: number) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-white border border-gray-200 rounded-lg mb-4 overflow-hidden"
              >
                <AccordionTrigger className="px-6 py-4">
                  <span className="font-semibold text-left">{faq.q}</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 pt-2 text-gray-600">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/#faq">
            <Button size="lg" className="px-8 text-lg mt-4">
              More Questions?
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
