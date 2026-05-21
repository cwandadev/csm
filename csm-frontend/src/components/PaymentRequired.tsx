// csms-frontend/src/pages/PaymentRequired.tsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CreditCard, Zap, Crown, Building2, Heart, Loader2,
  ShoppingCart, X, Check, AlertCircle, Gift, ChevronDown, ChevronUp,
  Percent, TrendingDown, Users, Shield, Award, Calendar
} from "lucide-react";
import { toast } from "sonner";

const TAX_CONFIG = { rate: 18, name: 'VAT' };

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
  stripe_price_id_monthly?: string;
  stripe_price_id_yearly?: string;
}

const SCHOOL_PLANS: SubscriptionPlan[] = [
  {
    id: 1, name: "free", display_name: "Free Trial", description: "30 days free trial.",
    price_monthly: 0, price_yearly: 0, max_users: 200, max_devices: 1, includes_free_device: false,
    features: ["Up to 200 users", "1 device included", "Basic analytics", "Email support", "30-day trial period"],
  },
  {
    id: 2, name: "basic", display_name: "Basic Plan", description: "For growing schools.",
    price_monthly: 15, price_yearly: 135, max_users: 1000, max_devices: 2, includes_free_device: false,
    features: ["Up to 1,000 users", "2 devices included", "Basic analytics", "Email support", "API access", "Data export", "Custom branding"],
    stripe_price_id_monthly: 'price_1TUbNbCE2cNbBO2QKA7T1ljO',
    stripe_price_id_yearly: 'price_1TUbNbCE2cNbBO2Qlo2Gs6J1'
  },
  {
    id: 3, name: "professional", display_name: "Professional", description: "For large schools.",
    price_monthly: 50, price_yearly: 450, max_users: 2000, max_devices: 5, includes_free_device: false,
    features: ["Up to 2,000 users", "5 devices included", "Advanced analytics", "Priority support", "Custom reports", "Custom branding", "API access", "Data export"],
    stripe_price_id_monthly: 'price_1TUbThCE2cNbBO2QxduoVj09',
    stripe_price_id_yearly: 'price_1TUbThCE2cNbBO2QpONVX5bY'
  },
  {
    id: 4, name: "enterprise", display_name: "Enterprise", description: "For large institutions.",
    price_monthly: 199, price_yearly: 1791, max_users: null, max_devices: 15, includes_free_device: true,
    features: ["Unlimited users", "15 devices included", "Premium analytics", "24/7 support", "1 free device", "Dedicated account manager", "Custom reports", "API access"],
    stripe_price_id_monthly: 'price_1TUbcbCE2cNbBO2Q9wSca7hP',
    stripe_price_id_yearly: 'price_1TUbcbCE2cNbBO2QZGTa3iXy'
  }
];

