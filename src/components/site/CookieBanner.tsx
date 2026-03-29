// src/components/site/CookieBanner.tsx
//
//
// HOW IT WORKS:
// - On first visit, shows a banner at the bottom of the screen
// - "Accept" → saves 'accepted' to localStorage, calls initAnalytics()
// - "Decline" → saves 'declined' to localStorage, banner disappears
// - On subsequent visits, reads localStorage and re-initialises analytics
//   if previously accepted (so consent persists across sessions)
// - "Manage cookies" link in the footer can clear the stored choice,
//   re-showing the banner (see clearCookieConsent() export below)

import React, { useEffect, useState } from 'react';
import { initAnalytics } from '@/firebase/config';
import { Button } from '../ui/Button';

const CONSENT_KEY = 'cookie_consent'; // matches the key documented in PrivacyPolicy

type ConsentValue = 'accepted' | 'declined';

// Call this from a "Manage cookies" button if you want to let users change
// their mind. E.g. in Settings or the Privacy Policy page.
export function clearCookieConsent(): void {
  localStorage.removeItem(CONSENT_KEY);
  window.location.reload(); // re-shows the banner
}

const CookieBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY) as ConsentValue | null;

    if (stored === 'accepted') {
      // Returning visitor who already accepted — start analytics silently
      initAnalytics();
    } else if (!stored) {
      // First visit — show the banner
      setVisible(true);
    }
    // stored === 'declined' → do nothing, analytics stays off
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    initAnalytics();
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6 pointer-events-none">
      <div className="max-w-2xl mx-auto bg-primary rounded-xl shadow-2xl border border-border p-5 md:p-6 pointer-events-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium mb-1">We use cookies</p>
            <p className="text-xs text-white/50 leading-relaxed">
              We use Google Analytics to understand how people use our site. No personal data is
              shared.{' '}
              <a href="/privacy#cookies" className="text-accent hover:underline">
                Privacy Policy
              </a>
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 flex-shrink-0">
            <Button
              onClick={handleDecline}
              className="text-border border border-border hover:text-white hover:bg-white/10 transition-colors"
            >
              Decline
            </Button>
            <Button onClick={handleAccept} variant="destructive">
              Accept analytics
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
