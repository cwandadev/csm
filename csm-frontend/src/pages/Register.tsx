// csms-frontend/src/pages/Register.tsx
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, User, Building2, CreditCard, CheckCircle, Loader2, Mail, Lock, Globe, Phone, MapPin, X, AlertCircle, Info, Camera, School, Briefcase, Shield, Cookie } from "lucide-react";
import AuthBrandPanel from "@/components/AuthBrandPanel";
import { Smartphone, Package, Fingerprint } from "lucide-react";

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

const adminSteps = [
  { label: "Personal Info", icon: User },
  { label: "Contact", icon: Mail },
  { label: "Role", icon: User },
  { label: "Security", icon: Lock },
];

const orgSteps = [
  { label: "Basic Info", icon: Building2 },
  { label: "Settings", icon: Globe },
  { label: "Location", icon: MapPin },
  { label: "Contact", icon: Phone },
];

const steps = [
  { label: "Admin Info", icon: User, subSteps: adminSteps },
  { label: "Organization", icon: Building2, subSteps: orgSteps },
  { label: "Plan", icon: CreditCard, subSteps: [] },
];

// School Plans
const SCHOOL_PLANS = [
  { 
    id: "free_trial", 
    name: "Free Trial", 
    displayName: "Free Trial",
    desc: "30 days free trial. 200 users.", 
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
    desc: "1000 users, basic analytics.", 
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
    desc: "2000 users, advanced analytics.", 
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
    desc: "Unlimited Users, premium Analytics, 24/7 support. Includes 1 free device.", 
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
    webhooks: true,
    includesFreeDevice: true
  },
];

// Company Plans
const COMPANY_PLANS = [
  { 
    id: "free_trial", 
    name: "Free Trial", 
    displayName: "Free Trial",
    desc: "30 days free trial. 50 users.", 
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
    desc: "100 users, basic analytics.", 
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
    desc: "500 users, advanced analytics.", 
    priceMonthly: 60, 
    priceYearly: 540,
    maxUsers: 500,
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
    desc: "Unlimited Users, premium Analytics, 24/7 support. Includes 1 free device.", 
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
    webhooks: true,
    includesFreeDevice: true
  },
];

declare global {
  interface Window {
    google?: any;
  }
}

const AlertTriangle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

// Update the uploadImage function to handle filenames correctly
const uploadImage = async (file: File, type: 'profile' | 'logo'): Promise<string> => {
  const formData = new FormData();
  formData.append(type, file);
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const endpoint = type === 'profile' ? '/uploads/profiles' : '/uploads/logos';
  
  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }
    
    console.log(`[Upload] ${type} uploaded:`, result.data.url);
    
    // Return the URL for preview purposes
    // The backend will extract the filename when saving to DB
    return result.data.url;
  } catch (error) {
    console.error(`${type} upload error:`, error);
    throw error;
  }
};
const Register = () => {
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();
  const [mainStep, setMainStep] = useState(0);
  const [subStep, setSubStep] = useState(0);
  const [authMethod, setAuthMethod] = useState<"email" | "google" | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" | "warning" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleInitialized, setIsGoogleInitialized] = useState(false);
  const [waitingForGooglePopup, setWaitingForGooglePopup] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [agreeToCookies, setAgreeToCookies] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showCookiesModal, setShowCookiesModal] = useState(false);
  const [addDevice, setAddDevice] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string>("");
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  const profileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", username: "", password: "",
    profileImage: "", gender: "", roleId: "2", confirmPassword: "",
    orgName: "", orgType: "school", orgAddress: "", orgEmail: "", orgPhone: "",
    logo: "", apiSlug: "", province: "", district: "",
    plan: "free_trial",
  });

  const showToast = (message: string, type: "success" | "error" | "info" | "warning") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const setField = (key: keyof typeof form, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleProfileImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast("Image size should be less than 2MB", "error");
        return;
      }
      setProfileImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast("Image size should be less than 2MB", "error");
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImages = async () => {
  let profileUrl = "";
  let logoUrl = "";
  
  if (profileImageFile) {
    setUploadingProfile(true);
    try {
      profileUrl = await uploadImage(profileImageFile, 'profile');
      // Don't call setField here - return the URL instead
    } catch (error) {
      console.error('Profile upload error:', error);
      showToast("Failed to upload profile image", "error");
    } finally {
      setUploadingProfile(false);
    }
  }
  
  if (logoFile) {
    setUploadingLogo(true);
    try {
      logoUrl = await uploadImage(logoFile, 'logo');
      // Don't call setField here - return the URL instead
    } catch (error) {
      console.error('Logo upload error:', error);
      showToast("Failed to upload logo", "error");
    } finally {
      setUploadingLogo(false);
    }
  }
  
  return { profileUrl, logoUrl };
};







