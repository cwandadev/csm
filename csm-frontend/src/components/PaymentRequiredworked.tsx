import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  CreditCard, Zap, Crown, Building2, Heart, Loader2,
  ShoppingCart, X, Check, AlertCircle, Info, Gift, ChevronDown, ChevronUp,
  Percent, TrendingDown, Users, Smartphone, Shield, Award, Calendar
} from "lucide-react";
import { toast } from "sonner";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_dummy');

const TAX_CONFIG = {
  rate: 18,
  name: 'VAT'
};

interface SubscriptionPlan {
  id: number;
  name: string;
  display_name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number | null;
  max_devices: number | null;
  includes_free_device: boolean;
  features: string[];
  limitations?: string[];
}

const SCHOOL_PLANS: SubscriptionPlan[] = [
  {
    id: 1, name: "free", display_name: "Free Trial", description: "30 days free trial. Perfect for getting started.",
    price_monthly: 0, price_yearly: 0, max_users: 200, max_devices: 1, includes_free_device: false,
    features: ["Up to 200 users", "1 device included", "Basic analytics", "Email support", "30-day trial period"],
    limitations: ["No custom reports", "No custom branding"]
  },
  {
    id: 2, name: "basic", display_name: "Basic Plan", description: "For growing schools with up to 1,000 users.",
    price_monthly: 15, price_yearly: 135, max_users: 1000, max_devices: 2, includes_free_device: false,
    features: ["Up to 1,000 users", "2 devices included", "Basic analytics", "Email support", "API access", "Data export", "Custom branding"]
  },
  {
    id: 3, name: "professional", display_name: "Professional", description: "For large schools with advanced needs.",
    price_monthly: 50, price_yearly: 450, max_users: 2000, max_devices: 5, includes_free_device: false,
    features: ["Up to 2,000 users", "5 devices included", "Advanced analytics", "Priority support", "Custom reports", "Custom branding", "API access", "Data export"]
  },
  {
    id: 4, name: "enterprise", display_name: "Enterprise", description: "For large institutions with custom needs.",
    price_monthly: 199, price_yearly: 1791, max_users: null, max_devices: 15, includes_free_device: true,
    features: ["Unlimited users", "15 devices included", "Premium analytics", "24/7 support", "1 free device", "Dedicated account manager", "Custom reports", "API access"]
  }
];

