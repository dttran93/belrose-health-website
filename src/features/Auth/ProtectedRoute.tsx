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

  const isPlaceholderEmail = user.email?.endsWith('@placeholder.belrose.health') ?? false;

  // A dependent who has claimed their account (isDependent flipped false by
  // claimDependentAccount) but still hasn't replaced their placeholder email — force them back
  // to /account-setup until they do. AccountSetupPage's own "Continue to Belrose" button
  // requires the same thing (!isEmailPlaceholder), so this keeps the router-level gate and the
  // page's CTA in agreement, instead of leaving a claimed dependent free to wander the app with
  // a permanently-disabled button on the one screen meant to unstick them.
  if (!user.isDependent && isPlaceholderEmail && location.pathname !== '/account-setup') {
    return <Navigate to="/account-setup" replace />;
  }

  // Logged in but email not verified → send to verification hub.
  // Exempt: still-active dependents (guardian verified consent at creation, and a placeholder
  // email can't be verified anyway — they're caught by the isDependent check above once
  // claimed), and /verification and /account-setup themselves (avoids a redirect loop).
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
