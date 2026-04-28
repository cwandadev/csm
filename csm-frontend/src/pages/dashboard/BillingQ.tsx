import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Check, Zap, Crown, Building2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { orgApi } from "@/lib/api";

const plans = [
  {
    id: "free_trial",
    name: "Free Trial",
    description: "Get started",
    price: "$0",
    period: "/30 days",
    icon: Zap,
    features: ["5 Devices", "100 Users", "Basic Analytics", "Email Support"],
  },
  {
    id: "basic",
    name: "Basic",
    description: "For small organizations",
    price: "$29",
    period: "/month",
    icon: CreditCard,
    features: ["10 Devices", "500 Users", "Advanced Analytics", "Priority Support", "Custom Reports"],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For growing organizations",
    price: "$79",
    period: "/month",
    icon: Crown,
    features: ["50 Devices", "5,000 Users", "Premium Analytics", "24/7 Support", "API Access", "Custom Branding"],
    recommended: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large institutions",
    price: "$199",
    period: "/month",
    icon: Building2,
    features: ["Unlimited Devices", "Unlimited Users", "Full Analytics Suite", "Dedicated Support", "On-premise Option", "SLA"],
  },
];

const Billing = () => {
  const { admin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState({
    plan: "free_trial",
    status: "active",
    expiresAt: null,
    daysLeft: 23,
  });

  useEffect(() => {
    if (admin?.organizationId) {
      fetchSubscription();
    }
  }, [admin]);

  const fetchSubscription = async () => {
    try {
      const res = await orgApi.getOrganization(admin?.organizationId || "");
      if (res.success && res.data) {
        const org = res.data as any;
        setSubscription({
          plan: org.subscription_status === "active" ? "pro" : "free_trial",
          status: org.subscription_status,
          expiresAt: org.subscription_expires_at,
          daysLeft: org.subscription_expires_at 
            ? Math.ceil((new Date(org.subscription_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : 23,
        });
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const trialTotal = 30;
  const trialProgress = ((trialTotal - subscription.daysLeft) / trialTotal) * 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPlan = plans.find(p => p.id === subscription.plan) || plans[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Billing & Plans</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your subscription and payment.</p>
      </div>

      {/* Current Plan Banner */}
      <div className="rounded-xl p-5 text-white shadow-card border-0 bg-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-heading font-bold text-lg">Current Plan: {currentPlan.name}</p>
            <p className="text-sm text-white/80">
              {subscription.status === "active" 
                ? `${subscription.daysLeft} days remaining`
                : "Your trial has ended - please upgrade"}
            </p>
          </div>
          <Badge className="bg-warning/10 text-warning border-warning/20" variant="outline">
            {subscription.status === "active" ? "Active" : "Expired"}
          </Badge>
        </div>
        {subscription.status === "active" && subscription.plan === "free_trial" && (
          <Progress value={trialProgress} className="h-2 bg-white/20 [&>div]:bg-blue" />
        )}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((p) => {
          const Icon = p.icon;
          const isCurrent = p.id === subscription.plan;
          return (
            <Card
              key={p.id}
              className={`border shadow-sm bg-card transition-all hover:shadow-lg relative ${
                p.recommended ? "border-primary ring-1 ring-primary" : isCurrent ? "border-success" : "border-border"
              }`}
            >
              {p.recommended && (
                <Badge className="absolute -top-3 -right-5 -translate-x-1/2 bg-primary text-primary-foreground border-0 text-xs px-3">
                  POPULAR
                </Badge>
              )}
              <CardHeader className="pb-3 pt-5 mb-2 items-center">
                <CardTitle className="font-heading text-foreground text-xlg mb-1 mt-5">{p.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{p.description}</p>
                <div className="mt-2">
                  <span className="text-3xl font-heading font-bold text-foreground">{p.price}</span>
                  <span className="text-muted-foreground text-sm">{p.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-0">
                {p.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    {f}
                  </div>
                ))}
                <Button
                  className={`w-full mt-4 ${
                    isCurrent
                      ? "bg-muted text-muted-foreground hover:bg-muted"
                      : "gradient-primary text-primary-foreground hover:opacity-90"
                  }`}
                  disabled={isCurrent}
                  onClick={() => {
                    if (!isCurrent) {
                      // Handle upgrade
                      window.location.href = "/dashboard/billing/upgrade";
                    }
                  }}
                >
                  {isCurrent ? "Current Plan" : "Upgrade"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Payment History */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {subscription.plan === "free_trial" ? (
            <p className="text-sm text-muted-foreground text-center py-8">No payments yet — you're on a free trial</p>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Pro Plan - Monthly</p>
                  <p className="text-xs text-muted-foreground">Paid on Mar 1, 2026</p>
                </div>
                <p className="text-sm font-semibold text-foreground">$79.00</p>
              </div>
              <div className="flex justify-between items-center py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Pro Plan - Monthly</p>
                  <p className="text-xs text-muted-foreground">Paid on Feb 1, 2026</p>
                </div>
                <p className="text-sm font-semibold text-foreground">$79.00</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Billing;