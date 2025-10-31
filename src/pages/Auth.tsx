import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import LoginForm from '@/components/auth/components/LoginForm';
import RegistrationForm from '@/components/auth/components/RegistrationForm';
import AccountRecovery from '@/components/auth/components/AccountRecovery';

type AuthPageState = 'login' | 'registration' | 'accountRecovery';

const Auth: React.FC = () => {
  const location = useLocation();
  const showRegistration = location.state?.showRegistration || false;
  const [currentView, setCurrentView] = useState<AuthPageState>(
    showRegistration ? 'registration' : 'login'
  );

  return (
    <>
      {currentView === 'login' && (
        <LoginForm
          onSwitchToRegister={() => setCurrentView('registration')}
          onForgotPassword={() => setCurrentView('accountRecovery')}
        />
      )}

      {currentView === 'registration' && (
        <RegistrationForm onSwitchToLogin={() => setCurrentView('login')} />
      )}

      {currentView === 'accountRecovery' && (
        <AccountRecovery onBackToLogin={() => setCurrentView('login')} />
      )}
    </>
  );
};

export default Auth;
