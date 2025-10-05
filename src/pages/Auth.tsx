import React, { useState } from 'react';
import LoginForm from '@/components/auth/components/LoginForm';
import RegistrationForm from '@/components/auth/components/RegistrationForm';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState<boolean>(true);

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
