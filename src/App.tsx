import React from 'react';
import { Toaster as Sonner } from 'sonner';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Index from './pages/index';
import NotFound from './pages/NotFound';
import Auth from './pages/Auth';
import Layout from './components/app/Layout';
import Dashboard from './pages/Dashboard';
import AllRecords from './pages/AllRecords';
import ProtectedRoute from './features/Auth/ProtectedRoute';
import AddRecord from './pages/AddRecord';
import './App.css';
import { AuthProvider } from './features/Auth/AuthContext';
import { LayoutProvider } from './components/app/LayoutProvider';
import SettingsPage from './pages/Settings';
import { EncryptionGate } from './features/Encryption/components/EncryptionGate';
import SharedRecords from './pages/SharedRecords';
import VerificationHub from './pages/VerificationHub';
import EmailVerifiedPage from './pages/EmailVerified';
import NotificationsManager from './features/Notifications/component/NotificationsManager';
import BlockchainAdminDashboard from './pages/BlockchainAdminDashboard';

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
              <Route path="/auth" element={<Auth />} />
              <Route path="/verification" element={<VerificationHub />} />
              <Route path="/verify-email" element={<EmailVerifiedPage />} />
              <Route
                path="/dashboard/*"
                element={
                  <ProtectedRoute>
                    <EncryptionGate>
                      <LayoutProvider>
                        <Layout>
                          <Routes>
                            <Route index element={<Dashboard />} />
                            <Route path="all-records" element={<AllRecords />} />
                            <Route path="add-record" element={<AddRecord />} />
                            <Route path="settings" element={<SettingsPage />} />
                            <Route path="notifications" element={<NotificationsManager />} />
                            <Route path="share-records" element={<SharedRecords />} />
                            <Route path="blockchain-admin" element={<BlockchainAdminDashboard />} />
                          </Routes>
                        </Layout>
                      </LayoutProvider>
                    </EncryptionGate>
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
