// csms-frontend/src/pages/Login.tsx
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Mail, Lock, X, CheckCircle, AlertCircle, Info, Loader2, AlertTriangle, UserPlus } from "lucide-react";
import AuthBrandPanel from "@/components/AuthBrandPanel";

// Toast Component
const Toast = ({ message, type, onClose }: { message: string; type: "success" | "error" | "info" | "warning"; onClose: () => void }) => {
  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
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

declare global {
  interface Window {
    google?: any;
  }
}

const Login = () => {
  const { login, isLoading: authLoading, admin: contextAdmin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" | "warning" } | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleInitialized, setIsGoogleInitialized] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const buttonTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" | "warning") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    if (contextAdmin && contextAdmin.isVerified) {
      navigate('/dashboard', { replace: true });
    }
  }, [contextAdmin, navigate]);

  useEffect(() => {
    return () => {
      if (buttonTimeoutRef.current) {
        clearTimeout(buttonTimeoutRef.current);
      }
    };
  }, []);

  const initializeGoogleSignIn = () => {
    if (typeof window === 'undefined') return;

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    
    const setupClient = () => {
      if (window.google && !isGoogleInitialized) {
        try {
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          setIsGoogleInitialized(true);
        } catch (err) {
          console.error('Failed to initialize Google client:', err);
        }
      }
    };

    if (existingScript) {
      if (window.google) {
        setupClient();
      } else {
        const checkGoogle = setInterval(() => {
          if (window.google) {
            clearInterval(checkGoogle);
            setupClient();
          }
        }, 100);
        setTimeout(() => clearInterval(checkGoogle), 5000);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = setupClient;
    script.onerror = () => {
      showToast("Failed to load Google Sign-In. Please refresh the page.", "error");
    };
    document.body.appendChild(script);
  };

  useEffect(() => {
    initializeGoogleSignIn();
  }, []);

  const handleGoogleCredentialResponse = async (response: any) => {
    if (googleLoading) return;
    setGoogleLoading(true);
    
    try {
      const { credential } = response;
      if (!credential) {
        throw new Error('No credential received from Google');
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const res = await fetch(`${apiUrl}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: credential }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      const result = await res.json();

      // Handle 404 - Account not found
      if (res.status === 404) {
        showToast("No account found. Please create an account first.", "warning");
        if (result.email) {
          sessionStorage.setItem('google_email', result.email);
          sessionStorage.setItem('google_name', result.name || '');
        }
        setTimeout(() => {
          navigate('/register', { replace: true });
        }, 1500);
        return;
      }

      // Handle 403 - Google login not enabled for this account
      if (res.status === 403) {
        showToast(result.error || "Google login is not enabled for this account. Please use email/password to login, then enable Google authentication in settings.", "warning");
        return;
      }

      if (!res.ok) {
        throw new Error(result.error || `Authentication failed`);
      }

      if (!result.success) {
        throw new Error(result.error || 'Google sign-in failed');
      }

      // Store tokens
      if (result.data?.token) {
        localStorage.setItem('csm_token', result.data.token);
      }
      
      if (result.data?.refreshToken) {
        localStorage.setItem('csm_refresh_token', result.data.refreshToken);
      }
      
      const adminData = result.data?.admin || result.data?.user;
      
      if (adminData) {
        localStorage.setItem('csm_admin', JSON.stringify(adminData));
        showToast(`Welcome${adminData.firstName ? ' ' + adminData.firstName : ''}!`, "success");
        
        setTimeout(() => {
          if (adminData.isVerified === false) {
            window.location.href = '/verify-email';
          } else {
            window.location.href = '/dashboard';
          }
        }, 500);
      } else {
        throw new Error('No user data received from server');
      }
      
    } catch (err: any) {
      console.error('Google auth error:', err);
      
      if (err.name === 'AbortError') {
        showToast("Request timed out. Please try again.", "error");
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('network')) {
        showToast("Cannot connect to server. Please check your connection.", "error");
      } else {
        showToast(err.message || "Google sign-in failed. Please try again.", "error");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    if (googleLoading || buttonDisabled) return;
    
    if (buttonTimeoutRef.current) {
      clearTimeout(buttonTimeoutRef.current);
    }
    
    setButtonDisabled(true);
    
    buttonTimeoutRef.current = setTimeout(() => {
      setButtonDisabled(false);
      buttonTimeoutRef.current = null;
    }, 8000);
    
    if (!isGoogleInitialized) {
      showToast("Initializing Google Sign-In, please wait...", "info");
      initializeGoogleSignIn();
      setTimeout(() => {
        if (window.google && isGoogleInitialized) {
          try {
            window.google.accounts.id.prompt();
          } catch (err) {
            showToast("Unable to show Google Sign-In. Please refresh the page.", "error");
          }
        } else {
          showToast("Google Sign-In is still loading. Please try again.", "warning");
        }
      }, 1000);
    } else if (window.google) {
      try {
        window.google.accounts.id.prompt();
      } catch (err) {
        showToast("Unable to show Google Sign-In. Please refresh the page.", "error");
      }
    } else {
      showToast("Google Sign-In not available. Please refresh the page.", "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      showToast("Please enter your email or username", "warning");
      return;
    }
    
    if (!password.trim()) {
      showToast("Please enter your password", "warning");
      return;
    }

    try {
      const loggedAdmin = await login(email, password);
      
      if (loggedAdmin) {
        showToast(`Welcome back, ${loggedAdmin.firstName || loggedAdmin.email}!`, "success");
        
        setTimeout(() => {
          if (loggedAdmin.isVerified === false) {
            navigate('/verify-email', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }, 1000);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      
      const errorMessage = err.message || "";
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
        showToast("Cannot connect to server. Please check your connection.", "error");
      } else if (errorMessage.includes('Invalid credentials')) {
        showToast("Invalid credentials. Please try again.", "error");
      } else if (errorMessage.includes('verify your email')) {
        showToast("Please verify your email before logging in.", "warning");
      } else {
        showToast(errorMessage || "Login failed. Please try again.", "error");
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <AuthBrandPanel />
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden text-center">
            <div className="mx-auto w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center mb-3 shadow-lg">
              <span className="text-primary-foreground font-heading font-bold text-xl">C</span>
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-heading font-bold text-foreground">Welcome Back</h1>
            <p className="text-muted-foreground text-sm mt-1 font-body">Sign in to your CSM dashboard</p>
          </div>

          <Button
            variant="outline"
            className="w-full h-11 font-body border-border hover:bg-muted relative"
            onClick={handleGoogleLogin}
            disabled={authLoading || buttonDisabled}
          >
            {buttonDisabled ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Please wait...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </>
            )}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground font-body">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="font-body">Email or Username</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="admin@organization.com"
                  className="pl-10 h-11 font-body"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={authLoading}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="font-body">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline font-body">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-11 font-body"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={authLoading}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full gradient-primary text-primary-foreground font-semibold h-11 font-body"
              disabled={authLoading}
            >
              {authLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Sign In</span>
                </div>
              )}
            </Button>
          </form>

          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground font-body">
              Don't have an account?{" "}
              <Link to="/register" className="text-primary font-medium hover:underline">
                Get Started Free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;