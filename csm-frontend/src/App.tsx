// csms-frontend/src/App.tsx
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
// import SubscriptionManagement from "./pages/dashboard/SubscriptionManagement";
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
import DeviceConfig from "./pages/dashboard/DeviceConfig";
import WifiConfig from "./pages/dashboard/WifiConfig";
import Notifications from "./pages/dashboard/Notifications";
import Reports from "./pages/dashboard/Reports";
import Billing from "./pages/dashboard/Billing";
import HardwareShop from "@/pages/dashboard/HardwareShop";
import AccountSettings from "./pages/dashboard/AccountSettings";
import LiveDisplay from "./pages/LiveDisplay";
import NotFound from "./pages/NotFound";
import CustomCategories from "./pages/dashboard/CustomCategories";
import { NotificationProvider } from "@/contexts/NotificationContext";

import PaymentProtectedRoute from "@/components/PaymentProtectedRoute";
import PaymentRequired from "@/components/PaymentRequired";
import SubscriptionSuccess from "@/pages/SubscriptionSuccess";

// IMPORT THE NEW MODULAR SETTINGS
import Settings from "./pages/settings";
// import ConfigSettings from "./pages/dashboard/ConfigSettings";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const queryClient = new QueryClient();

const App = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <>
      {installPrompt && (
        <button
          onClick={handleInstall}
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 9999,
            borderRadius: 9999,
            background: "#0f172a",
            color: "#fff",
            padding: "0.75rem 1rem",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.25)",
          }}
        >
          Install app
        </button>
      )}

      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <NotificationProvider>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/payment-required" element={<PaymentRequired />} />
                  <Route path="/subscription/success" element={<SubscriptionSuccess />} />

                  {/* Dashboard Routes */}
                  <Route element={<PaymentProtectedRoute />}>
                    <Route path="/dashboard" element={<DashboardLayout />}>
                      <Route index element={<DashboardOverview />} />
                      <Route path="analytics" element={<Analytics />} />
                      {/* <Route path="dashboard/subscription" element={<SubscriptionManagement />} /> */}
                      <Route path="categories" element={<CustomCategories />} />
                      <Route path="attendance" element={<AttendanceManagement />} />
                      <Route path="users" element={<UsersManagement />} />
                      <Route path="devices" element={<DeviceManagement />} />

                      {/* Settings */}
                      <Route path="settings" element={<Settings />} />
                      {/*<Route path="setting" element={<ConfigSettings />} />*/}

                      {/* More Settings */}
                      <Route path="device-config" element={<DeviceConfig />} />
                      <Route path="wifi-config" element={<WifiConfig />} />
                      <Route path="notifications" element={<Notifications />} />
                      <Route path="reports" element={<Reports />} />
                      <Route path="billing" element={<Billing />} />
                      <Route path="hardware-shop" element={<HardwareShop />} />
                      <Route path="account" element={<AccountSettings />} />
                    </Route>
                  </Route>

                  {/* Live View Routes */}
                  <Route path="/live/s/:sessionId" element={<LiveDisplay />} />
                  <Route path="/live/:slug" element={<LiveDisplay />} />

                  {/* 404 Fallback */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </NotificationProvider>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </>
  );
};

export default App;
