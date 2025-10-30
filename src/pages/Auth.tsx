import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import LoginForm from '@/components/auth/components/LoginForm';
import RegistrationForm from '@/components/auth/components/RegistrationForm';
import ForgotPasswordPage from '@/components/auth/components/ForgotPasswordPage';

type AuthPageState = 'login' | 'registration' | 'forgotPassword' | 'accountRecovery';

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
          onForgotPassword={() => setCurrentView('forgotPassword')}
        />
      )}

      {currentView === 'registration' && (
        <RegistrationForm onSwitchToLogin={() => setCurrentView('login')} />
      )}

      {currentView === 'forgotPassword' && (
        <ForgotPasswordPage
          onBackToLogin={() => setCurrentView('login')}
          onSwitchToRecovery={() => setCurrentView('accountRecovery')}
        />
      )}

      {currentView === 'accountRecovery' && <span>Placeholder</span>}
    </>
  );
};

export default Auth;
