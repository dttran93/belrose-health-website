import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const FAQ = () => {
  const faqs = [
    {
      question: "Is Belrose HIPAA/GDPR compliant?",
      answer: "Yes, Belrose is fully HIPAA/GDPR compliant. We implement all the necessary security measures and protocols to ensure your health information is protected according to HIPAA/GDPR standards. Our platform undergoes regular security audits to maintain compliance."
    },
    {
      question: "Who can access my health records?",
      answer: "Only you and those you explicitly grant access to can see your health records. You have complete control over permissions and can revoke access at any time. Even our staff cannot access your unencrypted health data without your explicit permission."
    },
    {
      question: "How do I upload my existing medical records?",
      answer: "You can upload your records in any legible formats including PDF, JPEG, PNG, and JSON files. Simply use our upload tool, and our system will help you transform your data into a medically interoperable format. You can also integrate directly with participating healthcare providers to import records."
    },
    {
      question: "Can I share my records with my doctor?",
      answer: "Absolutely. Your Belrose record is just a comprehensive, digital compilation of the records that have always been prepared in medical settings. You should be able to use it the same way you would have used previous records. Also, we are building out integrations with all EHR providers to make sure that your doctors can seamlessly integrate your Belrose record into existing processes."
    },
    {
      question: "What happens if I want to cancel my account?",
      answer: "You can export all your data at any time. If you decide to cancel your account, we provide a full export of your records in standard formats. After cancellation and export, your encrypted data, which we can not read regardless, is permanently deleted from our systems within 30 days."
    },
    {
      question: "What happens to our data if Belrose goes bankrupt?",
      answer: "Even if we go bankrupt, your records are protected. You legally own the data you store with our system. Even those with legal ownership of our company or physical access to servers will not be able access to your records unless you allow them to."
    }
  ];

  return (
    <section id="faq" className="py-20 bg-muted">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">
            FAQ
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Common Questions</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Find answers to frequently asked questions about our platform, security measures, and how to get started.
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="bg-white border border-gray-200 rounded-lg mb-4 overflow-hidden">
                <AccordionTrigger className="px-6 py-4">
                  <span className="font-semibold text-left">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 pt-2 text-gray-600">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="px-8 text-lg mt-4">
              More Questions?
            </Button>
          </div>
      </div>
    </section>
  );
};

export default FAQ;
