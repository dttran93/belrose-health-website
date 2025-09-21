// src/pages/Index.tsx
import React, { useEffect, useState } from 'react';
import Navbar from '../components/site/Navbar';
import WhoWeServeLanding from '@/components/site/WhoWeServeLanding';
import Footer from '../components/site/Footer';

type ViewMode = 'landing' | 'patient' | 'provider' | 'other';

const Index = () => {
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

  const [viewMode, setViewMode] = useState<ViewMode>('landing');

  const handleViewChange = (view:ViewMode) => {
    setViewMode(view)
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        {viewMode === 'landing' && 
        <WhoWeServeLanding />
        };
        {viewMode === 'patient' && 
        <WhoWeServeLanding />
        };
        {viewMode === 'provider' && 
        <WhoWeServeLanding />
        };
        {viewMode === 'other' && 
        <WhoWeServeLanding />
        };
      </main>
      <Footer />
    </div>
  );
};

export default Index;