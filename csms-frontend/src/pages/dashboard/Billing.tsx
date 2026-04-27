// csmsa/src/pages/dashboard/Billing.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  CreditCard, Check, Zap, Crown, Building2, Loader2, Heart, Headphones, 
  ShoppingCart, Plus, Minus, Smartphone, Fingerprint, FileText, 
  Download, Gift, LucideIcon
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { orgApi } from "@/lib/api";
import { toast } from "sonner";

// Subscription plans interface
interface SubscriptionPlan {
  id: number;
  name: string;
  display_name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number | null;
  max_devices: number | null;
  max_admins: number;
  analytics_level: string;
  support_level: string;
  api_access: boolean;
  custom_reports: boolean;
  custom_branding: boolean;
  live_view_duration: number;
  export_data: boolean;
  webhooks: boolean;
  discount_rate?: number;
}

// School plans from document
const SCHOOL_PLANS: SubscriptionPlan[] = [
  {
    id: 1,
    name: "free",
    display_name: "Free Trial",
    description: "30 days free trial. 200 users, up to 1 device.",
    price_monthly: 0,
    price_yearly: 0,
    max_users: 200,
    max_devices: 1,
    max_admins: 1,
    analytics_level: "basic",
    support_level: "email",
    api_access: true,
    custom_reports: false,
    custom_branding: false,
    live_view_duration: 60,
    export_data: false,
    webhooks: true,
    discount_rate: 0
  },
  {
    id: 2,
    name: "basic",
    display_name: "Basic Plan",
    description: "1000 users, up to 2 devices, basic analytics.",
    price_monthly: 15,
    price_yearly: 135,
    max_users: 1000,
    max_devices: 2,
    max_admins: 2,
    analytics_level: "basic",
    support_level: "email",
    api_access: true,
    custom_reports: false,
    custom_branding: true,
    live_view_duration: 120,
    export_data: true,
    webhooks: true,
    discount_rate: 0
  },
  {
    id: 3,
    name: "professional",
    display_name: "Professional Plan",
    description: "2000 users, up to 5 devices, advanced analytics, priority support.",
    price_monthly: 50,
    price_yearly: 450,
    max_users: 2000,
    max_devices: 5,
    max_admins: 3,
    analytics_level: "advanced",
    support_level: "priority",
    api_access: true,
    custom_reports: true,
    custom_branding: true,
    live_view_duration: 240,
    export_data: true,
    webhooks: true,
    discount_rate: 10
  },
  {
    id: 4,
    name: "enterprise",
    display_name: "Enterprise",
    description: "Unlimited Users, up to 15 devices, premium Analytics, 5 Admins.",
    price_monthly: 199,
    price_yearly: 1791,
    max_users: null,
    max_devices: 15,
    max_admins: 5,
    analytics_level: "premium",
    support_level: "24/7",
    api_access: true,
    custom_reports: true,
    custom_branding: true,
    live_view_duration: 480,
    export_data: true,
    webhooks: true,
    discount_rate: 20
  }
];

// Company plans from document
const COMPANY_PLANS: SubscriptionPlan[] = [
  {
    id: 5,
    name: "free",
    display_name: "Free Trial",
    description: "30 days free trial. 50 users, up to 1 device.",
    price_monthly: 0,
    price_yearly: 0,
    max_users: 50,
    max_devices: 1,
    max_admins: 1,
    analytics_level: "basic",
    support_level: "email",
    api_access: true,
    custom_reports: false,
    custom_branding: false,
    live_view_duration: 60,
    export_data: false,
    webhooks: true,
    discount_rate: 0
  },
  {
    id: 6,
    name: "basic",
    display_name: "Basic Plan",
    description: "100 users, up to 2 devices, basic analytics.",
    price_monthly: 20,
    price_yearly: 180,
    max_users: 100,
    max_devices: 2,
    max_admins: 2,
    analytics_level: "basic",
    support_level: "email",
    api_access: true,
    custom_reports: false,
    custom_branding: true,
    live_view_duration: 120,
    export_data: true,
    webhooks: true,
    discount_rate: 0
  },
  {
    id: 7,
    name: "professional",
    display_name: "Professional Plan",
    description: "1000 users, up to 5 devices, advanced analytics, priority support.",
    price_monthly: 60,
    price_yearly: 540,
    max_users: 1000,
    max_devices: 5,
    max_admins: 3,
    analytics_level: "advanced",
    support_level: "priority",
    api_access: true,
    custom_reports: true,
    custom_branding: true,
    live_view_duration: 240,
    export_data: true,
    webhooks: true,
    discount_rate: 10
  },
  {
    id: 8,
    name: "enterprise",
    display_name: "Enterprise",
    description: "Unlimited Users, up to 10 devices, premium Analytics, 5 Admins.",
    price_monthly: 160,
    price_yearly: 1440,
    max_users: null,
    max_devices: 10,
    max_admins: 5,
    analytics_level: "premium",
    support_level: "24/7",
    api_access: true,
    custom_reports: true,
    custom_branding: true,
    live_view_duration: 480,
    export_data: true,
    webhooks: true,
    discount_rate: 20
  }
];

