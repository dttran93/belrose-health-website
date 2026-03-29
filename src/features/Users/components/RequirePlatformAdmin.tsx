// src/components/guards/RequiresPlatformAdmin.tsx

import { useAuthContext } from '@/features/Auth/AuthContext';
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

export const RequiresPlatformAdmin = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthContext();

  useEffect(() => {
    if (user && !user.isPlatformAdmin) {
      toast.error('Access denied. Admin accounts only.');
    }
  }, [user]);

  if (!user?.isPlatformAdmin) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};
