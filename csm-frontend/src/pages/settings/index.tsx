// csms-frontend/src/pages/settings/index.tsx
import React, { useState, useEffect, useRef, useCallback, createContext } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { 
  UserCircle, Building2, Shield, Bell, CreditCard, Palette, 
  AlertTriangle, Users, Mail, Loader2, X, CheckCircle, AlertCircle, Info,
  Save, AlertOctagon, History
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ProfileSettings from "./components/ProfileSettings";
import OrganizationSettings from "./components/OrganizationSettings";
import AdminManagement from "./components/AdminManagement";
import SecuritySettings from "./components/SecuritySettings";
import NotificationSettings from "./components/NotificationSettings";
import BillingSettings from "./components/BillingSettings";
import ThemeSettings from "./components/ThemeSettings";
import DangerZone from "./components/DangerZone";
import GoogleAuthSettings from "./components/GoogleAuthSettings";
import AuditLogs from "./components/AuditLogs";

// Toast Component
const Toast = ({ message, type, onClose }: { message: string; type: "success" | "error" | "info" | "warning"; onClose: () => void }) => {
  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertCircle className="h-5 w-5 text-yellow-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />
  };

  const bgColors = {
    success: "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900",
    error: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900",
    warning: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900",
    info: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900"
  };

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 p-4 rounded-lg shadow-lg border ${bgColors[type]} animate-slide-in max-w-md`}>
      {icons[type]}
      <p className="text-sm font-body text-foreground flex-1">{message}</p>
      <button onClick={onClose} className="ml-2 text-muted-foreground hover:text-foreground transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// Confirmation Modal Component
const ConfirmationModal = ({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  title,
  description,
  confirmText = "Leave",
  cancelText = "Stay",
  variant = "warning"
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "warning" | "danger" | "info";
}) => {
  const variantStyles = {
    warning: {
      icon: <AlertOctagon className="h-6 w-6 text-amber-500" />,
      buttonClass: "bg-amber-500 hover:bg-amber-600",
      borderClass: "border-amber-500/20"
    },
    danger: {
      icon: <AlertTriangle className="h-6 w-6 text-red-500" />,
      buttonClass: "bg-red-500 hover:bg-red-600",
      borderClass: "border-red-500/20"
    },
    info: {
      icon: <Info className="h-6 w-6 text-blue-500" />,
      buttonClass: "bg-blue-500 hover:bg-blue-600",
      borderClass: "border-blue-500/20"
    }
  };

  const styles = variantStyles[variant];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={`border ${styles.borderClass}`}>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            {styles.icon}
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-foreground/80">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={styles.buttonClass}>
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// Bottom Floating Unsaved Changes Banner Component (ONLY BANNER - NO TOP ALERT)
const UnsavedChangesBanner = ({ isDirty, onDiscard, onSave }: { isDirty: boolean; onDiscard: () => void; onSave: () => void }) => {
  const [visible, setVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (isDirty) {
      setVisible(true);
      setIsAnimatingOut(false);
    } else if (visible) {
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setIsAnimatingOut(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isDirty]);

  if (!visible) return null;

  // return (
  //   <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
  //     isAnimatingOut ? "opacity-0 translate-y-20" : "opacity-100 translate-y-0"
  //   }`}>
  //     <div className="bg-card border border-amber-500/30 rounded-xl shadow-2xl p-4 min-w-[320px] max-w-md backdrop-blur-sm bg-background/95">
  //       <div className="flex items-center gap-4">
  //         <div className="flex-shrink-0">
  //           <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
  //             <AlertOctagon className="h-5 w-5 text-amber-500" />
  //           </div>
  //         </div>
  //         <div className="flex-1">
  //           <p className="text-sm font-semibold text-foreground">You have unsaved changes</p>
  //           <p className="text-xs text-muted-foreground mt-0.5">
  //             Your changes will be lost if you leave without saving.
  //           </p>
  //         </div>
  //         <div className="flex gap-2">
  //           <Button 
  //             size="sm" 
  //             variant="outline" 
  //             onClick={onDiscard}
  //             className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
  //           >
  //             <X className="h-3.5 w-3.5 mr-1" /> Discard
  //           </Button>
  //           <Button 
  //             size="sm" 
  //             onClick={onSave}
  //             className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg"
  //           >
  //             <Save className="h-3.5 w-3.5 mr-1" /> Save Changes
  //           </Button>
  //         </div>
  //       </div>
  //     </div>
  //   </div>
  // );
};

