import React from 'react';
import { Badge } from './ui/Badge';
import HowItWorksCard from './ui/HowItWorksCard';
import {ClipboardPenLine, Combine, Server, CheckCircle } from 'lucide-react';

const HowItWorks = () => {

    const steps = [
    {
      id: 1,
      title: "Sign Up",
      description: "Create your account and verify your identity. With your authorization, we can use your HIPPA/GDPR rights to collect your health data from any provider on your behalf.",
      icon: ClipboardPenLine,
      gradient: "from-slate-900 via-slate-700 to-slate-600",
      delay: "0ms"
    },
    {
      id: 2,
      title: "Gather Your Data",
      description: "In addition to health records from hospitals, doctors, and other providers, you can also self report data from your own records and even connect your wearables and other apps.",
      icon: Combine,
      gradient: "from-slate-800 via-indigo-700 to-blue-800",
      delay: "150ms"
    },
    {
      id: 3,
      title: "Store Your Data",
      description: "We then transform your data into an interoperable format and store it wherever you want. We recommend our HIPPA/GDPR audited servers with client-side encryption. We never retain your health information, meaning only you have access to your records.",
      icon: Server,
      gradient: "from-indigo-800 via-blue-700 to-slate-800",
      delay: "300ms"
    },
    {
      id: 4,
      title: "Use Your Records",
      description: "Use your records however you want to. With Belrose's blockchain verification to prevent tampering, you can share records with your doctors, use them to get better insurance rates, or support research you care about. You are in control of your data.",
      icon: CheckCircle,
      gradient: "from-blue-800 via-blue-500 to-blue-700",
      delay: "450ms"
    }
  ];

  return <section id="how-it-works" className="py-20 bg-white">
    <div className="container mx-auto px-4 md:px-6">
      <div className="text-center mb-16">
        <Badge variant="outline" className="bg-health-100 text-health-800 border-health-200 mb-4">
          Simple Process
        </Badge>  
        <h2 className = "text-3xl md:text-4xl font-bold text-gray-900 mb-4">How Belrose Health Records Work</h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          We believe that a protocol centered on personal responsibility and incentivization is the only path to achieving truly comprehensive health records, while balancing desires for privacy and democratization of data.
        </p>
      </div> 
    
    <div className="flex flex-col gap-4 max-w-4xl mx-auto">
      {steps.map((step, index) => (
        <div key={index}>
          <HowItWorksCard 
            id={step.id} 
            title={step.title} 
            description={step.description} 
            icon={step.icon} 
            gradient={step.gradient} 
            delay={step.delay}
            totalSteps={steps.length}
          />
        </div>
      ))}

    </div>
    </div>
  

     <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
  </section>
}
export default HowItWorks;