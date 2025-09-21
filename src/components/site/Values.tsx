import React from 'react';
import ValuesCard from './ui/ValuesCard.jsx';
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
      description: "With our data storage protocol, even Belrose employees cannot see your records. And you can store your records literally anywhere you want. We are the only health tech company that does not want your data.",
      link: "#"
    },
    {
      icon: <Users size={32} />,
      title: "Power to the Patients",
      description: "The average person lacks vital information about themselves. Data on blood type, vaccinations, medications and more is scattered or inaccessible. We believe patients should have sovereignty over this information.",
      link: "#"
    },
    {
      icon: <Handshake size={32} />,
      title: "Helping the Helpers",
      description: "Our goal is to give providers a complete view of their patient's health while reducing the workload from documentation. We integrate seamlessly into existing workflows, no forcing new solutions on providers.",
      link: "#"
    }
  ];

  return (
    <section id="values" className="bg-primary p-10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Our Core Values</h2>
          <p className="text-xl text-white max-w-3xl mx-auto">
            These principles guide everything we do and shape how we build technology that truly serves patients and healthcare providers.
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