// src/App.jsx
import { Toaster as Sonner } from "sonner";
import { TooltipProvider} from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/index.jsx";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/AuthPage.jsx";
import Layout from "./components/app/Layout.jsx";
import Dashboard from "./pages/Dashboard";
import Activity from "./pages/Activity";
import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
import AddRecord from "./pages/AddRecord.jsx";
import './App.css'
import { AuthProvider } from "./components/auth/AuthContext.jsx";
import MockFHIRFormTester from "./pages/MockFHIRFormTester.jsx";
import MockDataReviewTester from "@/pages/MockDataReviewTester.jsx";


const queryClient = new QueryClient();

/* This is the App component that wraps the entire application.
   It provides global state management, tooltips, and routing functionality. */
const App = () => {
  return(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />

            <Route path="/dashboard/*" element={
              <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route index element= {<Dashboard />}/>
                    <Route path="activity" element={<Activity />}/>
                    <Route path="addrecord" element={<AddRecord />}/>
                    <Route path="fhirtesting" element={<MockFHIRFormTester />} />
                    <Route path="datareviewtesting" element={<MockDataReviewTester />} />
                </Routes>
              </Layout>
              </ProtectedRoute>
            }/>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