// Tab keys mapping
const TAB_KEYS = {
  profile: "profile",
  organization: "organization",
  admins: "admins",
  security: "security",
  notifications: "notifications",
  billing: "billing",
  themes: "themes",
  google: "google",
  audit: "audit",
  danger: "danger"
} as const;

type TabKey = typeof TAB_KEYS[keyof typeof TAB_KEYS];

// Context for tracking unsaved changes across child components
export const SettingsDirtyContext = createContext<{
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  resetDirty: () => void;
  triggerSave?: () => void;
}>({
  isDirty: false,
  setDirty: () => {},
  resetDirty: () => {},
});

const Settings = () => {
  const { admin, updateProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" | "warning" } | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const savedTab = localStorage.getItem("settings_active_tab") as TabKey;
    const hash = window.location.hash.replace("#", "");
    if (hash && Object.values(TAB_KEYS).includes(hash as TabKey)) {
      return hash as TabKey;
    }
    return savedTab || TAB_KEYS.profile;
  });
  
  const [isDirty, setIsDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [showPageLeaveWarning, setShowPageLeaveWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const isNavigatingRef = useRef(false);
  const saveTriggerRef = useRef<() => void>(() => {});

  const showToast = (message: string, type: "success" | "error" | "info" | "warning") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const setDirty = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  const resetDirty = useCallback(() => {
    setIsDirty(false);
    setPendingTab(null);
    setPendingNavigation(null);
  }, []);

  const triggerSave = useCallback(() => {
    if (saveTriggerRef.current) {
      saveTriggerRef.current();
    }
  }, []);

  // Register save trigger from active component
  const registerSaveTrigger = useCallback((fn: () => void) => {
    saveTriggerRef.current = fn;
  }, []);

  // Handle tab change with confirmation
  const handleTabChange = (tab: string) => {
    if (isDirty) {
      setPendingTab(tab);
      setShowLeaveWarning(true);
    } else {
      setActiveTab(tab as TabKey);
      localStorage.setItem("settings_active_tab", tab);
      window.location.hash = tab;
    }
  };

  // Confirm tab leave
  const confirmTabLeave = () => {
    if (pendingTab) {
      setIsDirty(false);
      setActiveTab(pendingTab as TabKey);
      localStorage.setItem("settings_active_tab", pendingTab);
      window.location.hash = pendingTab;
      setPendingTab(null);
    }
    setShowLeaveWarning(false);
  };

  // Cancel tab leave
  const cancelTabLeave = () => {
    setPendingTab(null);
    setShowLeaveWarning(false);
  };

  // Handle hash change (browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash && Object.values(TAB_KEYS).includes(hash as TabKey) && hash !== activeTab) {
        if (isDirty) {
          setPendingTab(hash);
          setShowLeaveWarning(true);
          // Revert hash back
          window.location.hash = activeTab;
        } else {
          setActiveTab(hash as TabKey);
          localStorage.setItem("settings_active_tab", hash);
        }
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [activeTab, isDirty]);

  // Set initial hash on mount
  useEffect(() => {
    if (!window.location.hash && activeTab) {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  // Handle page refresh/close warning with custom modal
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  if (!admin) return null;

  return (
    <SettingsDirtyContext.Provider value={{ isDirty, setDirty, resetDirty, triggerSave }}>
      {/* Main container with custom scrollbar and overflow hidden on body */}
      <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-20 h-full overflow-y-auto custom-scrollbar">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        {/* Unsaved Changes Warning Modal for Tab Leave */}
        <ConfirmationModal
          open={showLeaveWarning}
          onOpenChange={setShowLeaveWarning}
          onConfirm={confirmTabLeave}
          onCancel={cancelTabLeave}
          title="Unsaved Changes"
          description="You have unsaved changes. Are you sure you want to leave this tab? Your changes will be lost."
          confirmText="Leave Anyway"
          cancelText="Stay"
          variant="warning"
        />

        {/* Unsaved Changes Warning Modal for Page Leave */}
        <ConfirmationModal
          open={showPageLeaveWarning}
          onOpenChange={setShowPageLeaveWarning}
          onConfirm={() => {
            setIsDirty(false);
            if (pendingNavigation) {
              navigate(pendingNavigation);
            }
            setShowPageLeaveWarning(false);
          }}
          onCancel={() => {
            setPendingNavigation(null);
            setShowPageLeaveWarning(false);
          }}
          title="Unsaved Changes"
          description="You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost."
          confirmText="Leave Page"
          cancelText="Stay"
          variant="warning"
        />

        {/* Bottom Floating Unsaved Changes Banner - ONLY BANNER, NO TOP ALERT */}
       {/* <UnsavedChangesBanner 
          isDirty={isDirty} 
          onDiscard={resetDirty} 
          onSave={triggerSave}
        />*/}

        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <History className="h-6 w-6 text-primary" /> Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account, organization, and preferences</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="bg-muted/50 border border-border flex-wrap h-auto gap-1 p-1 sticky top-16 z-10 bg-background/95 backdrop-blur-sm">
            <TabsTrigger value={TAB_KEYS.profile} className="gap-2">
              <UserCircle className="h-4 w-4" /> Account
            </TabsTrigger>
            <TabsTrigger value={TAB_KEYS.organization} className="gap-2">
              <Building2 className="h-4 w-4" /> Organization
            </TabsTrigger>
            <TabsTrigger value={TAB_KEYS.admins} className="gap-2">
              <Users className="h-4 w-4" /> Admins
            </TabsTrigger>
            <TabsTrigger value={TAB_KEYS.security} className="gap-2">
              <Shield className="h-4 w-4" /> Security
            </TabsTrigger>
            <TabsTrigger value={TAB_KEYS.notifications} className="gap-2">
              <Bell className="h-4 w-4" /> Notifications
            </TabsTrigger>
            <TabsTrigger value={TAB_KEYS.billing} className="gap-2">
              <CreditCard className="h-4 w-4" /> Billing
            </TabsTrigger>
            <TabsTrigger value={TAB_KEYS.themes} className="gap-2">
              <Palette className="h-4 w-4" /> Themes
            </TabsTrigger>
            <TabsTrigger value={TAB_KEYS.google} className="gap-2">
              <Mail className="h-4 w-4" /> OAuth
            </TabsTrigger>
            <TabsTrigger value={TAB_KEYS.audit} className="gap-2">
              <History className="h-4 w-4" /> Audit Logs
            </TabsTrigger>
            <TabsTrigger value={TAB_KEYS.danger} className="gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Danger
            </TabsTrigger>
          </TabsList>

          <TabsContent value={TAB_KEYS.profile} className="custom-scrollbar">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <ProfileSettings admin={admin} updateProfile={updateProfile} onToast={showToast} registerSaveTrigger={registerSaveTrigger} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value={TAB_KEYS.organization} className="custom-scrollbar">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <OrganizationSettings admin={admin} updateProfile={updateProfile} onToast={showToast} registerSaveTrigger={registerSaveTrigger} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value={TAB_KEYS.admins} className="custom-scrollbar">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <AdminManagement admin={admin} onToast={showToast} registerSaveTrigger={registerSaveTrigger} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value={TAB_KEYS.security} className="custom-scrollbar">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <SecuritySettings admin={admin} updateProfile={updateProfile} onToast={showToast} registerSaveTrigger={registerSaveTrigger} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value={TAB_KEYS.notifications} className="custom-scrollbar">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <NotificationSettings admin={admin} onToast={showToast} registerSaveTrigger={registerSaveTrigger} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value={TAB_KEYS.billing} className="custom-scrollbar">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <BillingSettings admin={admin} onToast={showToast} registerSaveTrigger={registerSaveTrigger} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value={TAB_KEYS.themes} className="custom-scrollbar">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <ThemeSettings admin={admin} onToast={showToast} registerSaveTrigger={registerSaveTrigger} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value={TAB_KEYS.google} className="custom-scrollbar">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <GoogleAuthSettings admin={admin} updateProfile={updateProfile} onToast={showToast} registerSaveTrigger={registerSaveTrigger} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value={TAB_KEYS.audit} className="custom-scrollbar">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <AuditLogs admin={admin} onToast={showToast} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value={TAB_KEYS.danger} className="custom-scrollbar">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <DangerZone admin={admin} onToast={showToast} registerSaveTrigger={registerSaveTrigger} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SettingsDirtyContext.Provider>
  );
};

export default Settings;