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
  const [gatedEmail, setGatedEmail] = useState('');
  const [localView, setLocalView] = useState<'registration' | null>(null);

  // Derive initial view from route
  const currentView = (): AuthPageState => {
    if (location.pathname === '/auth/register') return 'alphaGate';
    if (location.pathname === '/waitlist') return 'waitlist';
    if (location.pathname === '/auth/recover') return 'accountRecovery';
    return 'login';
  };

  // Called when AlphaGateScreen confirms the email is on the invite list
  const handleApproved = (email: string) => {
    setGatedEmail(email);
    setLocalView('registration');
  };

  // Called when AlphaGateScreen finds no invite for the email
  const handleNotApproved = (email: string) => {
    setGatedEmail(email);
    navigate('/waitlist');
  };

  // The actual resolved view — local state overrides URL for mid-flow transitions
  const resolvedView = localView ?? currentView();

  // Clear local override when URL changes
  useEffect(() => {
    setLocalView(null);
  }, [location.pathname]);

  return (
    <>
      {resolvedView === 'login' && (
        <LoginForm
          onSwitchToRegister={() => navigate('/auth/register')}
          onForgotPassword={() => navigate('/auth/recover')}
          onBack={() => navigate('/')}
        />
      )}

      {resolvedView === 'alphaGate' && (
        <AlphaGateScreen
          onApproved={handleApproved}
          onNotApproved={handleNotApproved}
          onSwitchToLogin={() => navigate('/auth')}
        />
      )}

      {resolvedView === 'registration' && (
        <RegistrationForm onSwitchToLogin={() => navigate('/auth')} />
      )}

      {resolvedView === 'waitlist' && (
        <WaitlistForm prefillEmail={gatedEmail} onBackToLogin={() => navigate('/auth')} />
      )}

      {resolvedView === 'accountRecovery' && (
        <AccountRecovery onBackToLogin={() => navigate('/auth')} />
      )}
    </>
  );
};

export default Auth;
