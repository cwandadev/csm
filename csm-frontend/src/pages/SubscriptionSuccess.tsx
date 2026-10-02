// csms-frontend/src/pages/SubscriptionSuccess.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const SubscriptionSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    console.log('Session ID from URL:', sessionId);
    
    if (!sessionId) {
      setError("No session ID found in URL");
      setProcessing(false);
      toast.error("Invalid session. Please contact support.");
      return;
    }
    
    // FIXED: Use activate-from-session instead of confirm-checkout-session
    activateFromSession(sessionId);
  }, [searchParams]);

  const activateFromSession = async (sessionId: string) => {
    try {
      const token = localStorage.getItem("csm_token");
      
      if (!token) {
        setError("Authentication token not found");
        setProcessing(false);
        toast.error("Please login again");
        setTimeout(() => navigate("/login"), 2000);
        return;
      }
      
      console.log('Activating subscription from session:', sessionId);
      
      // Get stored plan info as fallback
      const fallbackPlan = localStorage.getItem('selected_plan_name') || 'basic';
      const fallbackCycle = localStorage.getItem('selected_billing_cycle') || 'monthly';
      const fallbackOrgType = localStorage.getItem('selected_org_type') || 'school';
      const fallbackDeviceId = localStorage.getItem('selected_device_id') || '';
      
      // FIXED: Call activate-from-session endpoint (not confirm-checkout-session)
      const response = await fetch(`${API_BASE_URL}/payment/activate-from-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          sessionId,
          fallbackPlan,
          fallbackCycle,
          fallbackOrgType,
          fallbackDeviceId
        })
      });

      const data = await response.json();
      console.log('Activation response:', data);

      if (data.success) {
        setSuccess(true);
        setRedirectUrl(data.data?.redirect_url || null);
        toast.success(data.data?.message || "Subscription activated successfully!");
        
        // Clear stored selections
        localStorage.removeItem('selected_plan_id');
        localStorage.removeItem('selected_plan_name');
        localStorage.removeItem('selected_billing_cycle');
        localStorage.removeItem('selected_plan_details');
        localStorage.removeItem('selected_org_type');
        localStorage.removeItem('selected_device_id');
        localStorage.removeItem('pending_subscription_plan');
        localStorage.removeItem('pending_billing_cycle');
        localStorage.removeItem('pending_organization_type');
        localStorage.removeItem('pending_device_id');
        localStorage.removeItem('stripe_session_id');
        
        // Auto redirect after 3 seconds
        setTimeout(() => {
          if (data.data?.redirect_url) {
            navigate(data.data.redirect_url);
          } else {
            navigate("/dashboard", { replace: true });
          }
        }, 3000);
      } else {
        setError(data.error || "Failed to activate subscription");
        toast.error(data.error || "Failed to activate subscription");
      }
    } catch (error: any) {
      console.error("Error activating subscription:", error);
      setError(error.message || "Network error. Please try again.");
      toast.error("Failed to activate subscription. Please contact support.");
    } finally {
      setProcessing(false);
    }
  };

  const handleRetry = () => {
    navigate("/payment-required");
  };

  const handleGoToDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-6 text-center">
          {processing ? (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Processing Your Subscription...</h2>
              <p className="text-muted-foreground">Please wait while we activate your account.</p>
            </>
          ) : success ? (
            <>
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Subscription Activated!</h2>
              <p className="text-muted-foreground mb-6">
                Your subscription has been successfully activated.
                {redirectUrl ? " Redirecting you to complete device setup..." : " Redirecting you to the dashboard..."}
              </p>
              <div className="bg-muted/30 rounded-lg p-4 mb-4 text-left">
                <p className="text-sm font-semibold mb-2">What happens next?</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ Your subscription is now active</li>
                  <li>✓ You can access all features of your plan</li>
                  {redirectUrl && <li>✓ You'll be redirected to add your device</li>}
                  <li>✓ Check your dashboard for details</li>
                </ul>
              </div>
              <Button 
                onClick={() => navigate(redirectUrl || "/dashboard")} 
                className="w-full"
              >
                Continue to {redirectUrl ? "Device Setup" : "Dashboard"}
              </Button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Activation Failed</h2>
              <p className="text-muted-foreground mb-4">
                {error || "We couldn't activate your subscription."}
              </p>
              <div className="space-y-3">
                <Button onClick={handleRetry} variant="outline" className="w-full">
                  Try Again
                </Button>
                <Button onClick={handleGoToDashboard} variant="ghost" className="w-full">
                  Go to Dashboard
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                If the problem persists, please contact support with your payment receipt.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionSuccess;