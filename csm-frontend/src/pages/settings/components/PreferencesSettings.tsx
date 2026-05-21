// csms-frontend/src/pages/settings/components/PreferencesSettings.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Bell,
  BellRing,
  Mail,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Activity,
  Database,
  Server,
  Wifi,
  Smartphone,
  Users,
  Calendar,
  Clock,
  Loader2,
  CheckCircle,
  AlertCircle,
  Info,
  Moon,
  Sun,
  Monitor,
  Languages,
  Volume2,
  VolumeX,
  Download,
  Upload,
  RefreshCw,
  Shield,
  Fingerprint,
  CreditCard,
  FileText,
  BarChart,
  PieChart,
  TrendingUp,
  Zap,
  Coffee,
  Gift,
  Star,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { SettingsTabProps } from "../types";

interface Preferences {
  // General
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: "12h" | "24h";
  
  // Notifications
  emailNotifications: boolean;
  pushNotifications: boolean;
  soundEnabled: boolean;
  desktopAlerts: boolean;
  
  // Privacy
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  allowMessages: boolean;
  
  // Dashboard
  defaultView: "grid" | "list";
  compactMode: boolean;
  showRecentActivity: boolean;
  showStats: boolean;
  refreshInterval: number;
  
  // Data & Sync
  autoSync: boolean;
  syncFrequency: "realtime" | "hourly" | "daily";
  cacheData: boolean;
  
  // Security
  require2FA: boolean;
  sessionTimeout: number;
  loginAlerts: boolean;
  
  // Accessibility
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: "small" | "medium" | "large";
}

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "it", label: "Italiano", flag: "🇮🇹" },
  { value: "pt", label: "Português", flag: "🇵🇹" },
  { value: "ru", label: "Русский", flag: "🇷🇺" },
  { value: "zh", label: "中文", flag: "🇨🇳" },
  { value: "ja", label: "日本語", flag: "🇯🇵" },
  { value: "ko", label: "한국어", flag: "🇰🇷" },
  { value: "ar", label: "العربية", flag: "🇸🇦" },
  { value: "hi", label: "हिन्दी", flag: "🇮🇳" },
];

const TIMEZONE_OPTIONS = [
  "UTC-12:00", "UTC-11:00", "UTC-10:00", "UTC-09:00", "UTC-08:00", "UTC-07:00", "UTC-06:00", "UTC-05:00", "UTC-04:00", "UTC-03:00", "UTC-02:00", "UTC-01:00",
  "UTC+00:00", "UTC+01:00", "UTC+02:00", "UTC+03:00", "UTC+04:00", "UTC+05:00", "UTC+06:00", "UTC+07:00", "UTC+08:00", "UTC+09:00", "UTC+10:00", "UTC+11:00", "UTC+12:00"
];

const DATE_FORMAT_OPTIONS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY", example: "12/31/2024" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY", example: "31/12/2024" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD", example: "2024-12-31" },
  { value: "DD MMM YYYY", label: "DD MMM YYYY", example: "31 Dec 2024" },
  { value: "MMMM DD, YYYY", label: "MMMM DD, YYYY", example: "December 31, 2024" },
];

const REFRESH_INTERVALS = [
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
  { value: 1800, label: "30 minutes" },
  { value: 3600, label: "1 hour" },
];

const SESSION_TIMEOUTS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 480, label: "8 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "24 hours" },
];