const COMPANY_PLANS: SubscriptionPlan[] = [
  {
    id: 5, name: "free", display_name: "Free Trial", description: "30 days free trial.",
    price_monthly: 0, price_yearly: 0, max_users: 50, max_devices: 1, includes_free_device: false,
    features: ["Up to 50 employees", "1 device included", "Basic analytics", "Email support"]
  },
  {
    id: 6, name: "basic", display_name: "Basic Plan", description: "For small businesses.",
    price_monthly: 20, price_yearly: 180, max_users: 100, max_devices: 2, includes_free_device: false,
    features: ["Up to 100 employees", "2 devices included", "Basic analytics", "Email support", "Custom branding"],
    stripe_price_id_monthly: 'price_1TUbuyCE2cNbBO2Q9PQFjAvb',
    stripe_price_id_yearly: 'price_1TUbuyCE2cNbBO2Qsbd0FRSu'
  },
  {
    id: 7, name: "professional", display_name: "Professional", description: "For growing businesses.",
    price_monthly: 60, price_yearly: 540, max_users: 1000, max_devices: 5, includes_free_device: false,
    features: ["Up to 1,000 employees", "5 devices included", "Advanced analytics", "Priority support", "Custom reports", "Custom branding"],
    stripe_price_id_monthly: 'price_1TUbyDCE2cNbBO2Qsn12vaYC',
    stripe_price_id_yearly: 'price_1TUbyDCE2cNbBO2QshtlNsIg'
  },
  {
    id: 8, name: "enterprise", display_name: "Enterprise", description: "For large enterprises.",
    price_monthly: 160, price_yearly: 1440, max_users: null, max_devices: 10, includes_free_device: true,
    features: ["Unlimited employees", "10 devices included", "Premium analytics", "24/7 support", "1 free device", "Dedicated account manager"],
    stripe_price_id_monthly: 'price_1TUc34CE2cNbBO2QQAt7rgC5',
    stripe_price_id_yearly: 'price_1TUc34CE2cNbBO2QdZ0eLPm8'
  }
];

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const PaymentRequired = () => {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);
  const [includeTax, setIncludeTax] = useState(false);
  const [organizationType, setOrganizationType] = useState<string>("school");
  
  // Get device ID from location state (selected during registration)
  const selectedDeviceId = (location.state as any)?.selectedDeviceId || localStorage.getItem('selected_device_id');

  const isCompany = organizationType === "company";
  const plans = isCompany ? COMPANY_PLANS : SCHOOL_PLANS;

  useEffect(() => {
    const storedOrgType = localStorage.getItem('selected_org_type') || "school";
    setOrganizationType(storedOrgType);
    
    const storedPlanId = localStorage.getItem('selected_plan_id');
    const storedCycle = localStorage.getItem('selected_billing_cycle');
    
    if (storedCycle && (storedCycle === 'monthly' || storedCycle === 'yearly')) {
      setBillingCycle(storedCycle);
    }
    
    if (storedPlanId) {
      let plan = plans.find(p => p.id === parseInt(storedPlanId));
      if (!plan) plan = plans.find(p => p.name === storedPlanId);
      if (plan) setSelectedPlan(plan);
      else setSelectedPlan(plans[0]);
    } else {
      setSelectedPlan(plans[0]);
    }
    
    setLoading(false);
  }, [plans]);

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

  const getFinalTotal = () => {
    let total = getPlanPrice();
    if (includeTax) total += total * (TAX_CONFIG.rate / 100);
    return total;
  };

  const handlePlanSelect = (plan: SubscriptionPlan) => {
  setSelectedPlan(plan);
  
  // Update localStorage with the selected plan
  localStorage.setItem('selected_plan_id', plan.id.toString());
  localStorage.setItem('selected_plan_name', plan.name);
  localStorage.setItem('selected_billing_cycle', billingCycle);
  
  // Also update the pending values if they exist (for when user changes plan)
  localStorage.setItem('pending_subscription_plan', plan.name);
  localStorage.setItem('pending_billing_cycle', billingCycle);
  localStorage.setItem('pending_organization_type', organizationType);
  
  console.log('Plan changed to:', plan.name, 'with cycle:', billingCycle);
};