// Update the handleGoogleRegisterResponse function

const handleGoogleRegisterResponse = async (response: any) => {
  setWaitingForGooglePopup(false);
  setGoogleLoading(true);
  
  try {
    const { credential } = response;
    if (!credential) {
      throw new Error('No credential received from Google');
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    
    // First, try to login with Google
    const loginRes = await fetch(`${apiUrl}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: credential }),
    });

    const loginResult = await loginRes.json();

    // If user exists, login and redirect
    if (loginResult.success) {
      const { admin, token } = loginResult.data;
      if (token) localStorage.setItem('csm_token', token);
      localStorage.setItem('csm_admin', JSON.stringify(admin));
      
      showToast("Login successful! Redirecting...", "success");
      setTimeout(() => {
        navigate(admin.isVerified ? "/dashboard" : "/verify-email", { replace: true });
      }, 1500);
      return;
    }
    
    // If user doesn't exist, check if we need to register
    if (loginResult.requiresRegistration) {
      // CRITICAL FIX: Get the Google profile picture URL
      const googlePictureUrl = loginResult.picture || '';
      
      console.log('[Google] Profile picture URL from Google:', googlePictureUrl);
      
      // Verify the Google token directly to get the picture
      const verifyRes = await fetch(`${apiUrl}/auth/google/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: credential }),
      });
      
      const verifyResult = await verifyRes.json();
      console.log('[Google] Verify result:', verifyResult);
      
      let finalPictureUrl = googlePictureUrl;
      if (verifyResult.success && verifyResult.data?.picture) {
        finalPictureUrl = verifyResult.data.picture;
        console.log('[Google] Picture from verify endpoint:', finalPictureUrl);
      }
      
      // Pre-fill form with Google data including the profile image
      setForm(prev => ({
        ...prev,
        firstName: loginResult.name?.split(' ')[0] || verifyResult.data?.given_name || '',
        lastName: loginResult.name?.split(' ')[1] || verifyResult.data?.family_name || '',
        email: loginResult.email || verifyResult.data?.email || '',
        username: (loginResult.email || verifyResult.data?.email || '').split('@')[0],
        profileImage: finalPictureUrl,  // Store Google picture URL
      }));
      
      // Set profile preview to show Google picture
      if (finalPictureUrl) {
        setProfilePreview(finalPictureUrl);
        console.log('[Google] Profile preview set to:', finalPictureUrl);
      }
      
      showToast("Please complete your organization details to create an account.", "info");
      setAuthMethod("google");
      setMainStep(1);
      setSubStep(0);
      
      // Store Google token for later use in registration
      setGoogleToken(credential);
    } else {
      throw new Error(loginResult.error || 'Google authentication failed');
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Google verification failed";
    showToast(errorMessage, "error");
    console.error('Google verify error:', err);
  } finally {
    setGoogleLoading(false);
  }
};





// Add state for Google token
const [googleToken, setGoogleToken] = useState<string | null>(null);