// Hardware pricing from document
const HARDWARE_PRICING = {
  fingerprint_plus_card: 99,
  fingerprint_only: 90
};

// Additional device pricing - simplified
const EXTRA_DEVICE_PRICING = {
  per_device_monthly: 20
};

interface ExtraDevice {
  quantity: number;
  totalPrice: number;
  discountRate: number;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  description: string;
  invoiceNumber: string;
}

// Helper function to format relative time
const getRelativeTimeString = (dateString: string | null) => {
  if (!dateString) return "No expiration date";
  
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return "Expired";
  if (diffDays === 0) return "Expires today";
  if (diffDays === 1) return "Expires tomorrow";
  if (diffDays < 7) return `Expires in ${diffDays} days`;
  if (diffDays < 30) return `Expires in ${Math.floor(diffDays / 7)} weeks`;
  if (diffDays < 365) return `Expires in ${Math.floor(diffDays / 30)} months`;
  return `Expires in ${Math.floor(diffDays / 365)} years`;
};

const Billing = () => {
  const { admin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [plans, setPlans] = useState<SubscriptionPlan[]>(SCHOOL_PLANS);
  const [currentSubscription, setCurrentSubscription] = useState({
    plan_id: 1,
    plan_name: "free",
    display_name: "Free Trial",
    status: "trial",
    expiresAt: null as string | null,
    max_users: 200,
    max_devices: 1,
    current_devices: 0
  });
  const [extraDevices, setExtraDevices] = useState<ExtraDevice>({
    quantity: 0,
    totalPrice: 0,
    discountRate: 0
  });
  const [showDevicePurchase, setShowDevicePurchase] = useState(false);
  const [buyingHardware, setBuyingHardware] = useState<"fingerprint_card" | "fingerprint_only" | null>(null);
  const [invoices] = useState<Invoice[]>([
    {
      id: "inv_1",
      invoiceNumber: "INV-2024-001",
      date: new Date().toISOString(),
      amount: 199,
      status: "paid",
      description: "Enterprise Plan - Monthly Subscription"
    }
  ]);
  const [paymentMethods] = useState<Array<{id: string; brand: string; last4: string; expMonth: number; expYear: number; isDefault: boolean}>>([
    {
      id: "pm_1",
      brand: "Visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2026,
      isDefault: true
    }
  ]);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);

  const organizationType = (admin as any)?.organizationType || (admin as any)?.org_type || "school";
  const isCompany = organizationType === "company";

  useEffect(() => {
    const planSet = isCompany ? COMPANY_PLANS : SCHOOL_PLANS;
    setPlans(planSet);
    fetchPlansAndSubscription();
  }, [admin, isCompany]);

  const fetchPlansAndSubscription = async () => {
    try {
      const orgRes = await orgApi.getOrganization(admin?.organizationId || "");
      
      if (orgRes.success && orgRes.data) {
        const org = orgRes.data as any;
        const subscriptionPlan = org.subscription_plan;
        
        if (subscriptionPlan) {
          const planSet = isCompany ? COMPANY_PLANS : SCHOOL_PLANS;
          const currentPlan = planSet.find(p => p.name === subscriptionPlan.name) || planSet[0];
          
          setCurrentSubscription({
            plan_id: currentPlan.id,
            plan_name: subscriptionPlan.name,
            display_name: subscriptionPlan.display_name,
            status: org.subscription_status === "active" ? "active" : org.subscription_status === "trial" ? "trial" : "inactive",
            expiresAt: org.subscription_expires_at,
            max_users: currentPlan.max_users || 200,
            max_devices: currentPlan.max_devices || 1,
            current_devices: 0
          });
        }
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPlanPrice = (plan: SubscriptionPlan) => {
    return billingCycle === "monthly" ? plan.price_monthly : plan.price_yearly;
  };

  const handleUpgrade = async (plan: SubscriptionPlan) => {
    if (plan.id === currentSubscription.plan_id) {
      toast.info("This is already your current plan");
      return;
    }
    
    setProcessingPayment(true);
    
    try {
      const token = localStorage.getItem("csm_token");
      let expiresAt = new Date();
      
      if (billingCycle === "monthly") {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }
      
      const res = await fetch(`http://localhost:3000/api/billing/${admin?.organizationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subscription_status: "active",
          subscription_expires_at: expiresAt.toISOString(),
          plan_id: plan.id,
          billing_cycle: billingCycle
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success(`Successfully upgraded to ${plan.display_name}!`);
        fetchPlansAndSubscription();
      } else {
        toast.error(data.error || "Upgrade failed");
      }
    } catch (error) {
      console.error("Error upgrading:", error);
      toast.error("Failed to process upgrade");
    } finally {
      setProcessingPayment(false);
    }
  };

  const getDeviceDiscountRate = () => {
    const currentPlan = plans.find(p => p.id === currentSubscription.plan_id);
    if (currentPlan?.name === "professional") return 10;
    if (currentPlan?.name === "enterprise") return 20;
    return 0;
  };

  const getDevicePriceWithDiscount = () => {
    const discount = getDeviceDiscountRate();
    if (discount === 0) return EXTRA_DEVICE_PRICING.per_device_monthly;
    return EXTRA_DEVICE_PRICING.per_device_monthly * (1 - discount / 100);
  };

  const handleAddExtraDevices = async () => {
    if (extraDevices.quantity <= 0) {
      toast.error("Please select number of extra devices");
      return;
    }
    
    setProcessingPayment(true);
    
    try {
      const pricePerDevice = getDevicePriceWithDiscount();
      const totalPrice = pricePerDevice * extraDevices.quantity;
      
      toast.success(`Added ${extraDevices.quantity} extra device(s) for $${totalPrice.toFixed(2)}/month`);
      setShowDevicePurchase(false);
      setExtraDevices({ quantity: 0, totalPrice: 0, discountRate: 0 });
    } catch (error) {
      console.error("Error adding devices:", error);
      toast.error("Failed to add extra devices");
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleBuyHardware = async (type: "fingerprint_card" | "fingerprint_only") => {
    setBuyingHardware(type);
    
    try {
      const price = type === "fingerprint_card" ? HARDWARE_PRICING.fingerprint_plus_card : HARDWARE_PRICING.fingerprint_only;
      toast.success(`${type === "fingerprint_card" ? "Fingerprint + Card Reader" : "Fingerprint Only Device"} added to cart! Total: $${price}`);
    } catch (error) {
      console.error("Error purchasing hardware:", error);
      toast.error("Failed to purchase device");
    } finally {
      setBuyingHardware(null);
    }
  };

  const updateExtraDeviceQuantity = (delta: number) => {
    const newQuantity = Math.max(0, Math.min(100, extraDevices.quantity + delta));
    const pricePerDevice = getDevicePriceWithDiscount();
    const totalPrice = pricePerDevice * newQuantity;
    const discountRate = getDeviceDiscountRate();
    
    setExtraDevices({
      quantity: newQuantity,
      totalPrice: totalPrice,
      discountRate: discountRate
    });
  };

  const handleAddPaymentMethod = async () => {
    setShowAddPaymentMethod(false);
    toast.success("Payment method added successfully!");
  };

  const currentPlan = plans.find(p => p.id === currentSubscription.plan_id) || plans[0];
  const isFreePlan = currentSubscription.plan_name === "free";
  const deviceDiscountRate = getDeviceDiscountRate();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Subscription & Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isCompany ? "Company" : "School"} - Manage your subscription and billing
        </p>
      </div>

      {/* Billing Cycle Toggle - Hide for free trial (non-renewable) */}
      {!isFreePlan && (
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-3 p-1 bg-muted rounded-full">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === "monthly"
                  ? "gradient-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all relative ${
                billingCycle === "yearly"
                  ? "gradient-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly <span className="text-xs">(Save 25%)</span>
            </button>
          </div>
        </div>
      )}

      {/* Current Plan Card */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Badge className="mb-2 bg-primary">Current Plan</Badge>
              <h2 className="text-xl font-bold">{currentPlan?.display_name}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {currentSubscription.status === "trial" 
                  ? getRelativeTimeString(currentSubscription.expiresAt)
                  : currentSubscription.expiresAt 
                    ? `Next billing: ${new Date(currentSubscription.expiresAt).toLocaleDateString()}`
                    : "Active subscription"}
              </p>
              {currentSubscription.status === "trial" && (
                <p className="text-xs text-amber-600 mt-1">⚠️ Free trial is non-renewable. Upgrade to continue.</p>
              )}
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {currentPlan?.max_users === null ? "∞" : currentPlan?.max_users || 200}
                </p>
                <p className="text-xs text-muted-foreground">Max Users</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {currentPlan?.max_devices === null ? "∞" : currentPlan?.max_devices}
                </p>
                <p className="text-xs text-muted-foreground">Max Devices</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold capitalize">{currentPlan?.support_level || "Email"}</p>
                <p className="text-xs text-muted-foreground">Support</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentSubscription.plan_id;
          const isRecommended = plan.name === "professional";
          const price = getPlanPrice(plan);
          const isFree = plan.name === "free";
          
          let IconComponent: LucideIcon = Heart;
          if (plan.name === "basic") IconComponent = Zap;
          else if (plan.name === "professional") IconComponent = Crown;
          else if (plan.name === "enterprise") IconComponent = Building2;
          
          return (
            <Card
              key={plan.id}
              className={`relative border shadow-sm bg-card transition-all hover:shadow-lg hover:-translate-y-1 duration-200 ${
                isRecommended 
                  ? "border-primary shadow-lg ring-2 ring-primary/20" 
                  : isCurrent 
                    ? "border-primary/50" 
                    : "border-border"
              }`}
            >
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="gradient-primary text-primary-foreground border-0 px-3 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              
              {isCurrent && (
                <div className="absolute top-3 right-3">
                  <Badge className={isFree ? "bg-primary" : "bg-green-500"}>
                    Current
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-3">
                  <div className={`p-3 rounded-full ${
                    isRecommended ? "bg-primary/10" : isFree ? "bg-primary/5" : "bg-muted"
                  }`}>
                    <IconComponent className={`h-8 w-8 ${
                      isRecommended ? "text-primary" : isFree ? "text-primary" : "text-muted-foreground"
                    }`} />
                  </div>
                </div>
                <CardTitle className="text-2xl font-heading">{plan.display_name}</CardTitle>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
                
                <div className="mt-4">
                  {price === 0 ? (
                    <span className="text-4xl font-bold text-foreground">Free</span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-foreground">${price}</span>
                      <span className="text-muted-foreground text-sm">/month</span>
                    </>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className={`h-4 w-4 shrink-0 ${isFree ? "text-primary" : "text-green-500"}`} />
                    <span>{plan.max_users === null ? "Unlimited" : plan.max_users} Users</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className={`h-4 w-4 shrink-0 ${isFree ? "text-primary" : "text-green-500"}`} />
                    <span>Up to {plan.max_devices === null ? "Unlimited" : plan.max_devices} Devices</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className={`h-4 w-4 shrink-0 ${isFree ? "text-primary" : "text-green-500"}`} />
                    <span className="capitalize">{plan.analytics_level} Analytics</span>
                  </div>
                  {plan.api_access && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className={`h-4 w-4 shrink-0 ${isFree ? "text-primary" : "text-green-500"}`} />
                      <span>API Access</span>
                    </div>
                  )}
                  {plan.custom_reports && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className={`h-4 w-4 shrink-0 ${isFree ? "text-primary" : "text-green-500"}`} />
                      <span>Custom Reports</span>
                    </div>
                  )}
                  {plan.custom_branding && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className={`h-4 w-4 shrink-0 ${isFree ? "text-primary" : "text-green-500"}`} />
                      <span>Custom Branding</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Check className={`h-4 w-4 shrink-0 ${isFree ? "text-primary" : "text-green-500"}`} />
                    <span className="capitalize">{plan.support_level} Support</span>
                  </div>
                </div>
                
                {isCurrent ? (
                  <Button className="w-full" variant="outline" disabled>
                    Current Plan
                  </Button>
                ) : isFree ? (
                  <Button 
                    className="w-full gradient-primary text-primary-foreground"
                    onClick={() => handleUpgrade(plan)}
                    disabled={processingPayment}
                  >
                    {processingPayment ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Start Free Trial
                  </Button>
                ) : (
                  <Button 
                    className="w-full gradient-primary text-primary-foreground"
                    onClick={() => handleUpgrade(plan)}
                    disabled={processingPayment}
                  >
                    {processingPayment ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Upgrade
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Hardware Store - Shown to everyone */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Hardware Store</CardTitle>
          <p className="text-sm text-muted-foreground">
            Purchase CSM devices for your organization - One-time payment
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fingerprint + Card Reader */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 border rounded-lg bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">CSM Device: FingerPrint + Card Reader</p>
                  <p className="text-xs text-muted-foreground">Biometric + RFID attendance solution</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">ESP32</Badge>
                    <Badge variant="outline">Fingerprint</Badge>
                    <Badge variant="outline">RFID Card</Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <p className="text-2xl font-bold text-primary">${HARDWARE_PRICING.fingerprint_plus_card}</p>
                <Button 
                  size="default"
                  className="gradient-primary text-primary-foreground"
                  onClick={() => handleBuyHardware("fingerprint_card")}
                  disabled={buyingHardware !== null}
                >
                  {buyingHardware === "fingerprint_card" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ShoppingCart className="h-4 w-4 mr-2" />
                  )}
                  Buy Now
                </Button>
              </div>
            </div>

            {/* Fingerprint Only */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 border rounded-lg bg-gradient-to-r from-secondary/5 to-transparent">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-secondary/10 rounded-lg">
                  <Fingerprint className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <p className="font-medium">CSM Device: FingerPrint Only</p>
                  <p className="text-xs text-muted-foreground">Biometric fingerprint scanner only</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">ESP32</Badge>
                    <Badge variant="outline">Fingerprint</Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <p className="text-2xl font-bold text-primary">${HARDWARE_PRICING.fingerprint_only}</p>
                <Button 
                  size="default"
                  className="gradient-primary text-primary-foreground"
                  onClick={() => handleBuyHardware("fingerprint_only")}
                  disabled={buyingHardware !== null}
                >
                  {buyingHardware === "fingerprint_only" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ShoppingCart className="h-4 w-4 mr-2" />
                  )}
                  Buy Now
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional CSM Devices - For paid users only */}
      {!isFreePlan && (
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg">Additional CSM Devices</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Add extra devices to your monthly subscription
                </p>
              </div>
              {!showDevicePurchase && (
                <Button className="gradient-primary text-primary-foreground" onClick={() => setShowDevicePurchase(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Devices
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showDevicePurchase ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 border rounded-lg bg-muted/20">
                  <div>
                    <p className="font-medium">Extra CSM Device</p>
                    <p className="text-xs text-muted-foreground">Add to your monthly subscription</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">${EXTRA_DEVICE_PRICING.per_device_monthly}</p>
                    <p className="text-xs text-muted-foreground">per device/month</p>
                  </div>
                </div>
                
                {deviceDiscountRate > 0 && (
                  <div className="p-3 bg-primary/10 rounded-lg text-center">
                    <Gift className="h-4 w-4 inline mr-2 text-primary" />
                    <span className="text-sm">
                      Your {currentPlan?.display_name} gives you {deviceDiscountRate}% discount! 
                      You pay only ${getDevicePriceWithDiscount().toFixed(2)} per device/month
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Quantity</p>
                    <p className="text-xs text-muted-foreground">Select number of extra devices</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => updateExtraDeviceQuantity(-1)}
                      disabled={extraDevices.quantity <= 0}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="text-2xl font-bold w-12 text-center">{extraDevices.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => updateExtraDeviceQuantity(1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {extraDevices.quantity > 0 && (
                  <div className="p-4 bg-primary/5 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">Total Monthly Cost</p>
                        <p className="text-xs text-muted-foreground">
                          {extraDevices.quantity} extra device(s)
                          {deviceDiscountRate > 0 && ` (${deviceDiscountRate}% discount applied)`}
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-primary">${extraDevices.totalPrice.toFixed(2)}/month</p>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDevicePurchase(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 gradient-primary text-primary-foreground"
                    onClick={handleAddExtraDevices}
                    disabled={extraDevices.quantity <= 0 || processingPayment}
                  >
                    {processingPayment ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ShoppingCart className="h-4 w-4 mr-2" />
                    )}
                    Add to Subscription - ${extraDevices.totalPrice.toFixed(2)}/month
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center p-4 border rounded-lg bg-muted/20">
                <div>
                  <p className="font-medium">Extra CSM Device</p>
                  <p className="text-xs text-muted-foreground">Add to your monthly subscription</p>
                  {deviceDiscountRate > 0 && (
                    <Badge variant="outline" className="mt-2 text-primary border-primary">
                      {deviceDiscountRate}% discount for {currentPlan?.display_name} users
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">${getDevicePriceWithDiscount().toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">per device/month</p>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4 text-center">
              * Additional devices can be added to any paid plan. 
              {deviceDiscountRate > 0 && ` Your ${currentPlan?.display_name} gives you ${deviceDiscountRate}% off on all extra devices!`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Complete Feature Comparison Table */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Complete Feature Comparison</CardTitle>
          <p className="text-sm text-muted-foreground">
            Compare all features across {isCompany ? "company" : "school"} plans
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold">Feature</th>
                  {plans.map((plan) => (
                    <th key={plan.id} className="text-center py-3 px-4 font-semibold">
                      {plan.display_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-3 px-4 font-medium">Maximum Users</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-3 px-4">
                      {plan.max_users === null ? "Unlimited" : plan.max_users}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-4 font-medium">CSM Devices Limit</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-3 px-4">
                      {plan.max_devices === null ? "Unlimited" : plan.max_devices}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-4 font-medium">Analytics Level</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-3 px-4 capitalize">
                      {plan.analytics_level}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-4 font-medium">Support Level</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-3 px-4 capitalize">
                      {plan.support_level}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-4 font-medium">API Access</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-3 px-4">
                      {plan.api_access ? "✓" : "✗"}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-4 font-medium">Custom Reports</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-3 px-4">
                      {plan.custom_reports ? "✓" : "✗"}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-4 font-medium">Custom Branding</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-3 px-4">
                      {plan.custom_branding ? "✓" : "✗"}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-4 font-medium">Live View Duration</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-3 px-4">
                      {plan.live_view_duration}s
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-4 font-medium">Data Export</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-3 px-4">
                      {plan.export_data ? "✓" : "✗"}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-4 font-medium">Webhooks</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-3 px-4">
                      {plan.webhooks ? "✓" : "✗"}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-4 font-medium">Max Admins</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-3 px-4">
                      {plan.max_admins}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg">Payment Methods</CardTitle>
              <p className="text-sm text-muted-foreground">Manage your payment methods</p>
            </div>
            {!isFreePlan && (
              <Button className="gradient-primary text-primary-foreground" onClick={() => setShowAddPaymentMethod(true)}>
                <CreditCard className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {showAddPaymentMethod ? (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-4 mb-4">
                  <CreditCard className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <Input placeholder="Card Number" className="mb-2" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="MM/YY" />
                      <Input placeholder="CVC" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowAddPaymentMethod(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button className="flex-1 gradient-primary text-primary-foreground" onClick={handleAddPaymentMethod}>
                    Save Payment Method
                  </Button>
                </div>
              </div>
            </div>
          ) : paymentMethods.length > 0 ? (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{method.brand} ending in {method.last4}</p>
                      <p className="text-xs text-muted-foreground">Expires {method.expMonth}/{method.expYear}</p>
                    </div>
                    {method.isDefault && (
                      <Badge variant="outline" className="ml-2">Default</Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm">Edit</Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No payment methods saved</p>
              {!isFreePlan && <p className="text-sm">Add a payment method to manage your subscription</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoice History</CardTitle>
          <p className="text-sm text-muted-foreground">View and download your invoices</p>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex justify-between items-center py-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{invoice.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(invoice.date).toLocaleDateString()} • {invoice.invoiceNumber}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">${invoice.amount}</p>
                    <Badge variant={invoice.status === "paid" ? "default" : "outline"} className="text-xs">
                      {invoice.status}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No invoices yet</p>
              <p className="text-sm">Invoices will appear here once you have billing activity</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Need Help Section */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6 text-center">
          <Headphones className="h-10 w-10 text-primary mx-auto mb-3" />
          <h3 className="font-semibold text-lg mb-1">Need help?</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Contact our support team for assistance with billing or subscriptions
          </p>
          <Button className="gradient-primary text-primary-foreground">Contact Support</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Billing;