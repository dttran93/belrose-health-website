// src/components/site/Company/Who.tsx

import React, { useEffect } from 'react';
import CareersHero from './CareersHero';
import Contact from './Contact';
import OpenRoles from './OpenRoles';
import Team from './Team';

const Who: React.FC = () => {
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#who/contact') {
        setTimeout(() => {
          document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
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
      <div id="contact">
        <Contact />
      </div>
    </div>
  );
};

export default Who;
