import React from 'react';
import ValuesCard from '../ui/ValuesCard';
import { Shield, Users, Handshake } from 'lucide-react';

interface ValueItem {
  icon: React.ReactElement;
  title: string;
  description: string;
  link: string;
}

const Values: React.FC = () => {
  const values: ValueItem[] = [
    {
      icon: <Shield size={32} />,
      title: "We Don't Want Your Data",
      description:
        "Most HealthTechs are built to harvest your data. Not us. Your data's encrypted on your device before it ever reaches us, so even we can't read it. Store on our servers, your phone, or anywhere you choose.",
      link: '/#about',
    },
    {
      icon: <Users size={32} />,
      title: 'Data Sovereignty',
      description:
        "Our protocol is not just about privacy or access, it's about sovereignty. We want to create a future in which the economic, medical, and social value of your data is controled by you.",
      link: '/#about',
    },
    {
      icon: <Handshake size={32} />,
      title: 'A Healthier, More Equitable World',
      description:
        'We believe equity is the only path to truly unlock the potential of technology in healthcare. With Belrose, your wellbeing—not your data—is the product.',
      link: '/#about',
    },
  ];

  return (
    <section id="values" className="bg-primary p-10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Our Core Values</h2>
          <p className="text-xl text-white max-w-3xl mx-auto">
            These principles guide everything we do and shape how we build technology that truly
            serves patients and healthcare providers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {values.map((value: ValueItem, index: number) => (
            <ValuesCard
              key={index}
              icon={value.icon}
              title={value.title}
              description={value.description}
              link={value.link}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Values;