// update the handleSubmit function
const handleSubmit = async () => {
   const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'; 
  setToast(null);
  
  if (!agreeToTerms) {
    showToast("Please agree to the Terms and Conditions", "warning");
    return;
  }
  
  if (!agreeToCookies) {
    showToast("Please agree to the Cookie Settings", "warning");
    return;
  }
  
  setIsSubmitting(true);
  
  try {
    // Upload images and get URLs directly
    const { profileUrl, logoUrl } = await uploadImages();
    
    console.log("Upload results:", { profileUrl, logoUrl });
    console.log("Current form values:", { 
      formProfileImage: form.profileImage, 
      formLogo: form.logo 
    });

    // Use the uploaded URLs or existing form values
    const finalProfileImage = profileUrl || form.profileImage;
    const finalLogo = logoUrl || form.logo;

    console.log("Final values being sent:", { finalProfileImage, finalLogo });
    
    // Update form state (optional, for UI consistency)
    if (finalProfileImage) setField("profileImage", finalProfileImage);
    if (finalLogo) setField("logo", finalLogo);
    
    const currentPlans = form.orgType === "school" ? SCHOOL_PLANS : COMPANY_PLANS;
    let selectedPlan = currentPlans.find(p => p.id === form.plan) || currentPlans[0];
    
    let finalMaxDevices = selectedPlan.maxDevices;
    
    if (form.plan !== "enterprise" && addDevice) {
      finalMaxDevices = selectedPlan.maxDevices + 1;
    }
    
    const selectedPlanId = form.plan;
    
    const registrationData = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      username: form.username,
      gender: form.gender,
      roleId: parseInt(form.roleId),
      profileImage: finalProfileImage,
      orgName: form.orgName,
      orgType: form.orgType,
      orgAddress: form.orgAddress,
      orgEmail: form.orgEmail,
      orgPhone: form.orgPhone,
      orgLogo: finalLogo,
      province: form.province,
      district: form.district,
      apiSlug: form.apiSlug,
      planId: selectedPlanId,
      billingCycle: billingCycle,
      addDevice: addDevice,
      deviceFee: addDevice && form.plan !== "enterprise" ? 99 : 0,
      planDetails: {
        displayName: selectedPlan.displayName,
        desc: selectedPlan.desc,
        priceMonthly: selectedPlan.priceMonthly,
        priceYearly: selectedPlan.priceYearly,
        maxUsers: selectedPlan.maxUsers,
        maxDevices: finalMaxDevices,
        maxAdmins: selectedPlan.maxAdmins,
        analyticsLevel: selectedPlan.analyticsLevel,
        supportLevel: selectedPlan.supportLevel,
        apiAccess: selectedPlan.apiAccess,
        customReports: selectedPlan.customReports,
        customBranding: selectedPlan.customBranding,
        liveViewDuration: selectedPlan.liveViewDuration,
        exportData: selectedPlan.exportData,
        webhooks: selectedPlan.webhooks,
        includesFreeDevice: selectedPlan.includesFreeDevice || false
      }
    };
    
    let registeredAdmin;
    
    // EMAIL SIGNUP - includes password
    if (authMethod === "email") {
      const emailRegistrationData = {
        ...registrationData,
        password: form.password,
        isGoogleSignup: false
      };
      
      console.log("Email registration data being sent:", {
        ...emailRegistrationData,
        password: "[REDACTED]",
        profileImage: emailRegistrationData.profileImage,
        orgLogo: emailRegistrationData.orgLogo
      });
      
      registeredAdmin = await register(emailRegistrationData);
    } 
    // Google signup flow
    else if (authMethod === "google" && googleToken) {
      console.log("[Google Signup] Sending registration data:", {
        ...registrationData,
        profileImage: registrationData.profileImage,
        orgLogo: registrationData.orgLogo
      });
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${apiUrl}/auth/google/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: googleToken,
          registrationData: registrationData
        }),
      });
      
      const result = await response.json();
      console.log("[Google Signup] Response:", result);
      
      if (!result.success) {
        throw new Error(result.error || 'Google signup failed');
      }
      
      const { admin, token } = result.data;
      if (token) localStorage.setItem('csm_token', token);
      localStorage.setItem('csm_admin', JSON.stringify(admin));
      registeredAdmin = admin;
    } else {
      throw new Error('Invalid authentication method');
    }
    
    localStorage.setItem('cookie_consent', JSON.stringify({
      agreed: agreeToCookies,
      timestamp: new Date().toISOString()
    }));
    
   showToast("Account created successfully!", "success");

// Store selected device info (IMPORTANT - this was missing)
if (addDevice && selectedPlan.id !== "enterprise") {
  // When user checks "Add a CSM device", store the default device ID
  localStorage.setItem('selected_device_id', 'FP-CARD-001');
  localStorage.setItem('selected_device_name', 'CSM Device: FingerPrint + Card Reader');
  localStorage.setItem('selected_device_price', '99');
}
// Also store the device selected from the plan selection (if any)
if (selectedPlan.includesFreeDevice && selectedPlan.id !== "free_trial") {
  localStorage.setItem('selected_device_id', 'FP-CARD-001');
  localStorage.setItem('selected_device_name', 'CSM Device: FingerPrint + Card Reader');
  localStorage.setItem('selected_device_price', '99');
}

