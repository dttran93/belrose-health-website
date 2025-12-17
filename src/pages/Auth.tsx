import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import LoginForm from '@/features/Auth/components/LoginForm';
import RegistrationForm from '@/features/Auth/components/RegistrationForm';
import AccountRecovery from '@/features/Auth/components/AccountRecovery';
import { useNavigate } from 'react-router-dom';

type AuthPageState = 'login' | 'registration' | 'accountRecovery';

const Auth: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
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
          onBack={() => navigate('/')}
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
