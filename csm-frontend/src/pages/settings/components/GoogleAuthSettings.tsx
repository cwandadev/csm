// csms-frontend/src/pages/settings/components/GoogleAuthSettings.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Mail, Link2, Unlink, Loader2, CheckCircle, AlertCircle, Info } from "lucide-react";
import { SettingsTabProps } from "../types";

declare global {
  interface Window {
    google?: any;
  }
}

const GoogleAuthSettings = ({ admin, updateProfile, onToast }: SettingsTabProps) => {
  const [loading, setLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [showGoogleConnect, setShowGoogleConnect] = useState(false);
  const [isGoogleInitialized, setIsGoogleInitialized] = useState(false);

  useEffect(() => {
    fetchGoogleStatus();
  }, [admin]);

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

  const fetchGoogleStatus = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('csm_token');
      const response = await fetch(`${apiUrl}/auth/google-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setGoogleConnected(result.data.connected);
      }
    } catch (error) {
      console.error("Error fetching Google status:", error);
    }
  };

  const handleGoogleConnectResponse = async (response: any) => {
    setLoading(true);
    try {
      const { credential } = response;
      if (!credential) throw new Error('No credential received');

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('csm_token');
      
      const res = await fetch(`${apiUrl}/auth/google-connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token: credential }),
      });

      const result = await res.json();
      
      if (result.success) {
        setGoogleConnected(true);
        onToast?.("Google account connected successfully!", "success");
        if (admin) {
          const updatedAdmin = { ...admin, authProvider: "both" };
          localStorage.setItem("csm_admin", JSON.stringify(updatedAdmin));
          updateProfile?.(updatedAdmin);
        }
      } else {
        throw new Error(result.error || "Failed to connect Google account");
      }
    } catch (error: any) {
      onToast?.(error.message || "Failed to connect Google account", "error");
    } finally {
      setLoading(false);
      setShowGoogleConnect(false);
    }
  };

  const handleConnectGoogle = () => {
    setShowGoogleConnect(true);
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm("Disconnect your Google account? You will no longer be able to sign in with Google.")) return;
    
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('csm_token');
      
      const res = await fetch(`${apiUrl}/auth/google-disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const result = await res.json();
      
      if (result.success) {
        setGoogleConnected(false);
        onToast?.("Google account disconnected successfully!", "success");
        if (admin) {
          const updatedAdmin = { ...admin, authProvider: "email" };
          localStorage.setItem("csm_admin", JSON.stringify(updatedAdmin));
          updateProfile?.(updatedAdmin);
        }
      } else {
        if (result.requiresPasswordSetup) {
          onToast?.("Please set a password first using 'Forgot Password' before disconnecting Google.", "warning");
        } else {
          throw new Error(result.error || "Failed to disconnect Google account");
        }
      }
    } catch (error: any) {
      onToast?.(error.message || "Failed to disconnect Google account", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
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
              {googleConnected && (
                <i className="bx bxs-check-circle text-xs text-green-600 dark:text-green-400 mt-1 mr-2" style={{ fontSize: '15px' }}/> 
            )}
              {googleConnected 
                ? `You can sign in with Google using ${admin?.email}` 
                : "Connect your Google account to enable single sign-on"}
            </p>
            
          </div>
        </div>
        {googleConnected ? (
          <Button 
            variant="outline" 
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={handleDisconnectGoogle}
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
            <Label className="text-base font-semibold">Authentication Methods</Label>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Email & Password</p>
                    <p className="text-xs text-muted-foreground">Always enabled</p>
                  </div>
                </div>
                <div>
                <i className="bx bx-check text-green-500" style={{ fontSize: '30px' }}/>
                {/*<span className="text-xs text-green-500">Active ✓</span>*/}
              </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <svg className="h-4 w-4" fill="#4285F4" viewBox="0 0 24 24">
                      <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z"></path>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Google Sign-In</p>
                    <p className="text-xs text-muted-foreground"> Enabled - Google sign-in enabled for this account </p>
                  </div>
                </div>
                <div>
                {/*<span className="text-xs  mr-1 m">Connected</span>*/}
                <i className="bx bx-check-double text-green-500" style={{ fontSize: '30px' }}/>
              </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              <Info className="h-3 w-3 inline mr-1" />
              You can now sign in using either your email/password or Google account.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleAuthSettings;