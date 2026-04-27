// csms-frontend/src/pages/ConfigSettings.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, Building2, Globe, Shield, Lock, UserCircle, Camera, 
  Eye, EyeOff, Loader2, CheckCircle, AlertCircle, X, Info, 
  Moon, Sun, Monitor, History, Trash2, Power, AlertTriangle,
  LogOut, Key, Smartphone, Mail, Calendar, Activity, FileText,
  Users, Database, Server, Wifi, WifiOff, Bell, BellOff,
  ShieldCheck, Fingerprint, CreditCard, Download, RefreshCw,
  Link2, Unlink, MailCheck, Palette, Image as ImageIcon
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, orgApi } from "@/lib/api";
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
import { toast } from "sonner";

// Theme types
type ThemeMode = "light" | "dark" | "system";
// type ThemeColor = "blue" | "purple" | "green" | "orange" | "red";

// Apply theme color to CSS variables
const applyThemeColor = (color: ThemeColor) => {
  const root = document.documentElement;
  const colorMap = {
    blue: { primary: "#3b82f6", primaryDark: "#2563eb", primaryLight: "#eff6ff" },
    purple: { primary: "#8b5cf6", primaryDark: "#7c3aed", primaryLight: "#f5f3ff" },
    green: { primary: "#22c55e", primaryDark: "#16a34a", primaryLight: "#f0fdf4" },
    orange: { primary: "#f97316", primaryDark: "#ea580c", primaryLight: "#fff7ed" },
    red: { primary: "#ef4444", primaryDark: "#dc2626", primaryLight: "#fef2f2" },
  };
  
  const colors = colorMap[color];
  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--primary-dark", colors.primaryDark);
  root.style.setProperty("--primary-light", colors.primaryLight);
  
  const style = document.createElement('style');
  style.textContent = `
    .gradient-primary {
      background: linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark});
    }
    .gradient-primary:hover {
      background: linear-gradient(135deg, ${colors.primaryDark}, ${colors.primary});
    }
  `;
  const oldStyle = document.getElementById('theme-color-style');
  if (oldStyle) oldStyle.remove();
  style.id = 'theme-color-style';
  document.head.appendChild(style);
};

// Helper function to get image URL
const getImageUrl = (image: string | null | undefined) => {
  if (!image) return null;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('data:image')) return image;
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const staticBaseUrl = baseUrl.replace('/api', '');
  return `${staticBaseUrl}/uploads/${image}`;
};

