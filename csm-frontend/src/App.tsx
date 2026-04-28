// csms-frontend/src/App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import CompleteSetup from "./pages/CompleteSetup";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import DashboardLayout from "./pages/DashboardLayout";
import DashboardOverview from "./pages/dashboard/DashboardOverview";
import Analytics from "./pages/dashboard/Analytics";
import AttendanceManagement from "./pages/dashboard/AttendanceManagement";
import UsersManagement from "./pages/dashboard/UsersManagement";
import DeviceManagement from "./pages/dashboard/DeviceManagement";
import ConfigSettings from "./pages/dashboard/ConfigSettings";
import DeviceConfig from "./pages/dashboard/DeviceConfig";
import WifiConfig from "./pages/dashboard/WifiConfig";
import Notifications from "./pages/dashboard/Notifications";
import Reports from "./pages/dashboard/Reports";
import Billing from "./pages/dashboard/Billing";
import AccountSettings from "./pages/dashboard/AccountSettings";
import LiveDisplay from "./pages/LiveDisplay";
// import LiveDisplay from "@/pages/LiveDisplay";
import NotFound from "./pages/NotFound";

import CustomCategories from "./pages/dashboard/CustomCategories";
import { NotificationProvider } from "@/contexts/NotificationContext";


const queryClient = new QueryClient();
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <NotificationProvider>  {/* ← MOVE HERE - INSIDE BrowserRouter */}
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/complete-setup" element={<CompleteSetup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route path="/dashboard/categories" element={<CustomCategories />} />
                <Route index element={<DashboardOverview />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="attendance" element={<AttendanceManagement />} />
                <Route path="users" element={<UsersManagement />} />
                <Route path="devices" element={<DeviceManagement />} />
                <Route path="settings" element={<ConfigSettings />} />
                <Route path="device-config" element={<DeviceConfig />} />
                <Route path="wifi-config" element={<WifiConfig />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="reports" element={<Reports />} />
                <Route path="billing" element={<Billing />} />
                <Route path="account" element={<AccountSettings />} />
              </Route>
              <Route path="/live/s/:sessionId" element={<LiveDisplay />} />
              <Route path="/live/:slug" element={<LiveDisplay />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </NotificationProvider>  {/* ← CLOSE HERE */}
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
