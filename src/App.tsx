import React from 'react';
import { Toaster as Sonner } from 'sonner';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import NotFound from './pages/NotFound';
import Auth from './pages/Auth';
import Layout from './components/app/Layout';
import AppPortal from './pages/AppPortal';
import AllRecords from './pages/AllRecords';
import ProtectedRoute from './features/Auth/ProtectedRoute';
import AddRecord from './pages/AddRecord';
import './App.css';
import { AuthProvider } from './features/Auth/AuthContext';
import { LayoutProvider } from './components/app/LayoutProvider';
import SettingsPage from './pages/Settings';
import { EncryptionGate } from './features/Encryption/components/EncryptionGate';
import VerificationHub from './pages/VerificationHub';
import EmailVerifiedPage from './pages/EmailVerified';
import NotificationsManager from './features/Notifications/component/NotificationsManager';
import BlockchainAdminDashboard from './pages/BlockchainAdminDashboard';
import HashTester from './pages/HashTester';
import Index from './pages';
import { CitationProvider } from './components/site/Citations/CitationContext';
import { AIChatProvider } from './features/Ai/components/AIChatContext';
import ChatHistoryPage from './features/Ai/components/ChatHistoryPage';
import HealthProfile from './pages/HealthProfile';
import RecordDetail from './pages/RecordDetail';
import GuestInvitePage from './pages/GuestInvitePage';
import Messaging from './pages/Messaging';
import PrivacyPolicy from './pages/PrivacyPolicy';
import { RequiresPlatformAdmin } from './features/Users/components/RequirePlatformAdmin';
import FulfillRequestPage from './pages/FulfillRequestPage';
import RecordRequestsPage from './pages/RecordRequestsPage';
import ForProviders from './pages/ForProviders';

// Create QueryClient instance with proper typing
const queryClient = new QueryClient();

const App: React.FC = (): React.JSX.Element => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Sonner />
          <CitationProvider>
            <BrowserRouter>
              <Routes>
                {/* ── Public site shell ── */}
                <Route path="/" element={<Index />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/for-providers" element={<ForProviders />} />

                {/* ── Auth & verification ── */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/register" element={<Auth />} />
                <Route path="/auth/recover" element={<Auth />} />
                <Route path="/waitlist" element={<Auth />} />
                <Route path="/verification" element={<VerificationHub />} />
                <Route path="/verify-email" element={<EmailVerifiedPage />} />

                {/* ── Auth & verification ── */}
                <Route path="/invite" element={<GuestInvitePage />} />
                <Route path="/fulfill-request" element={<FulfillRequestPage />} />

                {/* ── Protected app ── */}
                <Route
                  path="/app/*"
                  element={
                    <ProtectedRoute>
                      <EncryptionGate>
                        <AIChatProvider>
                          <LayoutProvider>
                            <Layout>
                              <Routes>
                                <Route index element={<AppPortal />} />
                                // Admin Routes
                                <Route path="hash-tester" element={<HashTester />} />
                                <Route
                                  path="blockchain-admin"
                                  element={
                                    <RequiresPlatformAdmin>
                                      <BlockchainAdminDashboard />
                                    </RequiresPlatformAdmin>
                                  }
                                />
                                <Route
                                  path="health-profile/:subjectId"
                                  element={<HealthProfile />}
                                />
                                <Route path="ai/chat/:chatId" element={<AppPortal />} />
                                <Route path="ai/history" element={<ChatHistoryPage />} />
                                <Route path="all-records" element={<AllRecords />} />
                                <Route path="record-requests" element={<RecordRequestsPage />} />
                                <Route path="records/:recordId" element={<RecordDetail />} />
                                <Route path="add-record" element={<AddRecord />} />
                                <Route path="settings/*" element={<SettingsPage />} />
                                <Route path="notifications" element={<NotificationsManager />} />
                                <Route path="messages" element={<Messaging />} />
                                <Route path="messages/:recipientId" element={<Messaging />} />
                              </Routes>
                            </Layout>
                          </LayoutProvider>
                        </AIChatProvider>
                      </EncryptionGate>
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </CitationProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
