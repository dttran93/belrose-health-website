// src/pages/Auth.tsx

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoginForm from '@/features/Auth/components/LoginForm';
import RegistrationForm from '@/features/Auth/components/RegistrationForm';
import AccountRecovery from '@/features/Auth/components/AccountRecovery';
import AlphaGateScreen from '@/features/Auth/components/AlphaGateScreen';
import WaitlistForm from '@/features/Auth/components/WaitlistForm';

type AuthPageState = 'login' | 'alphaGate' | 'registration' | 'waitlist' | 'accountRecovery';

const Auth: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Derive initial view from route
  const getInitialView = (): AuthPageState => {
    if (location.pathname === '/auth/register') return 'alphaGate';
    // Direct hit on /waitlist renders the waitlist immediately
    if (location.pathname === '/waitlist') return 'waitlist';
    return 'login';
  };

  const [currentView, setCurrentView] = useState<AuthPageState>(getInitialView);
  const [gatedEmail, setGatedEmail] = useState('');

  useEffect(() => {
    if (location.pathname === '/auth/register') {
      setCurrentView('alphaGate');
    } else if (location.pathname === '/waitlist') {
      setCurrentView('waitlist');
    } else {
      setCurrentView('login');
    }
  }, [location.pathname]);

  // Called when AlphaGateScreen confirms the email is on the invite list
  const handleApproved = (email: string) => {
    setGatedEmail(email);
    setCurrentView('registration');
  };

  // Called when AlphaGateScreen finds no invite for the email
  const handleNotApproved = (email: string) => {
    setGatedEmail(email);
    setCurrentView('waitlist');
  };

  return (
    <>
      {currentView === 'login' && (
        <LoginForm
          onSwitchToRegister={() => setCurrentView('alphaGate')}
          onForgotPassword={() => setCurrentView('accountRecovery')}
          onBack={() => navigate('/')}
        />
      )}

      {currentView === 'alphaGate' && (
        <AlphaGateScreen
          onApproved={handleApproved}
          onNotApproved={handleNotApproved}
          onSwitchToLogin={() => setCurrentView('login')}
        />
      )}

      {currentView === 'registration' && (
        <RegistrationForm
          onSwitchToLogin={() => setCurrentView('login')}
          // prefillEmail={gatedEmail}
        />
      )}

      {currentView === 'waitlist' && (
        <WaitlistForm prefillEmail={gatedEmail} onBackToLogin={() => setCurrentView('login')} />
      )}

      {currentView === 'accountRecovery' && (
        <AccountRecovery onBackToLogin={() => setCurrentView('login')} />
      )}
    </>
  );
};

export default Auth;
