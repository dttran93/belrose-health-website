// src/components/site/WaitlistBanner.tsx
//
// A dismissible banner to place anywhere on the public site (e.g. top of Index page,
// inside Navbar, or above the footer). Links directly to /waitlist.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, Sparkles } from 'lucide-react';

const WaitlistBanner: React.FC = () => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative w-full bg-primary text-secondary px-4 py-3 flex items-center justify-center gap-4">
      {/* Sparkle icon — subtle visual cue */}
      <Sparkles className="w-4 h-4 text-complement-4 flex-shrink-0 hidden sm:block" />

      {/* Message */}
      <p className="text-sm font-medium text-center">
        Belrose is in private alpha testing —{' '}
        <button
          onClick={() => navigate('/waitlist')}
          className="inline-flex items-center gap-1 text-complement-4 font-semibold
                     hover:underline underline-offset-2 transition-colors"
        >
          join the waitlist for alpha access
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </p>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/50
                   hover:text-secondary transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default WaitlistBanner;