// Store all selected plan data for the payment page
localStorage.setItem('selected_plan_id', selectedPlanId);
localStorage.setItem('selected_plan_name', selectedPlan.name);
localStorage.setItem('selected_billing_cycle', billingCycle);
localStorage.setItem('selected_add_device', addDevice ? 'true' : 'false'); 
localStorage.setItem('selected_org_type', form.orgType);


// Store full plan details
localStorage.setItem('selected_plan_details', JSON.stringify({
  displayName: selectedPlan.displayName,
  priceMonthly: selectedPlan.priceMonthly,
  priceYearly: selectedPlan.priceYearly,
  maxUsers: selectedPlan.maxUsers,
  maxDevices: selectedPlan.maxDevices,
  includesFreeDevice: selectedPlan.includesFreeDevice || false,
  name: selectedPlan.name
}));

if (selectedPlan.includesFreeDevice && selectedPlan.id !== "free_trial") {
  // Enterprise plan includes free device, automatically add it
  localStorage.setItem('selected_device_id', 'FP-CARD-001');
}

// Update admin payment info in database
    // Update admin payment info in database (use the new endpoint)
try {
  const updateResponse = await fetch(`${apiUrl}/payment/update-payment-info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      organizationId: registeredAdmin.organizationId,
      planId: selectedPlanId,
      billingCycle: billingCycle,
      amount: selectedPlan.priceMonthly
    })
  });
  
  if (!updateResponse.ok) {
    console.warn('Failed to update payment info');
  } else {
    const updateData = await updateResponse.json();
    console.log('Payment info updated:', updateData);
  }
} catch (error) {
  console.warn('Error updating payment info:', error);
}
    
    // Store selected plan and device info for the payment page
    localStorage.setItem('selected_plan_id', selectedPlanId);
    localStorage.setItem('selected_plan_name', selectedPlan.name);
    localStorage.setItem('selected_billing_cycle', billingCycle);
    
    if (addDevice) {
      localStorage.setItem('selected_device_id', 'FP-CARD-001');
    }
    
    // Store plan details for payment page
    localStorage.setItem('selected_plan_details', JSON.stringify({
      displayName: selectedPlan.displayName,
      priceMonthly: selectedPlan.priceMonthly,
      priceYearly: selectedPlan.priceYearly,
      maxUsers: selectedPlan.maxUsers,
      maxDevices: selectedPlan.maxDevices,
      includesFreeDevice: selectedPlan.includesFreeDevice || false,
      name: selectedPlan.name
    }));
    
    // Redirect based on auth method
   setTimeout(() => {
  if (authMethod === "google") {
    // Google signup - no email verification needed, redirect to payment
    navigate("/payment-required", { 
      replace: true,
      state: {
        selectedPlanId: selectedPlanId,
        billingCycle: billingCycle,
        planDetails: {
          displayName: selectedPlan.displayName,
          priceMonthly: selectedPlan.priceMonthly,
          priceYearly: selectedPlan.priceYearly,
          maxUsers: selectedPlan.maxUsers,
          maxDevices: selectedPlan.maxDevices,
          includesFreeDevice: selectedPlan.includesFreeDevice || false,
          name: selectedPlan.name
        }
      }
    });
  } else {
    // Email signup - need email verification first, then payment
    navigate("/verify-email", { 
      replace: true,
      state: {
        email: form.email,
        selectedPlanId: selectedPlanId,
        billingCycle: billingCycle,
        planDetails: {
          displayName: selectedPlan.displayName,
          priceMonthly: selectedPlan.priceMonthly,
          priceYearly: selectedPlan.priceYearly,
          maxUsers: selectedPlan.maxUsers,
          maxDevices: selectedPlan.maxDevices,
          includesFreeDevice: selectedPlan.includesFreeDevice || false,
          name: selectedPlan.name
        }
      }
    });
  }
}, 1500);
    
  } catch (err) {
    console.error("Registration error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to create account. Please try again.";
    showToast(errorMessage, "error");
  } finally {
    setIsSubmitting(false);
  }
};





  // Initialize Google Sign-In for registration
  const initializeGoogleSignIn = () => {
    if (typeof window === 'undefined') return;

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    
    const setupClient = () => {
      if (window.google && !isGoogleInitialized) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleRegisterResponse,
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

  const handleGoogleRegister = () => {
    if (!isGoogleInitialized) {
      showToast("Initializing Google Sign-In, please wait...", "info");
      initializeGoogleSignIn();
      setTimeout(() => {
        if (window.google && isGoogleInitialized) {
          setWaitingForGooglePopup(true);
          window.google.accounts.id.prompt((notification: any) => {
            setWaitingForGooglePopup(false);
            if (notification.isNotDisplayed()) {
              showToast("Please enable popups for this site", "warning");
            }
          });
        } else {
          showToast("Google Sign-In is still loading. Please try again.", "warning");
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
            showToast("Please enable popups for this site", "warning");
          }
        }
      });
    } else {
      showToast("Google Sign-In not available. Please refresh the page.", "error");
    }
  };

 // Make sure handlePlanSelect correctly updates the plan
const handlePlanSelect = (planId: string) => {
  console.log('Selected plan:', planId);
  setField("plan", planId);
  setAddDevice(false);  // Changed from setAddExtraDevice
};


  const handleDeviceChange = (checked: boolean) => {
    setAddDevice(checked);
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

  const canComplete = () => {
    return agreeToTerms && agreeToCookies;
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
    if (billingCycle === "monthly") return plan.priceMonthly;
    return plan.priceYearly;
  };

  const getSavingsPercent = (plan: typeof SCHOOL_PLANS[0]) => {
    if (plan.priceMonthly === 0) return 0;
    const monthlyTotal = plan.priceMonthly * 12;
    const yearlyPrice = plan.priceYearly;
    if (monthlyTotal === 0 || yearlyPrice === 0) return 0;
    return Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100);
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
              className="w-full h-11 font-body border-border hover:bg-muted rounded-xl"
              onClick={handleGoogleRegister}
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
              {waitingForGooglePopup ? "Waiting for Google..." : googleLoading ? "Loading..." : "Continue with Google"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground font-body">or sign up with email</span>
              </div>
            </div>

            <Button
              className="w-full gradient-primary text-primary-foreground font-semibold h-11 font-body rounded-xl"
              onClick={() => setAuthMethod("email")}
            >
              <User className="mr-2 h-4 w-4" />
              Sign up with Email
            </Button>

            <div className="text-center text-xs text-muted-foreground space-y-2">
              <p>
                By signing up, you agree to our{" "}
                <button onClick={() => setShowTermsModal(true)} className="text-primary hover:underline">
                  Terms & Conditions
                </button>{" "}
                and{" "}
                <button onClick={() => setShowCookiesModal(true)} className="text-primary hover:underline">
                  Cookie Settings
                </button>
              </p>
              <p>
                Already have an account?{" "}
                <Link to="/login" className="text-primary font-medium hover:underline">Sign In</Link>
              </p>
            </div>
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
            <h1 className="text-2xl font-heading font-bold text-foreground">
              {authMethod === "google" ? "Complete Registration" : "Create Account"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {authMethod === "google" ? "Please complete your organization details" : "Fill in your details below"}
            </p>
          </div>

          {/* Main Steps - Show ALL steps with proper completion status */}
          <div className="flex items-center justify-center gap-2">
            {steps.map((s, i) => {
              // For Google auth, Admin step (index 0) is automatically completed
              const isCompleted = authMethod === "google" && i === 0;
              const isActive = authMethod === "google" ? i === 1 : i === mainStep;
              
              return (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCompleted || i < mainStep
                        ? "gradient-primary text-primary-foreground" 
                        : isActive
                        ? "gradient-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted || i < mainStep ? <CheckCircle className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={`text-xs hidden sm:inline font-body ${isCompleted || i <= mainStep ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                  {i < steps.length - 1 && <div className={`w-8 h-0.5 ${isCompleted || i < mainStep ? "bg-primary" : "bg-muted"}`} />}
                </div>
              );
            })}
          </div>

          {/* Sub Steps Indicator - Show based on current step */}
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
            {/* Admin Info - Personal Info - Only for email flow on step 0 */}
            {authMethod === "email" && mainStep === 0 && subStep === 0 && (
              <>
                <div className="flex flex-col items-center space-y-3">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-primary/20">
                      {profilePreview ? (
                        <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => profileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1.5 gradient-primary rounded-full text-primary-foreground hover:opacity-90 transition-opacity"
                      disabled={uploadingProfile}
                    >
                      {uploadingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
                    <input
                      ref={profileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleProfileImageSelect}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Upload profile picture (optional)</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="font-body">First Name *</Label>
                    <Input 
                      value={form.firstName} 
                      onChange={(e) => setField("firstName", e.target.value)} 
                      placeholder="John"
                      className="rounded-xl border-border focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-body">Last Name *</Label>
                    <Input 
                      value={form.lastName} 
                      onChange={(e) => setField("lastName", e.target.value)} 
                      placeholder="Doe"
                      className="rounded-xl border-border focus:ring-primary"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Admin Info - Contact - Only for email flow on step 0 */}
            {authMethod === "email" && mainStep === 0 && subStep === 1 && (
              <>
                <div className="space-y-1">
                  <Label className="font-body">Email Address *</Label>
                  <Input 
                    type="email" 
                    value={form.email} 
                    onChange={(e) => setField("email", e.target.value)} 
                    placeholder="john@example.com"
                    className="rounded-xl border-border focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Username *</Label>
                  <Input 
                    value={form.username} 
                    onChange={(e) => setField("username", e.target.value)} 
                    placeholder="john_doe"
                    className="rounded-xl border-border focus:ring-primary"
                  />
                </div>
              </>
            )}

            {/* Admin Info - Role - Only for email flow on step 0 */}
            {authMethod === "email" && mainStep === 0 && subStep === 2 && (
              <>
                <div className="space-y-1">
                  <Label className="font-body">Gender</Label>
                  <Select value={form.gender} onValueChange={(v) => setField("gender", v)}>
                    <SelectTrigger className="rounded-xl border-border">
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
                    <SelectTrigger className="rounded-xl border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" disabled className="text-gray-400 cursor-not-allowed">Super Admin - Full access to System</SelectItem>
                      <SelectItem value="2">Primary Admin - All permissions</SelectItem>
                      <SelectItem value="3">Manager level - Limited access</SelectItem>
                      {/*<SelectItem value="4" disabled className="text-gray-400 cursor-not-allowed">Moderetor - System Monitor</SelectItem>*/}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Admin Info - Security - Only for email flow on step 0 */}
            {authMethod === "email" && mainStep === 0 && subStep === 3 && (
              <>
                <div className="space-y-1">
                  <Label className="font-body">Password *</Label>
                  <Input 
                    type="password" 
                    value={form.password} 
                    onChange={(e) => setField("password", e.target.value)} 
                    placeholder="••••••••"
                    className="rounded-xl border-border focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground">At least 6 characters</p>
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Confirm Password *</Label>
                  <Input 
                    type="password" 
                    value={form.confirmPassword} 
                    onChange={(e) => setField("confirmPassword", e.target.value)} 
                    placeholder="••••••••"
                    className="rounded-xl border-border focus:ring-primary"
                  />
                  {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>
              </>
            )}

            {/* Organization - Basic Info - Always shows on step 1 */}
            {mainStep === 1 && subStep === 0 && (
              <>
                <div className="flex flex-col items-center space-y-3">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center overflow-hidden border-2 border-primary/20">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1.5 gradient-primary rounded-full text-primary-foreground hover:opacity-90 transition-opacity"
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoSelect}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Upload organization logo (optional)</p>
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Organization Name *</Label>
                  <Input 
                    value={form.orgName} 
                    onChange={(e) => setField("orgName", e.target.value)} 
                    placeholder="e.g., Green Hills School"
                    className="rounded-xl border-border focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Organization Type *</Label>
                  <Select value={form.orgType} onValueChange={(v) => setField("orgType", v)}>
                    <SelectTrigger className="rounded-xl border-border">
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

            {/* Organization - Settings */}
            {mainStep === 1 && subStep === 1 && (
              <>
                <div className="space-y-1">
                  <Label className="font-body">Contact Email</Label>
                  <Input 
                    type="email" 
                    value={form.orgEmail} 
                    onChange={(e) => setField("orgEmail", e.target.value)} 
                    placeholder="contact@organization.com"
                    className="rounded-xl border-border focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Page Slug (for Live View)</Label>
                  <Input 
                    value={form.apiSlug} 
                    onChange={(e) => setField("apiSlug", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} 
                    placeholder="your-organization"
                    className="rounded-xl border-border focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground">Your live view will be at: https://csm.cwanda.site/live/{form.apiSlug || "your-organization"}</p>
                </div>
              </>
            )}

            {/* Organization - Location */}
            {mainStep === 1 && subStep === 2 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-body">Province/State</Label>
                  <Input 
                    value={form.province} 
                    onChange={(e) => setField("province", e.target.value)} 
                    placeholder="e.g., Kigali"
                    className="rounded-xl border-border focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-body">District/City</Label>
                  <Input 
                    value={form.district} 
                    onChange={(e) => setField("district", e.target.value)} 
                    placeholder="e.g., Gasabo"
                    className="rounded-xl border-border focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Organization - Contact */}
            {mainStep === 1 && subStep === 3 && (
              <>
                <div className="space-y-1">
                  <Label className="font-body">Address</Label>
                  <Input 
                    value={form.orgAddress} 
                    onChange={(e) => setField("orgAddress", e.target.value)} 
                    placeholder="Street address"
                    className="rounded-xl border-border focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Phone Number</Label>
                  <Input 
                    value={form.orgPhone} 
                    onChange={(e) => setField("orgPhone", e.target.value)} 
                    placeholder="+250 781 281 828"
                    className="rounded-xl border-border focus:ring-primary"
                  />
                </div>
              </>
            )}

            {/* Plan Selection */}
            {mainStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 p-1 bg-muted rounded-xl">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
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
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                      billingCycle === "yearly" 
                        ? "gradient-primary text-primary-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Yearly Billing <span className="text-xs">(Save ~25%)</span>
                  </button>
                </div>

                {getCurrentPlans().map((plan) => {
                  const savings = getSavingsPercent(plan);
                  const isEnterprise = plan.id === "enterprise";
                  const showDeviceOption = !isEnterprise;
                  
                  return (
                    <div
                      key={plan.id}
                      onClick={() => handlePlanSelect(plan.id)}
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
                            <span><Smartphone className="inline h-3 w-3 mr-1" /> Up to {plan.maxDevices} Devices</span>
                            <span><Shield className="inline h-3 w-3 mr-1" /> {plan.maxAdmins} Admins</span>
                          </div>
                          {isEnterprise && plan.includesFreeDevice && (
                            <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                              ✓ 1 free device included
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {getPlanPrice(plan) === 0 ? (
                            <span className="font-heading font-bold text-primary text-lg">Free Trial</span>
                          ) : (
                            <>
                              {billingCycle === "yearly" && plan.priceMonthly > 0 && (
                                <div className="text-xs text-muted-foreground line-through">
                                  ${plan.priceMonthly}/month
                                </div>
                              )}
                              <span className="font-heading font-bold text-primary text-xl">
                                ${billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                /{billingCycle === "monthly" ? "month" : "year"}
                              </span>
                              {billingCycle === "yearly" && savings > 0 && (
                                <div className="text-xs text-green-600 dark:text-green-400">
                                  Save {savings}%
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Extra Device Option - Only for non-Enterprise plans */}
                      {showDeviceOption && form.plan === plan.id && (
  <div className="mt-4 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
    <div className="flex items-start gap-3">
      <Checkbox
        id={`addDevice-${plan.id}`}
        checked={addDevice}
        onCheckedChange={handleDeviceChange}
      />
      <Label htmlFor={`addDevice-${plan.id}`} className="text-sm font-body cursor-pointer">
        Add a CSM device (+$99 one-time fee)
        <p className="text-xs text-muted-foreground mt-0.5">
          {addDevice 
            ? `✓ Device added. You'll have up to ${plan.maxDevices + 1} devices total.`
            : `No device selected. Your plan includes up to ${plan.maxDevices} devices.`}
        </p>
      </Label>
    </div>
  </div>
)}
                    </div>
                  );
                })}
                
                <div className="text-xs text-muted-foreground text-center mt-4 p-3 bg-muted/30 rounded-xl">
                  <p><CreditCard className="inline h-3 w-3 mr-1" /> No credit card required for Free Trial</p>
                  <p className="mt-1"><Package className="inline h-3 w-3 mr-1" /> Additional devices can be added for $99 each</p>
                  <p className="mt-1"><Fingerprint className="inline h-3 w-3 mr-1" /> Device FingerPrint + Card Reader available</p>
                </div>
              </div>
            )}
          </div>

          {/* Terms and Conditions Checkboxes */}
          {mainStep === 2 && (
            <div className="space-y-3 p-4 bg-muted/20 rounded-xl border border-border">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={agreeToTerms}
                  onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                  className="mt-0.5"
                />
                <Label htmlFor="terms" className="text-sm font-body cursor-pointer">
                  I agree to the{" "}
                  <button onClick={() => setShowTermsModal(true)} className="text-primary hover:underline">
                    Terms and Conditions
                  </button>{" "}
                  and{" "}
                  <button
  onClick={() => window.open('https://docs.cwanda.site', '_blank')}
  className="text-primary hover:underline"
>
  Privacy Policy
</button>
                </Label>
              </div>
              
              <div className="flex items-start gap-3">
                <Checkbox
                  id="cookies"
                  checked={agreeToCookies}
                  onCheckedChange={(checked) => setAgreeToCookies(checked as boolean)}
                  className="mt-0.5"
                />
                <Label htmlFor="cookies" className="text-sm font-body cursor-pointer">
                  I agree to the{" "}
                  <button onClick={() => setShowCookiesModal(true)} className="text-primary hover:underline">
                    Cookie Settings
                  </button>{" "}
                  and understand that cookies are used to improve my experience
                </Label>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            {/* Hide Back button for Google auth on organization step */}
            {!(authMethod === "google" && mainStep === 1 && subStep === 0) && (
              <Button variant="outline" onClick={prevStep} disabled={isSubmitting} className="rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            )}
            
            {/* Empty div to maintain spacing when Back button is hidden */}
            {(authMethod === "google" && mainStep === 1 && subStep === 0) && (
              <div></div>
            )}
            
            {mainStep < 2 ? (
              <Button 
                className="gradient-primary text-primary-foreground rounded-xl"
                onClick={nextStep} 
                disabled={!canNext() || isSubmitting}
              >
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button 
                className="gradient-primary text-primary-foreground rounded-xl"
                onClick={handleSubmit} 
                disabled={isSubmitting || !canComplete() || uploadingProfile || uploadingLogo}
              >
                {isSubmitting || uploadingProfile || uploadingLogo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadingProfile || uploadingLogo ? "Uploading images..." : "Creating Account..."}
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto border border-border">
            <div className="sticky top-0 bg-background border-b border-border p-4 flex justify-between items-center">
              <h2 className="font-heading font-bold text-lg">Terms & Conditions</h2>
              <button onClick={() => setShowTermsModal(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm text-muted-foreground">
              <p><strong>1. Acceptance of Terms</strong><br />By accessing and using the CSM Platform, you agree to be bound by these Terms and Conditions.</p>
              <p><strong>2. User Accounts</strong><br />You are responsible for maintaining the confidentiality of your account credentials.</p>
              <p><strong>3. Subscription and Billing</strong><br />Subscription fees are billed in advance on a monthly or yearly basis.</p>
              <p><strong>4. Data Privacy</strong><br />We collect and process data in accordance with our Privacy Policy.</p>
              <p><strong>5. Termination</strong><br />We reserve the right to suspend or terminate accounts that violate these terms.</p>
              <p><strong>6. Limitation of Liability</strong><br />The CSM Platform is provided "as is" without warranties of any kind.</p>
              <p><strong>7. Changes to Terms</strong><br />We may modify these terms at any time. Continued use constitutes acceptance.</p>
            </div>
            <div className="sticky bottom-0 bg-background border-t border-border p-4">
              <Button onClick={() => setShowTermsModal(false)} className="w-full rounded-xl">Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Cookies Modal */}
      {showCookiesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto border border-border">
            <div className="sticky top-0 bg-background border-b border-border p-4 flex justify-between items-center">
              <h2 className="font-heading font-bold text-lg">Cookie Settings</h2>
              <button onClick={() => setShowCookiesModal(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Cookie className="h-5 w-5 text-primary" />
                <p><strong>What are cookies?</strong><br />Cookies are small text files stored on your device that help us provide and improve our services.</p>
              </div>
              <p><strong>Essential Cookies</strong><br />Required for the platform to function properly. Cannot be disabled.</p>
              <p><strong>Analytics Cookies</strong><br />Help us understand how users interact with our platform.</p>
              <p><strong>Preference Cookies</strong><br />Remember your settings and preferences.</p>
              <p><strong>Third-Party Cookies</strong><br />Used for authentication services like Google Sign-In.</p>
              <p className="text-xs">By using our platform, you consent to the use of cookies as described above.</p>
            </div>
            <div className="sticky bottom-0 bg-background border-t border-border p-4">
              <Button onClick={() => setShowCookiesModal(false)} className="w-full rounded-xl">Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;