const PreferencesSettings = ({ admin, onToast }: SettingsTabProps) => {
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({
    language: "en",
    timezone: "UTC+00:00",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
    emailNotifications: true,
    pushNotifications: true,
    soundEnabled: true,
    desktopAlerts: true,
    showOnlineStatus: true,
    showLastSeen: true,
    allowMessages: true,
    defaultView: "grid",
    compactMode: false,
    showRecentActivity: true,
    showStats: true,
    refreshInterval: 30,
    autoSync: true,
    syncFrequency: "realtime",
    cacheData: true,
    require2FA: false,
    sessionTimeout: 30,
    loginAlerts: true,
    highContrast: false,
    reducedMotion: false,
    fontSize: "medium",
  });

  const [originalPreferences, setOriginalPreferences] = useState<Preferences | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = () => {
    const saved = localStorage.getItem("user_preferences");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPreferences({ ...preferences, ...parsed });
        setOriginalPreferences({ ...preferences, ...parsed });
      } catch (e) {
        console.error("Error loading preferences:", e);
        setOriginalPreferences({ ...preferences });
      }
    } else {
      setOriginalPreferences({ ...preferences });
    }
  };

  const checkForChanges = (newPrefs: Preferences) => {
    if (originalPreferences) {
      const hasAnyChanges = Object.keys(newPrefs).some(
        key => newPrefs[key as keyof Preferences] !== originalPreferences[key as keyof Preferences]
      );
      setHasChanges(hasAnyChanges);
    }
  };

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    checkForChanges(newPrefs);
  };

  const savePreferences = async () => {
    setLoading(true);
    try {
      localStorage.setItem("user_preferences", JSON.stringify(preferences));
      
      // Send to backend if needed
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('csm_token');
      
      await fetch(`${apiUrl}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(preferences),
      });
      
      setOriginalPreferences({ ...preferences });
      setHasChanges(false);
      toast.success("Preferences saved successfully!");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setLoading(false);
    }
  };

  const resetPreferences = () => {
    if (originalPreferences) {
      setPreferences({ ...originalPreferences });
      setHasChanges(false);
      toast.info("Preferences reset to last saved state");
    }
  };

  const PreferenceRow = ({ 
    icon, 
    title, 
    description, 
    field, 
    value, 
    type = "switch",
    options = [],
    badge
  }: { 
    icon: React.ReactNode; 
    title: string; 
    description: string; 
    field: keyof Preferences; 
    value: any; 
    type?: "switch" | "select" | "radio";
    options?: { value: any; label: string }[];
    badge?: { text: string; variant?: "default" | "secondary" | "destructive" | "outline" };
  }) => (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">{title}</p>
            {badge && <Badge variant={badge.variant || "secondary"} className="text-xs">{badge.text}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {type === "switch" ? (
        <Switch 
          checked={value} 
          onCheckedChange={(checked) => updatePreference(field, checked as any)}
        />
      ) : type === "select" && (
        <Select value={value} onValueChange={(v) => updatePreference(field, v as any)}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Preferences</h2>
            <p className="text-sm text-muted-foreground">Customize your dashboard experience</p>
          </div>
        </div>
        {hasChanges && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetPreferences} disabled={loading}>
              Reset
            </Button>
            <Button size="sm" className="gradient-primary" onClick={savePreferences} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {hasChanges && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-amber-600 dark:text-amber-400">You have unsaved changes</span>
          </div>
        </div>
      )}

      {/* General Section */}
      <Card className="border-0 shadow-sm bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Globe className="h-5 w-5 text-primary" /> General Settings
          </CardTitle>
          <p className="text-sm text-muted-foreground">Language, timezone, and regional preferences</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <PreferenceRow
            icon={<Languages className="h-4 w-4" />}
            title="Language"
            description="Choose your preferred language"
            field="language"
            value={preferences.language}
            type="select"
            options={LANGUAGE_OPTIONS}
          />
          <Separator />
          <PreferenceRow
            icon={<Clock className="h-4 w-4" />}
            title="Timezone"
            description="Set your local timezone"
            field="timezone"
            value={preferences.timezone}
            type="select"
            options={TIMEZONE_OPTIONS.map(tz => ({ value: tz, label: tz }))}
          />
          <Separator />
          <PreferenceRow
            icon={<Calendar className="h-4 w-4" />}
            title="Date Format"
            description="How dates are displayed"
            field="dateFormat"
            value={preferences.dateFormat}
            type="select"
            options={DATE_FORMAT_OPTIONS}
          />
          <Separator />
          <PreferenceRow
            icon={<Clock className="h-4 w-4" />}
            title="Time Format"
            description="12-hour or 24-hour clock"
            field="timeFormat"
            value={preferences.timeFormat}
            type="select"
            options={[
              { value: "12h", label: "12-hour (12:30 PM)" },
              { value: "24h", label: "24-hour (13:30)" },
            ]}
          />
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <Card className="border-0 shadow-sm bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Bell className="h-5 w-5 text-primary" /> Notifications
          </CardTitle>
          <p className="text-sm text-muted-foreground">How you receive alerts and updates</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <PreferenceRow
            icon={<Mail className="h-4 w-4" />}
            title="Email Notifications"
            description="Receive important updates via email"
            field="emailNotifications"
            value={preferences.emailNotifications}
          />
          <Separator />
          <PreferenceRow
            icon={<BellRing className="h-4 w-4" />}
            title="Push Notifications"
            description="Get real-time alerts in your browser"
            field="pushNotifications"
            value={preferences.pushNotifications}
          />
          <Separator />
          <PreferenceRow
            icon={<Volume2 className="h-4 w-4" />}
            title="Sound Effects"
            description="Play sounds for notifications"
            field="soundEnabled"
            value={preferences.soundEnabled}
          />
          <Separator />
          <PreferenceRow
            icon={<Monitor className="h-4 w-4" />}
            title="Desktop Alerts"
            description="Show popup alerts on desktop"
            field="desktopAlerts"
            value={preferences.desktopAlerts}
          />
        </CardContent>
      </Card>

      {/* Privacy Section */}
      <Card className="border-0 shadow-sm bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Lock className="h-5 w-5 text-primary" /> Privacy & Visibility
          </CardTitle>
          <p className="text-sm text-muted-foreground">Control your online presence</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <PreferenceRow
            icon={<Eye className="h-4 w-4" />}
            title="Show Online Status"
            description="Let other admins see when you're online"
            field="showOnlineStatus"
            value={preferences.showOnlineStatus}
          />
          <Separator />
          <PreferenceRow
            icon={<Clock className="h-4 w-4" />}
            title="Show Last Seen"
            description="Display when you were last active"
            field="showLastSeen"
            value={preferences.showLastSeen}
          />
          <Separator />
          <PreferenceRow
            icon={<Users className="h-4 w-4" />}
            title="Allow Messages"
            description="Receive direct messages from other admins"
            field="allowMessages"
            value={preferences.allowMessages}
          />
        </CardContent>
      </Card>

      {/* Dashboard Section */}
      <Card className="border-0 shadow-sm bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" /> Dashboard Display
          </CardTitle>
          <p className="text-sm text-muted-foreground">Customize how your dashboard looks</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <PreferenceRow
            icon={<LayoutGrid className="h-4 w-4" />}
            title="Default View"
            description="Grid or list layout"
            field="defaultView"
            value={preferences.defaultView}
            type="select"
            options={[
              { value: "grid", label: "Grid View" },
              { value: "list", label: "List View" },
            ]}
          />
          <Separator />
          <PreferenceRow
            icon={<Zap className="h-4 w-4" />}
            title="Compact Mode"
            description="Reduce spacing for more content"
            field="compactMode"
            value={preferences.compactMode}
          />
          <Separator />
          <PreferenceRow
            icon={<Activity className="h-4 w-4" />}
            title="Show Recent Activity"
            description="Display recent actions on dashboard"
            field="showRecentActivity"
            value={preferences.showRecentActivity}
          />
          <Separator />
          <PreferenceRow
            icon={<BarChart className="h-4 w-4" />}
            title="Show Statistics"
            description="Display usage statistics on dashboard"
            field="showStats"
            value={preferences.showStats}
          />
          <Separator />
          <PreferenceRow
            icon={<RefreshCw className="h-4 w-4" />}
            title="Refresh Interval"
            description="How often data auto-refreshes"
            field="refreshInterval"
            value={preferences.refreshInterval}
            type="select"
            options={REFRESH_INTERVALS}
          />
        </CardContent>
      </Card>

      {/* Data & Sync Section */}
      <Card className="border-0 shadow-sm bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Database className="h-5 w-5 text-primary" /> Data & Sync
          </CardTitle>
          <p className="text-sm text-muted-foreground">Manage how data is synchronized</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <PreferenceRow
            icon={<RefreshCw className="h-4 w-4" />}
            title="Auto-Sync"
            description="Automatically sync data with server"
            field="autoSync"
            value={preferences.autoSync}
          />
          <Separator />
          <PreferenceRow
            icon={<Database className="h-4 w-4" />}
            title="Sync Frequency"
            description="How often data is synced"
            field="syncFrequency"
            value={preferences.syncFrequency}
            type="select"
            options={[
              { value: "realtime", label: "Real-time" },
              { value: "hourly", label: "Hourly" },
              { value: "daily", label: "Daily" },
            ]}
          />
          <Separator />
          <PreferenceRow
            icon={<Server className="h-4 w-4" />}
            title="Cache Data"
            description="Store data locally for faster access"
            field="cacheData"
            value={preferences.cacheData}
          />
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card className="border-0 shadow-sm bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-primary" /> Security Preferences
          </CardTitle>
          <p className="text-sm text-muted-foreground">Additional security settings</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <PreferenceRow
            icon={<Fingerprint className="h-4 w-4" />}
            title="Require 2FA"
            description="Two-factor authentication for login"
            field="require2FA"
            value={preferences.require2FA}
            badge={{ text: "Recommended", variant: "default" }}
          />
          <Separator />
          <PreferenceRow
            icon={<Clock className="h-4 w-4" />}
            title="Session Timeout"
            description="Auto logout after inactivity"
            field="sessionTimeout"
            value={preferences.sessionTimeout}
            type="select"
            options={SESSION_TIMEOUTS}
          />
          <Separator />
          <PreferenceRow
            icon={<Mail className="h-4 w-4" />}
            title="Login Alerts"
            description="Email notifications for new logins"
            field="loginAlerts"
            value={preferences.loginAlerts}
          />
        </CardContent>
      </Card>

      {/* Accessibility Section */}
      <Card className="border-0 shadow-sm bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Eye className="h-5 w-5 text-primary" /> Accessibility
          </CardTitle>
          <p className="text-sm text-muted-foreground">Make the platform easier to use</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <PreferenceRow
            icon={<Sun className="h-4 w-4" />}
            title="High Contrast"
            description="Increase color contrast for better visibility"
            field="highContrast"
            value={preferences.highContrast}
          />
          <Separator />
          <PreferenceRow
            icon={<VolumeX className="h-4 w-4" />}
            title="Reduced Motion"
            description="Minimize animations and transitions"
            field="reducedMotion"
            value={preferences.reducedMotion}
          />
          <Separator />
          <PreferenceRow
            icon={<Monitor className="h-4 w-4" />}
            title="Font Size"
            description="Adjust text size for better readability"
            field="fontSize"
            value={preferences.fontSize}
            type="select"
            options={[
              { value: "small", label: "Small" },
              { value: "medium", label: "Medium" },
              { value: "large", label: "Large" },
            ]}
          />
        </CardContent>
      </Card>

      {/* Export/Import Section */}
      <Card className="border-0 shadow-sm bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Download className="h-5 w-5 text-primary" /> Data Export/Import
          </CardTitle>
          <p className="text-sm text-muted-foreground">Manage your preferences data</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Download className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Export Preferences</p>
                <p className="text-xs text-muted-foreground">Download your settings as a JSON file</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const dataStr = JSON.stringify(preferences, null, 2);
                const blob = new Blob([dataStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `csm-preferences-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Preferences exported!");
              }}
            >
              Export
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Import Preferences</p>
                <p className="text-xs text-muted-foreground">Load settings from a JSON file</p>
              </div>
            </div>
            <input
              type="file"
              accept=".json"
              className="hidden"
              id="import-preferences"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const imported = JSON.parse(event.target?.result as string);
                      setPreferences({ ...preferences, ...imported });
                      setHasChanges(true);
                      toast.success("Preferences imported! Click Save to apply.");
                    } catch (error) {
                      toast.error("Invalid preferences file");
                    }
                  };
                  reader.readAsText(file);
                }
                e.target.value = '';
              }}
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => document.getElementById("import-preferences")?.click()}
            >
              Import
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button (sticky) */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button 
            className="gradient-primary shadow-lg"
            onClick={savePreferences} 
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save All Changes
          </Button>
        </div>
      )}
    </div>
  );
};

// Add missing import
import { LayoutGrid } from "lucide-react";

export default PreferencesSettings;