const COMPANY_PLANS: SubscriptionPlan[] = [
  {
    id: 5, name: "free", display_name: "Free Trial", description: "30 days free trial for small teams.",
    price_monthly: 0, price_yearly: 0, max_users: 50, max_devices: 1, includes_free_device: false,
    features: ["Up to 50 employees", "1 device included", "Basic analytics", "Email support"]
  },
  {
    id: 6, name: "basic", display_name: "Basic Plan", description: "For small businesses with up to 100 employees.",
    price_monthly: 20, price_yearly: 180, max_users: 100, max_devices: 2, includes_free_device: false,
    features: ["Up to 100 employees", "2 devices included", "Basic analytics", "Email support", "Custom branding"]
  },
  {
    id: 7, name: "professional", display_name: "Professional", description: "For growing businesses with up to 1,000 employees.",
    price_monthly: 60, price_yearly: 540, max_users: 1000, max_devices: 5, includes_free_device: false,
    features: ["Up to 1,000 employees", "5 devices included", "Advanced analytics", "Priority support", "Custom reports", "Custom branding"]
  },
  {
    id: 8, name: "enterprise", display_name: "Enterprise", description: "For large enterprises with custom needs.",
    price_monthly: 160, price_yearly: 1440, max_users: null, max_devices: 10, includes_free_device: true,
    features: ["Unlimited employees", "10 devices included", "Premium analytics", "24/7 support", "1 free device", "Dedicated account manager"]
  }
];

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Payment Form Component with Single Submission Protection
interface PaymentFormProps {
  amount: number;
  planName: string;
  billingCycle: string;
  includesFreeDevice: boolean;
  metadata: Record<string, string>;
  onSuccess: (paymentIntent: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

const PaymentForm = ({ amount, planName, billingCycle, includesFreeDevice, metadata, onSuccess, onError, onCancel }: PaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const { admin } = useAuth();
  
  // Refs to prevent duplicate submissions
  const isSubmittingRef = useRef(false);
  const paymentIntentIdRef = useRef<string | null>(null);

  useEffect(() => {
    const createPaymentIntent = async () => {
      if (amount === 0) {
        onSuccess({ id: 'free_trial', status: 'succeeded' });
        return;
      }

      // Don't create multiple payment intents
      if (paymentIntentIdRef.current) {
        return;
      }

      try {
        const token = localStorage.getItem("csm_token");
        
        const response = await fetch(`${API_BASE_URL}/payment/create-payment-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            subscriptionAmount: amount,
            deviceAmount: 0,
            planName: planName,
            billingCycle: billingCycle,
            deviceId: null,
            isEnterprise: includesFreeDevice,
            currency: 'usd',
            organizationId: admin?.organizationId,
            metadata: metadata
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          setClientSecret(data.data.client_secret);
          paymentIntentIdRef.current = data.data.payment_intent_id;
        } else {
          setErrorMessage(data.error || "Failed to initialize payment");
          onError(data.error || "Failed to initialize payment");
        }
      } catch (error) {
        console.error("Error creating payment intent:", error);
        setErrorMessage("Network error. Please try again.");
        onError("Network error. Please try again.");
      }
    };

    createPaymentIntent();
  }, [amount, planName, billingCycle, includesFreeDevice, admin, metadata]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (isSubmittingRef.current || paymentCompleted) {
      console.log('Payment already in progress or completed');
      return;
    }
    
    if (amount === 0) {
      onSuccess({ id: 'free_trial', status: 'succeeded' });
      return;
    }

    if (!stripe) {
      setErrorMessage("Stripe not loaded. Please refresh.");
      onError("Stripe not loaded. Please refresh.");
      return;
    }
    
    if (!elements) {
      setErrorMessage("Payment form not ready.");
      onError("Payment form not ready.");
      return;
    }
    
    if (!clientSecret) {
      setErrorMessage("Payment not initialized. Please try again.");
      onError("Payment not initialized. Please try again.");
      return;
    }

    // Set submitting flag to prevent duplicate submissions
    isSubmittingRef.current = true;
    setProcessing(true);
    setErrorMessage(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setErrorMessage("Card element not found.");
      onError("Card element not found.");
      isSubmittingRef.current = false;
      setProcessing(false);
      return;
    }

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: `${admin?.firstName || ''} ${admin?.lastName || ''}`.trim(),
            email: admin?.email,
          },
        },
      });

      if (error) {
        console.error("Payment error:", error);
        setErrorMessage(error.message || "Payment failed");
        onError(error.message || "Payment failed");
        isSubmittingRef.current = false;
        setProcessing(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        setPaymentCompleted(true);
        onSuccess(paymentIntent);
        // Don't reset isSubmittingRef here - prevent further submissions
      }
    } catch (err: any) {
      console.error("Payment confirmation error:", err);
      setErrorMessage(err.message || "Payment processing failed");
      onError(err.message || "Payment processing failed");
      isSubmittingRef.current = false;
      setProcessing(false);
    }
  };

  if (amount === 0) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="h-8 w-8 text-green-500" />
        </div>
        <p className="text-lg font-semibold mb-2">Free Trial Confirmed!</p>
        <p className="text-sm text-muted-foreground mb-4">Your free trial has been activated. No payment required.</p>
        <Button onClick={onCancel} className="gradient-primary text-primary-foreground w-full">Continue to Dashboard</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-600 text-sm">
          {errorMessage}
        </div>
      )}
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Card Information</label>
        <div className="p-4 border rounded-lg bg-background transition-all duration-200 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                  iconColor: '#9e2146',
                },
              },
              hidePostalCode: false,
            }}
            onReady={() => setCardReady(true)}
            onChange={(event) => {
              if (event.error) {
                setErrorMessage(event.error.message);
              } else {
                setErrorMessage(null);
              }
            }}
          />
        </div>
      </div>
      
      <div className="flex gap-3">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel} 
          className="flex-1"
          disabled={processing || paymentCompleted}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || !clientSecret || processing || !cardReady || paymentCompleted || isSubmittingRef.current} 
          className="flex-1 gradient-primary text-primary-foreground"
        >
          {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
          {processing ? "Processing..." : `Pay $${amount.toFixed(2)}`}
        </Button>
      </div>
    </form>
  );
};

interface PaymentRequiredProps {
  selectedPlanId?: string;
  selectedDeviceId?: string;
  selectedBillingCycle?: "monthly" | "yearly";
  selectedPlanDetails?: any;
  onComplete?: () => void;
}

const PaymentRequired = ({ 
  selectedPlanId: propPlanId, 
  selectedDeviceId: propDeviceId, 
  selectedBillingCycle: propBillingCycle,
  selectedPlanDetails: propPlanDetails,
  onComplete 
}: PaymentRequiredProps) => {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(propBillingCycle || "monthly");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);
  const [includeTax, setIncludeTax] = useState(false);
  const [organizationType, setOrganizationType] = useState<string>("school");
  const [subscriptionCreated, setSubscriptionCreated] = useState(false);
  
  // Refs to prevent duplicate subscription activation
  const isActivatingRef = useRef(false);
  const activationCompletedRef = useRef(false);

  // Get plans based on organization type
  const isCompany = organizationType === "company";
  const plans = isCompany ? COMPANY_PLANS : SCHOOL_PLANS;

  // Load selected plan from props, localStorage, or location state
  useEffect(() => {
    let storedPlanId = propPlanId;
    let storedBillingCycle = propBillingCycle;
    let storedOrgType = localStorage.getItem('selected_org_type') || "school";
    
    setOrganizationType(storedOrgType);
    
    // Priority 2: Location state (from navigation)
    if (!storedPlanId && location.state) {
      storedPlanId = location.state.selectedPlanId;
      storedBillingCycle = location.state.billingCycle;
      if (storedBillingCycle) setBillingCycle(storedBillingCycle);
    }
    
    // Priority 3: localStorage
    if (!storedPlanId) {
      storedPlanId = localStorage.getItem('selected_plan_id');
      const storedCycle = localStorage.getItem('selected_billing_cycle');
      if (storedCycle && (storedCycle === 'monthly' || storedCycle === 'yearly')) {
        setBillingCycle(storedCycle);
      }
    }
    
    // Find and set the plan
    if (storedPlanId) {
      let plan = plans.find(p => p.id === parseInt(storedPlanId));
      if (!plan) {
        plan = plans.find(p => p.name === storedPlanId);
      }
      if (plan) {
        setSelectedPlan(plan);
        console.log('[PaymentRequired] Selected plan loaded:', plan.display_name);
      } else {
        console.warn('[PaymentRequired] Plan not found for ID:', storedPlanId);
        const defaultPlan = plans.find(p => p.name !== 'free') || plans[0];
        setSelectedPlan(defaultPlan);
      }
    } else {
      setSelectedPlan(plans[0]);
    }
    
    setLoading(false);
  }, [propPlanId, propBillingCycle, plans, location]);

  const getPlanPrice = () => {
    if (!selectedPlan) return 0;
    return billingCycle === "monthly" ? selectedPlan.price_monthly : selectedPlan.price_yearly;
  };

  const getYearlySavingsPercent = () => {
    if (!selectedPlan || selectedPlan.name === 'free') return 0;
    const monthlyTotal = selectedPlan.price_monthly * 12;
    const yearlyPrice = selectedPlan.price_yearly;
    if (monthlyTotal === 0) return 0;
    return Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100);
  };

  const getYearlySavingsAmount = () => {
    if (!selectedPlan || selectedPlan.name === 'free') return 0;
    const monthlyTotal = selectedPlan.price_monthly * 12;
    const yearlyPrice = selectedPlan.price_yearly;
    return monthlyTotal - yearlyPrice;
  };

  const getTotalAmount = () => {
    return getPlanPrice();
  };

  const getTax = () => {
    if (!includeTax) return 0;
    return getTotalAmount() * (TAX_CONFIG.rate / 100);
  };

  const getFinalTotal = () => {
    return getTotalAmount() + getTax();
  };

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    localStorage.setItem('selected_plan_id', plan.id.toString());
    localStorage.setItem('selected_plan_name', plan.name);
    localStorage.setItem('selected_plan_details', JSON.stringify({
      displayName: plan.display_name,
      priceMonthly: plan.price_monthly,
      priceYearly: plan.price_yearly,
      maxUsers: plan.max_users,
      maxDevices: plan.max_devices,
      includesFreeDevice: plan.includes_free_device,
      name: plan.name
    }));
  };

  const buildMetadata = () => {
    const metadata: Record<string, string> = {
      organization_type: organizationType,
      plan_name: selectedPlan?.name || 'unknown',
      subscription_type: billingCycle,
      subscription_price: (selectedPlan ? (billingCycle === 'monthly' ? selectedPlan.price_monthly : selectedPlan.price_yearly) : 0).toString(),
      currency: 'USD',
      tax_rate: includeTax ? TAX_CONFIG.rate.toString() : '0',
      tax_amount: getTax().toString(),
      total_amount: getFinalTotal().toString(),
      type: 'subscription_only',
      timestamp: Date.now().toString()
    };
    
    if (selectedPlan?.includes_free_device) {
      metadata.includes_free_device = 'true';
    }
    
    return metadata;
  };

  const handleProceedToPayment = () => {
    if (!selectedPlan) {
      toast.error("Please select a subscription plan");
      return;
    }
    
    // Reset activation flags when opening new payment modal
    isActivatingRef.current = false;
    activationCompletedRef.current = false;
    setShowPaymentModal(true);
  };

  // In the handlePaymentSuccess function, update the redirect section:

const handlePaymentSuccess = async (paymentIntent: any) => {
  if (isActivatingRef.current || activationCompletedRef.current) {
    console.log('Activation already in progress or completed');
    return;
  }
  
  isActivatingRef.current = true;
  setProcessing(true);
  
  try {
    const token = localStorage.getItem("csm_token");
    
    if (!selectedPlan) {
      toast.error("No plan selected. Please go back and select a plan.");
      isActivatingRef.current = false;
      setProcessing(false);
      return;
    }
    
    const metadata = buildMetadata();
    const idempotencyKey = `${selectedPlan.name}_${billingCycle}_${paymentIntent.id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const response = await fetch(`${API_BASE_URL}/payment/process-activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        paymentIntentId: paymentIntent.id,
        planName: selectedPlan.name,
        billingCycle: billingCycle,
        deviceId: 'none',
        addDevice: 0,
        customerName: `${admin?.firstName} ${admin?.lastName}`,
        customerEmail: admin?.email,
        organizationType: organizationType,
        metadata: metadata,
        shippingAddress: null,
        idempotencyKey: idempotencyKey
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      activationCompletedRef.current = true;
      
      if (data.data?.already_processed) {
        toast.info("Subscription already active!");
        setShowPaymentModal(false);
        
        // Redirect to dashboard with success parameter
        setTimeout(() => {
          if (onComplete) onComplete();
          else navigate("/dashboard?subscription=already_active", { replace: true });
        }, 1500);
      } else {
        setSubscriptionCreated(true);
        
        // Clear stored selections
        localStorage.removeItem('selected_plan_id');
        localStorage.removeItem('selected_plan_name');
        localStorage.removeItem('selected_billing_cycle');
        localStorage.removeItem('selected_plan_details');
        localStorage.removeItem('selected_device_id');
        localStorage.removeItem('selected_add_device');
        localStorage.removeItem('selected_org_type');
        
        const successMessage = selectedPlan?.name === 'free' 
          ? "Free trial activated successfully!" 
          : `Successfully subscribed to ${selectedPlan?.display_name}!`;
        
        toast.success(successMessage);
        setShowPaymentModal(false);
        
        // Get redirect URL from response or default
        const redirectUrl = data.data?.redirect_url || "/dashboard?subscription=success";
        
        setTimeout(() => {
          if (onComplete) onComplete();
          else navigate(redirectUrl, { 
            replace: true,
            state: { 
              subscription_success: true, 
              plan: selectedPlan?.name,
              billing_cycle: billingCycle,
              invoice_number: data.data?.invoice_number
            }
          });
        }, 2000);
      }
    } else {
      toast.error(data.error || "Failed to activate subscription");
      isActivatingRef.current = false;
      activationCompletedRef.current = false;
    }
  } catch (error) {
    console.error("Error creating subscription:", error);
    toast.error("Failed to process subscription. Please contact support.");
    isActivatingRef.current = false;
    activationCompletedRef.current = false;
  } finally {
    setProcessing(false);
  }
};

  const handlePaymentError = (error: string) => {
    toast.error(error);
    setShowPaymentModal(false);
    // Reset activation flags on error so user can try again
    isActivatingRef.current = false;
    activationCompletedRef.current = false;
  };

  const handleCancelPayment = () => {
    setShowPaymentModal(false);
    // Reset activation flags
    isActivatingRef.current = false;
    activationCompletedRef.current = false;
  };

  const togglePlanExpand = (planId: number) => {
    setExpandedPlan(expandedPlan === planId ? null : planId);
  };

  const totalAmount = getTotalAmount();
  const tax = getTax();
  const finalTotal = getFinalTotal();
  const isFreeTrial = selectedPlan?.name === 'free';
  const includesFreeDevice = selectedPlan?.includes_free_device || false;
  const yearlySavingsPercent = getYearlySavingsPercent();
  const yearlySavingsAmount = getYearlySavingsAmount();
  const metadata = buildMetadata();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (subscriptionCreated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center border-green-500/30">
          <CardContent className="pt-8 pb-6">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-heading font-bold mb-2">Subscription Activated!</h2>
            <p className="text-muted-foreground mb-4">
              {isFreeTrial 
                ? "Your free trial has been activated. Enjoy all the features!"
                : `Your ${selectedPlan?.display_name} subscription is now active.`}
            </p>
            <div className="bg-muted/30 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm font-semibold mb-2">Subscription Details:</p>
              <p className="text-sm">Organization Type: {organizationType === 'school' ? 'School' : 'Company'}</p>
              <p className="text-sm">Plan: {selectedPlan?.display_name}</p>
              <p className="text-sm">Billing: {billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}</p>
              <p className="text-sm">Subscription Price: ${getPlanPrice().toFixed(2)}/{billingCycle === 'monthly' ? 'month' : 'year'}</p>
              {billingCycle === 'yearly' && yearlySavingsPercent > 0 && (
                <p className="text-sm text-green-600">✓ Save {yearlySavingsPercent}% (${yearlySavingsAmount.toFixed(2)}) with yearly billing</p>
              )}
              {includesFreeDevice && <p className="text-sm text-green-600">✓ Free device included with plan</p>}
              {includeTax && tax > 0 && (
                <p className="text-sm">Tax ({TAX_CONFIG.rate}%): ${tax.toFixed(2)}</p>
              )}
              <p className="text-sm font-semibold mt-2">Total Paid: ${finalTotal.toFixed(2)}</p>
            </div>
            <Button onClick={() => navigate("/dashboard", { replace: true })} className="gradient-primary text-primary-foreground w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-heading font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Choose Your Subscription Plan
            </h1>
            <p className="text-muted-foreground mt-2">Select the perfect plan for your organization</p>
            <Badge variant="outline" className="mt-2">
              {organizationType === 'school' ? '🏫 School' : '🏢 Company'}
            </Badge>
          </div>

          {/* Tax Control */}
          <div className="flex justify-center">
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Include {TAX_CONFIG.rate}% {TAX_CONFIG.name}</span>
              <Checkbox checked={includeTax} onCheckedChange={(checked) => setIncludeTax(checked as boolean)} className="ml-2" />
            </div>
          </div>

          {/* Billing Cycle Toggle */}
          {selectedPlan && selectedPlan.price_monthly > 0 && (
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 p-1 bg-muted rounded-full shadow-sm">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    billingCycle === "monthly" 
                      ? "gradient-primary text-primary-foreground shadow-md" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 relative ${
                    billingCycle === "yearly" 
                      ? "gradient-primary text-primary-foreground shadow-md" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Yearly Billing
                  {yearlySavingsPercent > 0 && (
                    <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      Save {yearlySavingsPercent}%
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Plans Section */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {plans.map((plan) => {
                  const isSelected = selectedPlan?.id === plan.id;
                  const price = billingCycle === "monthly" ? plan.price_monthly : plan.price_yearly;
                  const isRecommended = plan.name === "professional";
                  
                  let IconComponent: any = Heart;
                  if (plan.name === "basic") IconComponent = Zap;
                  else if (plan.name === "professional") IconComponent = Crown;
                  else if (plan.name === "enterprise") IconComponent = Building2;
                  
                  return (
                    <div
                      key={plan.id}
                      onClick={() => handlePlanSelect(plan)}
                      className={`group relative rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                        isSelected 
                          ? "border-primary bg-gradient-to-br from-primary/10 to-transparent shadow-lg ring-2 ring-primary/30" 
                          : isRecommended
                            ? "border-primary/50 hover:border-primary bg-gradient-to-br from-primary/5 to-transparent"
                            : "border-border hover:border-primary/30"
                      }`}
                    >
                      {/* Most Popular Badge */}
                      {isRecommended && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <Badge className="gradient-primary text-primary-foreground border-0 px-3 py-1 text-xs shadow-md">
                            <Award className="h-3 w-3 mr-1" /> Most Popular
                          </Badge>
                        </div>
                      )}
                      
                      {/* Selected Badge */}
                      {isSelected && (
                        <div className="absolute top-3 right-3">
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md">
                            <Check className="h-3.5 w-3.5 text-white" />
                          </div>
                        </div>
                      )}
                      
                      <div className="p-5">
                        {/* Icon and Plan Name */}
                        <div className="flex items-start justify-between mb-3">
                          <div className={`p-2.5 rounded-xl ${
                            isSelected || isRecommended ? "bg-primary/15" : "bg-muted"
                          }`}>
                            <IconComponent className={`h-6 w-6 ${
                              isSelected || isRecommended ? "text-primary" : "text-muted-foreground"
                            }`} />
                          </div>
                        </div>
                        
                        {/* Plan Title */}
                        <h3 className={`font-heading font-bold text-xl ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {plan.display_name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.description}</p>
                        
                        {/* Price */}
                        <div className="mt-4">
                          {price === 0 ? (
                            <span className="text-3xl font-bold text-foreground">Free</span>
                          ) : (
                            <>
                              <span className="text-4xl font-bold text-foreground">${price}</span>
                              <span className="text-muted-foreground text-sm ml-1">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
                              {billingCycle === "yearly" && plan.price_monthly > 0 && (
                                <div className="text-xs text-green-600 flex items-center gap-1 mt-1 font-medium">
                                  <TrendingDown className="h-3 w-3" />
                                  Save ${(plan.price_monthly * 12 - plan.price_yearly).toFixed(0)}/year
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        
                        {/* User Limit Badge */}
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full w-fit">
                          <Users className="h-3 w-3" />
                          <span>{plan.max_users === null ? "Unlimited users" : `Up to ${plan.max_users.toLocaleString()} users`}</span>
                        </div>
                        
                        {/* Key Features Preview */}
                        <div className="mt-4 space-y-1.5">
                          {plan.features.slice(0, 2).map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <Check className="h-3 w-3 text-green-500 shrink-0" />
                              <span className="text-muted-foreground">{feature}</span>
                            </div>
                          ))}
                          {plan.features.length > 2 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePlanExpand(plan.id);
                              }}
                              className="text-xs text-primary hover:underline flex items-center gap-1 mt-1 font-medium"
                            >
                              {expandedPlan === plan.id ? (
                                <>Show less <ChevronUp className="h-3 w-3" /></>
                              ) : (
                                <>+{plan.features.length - 2} more features <ChevronDown className="h-3 w-3" /></>
                              )}
                            </button>
                          )}
                        </div>
                        
                        {/* Expanded Features */}
                        {expandedPlan === plan.id && (
                          <div className="mt-4 pt-3 border-t border-border/50">
                            <p className="text-xs font-semibold mb-2">All features:</p>
                            <ul className="space-y-1.5">
                              {plan.features.map((feature, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-xs">
                                  <Check className="h-3 w-3 text-green-500 shrink-0" />
                                  <span className="text-muted-foreground">{feature}</span>
                                </li>
                              ))}
                            </ul>
                            {plan.limitations && plan.limitations.length > 0 && (
                              <>
                                <p className="text-xs font-semibold mt-3 mb-2 text-muted-foreground">Limitations:</p>
                                <ul className="space-y-1.5">
                                  {plan.limitations.map((limitation, idx) => (
                                    <li key={idx} className="flex items-center gap-2 text-xs">
                                      <AlertCircle className="h-3 w-3 text-orange-500 shrink-0" />
                                      <span className="text-muted-foreground">{limitation}</span>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Select Button */}
                      <div className="px-5 pb-5 pt-0">
                        <Button
                          className={`w-full transition-all duration-200 ${
                            isSelected 
                              ? "gradient-primary text-primary-foreground shadow-md" 
                              : "bg-muted hover:bg-primary/10 text-foreground"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlanSelect(plan);
                          }}
                        >
                          {isSelected ? "✓ Selected" : price === 0 ? "Start Free Trial" : `Select ${plan.display_name}`}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Summary */}
            <div>
              <Card className="sticky top-24 shadow-xl border-primary/20 bg-gradient-to-br from-card to-primary/5">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" /> 
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> Subscription
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{selectedPlan?.display_name || 'Select a plan'}</span>
                      <span className="font-semibold text-lg">
                        {selectedPlan?.price_monthly === 0 ? 'Free' : `$${getPlanPrice().toFixed(2)}/${billingCycle === 'monthly' ? 'mo' : 'yr'}`}
                      </span>
                    </div>
                    {billingCycle === 'yearly' && yearlySavingsPercent > 0 && (
                      <div className="flex justify-between text-sm text-green-600 bg-green-500/10 px-2 py-1 rounded-lg">
                        <span>Yearly discount ({yearlySavingsPercent}% OFF)</span>
                        <span className="font-semibold">-${yearlySavingsAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {includesFreeDevice && selectedPlan && (
                      <div className="flex justify-between text-sm text-green-600 bg-green-500/10 px-2 py-1 rounded-lg">
                        <span className="flex items-center gap-1"><Gift className="h-3 w-3" /> Free Device Included</span>
                        <span>-$99</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {finalTotal > 0 ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>${totalAmount.toFixed(2)}</span>
                      </div>
                      {includeTax && tax > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax ({TAX_CONFIG.rate}% {TAX_CONFIG.name})</span>
                          <span>${tax.toFixed(2)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between items-center text-xl font-bold pt-2">
                        <span>Total</span>
                        <span className="text-primary">${finalTotal.toFixed(2)}</span>
                      </div>
                      {billingCycle === 'yearly' && yearlySavingsAmount > 0 && (
                        <p className="text-xs text-green-600 text-center bg-green-500/10 py-2 rounded-lg">
                          🎉 You save ${yearlySavingsAmount.toFixed(2)} with yearly billing
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Gift className="h-6 w-6 text-green-500" />
                      </div>
                      <p className="font-semibold text-green-600">Free Trial</p>
                      <p className="text-xs text-muted-foreground">No payment required</p>
                    </div>
                  )}

                  <Button 
                    className="w-full gradient-primary text-primary-foreground py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200" 
                    onClick={handleProceedToPayment} 
                    disabled={!selectedPlan || processing}
                  >
                    {processing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : finalTotal > 0 ? (
                      <><CreditCard className="h-5 w-5 mr-2" /> Pay ${finalTotal.toFixed(2)}</>
                    ) : "Activate Free Trial"}
                  </Button>

                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <Shield className="h-4 w-4 text-primary mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">
                      Your payment is secure and encrypted.<br />
                      {!isFreeTrial && "Subscription auto-renews unless canceled."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && selectedPlan && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-heading font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Complete Payment
                </h2>
                <button 
                  onClick={handleCancelPayment} 
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted"
                  disabled={processing}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-4 p-4 bg-gradient-to-br from-primary/5 to-transparent rounded-xl border border-primary/20">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Organization</span>
                    <span className="font-medium">{organizationType === 'school' ? '🏫 School' : '🏢 Company'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <span className="font-semibold">{selectedPlan.display_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Billing Cycle</span>
                    <span className="font-medium capitalize">{billingCycle}</span>
                  </div>
                  {billingCycle === 'yearly' && yearlySavingsPercent > 0 && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>Yearly discount</span>
                      <span>Save {yearlySavingsPercent}%</span>
                    </div>
                  )}
                  {includesFreeDevice && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>✓ Free device included</span>
                      <span>-$99</span>
                    </div>
                  )}
                  {includeTax && tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax ({TAX_CONFIG.rate}%)</span>
                      <span>${tax.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center pt-1">
                    <span className="font-semibold">Total to Pay</span>
                    <span className="text-2xl font-bold text-primary">${finalTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <PaymentForm
                amount={finalTotal}
                planName={selectedPlan.name}
                billingCycle={billingCycle}
                includesFreeDevice={includesFreeDevice}
                metadata={metadata}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onCancel={handleCancelPayment}
              />
            </div>
          </div>
        )}
      </div>
    </Elements>
  );
};

export default PaymentRequired;