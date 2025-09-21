// src/pages/Index.tsx
import React, { useEffect } from 'react';
import Navbar from '../components/site/Navbar';
import HeroSection from '../components/site/HeroSection';
import Values from '../components/site/Values';
import HowItWorks from '../components/site/HowItWorks';
import FAQ from '../components/site/FAQ';
import CTASection from '../components/site/CTASection';
import Footer from '../components/site/Footer';

const Index: React.FC = () => {
  useEffect(() => {
    const handleScroll = () => {
      const elements = document.querySelectorAll('.animate-fade-in');
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.top <= window.innerHeight * 0.8;
        if (isVisible) {
          el.classList.add('opacity-100');
        }
      });
    };
    //

    window.addEventListener('scroll', handleScroll);
    // Initial check for elements in viewport
    setTimeout(handleScroll, 100);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <HeroSection />
        <Values />
        <HowItWorks />
        <FAQ />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;