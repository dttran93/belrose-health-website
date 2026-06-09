import React from 'react';
import ValuesCard from '../ui/ValuesCard';
import { Shield, Users, Handshake, HeartHandshake, Earth, Crown } from 'lucide-react';

interface ValueItem {
  icon: React.ReactElement;
  title: string;
  description: string;
  link: string;
}

const Values: React.FC = () => {
  const values: ValueItem[] = [
    {
      icon: <Crown size={32} />,
      title: 'Data Sovereignty',
      description:
        "We encrypt your data on your device before it ever reaches us, so even we can't read it. But sovereignty is more than privacy. We want to create a world where the economic, medical, and social value of your data flows back to you.",
      link: '/#about',
    },
    {
      icon: <HeartHandshake size={32} />,
      title: 'Reclaim Your Digital Life',
      description:
        'Health data is worth billions, but currently that value flows exclusively to big pharma and insurance. Belrose is decentralized and peer-to-peer so that no one, including us, will ever be the gatekeeper of your most intimate data.',
      link: '/#about',
    },
    {
      icon: <Earth size={32} />,
      title: 'A Healthier, More Equitable World',
      description:
        "We're accustomed to our data existing to serve big tech. But a future where medicine is truly preventative, not reactive, requires patients to be partners, not commodities. With Belrose, your wellbeing, not your data, is the product.",
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
