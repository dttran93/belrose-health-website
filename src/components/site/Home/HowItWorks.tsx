import React, { useState } from 'react';
import HowItWorksCard from '../ui/HowItWorksCard';
import { Button } from '../../ui/Button';

interface StepItem {
  id: number;
  title: string;
  description: string;
  image: string;
  delay: string;
}

const HowItWorks: React.FC = () => {
  const [selectedStep, setSelectedStep] = useState('1');

  const steps: StepItem[] = [
    {
      id: 1,
      title: 'Collect',
      description:
        'Create your account in under 5 minutes. If you verify your identity, we can collect your records from any healthcare providers on your behalf. You can also self report data, add wearables, and connect other apps.',
      image: '/pexels-luis-f-rodriguez-jimenez-3618842-5412878.jpg',
      delay: '0ms',
    },
    {
      id: 2,
      title: 'Standardize',
      description:
        'Our platform converts your records into interoperable, standardize formats allowing for any provider to seamlessly integrate your new record.',
      image: '/pexels-karolina-grabowska-6627922.jpg',

      delay: '150ms',
    },
    {
      id: 3,
      title: 'Store',
      description:
        'We make your data interoperable and store it anywhere you want. We recommend our encrypted, HIPPA/GDPR compliant servers where only you will have access.',
      image: '/pexels-rdne-6129037.jpg',
      delay: '300ms',
    },
    {
      id: 4,
      title: 'Share',
      description:
        'Share your record with whoever you want. Granular permission levels let you decide exatly what each recipient can view, edit, comment, or share.',
      image: '/pexels-tima-miroshnichenko-5452232.jpg',
      delay: '450ms',
    },
    {
      id: 5,
      title: 'Verify',
      description:
        "Belrose's distirbuted network verification prevents tampering, allowing anyone to rely on your data while you remain in complete control.",
      image: '/pexels-mahyub-hamida-736226299-30313813.jpg',
      delay: '450ms',
    },
  ];

  const selected = steps.find(step => step.id.toString() === selectedStep);

  return (
    <section id="how-it-works" className="py-20 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            How Belrose Health Records Work
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Sign up. Get Your Data. Own It Forever.
          </p>
        </div>

        {/* LEFT SIDE: Image (fixed area, changes content) */}
        <div className="flex justify-between gap-3">
          <div className="w-full md:w-1/2 sticky top-10">
            <div className="rounded-3xl overflow-hidden shadow-2xl">
              <img
                src={selected?.image}
                alt={selected?.title}
                className="w-full h-[400px] object-cover transition-all duration-700"
              />
            </div>
          </div>

          {/* RIGHT SIDE: Steps */}
          <div className="flex flex-col gap-3 w-full md:w-1/2 justify-center">
            {steps.map(step => (
              <HowItWorksCard
                key={step.id}
                id={step.id}
                title={step.title}
                description={step.description}
                delay={step.delay}
                selectedStep={selectedStep}
                onSelect={setSelectedStep}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/#how">
          <Button size="lg" className="px-8 text-lg mt-8">
            Get More Details
          </Button>
        </a>
      </div>

      <style>{`
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
  );
};
export default HowItWorks;
