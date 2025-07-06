import React from 'react';
import { ArrowRight } from 'lucide-react';

const NavCard = ({ icon, title, description, link, color}) => {
  return (
    <a href={link}>
    <div className={`h-full relative group bg-${color} text-primary rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100 flex flex-col cursor-pointer`}>
      <div className="mb-4 h-12">
        {icon}
      </div>
      <h3 className="flex text-2xl font-semibold mb-3">{title}</h3>
      <p className="flex-grow text-left">{description}</p>

      {/* Hover Effect Overlay with Link Indicator */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
        
        {/* Link indicator */}
        <div className="absolute top-4 right-4 w-8 h-8 bg-primary/20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-50 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
          <ArrowRight className="w-4 h-4" />
        </div>
    </div>
    </a>
  );
};

export default NavCard;