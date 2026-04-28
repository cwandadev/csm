// csms-frontend/src/pages/Login.tsx
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Mail, Lock, X, CheckCircle, AlertCircle, Info, Loader2, AlertTriangle, UserPlus } from "lucide-react";
import AuthBrandPanel from "@/components/AuthBrandPanel";

// Toast Component with better styling
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
  const { login, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" | "warning" } | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleInitialized, setIsGoogleInitialized] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const buttonTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" | "warning") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (buttonTimeoutRef.current) {
        clearTimeout(buttonTimeoutRef.current);
      }
    };
  }, []);

  // Handle Google credential response
  const handleGoogleCredentialResponse = async (response: any) => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setNetworkError(false);
    
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

      // Handle 404 specifically - Account not found
      if (res.status === 404) {
        showToast(
          "No account found with this Google email. Please sign up first.", 
          "warning"
        );
        setGoogleLoading(false);
        setButtonDisabled(false);
        return;
      }

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Authentication failed. Please try again.');
        } else if (res.status === 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`Error: ${res.status}`);
        }
      }

      if (!result.success) {
        // Check for specific error messages indicating no account
        if (result.error?.toLowerCase().includes('not found') || 
            result.error?.toLowerCase().includes('no account') ||
            result.error?.toLowerCase().includes('does not exist')) {
          showToast(
            "No account found with this Google email. Please sign up first.", 
            "warning"
          );
          setGoogleLoading(false);
          setButtonDisabled(false);
          return;
        } else if (result.error?.includes('token') || result.error?.includes('credential')) {
          throw new Error('Google authentication failed. Please try again.');
        } else if (result.error?.includes('network') || result.error?.includes('connection')) {
          throw new Error('Network error. Please check your internet connection.');
        } else {
          throw new Error(result.error || 'Google sign-in failed. Please try again.');
        }
      }

      // Store tokens
      if (result.data?.token) {
        localStorage.setItem('csm_token', result.data.token);
      }
      
      const admin = result.data?.admin;
      if (admin) {
        localStorage.setItem('csm_admin', JSON.stringify(admin));
        
        // Check if user needs org setup (new Google user)
        if (admin.needsOrgSetup && admin.authProvider === 'google') {
          showToast("Welcome! Please complete your organization setup.", "info");
          setTimeout(() => {
            navigate('/complete-setup', { replace: true });
          }, 1500);
        } else {
          showToast(`Welcome back, ${admin.firstName || admin.email}!`, "success");
          setTimeout(() => {
            if (admin.isVerified) {
              navigate('/dashboard', { replace: true });
            } else {
              navigate('/verify-email', { replace: true });
            }
          }, 1500);
        }
      }
    } catch (err: any) {
      console.error('Google auth error:', err);
      
      if (err.name === 'AbortError') {
        showToast("Request timed out. Please check your internet connection and try again.", "error");
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('network')) {
        showToast("Cannot connect to server. Please check if the backend is running and try again.", "error");
        setNetworkError(true);
      } else if (err.message?.includes('401') || err.message?.includes('unauthorized')) {
        showToast("Authentication failed. Please try again with a different Google account.", "warning");
      } else if (err.message?.includes('500')) {
        showToast("Server error. Our team has been notified. Please try again later.", "error");
      } else {
        showToast(err.message || "Google sign-in failed. Please try again.", "warning");
      }
    } finally {
      setGoogleLoading(false);
      if (buttonTimeoutRef.current) {
        clearTimeout(buttonTimeoutRef.current);
      }
      buttonTimeoutRef.current = setTimeout(() => {
        setButtonDisabled(false);
      }, 5000);
    }
  };

  // Initialize Google Sign-In
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
          showToast("Failed to initialize Google Sign-In. Please refresh the page.", "error");
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
      console.error('Failed to load Google script');
      showToast("Failed to load Google Sign-In. Please check your internet connection.", "error");
    };
    document.body.appendChild(script);
  };

  useEffect(() => {
    initializeGoogleSignIn();
  }, []);

  const handleGoogleLogin = () => {
    if (googleLoading || buttonDisabled) return;
    setButtonDisabled(true);
    
    if (!isGoogleInitialized) {
      showToast("Initializing Google Sign-In, please wait...", "info");
      initializeGoogleSignIn();
      setTimeout(() => {
        if (window.google && isGoogleInitialized) {
          try {
            window.google.accounts.id.prompt((notification: any) => {
              if (notification.isNotDisplayed()) {
                showToast("Please enable popups for this site to continue with Google.", "warning");
                setButtonDisabled(false);
              }
            });
          } catch (err) {
            showToast("Unable to show Google Sign-In. Please refresh the page.", "error");
            setButtonDisabled(false);
          }
        } else {
          showToast("Google Sign-In is still loading. Please try again in a moment.", "warning");
          setButtonDisabled(false);
        }
      }, 1000);
    } else if (window.google) {
      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed()) {
            if (notification.notDisplayedReason === 'opt_out_or_no_session') {
              showToast("Please sign in to your Google account first.", "info");
            } else if (notification.notDisplayedReason === 'invalid_client') {
              showToast("Google client configuration error. Please contact support.", "error");
            } else {
              showToast("Please enable popups for this site.", "warning");
            }
            setButtonDisabled(false);
          }
        });
      } catch (err) {
        showToast("Unable to show Google Sign-In. Please refresh the page.", "error");
        setButtonDisabled(false);
      }
    } else {
      showToast("Google Sign-In not available. Please try refreshing the page.", "error");
      setButtonDisabled(false);
    }
    
    if (buttonTimeoutRef.current) {
      clearTimeout(buttonTimeoutRef.current);
    }
    buttonTimeoutRef.current = setTimeout(() => {
      setButtonDisabled(false);
    }, 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNetworkError(false);
    
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
      showToast(`Welcome back, ${loggedAdmin.firstName}! Redirecting...`, "success");
      setTimeout(() => {
        if (loggedAdmin.isVerified) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/verify-email', { replace: true });
        }
      }, 1500);
    } catch (err: any) {
      console.error('Login error:', err);
      
      const errorMessage = err.message || "";
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network') || errorMessage.includes('Cannot connect')) {
        showToast("Cannot connect to server. Please check if the backend is running at http://localhost:3000", "error");
        setNetworkError(true);
      } 
      else if (errorMessage.includes('401') || errorMessage.includes('Invalid credentials') || errorMessage.includes('Invalid email')) {
        showToast("Invalid email/username or password. Please try again.", "error");
      }
      else if (errorMessage.includes('verify your email')) {
        showToast("Please verify your email before logging in. Check your inbox for the verification code.", "warning");
      }
      else if (errorMessage.includes('Account locked')) {
        showToast("Your account has been temporarily locked due to too many failed attempts. Please try again later.", "error");
      }
      else if (errorMessage.includes('No account found') || errorMessage.includes('not found')) {
        showToast("No account found with these credentials. Please check your email/username or sign up.", "warning");
      }
      else if (errorMessage.includes('Session expired')) {
        showToast("Please try logging in again.", "warning");
      }
      else {
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

          {networkError && (
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-3 text-center">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                You are having trouble connecting. Make sure you are connected to the 
                <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1 rounded mx-1">Internet</code>
              </p>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full h-11 font-body border-border hover:bg-muted relative"
            onClick={handleGoogleLogin}
            disabled={authLoading || googleLoading || buttonDisabled}
          >
            {(authLoading || googleLoading) ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {buttonDisabled && !googleLoading ? "Please wait..." : "Continue with Google"}
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
                  disabled={authLoading}
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
                  <i className='bx bx-log-in-circle' style={{ fontSize: '20px' }} />
                  <span>Sign In</span>
                </div>
              )}
            </Button>
          </form>

          <div className="text-center space-y-3">
            <p className="text-center text-sm text-muted-foreground font-body">
              Don't have an account?{" "}
              <Link to="/register" className="text-primary font-medium hover:underline">
                Get Started Free
              </Link>
            </p>
            
            {/* Helpful message for Google sign-in */}
            <div className="text-xs text-muted-foreground border-t border-border pt-3 mt-2">
              <p className="flex items-center justify-center gap-1">
                <UserPlus className="h-3 w-3" />
                New to CSM?{" "}
                <Link to="/register" className="text-primary hover:underline">
                  Create an account first
                </Link>
                {" "}before using Google Sign-In
              </p>
            </div>
            
            {networkError && (
              <p className="text-xs text-muted-foreground">
                Backend URL: {import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;