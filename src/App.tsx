import React from 'react';
import { Toaster as Sonner } from 'sonner';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
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
import ActivityHub from './pages/ActivityHub';

const queryClient = new QueryClient();

// ── Root wrapper — provides all global context, renders matched route via Outlet ──
// Replaces the provider nesting that previously wrapped <BrowserRouter>.
// Every route in the tree is a descendant of this component.
const RootLayout: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <CitationProvider>
          <Outlet />
        </CitationProvider>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

// ── Protected app shell — auth gate + encryption gate + layout providers ──
// Replaces the inline nesting inside the old /app/* Route element.
// <Layout /> now renders <Outlet /> instead of {children}.
const ProtectedLayout: React.FC = () => (
  <ProtectedRoute>
    <EncryptionGate>
      <AIChatProvider>
        <LayoutProvider>
          <Layout />
        </LayoutProvider>
      </AIChatProvider>
    </EncryptionGate>
  </ProtectedRoute>
);

// ── Router ────────────────────────────────────────────────────────────────────
const router = createBrowserRouter([
  {
    // RootLayout wraps every route — all providers live here
    element: <RootLayout />,
    children: [
      // ── Public site shell ──
      { path: '/', element: <Index /> },
      { path: '/privacy', element: <PrivacyPolicy /> },
      { path: '/for-providers', element: <ForProviders /> },

      // ── Auth & verification ──
      { path: '/auth', element: <Auth /> },
      { path: '/auth/register', element: <Auth /> },
      { path: '/auth/recover', element: <Auth /> },
      { path: '/waitlist', element: <Auth /> },
      { path: '/verification', element: <VerificationHub /> },
      { path: '/verify-email', element: <EmailVerifiedPage /> },

      // ── Guest flows ──
      { path: '/invite', element: <GuestInvitePage /> },
      { path: '/fulfill-request', element: <FulfillRequestPage /> },

      // ── Protected app ──
      {
        path: '/app',
        element: <ProtectedLayout />,
        children: [
          { index: true, element: <AppPortal /> },
          { path: 'hash-tester', element: <HashTester /> },
          {
            path: 'blockchain-admin',
            element: (
              <RequiresPlatformAdmin>
                <BlockchainAdminDashboard />
              </RequiresPlatformAdmin>
            ),
          },
          { path: 'health-profile/:subjectId', element: <HealthProfile /> },
          { path: 'ai/chat/:chatId', element: <AppPortal /> },
          { path: 'ai/history', element: <ChatHistoryPage /> },
          { path: 'all-records', element: <AllRecords /> },
          { path: 'record-requests', element: <RecordRequestsPage /> },
          { path: 'records/:recordId', element: <RecordDetail /> },
          { path: 'add-record', element: <AddRecord /> },
          { path: 'settings/*', element: <SettingsPage /> },
          { path: 'activity', element: <ActivityHub /> },
          { path: 'messages', element: <Messaging /> },
          { path: 'messages/:recipientId', element: <Messaging /> },
        ],
      },

      { path: '*', element: <NotFound /> },
    ],
  },
]);

// ── App ───────────────────────────────────────────────────────────────────────
const App: React.FC = (): React.JSX.Element => <RouterProvider router={router} />;

export default App;
