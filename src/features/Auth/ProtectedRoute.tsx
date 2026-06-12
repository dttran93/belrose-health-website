import React, { ReactNode } from 'react';
import { Navigate, useLocation, Location } from 'react-router-dom';
import { useAuthContext } from './AuthContext';

export interface ProtectedRouteProps {
  children: ReactNode;
}

export interface LocationState {
  from: {
    pathname: string;
  };
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuthContext();
  const location = useLocation() as Location<LocationState>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Dependent logging in directly (not via guardian custom-token switch) → handoff screen.
  // signInProvider === 'password' means they used their own credentials, not a guardian switch.
  if (user.isDependent && user.signInProvider === 'password' && location.pathname !== '/claim-account') {
    return <Navigate to="/claim-account" replace />;
  }

  // Logged in but email not verified → send to verification hub.
  // Exempt: dependents (guardian verified consent at creation), and accounts still on a placeholder
  // email (they can't verify until they update to a real email — future feature).
  const isPlaceholderEmail = user.email?.endsWith('@placeholder.belrose.health') ?? false;
  const VERIFICATION_EXEMPT = ['/verification', '/account-setup'];
  if (!user.emailVerified && !user.isDependent && !isPlaceholderEmail && !VERIFICATION_EXEMPT.includes(location.pathname)) {
    return (
      <Navigate
        to="/verification"
        state={{
          userId: user.uid,
          email: user.email,
          from: location,
        }}
        replace
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
