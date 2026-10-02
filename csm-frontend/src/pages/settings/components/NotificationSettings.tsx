// csms-frontend/src/pages/settings/components/NotificationSettings.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Bell, Mail, BellRing, AlertTriangle, Smartphone, Loader2, CheckCircle } from "lucide-react";
import { SettingsTabProps, NotificationPreferences } from "../types";

const NotificationSettings = ({ admin, onToast }: SettingsTabProps) => {
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: true,
    pushNotifications: true,
    marketingEmails: false,
    securityAlerts: true,
    attendanceAlerts: true,
    deviceAlerts: true,
    subscriptionAlerts: true,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = () => {
    const saved = localStorage.getItem("notification_preferences");
    if (saved) {
      try {
        setPreferences(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading preferences:", e);
      }
    }
  };

  const savePreferences = async () => {
    setLoading(true);
    try {
      localStorage.setItem("notification_preferences", JSON.stringify(preferences));
      
      // Send to backend if needed
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('csm_token');
      await fetch(`${apiUrl}/notifications/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(preferences)
      });
      
      onToast?.("Notification preferences saved!", "success");
    } catch (error) {
      onToast?.("Failed to save preferences", "error");
    } finally {
      setLoading(false);
    }
  };

  const NotificationRow = ({ icon, title, description, field, value }: any) => (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">{icon}</div>
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={value} onCheckedChange={(checked) => setPreferences({ ...preferences, [field]: checked })} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 rounded-lg bg-accent/30">
        <Bell className="h-8 w-8 text-primary" />
        <div>
          <p className="font-semibold">Stay Updated</p>
          <p className="text-sm text-muted-foreground">Choose how you want to receive notifications</p>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <NotificationRow
          icon={<Mail className="h-4 w-4 text-primary" />}
          title="Email Notifications"
          description="Receive important updates via email"
          field="emailNotifications"
          value={preferences.emailNotifications}
        />
        <NotificationRow
          icon={<Smartphone className="h-4 w-4 text-primary" />}
          title="Push Notifications"
          description="Get real-time alerts in your browser"
          field="pushNotifications"
          value={preferences.pushNotifications}
        />
      </div>

      <Separator />

      <div>
        <p className="text-sm font-semibold mb-3 flex items-center gap-2"><BellRing className="h-4 w-4" /> Alert Types</p>
        <div className="space-y-2">
          <NotificationRow
            icon={<Shield className="h-4 w-4 text-red-500" />}
            title="Security Alerts"
            description="Login attempts, password changes, and security events"
            field="securityAlerts"
            value={preferences.securityAlerts}
          />
          <NotificationRow
            icon={<Users className="h-4 w-4 text-blue-500" />}
            title="Attendance Alerts"
            description="User check-ins/outs and attendance updates"
            field="attendanceAlerts"
            value={preferences.attendanceAlerts}
          />
          <NotificationRow
            icon={<Smartphone className="h-4 w-4 text-green-500" />}
            title="Device Alerts"
            description="Device status changes and offline notifications"
            field="deviceAlerts"
            value={preferences.deviceAlerts}
          />
          <NotificationRow
            icon={<CreditCard className="h-4 w-4 text-purple-500" />}
            title="Subscription Alerts"
            description="Billing, payment, and plan updates"
            field="subscriptionAlerts"
            value={preferences.subscriptionAlerts}
          />
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between p-3 rounded-lg border border-border">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">Marketing & Updates</p>
            <p className="text-xs text-muted-foreground">Product updates, tips, and special offers</p>
          </div>
        </div>
        <Switch 
          checked={preferences.marketingEmails} 
          onCheckedChange={(checked) => setPreferences({ ...preferences, marketingEmails: checked })}
        />
      </div>

      <Button className="gradient-primary w-full" onClick={savePreferences} disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Preferences
      </Button>

      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center">
        <p className="text-xs text-muted-foreground">
          You can change these preferences at any time. Security alerts will always be sent regardless of your preferences.
        </p>
      </div>
    </div>
  );
};

// Import missing icons at top
import { Shield, Users, CreditCard } from "lucide-react";

export default NotificationSettings;