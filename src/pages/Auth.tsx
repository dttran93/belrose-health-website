import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import LoginForm from '@/components/auth/components/LoginForm';
import RegistrationForm from '@/components/auth/components/RegistrationForm';

const Auth: React.FC = () => {
  const location = useLocation();
  const showRegistration = location.state?.showRegistration || false;
  const [isLogin, setIsLogin] = useState<boolean>(!showRegistration);

  return (
    <>
      {isLogin ? (
        <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
      ) : (
        <RegistrationForm onSwitchToLogin={() => setIsLogin(true)} />
      )}
    </>
  );
};

export default Auth;
