// src/components/site/Company/OpenRoles.tsx

import React from 'react';
import TeamCard from './ui/TeamCard';
import { team } from './data/teamMemberData';

const Team: React.FC = () => {
  return (
    <section className="px-8 md:px-[10vw] py-16 bg-white">
      <div className="max-w-5xl mx-auto text-left">
        <p
          className="text-[11px] font-semibold tracking-[0.18em] uppercase
            text-pink-500 mb-3"
        >
          The Team
        </p>
        <h2
          className="text-[clamp(1.6rem,2.5vw,2.4rem)] font-bold
            text-gray-900 mb-3"
        >
          Multi-disciplinary. Mission-aligned.
        </h2>
        <p className="text-[15px] text-gray-500 leading-relaxed max-w-[500px] mb-12">
          Built from clinical medicine, enterprise pharma, venture capital, and software engineering
          — because the problem demands all of it.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {team.map(member => (
            <TeamCard key={member.name} {...member} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Team;
