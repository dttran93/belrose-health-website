import React from "react";
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/AuthPage";
import Layout from "./components/app/Layout";
import Dashboard from "./pages/Dashboard";
import PatientRecordsList from "./pages/Activity";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AddRecord from "./pages/AddRecord";
import './App.css';
import { AuthProvider } from "./components/auth/AuthContext";

// Create QueryClient instance with proper typing
const queryClient = new QueryClient();

/**
 * This is the App component that wraps the entire application.
 * It provides global state management, tooltips, and routing functionality.
 * 
 * @returns {React.JSX.Element} The main App component
 */
const App: React.FC = (): React.JSX.Element => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />

              <Route 
                path="/dashboard/*" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Routes>
                        <Route index element={<Dashboard />} />
                        <Route path="activity" element={<PatientRecordsList />} />
                        <Route path="addrecord" element={<AddRecord />} />
                      </Routes>
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;