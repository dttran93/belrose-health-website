import React from 'react';
import { ArrowRight } from 'lucide-react';

const HowItWorksCard = ({ 
id, 
title, 
description,
icon,
gradient, 
delay,
totalSteps,
href = "#",
className = "" 
}) => {

const IconComponent = icon;
  
  return (
    <a
      href={href}
      className={`group relative overflow-hidden rounded-xl w-full h-32 transform transition-all duration-700 hover:scale-[1.02] hover:-rotate-0.5 cursor-pointer block ${className}`}
      style={{
        animationDelay: delay,
        animation: `fadeInUp 0.8s ease-out forwards ${delay}`
      }}
    >
      {/* Background with Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90 group-hover:opacity-100 transition-opacity duration-300`} />

      {/* Content Container */}
      <div className="relative z-10 p-4 sm:p-6 h-full flex items-center text-white">
        {/* Step Number & Icon */}
        <div className="flex items-center mr-3 sm:mr-6">
          <span className="text-xs sm:text-sm font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full mr-2 sm:mr-4">
            {id}
          </span>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors duration-300">
            <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <h3 className="text-base sm:text-xl font-bold mb-1 sm:mb-2 group-hover:scale-105 transition-transform duration-300">
            {title}
          </h3>
          <p className="text-xs sm:text-sm opacity-90 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Down arrow for flow indication (except last item) */}
        {id < totalSteps && (
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 z-20">
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg">
              <ArrowRight className="w-3 h-3 text-gray-600 rotate-90" />
            </div>
          </div>
        )}

        {/* Hover Effect Overlay with Link Indicator */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Link indicator */}
        <div className="absolute top-4 right-4 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
          <ArrowRight className="w-4 h-4 text-white" />
        </div>

        {/* Animated Border */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
    </a>
  );
};

export default HowItWorksCard;