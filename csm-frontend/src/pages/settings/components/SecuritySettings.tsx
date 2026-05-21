// csms-frontend/src/pages/settings/components/SecuritySettings.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Shield, Lock, Eye, EyeOff, Loader2, Smartphone, LogOut, CheckCircle, AlertCircle } from "lucide-react";
import { authApi } from "@/lib/api";
import { SettingsTabProps } from "../types";

const SecuritySettings = ({ admin, onToast }: SettingsTabProps) => {
  const [loading, setLoading] = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    fetchSessions();
    loadTwoFactorStatus();
  }, []);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('csm_token');
      const response = await fetch(`${apiUrl}/auth/sessions`, { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      if (result.success) {
        setSessions(result.data);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadTwoFactorStatus = () => {
    const saved = localStorage.getItem("2fa_enabled");
    setTwoFactorEnabled(saved === "true");
  };

  const handlePasswordUpdate = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      onToast?.("New passwords do not match", "warning");
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      onToast?.("Password must be at least 6 characters", "warning");
      return;
    }

    if (!passwordForm.currentPassword) {
      onToast?.("Please enter your current password", "warning");
      return;
    }

    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('csm_token');
      const response = await fetch(`${apiUrl}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          current_password: passwordForm.currentPassword,
          new_password: passwordForm.newPassword
        })
      });
      
      const result = await response.json();
      if (result.success) {
        onToast?.("Password updated successfully!", "success");
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        onToast?.("Failed to update password", "error");
      }
    } catch (error) {
      onToast?.("Failed to update password", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('csm_token');
      await fetch(`${apiUrl}/auth/sessions/${sessionId}/revoke`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      onToast?.("Session revoked successfully", "success");
      fetchSessions();
    } catch (error) {
      onToast?.("Failed to revoke session", "error");
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!confirm("Revoke all other sessions? You will be logged out on all other devices.")) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('csm_token');
      await fetch(`${apiUrl}/auth/sessions/revoke-all`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      onToast?.("All other sessions revoked", "success");
      fetchSessions();
    } catch (error) {
      onToast?.("Failed to revoke sessions", "error");
    }
  };

  const handleToggleTwoFactor = async () => {
    if (!twoFactorEnabled) {
      onToast?.("2FA setup would begin here. Feature coming soon!", "info");
    } else {
      onToast?.("2FA disabled", "info");
      setTwoFactorEnabled(false);
      localStorage.setItem("2fa_enabled", "false");
    }
  };

  const getDeviceIcon = (userAgent: string) => {
    if (userAgent?.includes('Chrome')) return '🌐 Chrome';
    if (userAgent?.includes('Firefox')) return '🦊 Firefox';
    if (userAgent?.includes('Safari')) return '🧭 Safari';
    if (userAgent?.includes('Mobile')) return '📱 Mobile';
    return '💻 Browser';
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <div>
        <Label className="text-base font-semibold flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /> Change Password</Label>
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
              <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
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
              <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
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
          <Button onClick={handlePasswordUpdate} disabled={loading || !passwordForm.newPassword || !passwordForm.currentPassword} className="gradient-primary">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Update Password
          </Button>
        </div>
      </div>

      <Separator />

      {/* Two-Factor Authentication */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">Two-Factor Authentication</p>
            <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${twoFactorEnabled ? 'text-green-500' : 'text-muted-foreground'}`}>
            {twoFactorEnabled ? 'Enabled' : 'Disabled'}
          </span>
          <Switch checked={twoFactorEnabled} onCheckedChange={handleToggleTwoFactor} />
        </div>
      </div>

      <Separator />

      {/* Active Sessions */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <Label className="text-base font-semibold flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary" /> Active Sessions</Label>
          {sessions.length > 1 && (
            <Button variant="outline" size="sm" onClick={handleRevokeAllSessions}>
              <LogOut className="h-4 w-4 mr-2" /> Revoke All Others
            </Button>
          )}
        </div>
        
        {loadingSessions ? (
          <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                    {session.is_current ? '🟢' : '🟡'}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{getDeviceIcon(session.user_agent)}</p>
                    <p className="text-xs text-muted-foreground">IP: {session.ip_address} • {new Date(session.login_at).toLocaleString()}</p>
                    {session.is_current && <p className="text-xs text-green-500">Current session</p>}
                  </div>
                </div>
                {!session.is_current && (
                  <Button variant="ghost" size="sm" onClick={() => handleRevokeSession(session.id)}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">No active sessions found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SecuritySettings;