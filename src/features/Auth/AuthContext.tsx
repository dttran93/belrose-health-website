import React, { createContext, ReactNode, useContext } from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthContextData } from '@/types/core';

export interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextData | null>(null);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const authData = useAuth();

  return <AuthContext.Provider value={authData}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextData => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};