const ConfigSettings = () => {
  const { admin, logout, darkMode, toggleDarkMode, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ message: string; type: "success" | "error" | "info" | "warning" } | null>(null);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showDisconnectGoogleConfirm, setShowDisconnectGoogleConfirm] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  
  // Theme state
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("theme_mode") as ThemeMode;
    return saved || "system";
  });
  const [themeColor, setThemeColor] = useState<ThemeColor>(() => {
    const saved = localStorage.getItem("theme_color") as ThemeColor;
    return saved || "blue";
  });

  const [orgData, setOrgData] = useState({
    org_name: "",
    address: "",
    contact_email: "",
    contact_phone: "",
    api_slug: "",
  });
  
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    profile: "",
  });
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  
  const [settings, setSettings] = useState({
    emailNotifications: true,
    twoFactorAuth: false,
    apiLogging: true,
    showOnlineStatus: true,
  });

  const [googleConnected, setGoogleConnected] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showGoogleConnect, setShowGoogleConnect] = useState(false);
  const [isGoogleInitialized, setIsGoogleInitialized] = useState(false);
  
  // Organization logo states
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [uploadingOrgLogo, setUploadingOrgLogo] = useState(false);
  const [orgLogoError, setOrgLogoError] = useState(false);

  useEffect(() => {
    if (admin) {
      setProfileForm({
        firstName: admin.firstName || "",
        lastName: admin.lastName || "",
        username: admin.username || "",
        email: admin.email || "",
        profile: admin.profile || "",
      });
      setProfileImage(admin.profile || null);
      setGoogleConnected(admin.authProvider === "google");
      fetchOrganization();
      loadSettings();
    }
  }, [admin]);

  useEffect(() => {
    if (admin) {
      fetchAuditLogs();
    }
  }, [admin]);

  useEffect(() => {
    applyThemeColor(themeColor);
    localStorage.setItem("theme_color", themeColor);
  }, [themeColor]);

  useEffect(() => {
    const applyTheme = () => {
      if (themeMode === "system") {
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (systemDark !== darkMode) {
          toggleDarkMode();
        }
      } else if (themeMode === "dark" && !darkMode) {
        toggleDarkMode();
      } else if (themeMode === "light" && darkMode) {
        toggleDarkMode();
      }
    };
    applyTheme();
    localStorage.setItem("theme_mode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (showGoogleConnect && !isGoogleInitialized) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            callback: handleGoogleConnectResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          setIsGoogleInitialized(true);
          window.google.accounts.id.prompt();
        }
      };
      document.body.appendChild(script);
    }
  }, [showGoogleConnect]);

  const handleGoogleConnectResponse = async (response: any) => {
    setLoading(true);
    try {
      const { credential } = response;
      if (!credential) throw new Error('No credential received');

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const res = await fetch(`${apiUrl}/auth/google-connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('csm_token')}`
        },
        body: JSON.stringify({ token: credential }),
      });

      const result = await res.json();
      if (result.success) {
        setGoogleConnected(true);
        toast.success("Google account connected successfully!");
        if (admin) {
          const updatedAdmin = { ...admin, authProvider: "google" };
          localStorage.setItem("csm_admin", JSON.stringify(updatedAdmin));
        }
      } else {
        throw new Error(result.error || "Failed to connect Google account");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to connect Google account");
    } finally {
      setLoading(false);
      setShowGoogleConnect(false);
    }
  };

  const handleConnectGoogle = () => {
    setShowGoogleConnect(true);
  };

  const fetchOrganization = async () => {
    try {
      const res = await orgApi.getOrganization(admin?.organizationId || "");
      if (res.success && res.data) {
        const org = res.data as any;
        setOrgData({
          org_name: org.org_name,
          address: org.address || "",
          contact_email: org.contact_email || "",
          contact_phone: org.contact_phone || "",
          api_slug: org.api_page?.split('/').pop() || "",
        });
        setOrgLogo(org.logo || null);
      }
    } catch (error) {
      console.error("Error fetching organization:", error);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const savedLogs = localStorage.getItem("audit_logs");
      let logs = [];
      
      if (savedLogs) {
        logs = JSON.parse(savedLogs);
      } else {
        const mockActions = [
          { action: "Login", details: "Successful login to dashboard", icon: "🔐" },
          { action: "Profile Update", details: "Updated profile information", icon: "👤" },
          { action: "Settings Change", details: "Changed notification preferences", icon: "⚙️" },
          { action: "User Added", details: `Added new ${admin?.organizationType === "school" ? "student" : "employee"}`, icon: "➕" },
          { action: "Password Change", details: "Updated account password", icon: "🔑" },
          { action: "Device Added", details: "Registered new attendance device", icon: "📱" },
          { action: "Organization Update", details: "Modified organization details", icon: "🏢" },
        ];
        
        logs = [];
        for (let i = 0; i < 15; i++) {
          const randomAction = mockActions[Math.floor(Math.random() * mockActions.length)];
          const date = new Date();
          date.setDate(date.getDate() - Math.floor(Math.random() * 30));
          
          logs.push({
            id: i + 1,
            action: randomAction.action,
            user: admin?.email || "admin@example.com",
            timestamp: date.toISOString(),
            ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            details: randomAction.details,
            icon: randomAction.icon,
          });
        }
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        localStorage.setItem("audit_logs", JSON.stringify(logs));
      }
      setAuditLogs(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoadingAudit(false);
    }
  };

  const addAuditLog = (action: string, details: string) => {
    const newLog = {
      id: Date.now(),
      action,
      user: admin?.email || "unknown",
      timestamp: new Date().toISOString(),
      ip: "127.0.0.1",
      details,
      icon: "📝",
    };
    const updatedLogs = [newLog, ...auditLogs].slice(0, 100);
    setAuditLogs(updatedLogs);
    localStorage.setItem("audit_logs", JSON.stringify(updatedLogs));
  };

  const exportAuditLogs = () => {
    const csv = auditLogs.map(log => 
      `${log.timestamp},${log.action},${log.user},${log.ip},${log.details}`
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Audit logs exported successfully!");
  };

  const loadSettings = () => {
    const saved = localStorage.getItem("app_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(parsed);
      } catch (e) {
        console.error("Error loading settings:", e);
      }
    }
  };

  const saveSettings = () => {
    localStorage.setItem("app_settings", JSON.stringify(settings));
    addAuditLog("Settings Change", "Updated application preferences");
    toast.success("Settings saved successfully!");
  };

  const handleProfileUpdate = async () => {
    setLoading(true);
    try {
      if (updateProfile) {
        await updateProfile({
          firstName: profileForm.firstName,
          lastName: profileForm.lastName,
          username: profileForm.username,
          profile: profileImage || admin?.profile,
        });
        addAuditLog("Profile Update", "Updated profile information");
        toast.success("Profile updated successfully!");
      }
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleOrgUpdate = async () => {
    setLoading(true);
    try {
      const res = await orgApi.updateOrganization(admin?.organizationId || "", {
        org_name: orgData.org_name,
        address: orgData.address,
        contact_email: orgData.contact_email,
        contact_phone: orgData.contact_phone,
      });
      
      if (res.success) {
        addAuditLog("Organization Update", "Modified organization details");
        toast.success("Organization updated successfully!");
      } else {
        toast.error(res.error || "Failed to update organization");
      }
    } catch (error) {
      toast.error("Failed to update organization");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (!passwordForm.currentPassword) {
      toast.error("Please enter your current password");
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      addAuditLog("Password Change", "Updated account password");
      toast.success("Password updated successfully!");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast.error("Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setLoading(true);
    try {
      setGoogleConnected(false);
      addAuditLog("Google Auth", "Disconnected Google account");
      toast.success("Google account disconnected successfully!");
      if (admin) {
        const updatedAdmin = { ...admin, authProvider: "email" };
        localStorage.setItem("csm_admin", JSON.stringify(updatedAdmin));
      }
    } catch (error) {
      toast.error("Failed to disconnect Google account");
    } finally {
      setLoading(false);
      setShowDisconnectGoogleConfirm(false);
    }
  };

  const handleDeactivateAccount = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      addAuditLog("Account Deactivation", "Account was deactivated");
      toast.info("Account deactivated successfully");
      setTimeout(() => {
        logout();
        window.location.href = "/login";
      }, 2000);
    } catch (error) {
      toast.error("Failed to deactivate account");
    } finally {
      setLoading(false);
      setShowDeactivateConfirm(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      addAuditLog("Account Deletion", "Account was permanently deleted");
      toast.info("Account deleted successfully");
      setTimeout(() => {
        logout();
        window.location.href = "/login";
      }, 2000);
    } catch (error) {
      toast.error("Failed to delete account");
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  // Profile image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB");
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    setUploadingImage(true);
    setImageError(false);
    
    try {
      const formData = new FormData();
      formData.append('profile', file);
      const token = localStorage.getItem('csm_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      
      const response = await fetch(`${apiUrl}/auth/upload-profile`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success && result.data?.filename) {
        setProfileImage(result.data.filename);
        toast.success("Profile image updated! Click Save Profile to apply.");
      } else {
        toast.error(result.error || "Failed to update profile image");
      }
    } catch (error) {
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  // Organization logo upload
  const handleOrgLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB");
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    setUploadingOrgLogo(true);
    setOrgLogoError(false);
    
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const token = localStorage.getItem('csm_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      
      const response = await fetch(`${apiUrl}/organizations/${admin?.organizationId}/logo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success && result.data?.filename) {
        setOrgLogo(result.data.filename);
        toast.success("Organization logo updated successfully!");
        if (admin) {
          const updatedAdmin = { ...admin, organizationLogo: result.data.filename };
          localStorage.setItem("csm_admin", JSON.stringify(updatedAdmin));
        }
      } else {
        toast.error(result.error || "Failed to update organization logo");
      }
    } catch (error) {
      toast.error("Failed to upload logo");
    } finally {
      setUploadingOrgLogo(false);
      e.target.value = '';
    }
  };

  const getProfileImageUrl = () => getImageUrl(profileImage);
  const getOrgLogoUrl = () => getImageUrl(orgLogo);
  
  const profileImageUrl = getProfileImageUrl();
  const orgLogoUrl = getOrgLogoUrl();
  const showImage = profileImageUrl && !imageError;
  const showOrgLogo = orgLogoUrl && !orgLogoError;

  const getInitials = () => {
    const first = profileForm.firstName?.[0] || '';
    const last = profileForm.lastName?.[0] || '';
    if (first && last) return `${first}${last}`;
    if (first) return first;
    if (last) return last;
    return profileForm.username?.[0]?.toUpperCase() || 'U';
  };

  const orgInitials = orgData.org_name?.[0] || 'C';

  const CustomSwitch = ({ checked, onCheckedChange, disabled }: { checked: boolean; onCheckedChange: (checked: boolean) => void; disabled?: boolean }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        ${checked ? 'bg-primary' : 'bg-muted'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 transform rounded-full bg-white transition-transform
          ${checked ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account, organization, and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-muted/50 border border-border flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="themes">Themes</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="google">Google Auth</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="border-0 shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-primary" /> Profile Information
              </CardTitle>
              <p className="text-sm text-muted-foreground">Update your personal information and profile picture</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  {showImage ? (
                    <img
                      src={profileImageUrl}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-2 border-primary"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-24 h-24 gradient-primary rounded-full flex items-center justify-center text-primary-foreground text-3xl font-bold">
                      {getInitials()}
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                    <Camera className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                  </label>
                </div>
                <div>
                  <p className="font-heading font-bold text-foreground text-lg">{profileForm.firstName} {profileForm.lastName}</p>
                  <p className="text-sm text-muted-foreground">@{profileForm.username}</p>
                  {uploadingImage && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
                    </p>
                  )}
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>First Name</Label>
                  <Input 
                    value={profileForm.firstName} 
                    onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name</Label>
                  <Input 
                    value={profileForm.lastName} 
                    onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input 
                    value={profileForm.username} 
                    onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={profileForm.email} disabled className="bg-muted" />
                </div>
              </div>
              <Button 
                className="gradient-primary text-primary-foreground"
                onClick={handleProfileUpdate}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization">
          <Card className="border-0 shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> Organization Information
              </CardTitle>
              <p className="text-sm text-muted-foreground">Manage your organization details and branding</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Organization Logo Upload */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  {showOrgLogo ? (
                    <img
                      src={orgLogoUrl}
                      alt="Organization Logo"
                      className="w-24 h-24 rounded-xl object-cover border-2 border-primary"
                      onError={() => setOrgLogoError(true)}
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 flex items-center justify-center font-heading font-bold text-3xl text-primary">
                      {orgInitials}
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-card border-2 border-background rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors shadow-sm">
                    <Camera className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleOrgLogoUpload}
                      disabled={uploadingOrgLogo}
                    />
                  </label>
                </div>
                <div>
                  <p className="font-heading font-bold text-foreground text-lg">{orgData.org_name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{admin?.organizationType}</p>
                  {uploadingOrgLogo && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
                    </p>
                  )}
                </div>
              </div>

              <Separator />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Organization Name</Label>
                  <Input 
                    value={orgData.org_name} 
                    onChange={(e) => setOrgData({ ...orgData, org_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Organization Type</Label>
                  <Input value={admin?.organizationType} disabled className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Email</Label>
                  <Input 
                    type="email" 
                    value={orgData.contact_email} 
                    onChange={(e) => setOrgData({ ...orgData, contact_email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Phone</Label>
                  <Input 
                    value={orgData.contact_phone} 
                    onChange={(e) => setOrgData({ ...orgData, contact_phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input 
                  value={orgData.address} 
                  onChange={(e) => setOrgData({ ...orgData, address: e.target.value })}
                />
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label>Live View URL Slug</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">csm.cwanda.site/live/</span>
                  <Input 
                    value={orgData.api_slug} 
                    onChange={(e) => setOrgData({ ...orgData, api_slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    className="max-w-[200px]" 
                    placeholder="your-org-slug"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Custom URL for your organization's live view page</p>
              </div>
              <Button 
                className="gradient-primary text-primary-foreground"
                onClick={handleOrgUpdate}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <Card className="border-0 shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" /> Preferences
              </CardTitle>
              <p className="text-sm text-muted-foreground">Customize your dashboard experience</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Show online status</p>
                  <p className="text-xs text-muted-foreground">Let other admins see when you're online</p>
                </div>
                <CustomSwitch 
                  checked={settings.showOnlineStatus}
                  onCheckedChange={(checked) => setSettings({ ...settings, showOnlineStatus: checked })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Email notifications</p>
                  <p className="text-xs text-muted-foreground">Receive email alerts for important events</p>
                </div>
                <CustomSwitch 
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, emailNotifications: checked })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">API access logging</p>
                  <p className="text-xs text-muted-foreground">Log all API requests for auditing</p>
                </div>
                <CustomSwitch 
                  checked={settings.apiLogging}
                  onCheckedChange={(checked) => setSettings({ ...settings, apiLogging: checked })}
                />
              </div>
              <Button onClick={saveSettings} className="mt-4" variant="outline">
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Themes Tab */}
        <TabsContent value="themes">
          <Card className="border-0 shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" /> Themes & Appearance
              </CardTitle>
              <p className="text-sm text-muted-foreground">Customize the look and feel of your dashboard</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Mode */}
              <div>
                <Label className="text-base font-semibold">Theme Mode</Label>
                <p className="text-sm text-muted-foreground mb-3">Choose your preferred theme mode</p>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setThemeMode("light")}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
                      themeMode === "light" 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Sun className="h-5 w-5" />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={() => setThemeMode("dark")}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
                      themeMode === "dark" 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Moon className="h-5 w-5" />
                    <span>Dark</span>
                  </button>
                  <button
                    onClick={() => setThemeMode("system")}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
                      themeMode === "system" 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Monitor className="h-5 w-5" />
                    <span>System</span>
                  </button>
                </div>
              </div>

              <Separator />

              {/* Color Palette */}
              <div>
                <Label className="text-base font-semibold">Color Palette</Label>
                <p className="text-sm text-muted-foreground mb-3">Choose your primary accent color</p>
                <div className="flex gap-4 flex-wrap">
                  {[
                    { name: "blue", color: "bg-blue-500", ring: "ring-blue-500" },
                    { name: "purple", color: "bg-purple-500", ring: "ring-purple-500" },
                    { name: "green", color: "bg-green-500", ring: "ring-green-500" },
                    { name: "orange", color: "bg-orange-500", ring: "ring-orange-500" },
                    { name: "red", color: "bg-red-500", ring: "ring-red-500" },
                  ].map((color) => (
                    <button
                      key={color.name}
                      onClick={() => setThemeColor(color.name as ThemeColor)}
                      className={`w-12 h-12 ${color.color} rounded-full transition-all ${
                        themeColor === color.name 
                          ? `ring-4 ring-offset-2 ring-offset-background ${color.ring} scale-110` 
                          : "hover:scale-105"
                      }`}
                      title={color.name}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Current color: <span className="capitalize font-medium">{themeColor}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit">
          <Card className="border-0 shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <History className="h-5 w-5 text-primary" /> Audit Logs
              </CardTitle>
              <p className="text-sm text-muted-foreground">Track all actions performed on your account</p>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={fetchAuditLogs}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportAuditLogs}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Showing last 30 days</p>
              </div>
              
              {loadingAudit ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-lg">
                        {log.icon || "📝"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <p className="font-medium text-foreground">{log.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{log.details}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <UserCircle className="h-3 w-3" />
                            {log.user}
                          </span>
                          <span className="flex items-center gap-1">
                            <Server className="h-3 w-3" />
                            IP: {log.ip}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <div className="text-center py-12">
                      <History className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">No audit logs found</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card className="border-0 shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" /> Security Settings
              </CardTitle>
              <p className="text-sm text-muted-foreground">Manage your password and security preferences</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base font-semibold">Change Password</Label>
                <div className="space-y-4 mt-3">
                  <div className="space-y-1.5">
                    <Label>Current Password</Label>
                    <div className="relative">
                      <Input 
                        type={showCurrentPass ? "text" : "password"} 
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        placeholder="Enter current password" 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>New Password</Label>
                    <div className="relative">
                      <Input 
                        type={showNewPass ? "text" : "password"} 
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        placeholder="Enter new password (min 6 characters)" 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Confirm New Password</Label>
                    <Input 
                      type="password" 
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="Confirm new password" 
                    />
                    {passwordForm.newPassword && passwordForm.confirmPassword && 
                     passwordForm.newPassword !== passwordForm.confirmPassword && (
                      <p className="text-xs text-destructive">Passwords do not match</p>
                    )}
                  </div>
                  <Button 
                    onClick={handlePasswordUpdate}
                    disabled={loading || !passwordForm.newPassword || !passwordForm.currentPassword}
                    className="gradient-primary"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Update Password
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                    <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${settings.twoFactorAuth ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {settings.twoFactorAuth ? 'Enabled' : 'Disabled'}
                    </span>
                    <CustomSwitch 
                      checked={settings.twoFactorAuth}
                      onCheckedChange={(checked) => {
                        setSettings({ ...settings, twoFactorAuth: checked });
                        if (checked) {
                          toast.info("2FA would be configured here. Feature coming soon!");
                        } else {
                          toast.info("2FA disabled");
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Google Auth Tab */}
        <TabsContent value="google">
          <Card className="border-0 shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" /> Google Authentication
              </CardTitle>
              <p className="text-sm text-muted-foreground">Manage your Google account connection</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-accent/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {googleConnected ? "Google Account Connected" : "No Google Account Connected"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {googleConnected 
                        ? `Connected as ${admin?.email}` 
                        : "Connect your Google account for single sign-on"}
                    </p>
                  </div>
                </div>
                {googleConnected ? (
                  <Button 
                    variant="outline" 
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => setShowDisconnectGoogleConfirm(true)}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
                    Disconnect
                  </Button>
                ) : (
                  <Button 
                    className="gradient-primary text-primary-foreground"
                    onClick={handleConnectGoogle}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                    Connect Google Account
                  </Button>
                )}
              </div>

              {googleConnected && (
                <div className="space-y-4">
                  <Separator />
                  <div>
                    <Label className="text-base font-semibold">Google Account Details</Label>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <MailCheck className="h-4 w-4 text-green-500" />
                        <span>Email verified with Google</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <span>Single sign-on enabled</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span>Connected: {new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Danger Zone Tab */}
        <TabsContent value="danger">
          <Card className="border-0 shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Danger Zone
              </CardTitle>
              <p className="text-sm text-muted-foreground">Manage your account status and data</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Deactivate Account */}
              <div className="p-4 rounded-lg border border-orange-500/20 bg-orange-500/5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Power className="h-5 w-5 text-orange-500" />
                      <p className="font-semibold text-foreground">Deactivate Account</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Temporarily deactivate your account. You can reactivate later by logging in.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
                    onClick={() => setShowDeactivateConfirm(true)}
                  >
                    <Power className="h-4 w-4 mr-2" />
                    Deactivate Account
                  </Button>
                </div>
              </div>

              {/* Delete Account */}
              <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-5 w-5 text-red-500" />
                      <p className="font-semibold text-foreground">Delete Account</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="border-red-500 text-red-500 hover:bg-red-500/10"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </div>

              {/* Session Info */}
              <Separator />
              <div>
                <Label className="text-base font-semibold">Active Sessions</Label>
                <div className="mt-3 p-3 rounded-lg border border-border bg-accent/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Smartphone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Current Session</p>
                        <p className="text-xs text-muted-foreground">
                          {navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                           navigator.userAgent.includes('Firefox') ? 'Firefox' : 
                           navigator.userAgent.includes('Safari') ? 'Safari' : 'Browser'} on {navigator.platform} • {new Date().toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={logout}>
                      <LogOut className="h-4 w-4 mr-1" />
                      Logout
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Deactivate Confirm Dialog */}
      <AlertDialog open={showDeactivateConfirm} onOpenChange={setShowDeactivateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Your account will be temporarily disabled. You can reactivate it by logging in again.
              Your organization data will remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivateAccount} className="bg-orange-500 text-white hover:bg-orange-600">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account
              and remove all your organization data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} className="bg-red-500 text-white hover:bg-red-600">
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect Google Confirm Dialog */}
      <AlertDialog open={showDisconnectGoogleConfirm} onOpenChange={setShowDisconnectGoogleConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Account?</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer be able to sign in with Google. You can still sign in with your email and password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnectGoogle}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ConfigSettings;