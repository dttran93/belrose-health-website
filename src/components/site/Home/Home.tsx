// src/pages/Index.tsx
import React from 'react';
import HeroSection from './HeroSection';
import Values from './Values';
import HowItWorks from './HowItWorks';
import FAQ from './FAQ';
import CTASection from './CTASection';

const Home: React.FC = () => {
  return (
    <div>
      <HeroSection />
      <Values />
      <HowItWorks />
      <FAQ />
      <CTASection />
    </div>
  );
};

export default Home;
