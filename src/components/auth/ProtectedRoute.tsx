import React from 'react';
import { Navigate, useLocation } from "react-router-dom";
import { useAuthContext } from "./AuthContext";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuthContext(); // Use context instead
  const location = useLocation();

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

  return children; 
};

export default ProtectedRoute;