// Also update when billing cycle changes
const handleBillingCycleChange = (cycle: "monthly" | "yearly") => {
  setBillingCycle(cycle);
  localStorage.setItem('selected_billing_cycle', cycle);
  
  if (selectedPlan) {
    localStorage.setItem('pending_billing_cycle', cycle);
  }
};
  const handleCreateCheckoutSession = async () => {
  if (!selectedPlan) {
    toast.error("Please select a subscription plan");
    return;
  }

  if (selectedPlan.name === 'free') {
    await handleFreeTrial();
    return;
  }

  setProcessing(true);

  try {
    const token = localStorage.getItem("csm_token");
    
    const priceId = billingCycle === 'monthly' 
      ? selectedPlan.stripe_price_id_monthly 
      : selectedPlan.stripe_price_id_yearly;

    if (!priceId) {
      toast.error("Price configuration missing for this plan");
      setProcessing(false);
      return;
    }

    // Store selected plan info before redirect
    localStorage.setItem('pending_subscription_plan', selectedPlan.name);
    localStorage.setItem('pending_billing_cycle', billingCycle);
    localStorage.setItem('pending_organization_type', organizationType);
    if (selectedDeviceId) {
      localStorage.setItem('pending_device_id', selectedDeviceId);
    }

    const response = await fetch(`${API_BASE_URL}/payment/create-checkout-session`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${token}` 
      },
      body: JSON.stringify({
        priceId: priceId,
        planName: selectedPlan.name,
        billingCycle: billingCycle,
        organizationType: organizationType,
        deviceId: selectedDeviceId,
        includeTax: includeTax,
        taxRate: includeTax ? TAX_CONFIG.rate : 0,
        successUrl: `${window.location.origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/payment-required`,
      })
    });

    const data = await response.json();

    if (data.success && data.data?.sessionUrl) {
      // Store session ID for potential recovery
      localStorage.setItem('stripe_session_id', data.data.sessionId);
      // Redirect to Stripe Checkout
      window.location.href = data.data.sessionUrl;
    } else {
      toast.error(data.error || "Failed to create checkout session");
      setProcessing(false);
    }
  } catch (error) {
    console.error("Error creating checkout session:", error);
    toast.error("Failed to create checkout session");
    setProcessing(false);
  }
};

  const handleFreeTrial = async () => {
    setProcessing(true);

    try {
      const token = localStorage.getItem("csm_token");

      const response = await fetch(`${API_BASE_URL}/payment/activate-free-trial`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({
          planName: selectedPlan?.name || 'free',
          organizationType: organizationType,
          deviceId: selectedDeviceId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Clear stored selections
        localStorage.removeItem('selected_plan_id');
        localStorage.removeItem('selected_plan_name');
        localStorage.removeItem('selected_billing_cycle');
        localStorage.removeItem('selected_plan_details');
        localStorage.removeItem('selected_org_type');
        
        toast.success("Free trial activated successfully!");
        
        // Redirect to hardware shop if device was selected
        if (selectedDeviceId) {
          navigate(`/hardware-shop?re-select_crat=csm-device-99_added&device_id=${selectedDeviceId}`);
        } else {
          navigate("/dashboard", { replace: true });
        }
      } else {
        toast.error(data.error || "Failed to activate free trial");
      }
    } catch (error) {
      console.error("Error activating free trial:", error);
      toast.error("Failed to activate free trial");
    } finally {
      setProcessing(false);
    }
  };

  const togglePlanExpand = (planId: number) => {
    setExpandedPlan(expandedPlan === planId ? null : planId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const finalTotal = getFinalTotal();
  const isFreeTrial = selectedPlan?.name === 'free';

  return (
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
          {selectedDeviceId && (
            <div className="mt-2 text-sm text-green-600">
              ✓ Device will be added after subscription
            </div>
          )}
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
      onClick={() => handleBillingCycleChange("monthly")}
      className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
        billingCycle === "monthly" 
          ? "gradient-primary text-primary-foreground shadow-md" 
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      Monthly Billing
    </button>
    <button
      onClick={() => handleBillingCycleChange("yearly")}
      className={`px-6 py-2 rounded-full text-sm font-medium transition-all relative ${
        billingCycle === "yearly" 
          ? "gradient-primary text-primary-foreground shadow-md" 
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      Yearly Billing
      {getYearlySavingsPercent() > 0 && (
        <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
          Save {getYearlySavingsPercent()}%
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
                    {isRecommended && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="gradient-primary text-primary-foreground border-0 px-3 py-1 text-xs shadow-md">
                          <Award className="h-3 w-3 mr-1" /> Most Popular
                        </Badge>
                      </div>
                    )}
                    
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                    )}
                    
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`p-2.5 rounded-xl ${
                          isSelected || isRecommended ? "bg-primary/15" : "bg-muted"
                        }`}>
                          <IconComponent className={`h-6 w-6 ${
                            isSelected || isRecommended ? "text-primary" : "text-muted-foreground"
                          }`} />
                        </div>
                      </div>
                      
                      <h3 className={`font-heading font-bold text-xl ${isSelected ? "text-primary" : "text-foreground"}`}>
                        {plan.display_name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.description}</p>
                      
                      <div className="mt-4">
                        {price === 0 ? (
                          <span className="text-3xl font-bold text-foreground">Free</span>
                        ) : (
                          <>
                            <span className="text-4xl font-bold text-foreground">${price}</span>
                            <span className="text-muted-foreground text-sm ml-1">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
                          </>
                        )}
                      </div>
                      
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full w-fit">
                        <Users className="h-3 w-3" />
                        <span>{plan.max_users === null ? "Unlimited users" : `Up to ${plan.max_users.toLocaleString()} users`}</span>
                      </div>
                      
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
                        </div>
                      )}
                    </div>
                    
                    <div className="px-5 pb-5 pt-0">
                      <Button
                        className={`w-full transition-all ${
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
                </div>

                <Separator />

                {finalTotal > 0 ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${getPlanPrice().toFixed(2)}</span>
                    </div>
                    {includeTax && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax ({TAX_CONFIG.rate}% {TAX_CONFIG.name})</span>
                        <span>${(getPlanPrice() * TAX_CONFIG.rate / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between items-center text-xl font-bold pt-2">
                      <span>Total</span>
                      <span className="text-primary">${finalTotal.toFixed(2)}</span>
                    </div>
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
                  className="w-full gradient-primary text-primary-foreground py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all" 
                  onClick={handleCreateCheckoutSession}
                  disabled={!selectedPlan || processing}
                >
                  {processing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : finalTotal > 0 ? (
                    <><CreditCard className="h-5 w-5 mr-2" /> Proceed to Checkout</>
                  ) : "Activate Free Trial"}
                </Button>

                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <Shield className="h-4 w-4 text-primary mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">
                    You will be redirected to Stripe secure checkout.<br />
                    {!isFreeTrial && "Subscription auto-renews unless canceled."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentRequired;