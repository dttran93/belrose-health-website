// src/components/site/Company/Who.tsx

import React, { useEffect } from 'react';
import CareersHero from './CareersHero';
import Contact from './Contact';
import OpenRoles from './OpenRoles';
import LearnMoreHub from './LearnMoreHub';

const Who: React.FC = () => {
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#who/contact') {
        setTimeout(() => {
          document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
        }, 420);
      }
      if (window.location.hash === '#who/learn-more') {
        setTimeout(() => {
          document.getElementById('learn-more')?.scrollIntoView({ behavior: 'smooth' });
        }, 420);
      }
      if (window.location.hash === '#who/investors') {
        setTimeout(() => {
          document.getElementById('learn-more')?.scrollIntoView({ behavior: 'smooth' });
        }, 420);
      }
    };

    // Check on mount for direct deep links
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div>
      <CareersHero />
      <OpenRoles />
      <div id="learn-more">
        <LearnMoreHub />
      </div>
      <div id="contact">
        <Contact />
      </div>
    </div>
  );
};

export default Who;
