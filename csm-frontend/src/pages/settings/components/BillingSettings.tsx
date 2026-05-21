// csms-frontend/src/pages/settings/components/BillingSettings.tsx
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  FileText,
  Download,
  RefreshCw,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  ChevronRight,
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Smartphone,
  Users,
  Zap,
  Crown,
  Heart
} from "lucide-react";
import { SettingsTabProps } from "../types";
import { toast } from "sonner";

interface SubscriptionInfo {
  plan_id: number;
  plan_name: string;
  display_name: string;
  status: 'active' | 'trial' | 'expired' | 'cancelled' | 'past_due';
  start_date: string | null;
  end_date: string | null;
  trial_ends_at: string | null;
  auto_renew: boolean;
  billing_cycle: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  current_period_start: string;
  current_period_end: string;
  max_users: number | null;
  max_devices: number | null;
  current_users: number;
  current_devices: number;
}

interface Invoice {
  id: string;
  number: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed' | 'open';
  description: string;
  pdf_url?: string;
}

interface BillingInfo {
  billing_email: string;
  billing_phone: string;
  billing_address: string;
  billing_city: string;
  billing_country: string;
  tax_id: string;
  vat_number: string;
}

const BillingSettings = ({ admin, onToast }: SettingsTabProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [billingInfo, setBillingInfo] = useState<BillingInfo>({
    billing_email: "",
    billing_phone: "",
    billing_address: "",
    billing_city: "",
    billing_country: "Rwanda",
    tax_id: "",
    vat_number: "",
  });
  const [currency, setCurrency] = useState("USD");
  const [autoRenew, setAutoRenew] = useState(true);
  const [updatingAutoRenew, setUpdatingAutoRenew] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("csm_token");
      
      // Fetch subscription details
      const subRes = await fetch(`${API_BASE_URL}/billing/${admin?.organizationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const subData = await subRes.json();
      
      if (subData.success && subData.data) {
        const org = subData.data;
        setSubscription({
          plan_id: org.plan_id || 1,
          plan_name: org.plan_name || "free",
          display_name: org.display_name || "Free Trial",
          status: org.subscription_status === 'active' ? 'active' : 
                  org.subscription_status === 'trial' ? 'trial' : 'expired',
          start_date: org.created_at,
          end_date: org.subscription_expires_at,
          trial_ends_at: org.trial_ends_at,
          auto_renew: org.auto_renew !== false,
          billing_cycle: org.billing_cycle || 'monthly',
          amount: org.amount || 0,
          currency: org.currency || 'USD',
          current_period_start: org.current_period_start,
          current_period_end: org.current_period_end || org.subscription_expires_at,
          max_users: org.max_users || 200,
          max_devices: org.max_devices || 1,
          current_users: org.current_users || 0,
          current_devices: org.current_devices || 0
        });
        setAutoRenew(org.auto_renew !== false);
        
        // Load saved billing info
        const savedBilling = localStorage.getItem("billing_info");
        if (savedBilling) {
          setBillingInfo(JSON.parse(savedBilling));
        } else if (admin) {
          setBillingInfo(prev => ({
            ...prev,
            billing_email: admin.email || "",
          }));
        }
        
        const savedCurrency = localStorage.getItem("billing_currency");
        if (savedCurrency) {
          setCurrency(savedCurrency);
        }
      }
      
      // Fetch invoices
      const invRes = await fetch(`${API_BASE_URL}/stripe/invoices/${admin?.organizationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const invData = await invRes.json();
      if (invData.success && invData.data) {
        setInvoices(invData.data.map((inv: any) => ({
          id: inv.id,
          number: inv.number,
          date: new Date(inv.created * 1000).toISOString(),
          amount: inv.total / 100,
          status: inv.status,
          description: inv.lines?.data[0]?.description || "Subscription payment",
          pdf_url: inv.invoice_pdf
        })));
      }
    } catch (error) {
      console.error("Error fetching billing data:", error);
      toast.error("Failed to load billing information");
    } finally {
      setLoading(false);
    }
  }, [admin, API_BASE_URL]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleSaveBillingInfo = async () => {
    setSaving(true);
    try {
      localStorage.setItem("billing_info", JSON.stringify(billingInfo));
      localStorage.setItem("billing_currency", currency);
      
      const token = localStorage.getItem("csm_token");
      await fetch(`${API_BASE_URL}/billing/${admin?.organizationId}/info`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ billing_info: billingInfo, currency })
      });
      
      toast.success("Billing information saved successfully!");
    } catch (error) {
      console.error("Error saving billing info:", error);
      toast.error("Failed to save billing information");
    } finally {
      setSaving(false);
    }
  };

  const handleAutoRenewToggle = async (checked: boolean) => {
    setUpdatingAutoRenew(true);
    try {
      const token = localStorage.getItem("csm_token");
      const response = await fetch(`${API_BASE_URL}/billing/${admin?.organizationId}/auto-renew`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ auto_renew: checked })
      });
      
      const data = await response.json();
      if (data.success) {
        setAutoRenew(checked);
        toast.success(checked ? "Auto-renewal enabled" : "Auto-renewal disabled");
        if (subscription) {
          setSubscription({ ...subscription, auto_renew: checked });
        }
      } else {
        toast.error(data.error || "Failed to update auto-renewal");
      }
    } catch (error) {
      console.error("Error updating auto-renew:", error);
      toast.error("Failed to update auto-renewal setting");
    } finally {
      setUpdatingAutoRenew(false);
    }
  };

  const downloadInvoice = (invoice: Invoice) => {
    if (invoice.pdf_url) {
      window.open(invoice.pdf_url, "_blank");
    } else {
      toast.info("Invoice PDF will be available soon");
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = () => {
    switch (subscription?.status) {
      case 'active': return "bg-green-500";
      case 'trial': return "bg-blue-500";
      case 'expired': return "bg-red-500";
      case 'cancelled': return "bg-orange-500";
      case 'past_due': return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (subscription?.status) {
      case 'active': return "Active";
      case 'trial': return "Trial";
      case 'expired': return "Expired";
      case 'cancelled': return "Cancelled";
      case 'past_due': return "Past Due";
      default: return "Unknown";
    }
  };

  const getPlanIcon = () => {
    const planName = subscription?.plan_name;
    if (planName === 'free') return <Heart className="h-6 w-6 text-primary" />;
    if (planName === 'basic') return <Zap className="h-6 w-6 text-primary" />;
    if (planName === 'professional') return <Crown className="h-6 w-6 text-primary" />;
    return <Building2 className="h-6 w-6 text-primary" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getPlanIcon()}
            Current Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={getStatusColor()}>{getStatusText()}</Badge>
                {autoRenew && subscription?.status === 'active' && (
                  <Badge variant="outline" className="border-green-500 text-green-500">Auto-renew ON</Badge>
                )}
              </div>
              <h2 className="text-2xl font-bold">{subscription?.display_name}</h2>
              <p className="text-muted-foreground text-sm mt-1 capitalize">
                {subscription?.billing_cycle} billing
              </p>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="text-sm font-medium">{formatDate(subscription?.start_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Next Billing Date</p>
                  <p className="text-sm font-medium">{formatDate(subscription?.end_date)}</p>
                </div>
                {/*<div>
                  <p className="text-xs text-muted-foreground">Users</p>
                  <p className="text-sm font-medium">
                    {subscription?.current_users || 0} / {subscription?.max_users === null ? '∞' : subscription?.max_users}
                  </p>
                </div>*/}
                {/*<div>
                  <p className="text-xs text-muted-foreground">Devices</p>
                  <p className="text-sm font-medium">
                    {subscription?.current_devices || 0} / {subscription?.max_devices}
                  </p>
                </div>*/}
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">
                ${subscription?.amount}/{subscription?.billing_cycle === 'monthly' ? 'mo' : 'yr'}
              </p>
              {subscription?.status === 'trial' && subscription?.trial_ends_at && (
                <p className="text-sm text-blue-600 mt-1">
                  Trial ends {formatDate(subscription.trial_ends_at)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Subscription Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Auto-renewal</p>
              <p className="text-sm text-muted-foreground">
                Automatically renew your subscription at the end of each billing period
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${autoRenew ? 'text-green-500' : 'text-muted-foreground'}`}>
                {autoRenew ? 'Enabled' : 'Disabled'}
              </span>
              <Switch 
                checked={autoRenew} 
                onCheckedChange={handleAutoRenewToggle}
                disabled={updatingAutoRenew}
              />
            </div>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Billing Currency</p>
              <p className="text-sm text-muted-foreground">
                Select your preferred billing currency
              </p>
            </div>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="RWF">RWF (FRw)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Billing Information
          </CardTitle>
          <p className="text-sm text-muted-foreground">Update your billing contact and address information</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Billing Email</Label>
              <Input
                type="email"
                value={billingInfo.billing_email}
                onChange={(e) => setBillingInfo({ ...billingInfo, billing_email: e.target.value })}
                placeholder="billing@organization.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> Billing Phone</Label>
              <Input
                value={billingInfo.billing_phone}
                onChange={(e) => setBillingInfo({ ...billingInfo, billing_phone: e.target.value })}
                placeholder="+250 788 123 456"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Billing Address</Label>
              <Input
                value={billingInfo.billing_address}
                onChange={(e) => setBillingInfo({ ...billingInfo, billing_address: e.target.value })}
                placeholder="Street address"
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={billingInfo.billing_city}
                onChange={(e) => setBillingInfo({ ...billingInfo, billing_city: e.target.value })}
                placeholder="Kigali"
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={billingInfo.billing_country} onValueChange={(v) => setBillingInfo({ ...billingInfo, billing_country: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rwanda">Rwanda</SelectItem>
                  <SelectItem value="Kenya">Kenya</SelectItem>
                  <SelectItem value="Uganda">Uganda</SelectItem>
                  <SelectItem value="Tanzania">Tanzania</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tax ID / VAT Number</Label>
              <Input
                value={billingInfo.tax_id}
                onChange={(e) => setBillingInfo({ ...billingInfo, tax_id: e.target.value })}
                placeholder="Tax ID"
              />
            </div>
            <div className="space-y-2">
              <Label>VAT Number (if applicable)</Label>
              <Input
                value={billingInfo.vat_number}
                onChange={(e) => setBillingInfo({ ...billingInfo, vat_number: e.target.value })}
                placeholder="VAT Number"
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={handleSaveBillingInfo} disabled={saving} className="gradient-primary">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Billing Information
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Invoice History
          </CardTitle>
          <p className="text-sm text-muted-foreground">View and download your past invoices</p>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{invoice.description}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(invoice.date)}
                        <span className="mx-1">•</span>
                        {invoice.number}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-foreground">${invoice.amount.toFixed(2)}</p>
                      <Badge variant={invoice.status === 'paid' ? 'default' : 'outline'} className="text-xs">
                        {invoice.status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => downloadInvoice(invoice)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No invoices yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Invoices will appear here once you have billing activity
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={fetchAllData} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Billing Data
        </Button>
      </div>
    </div>
  );
};

// Add Settings icon import
import { Settings } from "lucide-react";

export default BillingSettings;