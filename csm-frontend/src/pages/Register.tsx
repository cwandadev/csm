// csms-frontend/src/pages/Register.tsx
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, User, Building2, CreditCard, CheckCircle, Loader2, Mail, Lock, Globe, Phone, MapPin, X, AlertCircle, Info, Camera, School, Briefcase } from "lucide-react";
import AuthBrandPanel from "@/components/AuthBrandPanel";
// Add missing icon imports at the top
import { Smartphone, Shield, Package, Fingerprint } from "lucide-react";

// Toast Component
const Toast = ({ message, type, onClose }: { message: string; type: "success" | "error" | "info"; onClose: () => void }) => {
  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />
  };

  const bgColors = {
    success: "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900",
    error: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900",
    info: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900"
  };

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 p-4 rounded-lg shadow-lg border ${bgColors[type]} animate-slide-in`}>
      {icons[type]}
      <p className="text-sm font-body text-foreground">{message}</p>
      <button onClick={onClose} className="ml-4 text-muted-foreground hover:text-foreground transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

const adminSteps = [
  { label: "Personal Info", icon: User },
  { label: "Contact", icon: Mail },
  { label: "Role", icon: User },
  { label: "Security", icon: Lock },
];

const orgSteps = [
  { label: "Basic Info", icon: Building2 },
  { label: "API Slug", icon: Globe },
  { label: "Location", icon: MapPin },
  { label: "Contact", icon: Phone },
];

const steps = [
  { label: "Admin Info", icon: User, subSteps: adminSteps },
  { label: "Organization", icon: Building2, subSteps: orgSteps },
  { label: "Plan", icon: CreditCard, subSteps: [] },
];

// School Plans - based on document
const SCHOOL_PLANS = [
  { 
    id: "free_trial", 
    name: "Free Trial", 
    displayName: "Free Trial",
    desc: "30 days free trial. 200 users, 1 free device.", 
    priceMonthly: 0, 
    priceYearly: 0,
    maxUsers: 200,
    maxDevices: 1,
    maxAdmins: 1,
    highlight: false,
    analyticsLevel: "basic",
    supportLevel: "email",
    apiAccess: true,
    customReports: false,
    customBranding: false,
    liveViewDuration: 60,
    exportData: false,
    webhooks: true
  },
  { 
    id: "basic", 
    name: "basic",
    displayName: "Basic Plan", 
    desc: "1000 users, 2 free devices, basic analytics.", 
    priceMonthly: 15, 
    priceYearly: 135,
    maxUsers: 1000,
    maxDevices: 2,
    maxAdmins: 2,
    highlight: false,
    analyticsLevel: "basic",
    supportLevel: "email",
    apiAccess: true,
    customReports: false,
    customBranding: true,
    liveViewDuration: 120,
    exportData: true,
    webhooks: true
  },
  { 
    id: "professional", 
    name: "professional",
    displayName: "Professional Plan", 
    desc: "2000 users, 5 free devices, advanced analytics.", 
    priceMonthly: 50, 
    priceYearly: 450,
    maxUsers: 2000,
    maxDevices: 5,
    maxAdmins: 3,
    highlight: true,
    analyticsLevel: "advanced",
    supportLevel: "priority",
    apiAccess: true,
    customReports: true,
    customBranding: true,
    liveViewDuration: 240,
    exportData: true,
    webhooks: true
  },
  { 
    id: "enterprise", 
    name: "enterprise",
    displayName: "Enterprise", 
    desc: "Unlimited Users, 15 free devices, premium Analytics.", 
    priceMonthly: 199, 
    priceYearly: 1791,
    maxUsers: null,
    maxDevices: 15,
    maxAdmins: 5,
    highlight: false,
    analyticsLevel: "premium",
    supportLevel: "24/7",
    apiAccess: true,
    customReports: true,
    customBranding: true,
    liveViewDuration: 480,
    exportData: true,
    webhooks: true
  },
];

// Company Plans - based on document
const COMPANY_PLANS = [
  { 
    id: "free_trial", 
    name: "Free Trial", 
    displayName: "Free Trial",
    desc: "30 days free trial. 50 users, 1 free device.", 
    priceMonthly: 0, 
    priceYearly: 0,
    maxUsers: 50,
    maxDevices: 1,
    maxAdmins: 1,
    highlight: false,
    analyticsLevel: "basic",
    supportLevel: "email",
    apiAccess: true,
    customReports: false,
    customBranding: false,
    liveViewDuration: 60,
    exportData: false,
    webhooks: true
  },
  { 
    id: "basic", 
    name: "basic",
    displayName: "Basic Plan", 
    desc: "100 users, 2 free devices, basic analytics.", 
    priceMonthly: 20, 
    priceYearly: 180,
    maxUsers: 100,
    maxDevices: 2,
    maxAdmins: 2,
    highlight: false,
    analyticsLevel: "basic",
    supportLevel: "email",
    apiAccess: true,
    customReports: false,
    customBranding: true,
    liveViewDuration: 120,
    exportData: true,
    webhooks: true
  },
  { 
    id: "professional", 
    name: "professional",
    displayName: "Professional Plan", 
    desc: "1000 users, 5 free devices, advanced analytics.", 
    priceMonthly: 60, 
    priceYearly: 540,
    maxUsers: 1000,
    maxDevices: 5,
    maxAdmins: 3,
    highlight: true,
    analyticsLevel: "advanced",
    supportLevel: "priority",
    apiAccess: true,
    customReports: true,
    customBranding: true,
    liveViewDuration: 240,
    exportData: true,
    webhooks: true
  },
  { 
    id: "enterprise", 
    name: "enterprise",
    displayName: "Enterprise", 
    desc: "Unlimited Users, 10 free devices, premium Analytics.", 
    priceMonthly: 160, 
    priceYearly: 1440,
    maxUsers: null,
    maxDevices: 10,
    maxAdmins: 5,
    highlight: false,
    analyticsLevel: "premium",
    supportLevel: "24/7",
    apiAccess: true,
    customReports: true,
    customBranding: true,
    liveViewDuration: 480,
    exportData: true,
    webhooks: true
  },
];

declare global {
  interface Window {
    google?: any;
  }
}

const Register = () => {
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();
  const [mainStep, setMainStep] = useState(0);
  const [subStep, setSubStep] = useState(0);
  const [authMethod, setAuthMethod] = useState<"email" | "google" | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleInitialized, setIsGoogleInitialized] = useState(false);
  const [waitingForGooglePopup, setWaitingForGooglePopup] = useState(false);
  
  const profileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", username: "", password: "",
    profileImage: "", gender: "", roleId: "4", confirmPassword: "",
    orgName: "", orgType: "school", orgAddress: "", orgEmail: "", orgPhone: "",
    logo: "", apiSlug: "", province: "", district: "",
    plan: "free_trial",
  });

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const setField = (key: keyof typeof form, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: "profileImage" | "logo") => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast("Image size should be less than 2MB", "error");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setField(field, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Google credential response
  const handleGoogleCredentialResponse = async (response: any) => {
    setWaitingForGooglePopup(false);
    setGoogleLoading(true);
    try {
      const { credential } = response;
      if (!credential) {
        throw new Error('No credential received from Google');
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const res = await fetch(`${apiUrl}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: credential }),
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Google authentication failed');
      }

      if (result.data?.token) {
        localStorage.setItem('csm_token', result.data.token);
      }
      if (result.data?.admin) {
        localStorage.setItem('csm_admin', JSON.stringify(result.data.admin));
      }

      const userData = result.data?.admin;
      if (userData) {
        setForm(prev => ({
          ...prev,
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || '',
          username: userData.username || userData.email?.split('@')[0] || '',
          profileImage: userData.profile || '',
        }));
        
        showToast("Google account connected! Please complete your organization info.", "success");
        setAuthMethod("google");
        setMainStep(1);
        setSubStep(0);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Google sign-up failed";
      showToast(errorMessage, "error");
      console.error('Google auth error:', err);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Initialize Google Sign-In
  const initializeGoogleSignIn = () => {
    if (typeof window === 'undefined') return;

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    
    const setupClient = () => {
      if (window.google && !isGoogleInitialized) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        setIsGoogleInitialized(true);
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
      showToast("Failed to load Google Sign-In", "error");
    };
    document.body.appendChild(script);
  };

  useEffect(() => {
    initializeGoogleSignIn();
  }, []);

  // Handle Google Sign Up button click
  const handleGoogleSignup = () => {
    if (!isGoogleInitialized) {
      showToast("Initializing Google Sign-In, please wait...", "info");
      initializeGoogleSignIn();
      setTimeout(() => {
        if (window.google && isGoogleInitialized) {
          setWaitingForGooglePopup(true);
          window.google.accounts.id.prompt((notification: any) => {
            setWaitingForGooglePopup(false);
            if (notification.isNotDisplayed()) {
              showToast("Please enable popups for this site", "error");
            }
          });
          setTimeout(() => {
            setWaitingForGooglePopup(false);
          }, 5000);
        } else {
          showToast("Google Sign-In is still loading. Please try again.", "error");
        }
      }, 1000);
    } else if (window.google) {
      setWaitingForGooglePopup(true);
      window.google.accounts.id.prompt((notification: any) => {
        setWaitingForGooglePopup(false);
        if (notification.isNotDisplayed()) {
          if (notification.notDisplayedReason === 'opt_out_or_no_session') {
            showToast("Please sign in to your Google account first.", "info");
          } else {
            showToast("Please enable popups for this site", "error");
          }
        }
      });
      setTimeout(() => {
        setWaitingForGooglePopup(false);
      }, 5000);
    } else {
      showToast("Google Sign-In not available. Please refresh the page.", "error");
    }
  };

  const handleSubmit = async () => {
    setToast(null);
    setIsSubmitting(true);
    
    try {
      // Get plans based on selected organization type
      const currentPlans = form.orgType === "school" ? SCHOOL_PLANS : COMPANY_PLANS;
      const selectedPlan = currentPlans.find(p => p.id === form.plan) || currentPlans[0];
      
      if (authMethod === "google") {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
        
        const response = await fetch(`${apiUrl}/auth/complete-google-signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('csm_token')}`
          },
          body: JSON.stringify({
            orgName: form.orgName,
            orgType: form.orgType,
            orgAddress: form.orgAddress,
            orgEmail: form.orgEmail,
            orgPhone: form.orgPhone,
            orgLogo: form.logo,
            province: form.province,
            district: form.district,
            apiSlug: form.apiSlug,
            planId: form.plan,
            billingCycle: billingCycle,
            planDetails: {
              displayName: selectedPlan.displayName,
              desc: selectedPlan.desc,
              priceMonthly: selectedPlan.priceMonthly,
              priceYearly: selectedPlan.priceYearly,
              maxUsers: selectedPlan.maxUsers,
              maxDevices: selectedPlan.maxDevices,
              maxAdmins: selectedPlan.maxAdmins,
              analyticsLevel: selectedPlan.analyticsLevel,
              supportLevel: selectedPlan.supportLevel,
              apiAccess: selectedPlan.apiAccess,
              customReports: selectedPlan.customReports,
              customBranding: selectedPlan.customBranding,
              liveViewDuration: selectedPlan.liveViewDuration,
              exportData: selectedPlan.exportData,
              webhooks: selectedPlan.webhooks
            }
          }),
        });
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to complete signup');
        }
        
        showToast("Organization created successfully!", "success");
        setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 1500);
      } else {
        const registrationData = {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          username: form.username,
          password: form.password,
          gender: form.gender,
          roleId: parseInt(form.roleId),
          profileImage: form.profileImage,
          orgName: form.orgName,
          orgType: form.orgType,
          orgAddress: form.orgAddress,
          orgEmail: form.orgEmail,
          orgPhone: form.orgPhone,
          orgLogo: form.logo,
          province: form.province,
          district: form.district,
          apiSlug: form.apiSlug,
          planId: form.plan,
          billingCycle: billingCycle,
          planDetails: {
            displayName: selectedPlan.displayName,
            desc: selectedPlan.desc,
            priceMonthly: selectedPlan.priceMonthly,
            priceYearly: selectedPlan.priceYearly,
            maxUsers: selectedPlan.maxUsers,
            maxDevices: selectedPlan.maxDevices,
            maxAdmins: selectedPlan.maxAdmins,
            analyticsLevel: selectedPlan.analyticsLevel,
            supportLevel: selectedPlan.supportLevel,
            apiAccess: selectedPlan.apiAccess,
            customReports: selectedPlan.customReports,
            customBranding: selectedPlan.customBranding,
            liveViewDuration: selectedPlan.liveViewDuration,
            exportData: selectedPlan.exportData,
            webhooks: selectedPlan.webhooks
          }
        };
        
        const registeredAdmin = await register(registrationData);
        
        showToast("Account created successfully!", "success");
        setTimeout(() => {
          navigate(registeredAdmin.isVerified ? "/dashboard" : "/verify-email", { replace: true });
        }, 1500);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create account. Please try again.";
      showToast(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canNext = () => {
    if (mainStep === 0 && authMethod === "email") {
      if (subStep === 0) return form.firstName && form.lastName;
      if (subStep === 1) return form.email && form.username;
      if (subStep === 2) return true;
      if (subStep === 3) return form.password && form.confirmPassword && form.password === form.confirmPassword;
    }
    if (mainStep === 1) {
      if (subStep === 0) return form.orgName && form.orgType;
      return true;
    }
    return true;
  };

  const nextStep = () => {
    if (mainStep === 0 && authMethod === "email" && subStep < adminSteps.length - 1) {
      setSubStep(subStep + 1);
    } else if (mainStep === 1 && subStep < orgSteps.length - 1) {
      setSubStep(subStep + 1);
    } else if (mainStep < steps.length - 1) {
      setMainStep(mainStep + 1);
      setSubStep(0);
    }
  };

  const prevStep = () => {
    if (authMethod === "google" && mainStep === 1 && subStep === 0) {
      showToast("You cannot go back. Please complete the organization setup.", "info");
      return;
    }
    
    if (subStep > 0) {
      setSubStep(subStep - 1);
    } else if (mainStep > 0) {
      setMainStep(mainStep - 1);
      if (mainStep === 1) setSubStep(orgSteps.length - 1);
      if (mainStep === 2) setSubStep(adminSteps.length - 1);
    } else if (authMethod === "google" && mainStep === 1) {
      showToast("You cannot go back. Please complete the organization setup.", "info");
    } else if (mainStep === 0 && authMethod === "email") {
      setAuthMethod(null);
    }
  };

  const getCurrentSubSteps = () => {
    if (mainStep === 0 && authMethod === "email") return adminSteps;
    if (mainStep === 1) return orgSteps;
    return [];
  };

  const currentSubSteps = getCurrentSubSteps();

  const getCurrentPlans = () => {
    return form.orgType === "school" ? SCHOOL_PLANS : COMPANY_PLANS;
  };

  const getPlanPrice = (plan: typeof SCHOOL_PLANS[0]) => {
    return billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
  };

  // Initial choice screen
  if (authMethod === null && mainStep === 0 && subStep === 0) {
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
              <h1 className="text-2xl font-heading font-bold text-foreground">Create Account</h1>
              <p className="text-muted-foreground text-sm mt-1 font-body">Start your free trial today</p>
            </div>

            <Button
              variant="outline"
              className="w-full h-11 font-body border-border hover:bg-muted"
              onClick={handleGoogleSignup}
              disabled={waitingForGooglePopup || googleLoading}
            >
              {waitingForGooglePopup || googleLoading ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {waitingForGooglePopup ? "Waiting for Google..." : googleLoading ? "Connecting..." : "Sign up with Google"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground font-body">or continue with email</span>
              </div>
            </div>

            <Button
              className="w-full gradient-primary text-primary-foreground font-semibold h-11 font-body"
              onClick={() => setAuthMethod("email")}
            >
              <User className="mr-2 h-4 w-4" />
              Continue with Email
            </Button>

            <p className="text-center text-sm text-muted-foreground font-body">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <AuthBrandPanel />
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden text-center">
            <div className="mx-auto w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center mb-3 shadow-lg">
              <span className="text-primary-foreground font-heading font-bold text-xl">C</span>
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-heading font-bold text-foreground">Create Account</h1>
            {authMethod === "google" && (
              <p className="text-sm text-muted-foreground mt-1">Complete your organization details</p>
            )}
          </div>

          {/* Main Steps */}
          <div className="flex items-center justify-center gap-2">
            {steps.map((s, i) => {
              const startIdx = authMethod === "google" ? 1 : 0;
              if (i < startIdx) return null;
              return (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      i <= mainStep ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < mainStep ? <CheckCircle className="h-4 w-4" /> : i + 1 - startIdx}
                  </div>
                  <span className={`text-xs hidden sm:inline font-body ${i <= mainStep ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                  {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < mainStep ? "bg-primary" : "bg-muted"}`} />}
                </div>
              );
            })}
          </div>

          {/* Sub Steps */}
          {currentSubSteps.length > 0 && (
            <div className="flex items-center justify-center gap-1">
              {currentSubSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      i <= subStep ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </div>
                  {i < currentSubSteps.length - 1 && <div className={`w-2 h-0.5 ${i < subStep ? "bg-primary" : "bg-muted"}`} />}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {/* Admin Info - Personal Info */}
            {mainStep === 0 && subStep === 0 && authMethod === "email" && (
              <>
                <div className="flex flex-col items-center space-y-3">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-primary/20">
                      {form.profileImage ? (
                        <img src={form.profileImage} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => profileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1.5 gradient-primary rounded-full text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={profileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, "profileImage")}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Upload profile picture (optional)</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="font-body">First Name *</Label>
                    <Input value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} placeholder="John" />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-body">Last Name *</Label>
                    <Input value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} placeholder="Doe" />
                  </div>
                </div>
              </>
            )}

            {/* Admin Info - Contact */}
            {mainStep === 0 && subStep === 1 && authMethod === "email" && (
              <>
                <div className="space-y-1">
                  <Label className="font-body">Email Address *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="john@example.com" />
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Username *</Label>
                  <Input value={form.username} onChange={(e) => setField("username", e.target.value)} placeholder="john_doe" />
                </div>
              </>
            )}

            {/* Admin Info - Role */}
            {mainStep === 0 && subStep === 2 && authMethod === "email" && (
              <>
                <div className="space-y-1">
                  <Label className="font-body">Gender</Label>
                  <Select value={form.gender} onValueChange={(v) => setField("gender", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Admin Role *</Label>
                  <Select value={form.roleId} onValueChange={(v) => setField("roleId", v)}>
                    <SelectTrigger className="font-body h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Basic Admin - Standard permissions</SelectItem>
                      <SelectItem value="2">Pro Admin - Advanced features</SelectItem>
                      <SelectItem value="3">Enterprise Admin - Full access</SelectItem>
                      <SelectItem value="4">Super Admin - All permissions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Admin Info - Security */}
            {mainStep === 0 && subStep === 3 && authMethod === "email" && (
              <>
                <div className="space-y-1">
                  <Label className="font-body">Password *</Label>
                  <Input type="password" value={form.password} onChange={(e) => setField("password", e.target.value)} placeholder="••••••••" />
                  <p className="text-xs text-muted-foreground">At least 6 characters</p>
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Confirm Password *</Label>
                  <Input type="password" value={form.confirmPassword} onChange={(e) => setField("confirmPassword", e.target.value)} placeholder="••••••••" />
                  {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>
              </>
            )}

            {/* Organization - Basic Info */}
            {mainStep === 1 && subStep === 0 && (
              <>
                <div className="flex flex-col items-center space-y-3">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-primary/20">
                      {form.logo ? (
                        <img src={form.logo} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1.5 gradient-primary rounded-full text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, "logo")}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Upload organization logo (optional)</p>
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Organization Name *</Label>
                  <Input value={form.orgName} onChange={(e) => setField("orgName", e.target.value)} placeholder="e.g., Green Hills School" />
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Organization Type *</Label>
                  <Select value={form.orgType} onValueChange={(v) => setField("orgType", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="school">
                        <div className="flex items-center gap-2">
                          <School className="h-4 w-4" />
                          School / Education Institute
                        </div>
                      </SelectItem>
                      <SelectItem value="company">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Company / Business Organization
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Organization - API Slug */}
            {mainStep === 1 && subStep === 1 && (
              <>
                <div className="space-y-1">
                  <Label className="font-body">Contact Email</Label>
                  <Input type="email" value={form.orgEmail} onChange={(e) => setField("orgEmail", e.target.value)} placeholder="contact@organization.com" />
                </div>
                <div className="space-y-1">
                  <Label className="font-body">API Slug (for Live View)</Label>
                  <Input 
                    value={form.apiSlug} 
                    onChange={(e) => setField("apiSlug", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} 
                    placeholder="your-organization"
                  />
                  <p className="text-xs text-muted-foreground">Your live view will be at: /live/{form.apiSlug || "your-organization"}</p>
                </div>
              </>
            )}

            {/* Organization - Location */}
            {mainStep === 1 && subStep === 2 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-body">Province/State</Label>
                  <Input value={form.province} onChange={(e) => setField("province", e.target.value)} placeholder="e.g., Kigali"/>
                </div>
                <div className="space-y-1">
                  <Label className="font-body">District/City</Label>
                  <Input value={form.district} onChange={(e) => setField("district", e.target.value)} placeholder="e.g., Gasabo"/>
                </div>
              </div>
            )}

            {/* Organization - Contact */}
            {mainStep === 1 && subStep === 3 && (
              <>
                <div className="space-y-1">
                  <Label className="font-body">Address</Label>
                  <Input value={form.orgAddress} onChange={(e) => setField("orgAddress", e.target.value)} placeholder="Street address" />
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Phone Number</Label>
                  <Input value={form.orgPhone} onChange={(e) => setField("orgPhone", e.target.value)} placeholder="+250 781 281 828" />
                </div>
              </>
            )}

            {/* Plan Selection */}
            {mainStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 p-1 bg-muted rounded-lg">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                      billingCycle === "monthly" 
                        ? "gradient-primary text-primary-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Monthly Billing
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("yearly")}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                      billingCycle === "yearly" 
                        ? "gradient-primary text-primary-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Yearly Billing <span className="text-xs">(Save 25%)</span>
                  </button>
                </div>

                {getCurrentPlans().map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setField("plan", plan.id)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      form.plan === plan.id 
                        ? "border-primary bg-primary/5 shadow-md" 
                        : "border-border hover:border-primary/50"
                    } ${plan.highlight ? "relative overflow-hidden" : ""}`}
                  >
                    {plan.highlight && (
                      <div className="absolute top-0 right-0 gradient-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg rounded-tr-lg">
                        MOST POPULAR
                      </div>
                    )}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-heading font-bold text-foreground text-lg">{plan.displayName}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{plan.desc}</p>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span><User className="inline h-3 w-3 mr-1" /> {plan.maxUsers === null ? "Unlimited" : `${plan.maxUsers}`} Users</span>
                          <span><Smartphone className="inline h-3 w-3 mr-1" /> {plan.maxDevices === null ? "Unlimited" : `${plan.maxDevices}`} Free Devices</span>
                          <span><Shield className="inline h-3 w-3 mr-1" /> {plan.maxAdmins} Admins</span>
                        </div>
                      </div>
                      <div className="text-right">
                        {getPlanPrice(plan) === 0 ? (
                          <span className="font-heading font-bold text-primary text-lg">Free Trial</span>
                        ) : (
                          <>
                            <span className="font-heading font-bold text-primary text-xl">${getPlanPrice(plan)}</span>
                            <span className="text-xs text-muted-foreground">/month</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="text-xs text-muted-foreground text-center mt-4 p-3 bg-muted/30 rounded-lg">
                  <p><CreditCard className="inline h-3 w-3 mr-1" /> No credit card required for Free Trial</p>
                  <p className="mt-1"><Package className="inline h-3 w-3 mr-1" /> Additional devices can be added after signup for $20/month per device</p>
                  <p className="mt-1"><Fingerprint className="inline h-3 w-3 mr-1" /> Device FingerPrint + Card Reader: $99 one-time purchase</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            {!(authMethod === "google" && mainStep === 1 && subStep === 0) && (
              <Button variant="outline" onClick={prevStep} disabled={isSubmitting}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            )}
            
            {(authMethod === "google" && mainStep === 1 && subStep === 0) && (
              <div></div>
            )}
            
            {mainStep < 2 ? (
              <Button 
                className="gradient-primary text-primary-foreground"
                onClick={nextStep} 
                disabled={!canNext() || isSubmitting}
              >
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button 
                className="gradient-primary text-primary-foreground"
                onClick={handleSubmit} 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};



export default Register;