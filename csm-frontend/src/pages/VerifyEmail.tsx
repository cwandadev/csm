// csms-frontend/src/pages/VerifyEmail.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { MailCheck, Loader2 } from "lucide-react";
import AuthBrandPanel from "@/components/AuthBrandPanel";
import { toast } from "sonner";

const VerifyEmail = () => {
  const { verifyEmail, resendCode, admin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const ok = await verifyEmail(code);
      if (ok) {
        // After successful verification, get stored plan data and redirect to payment page
        const selectedPlanId = localStorage.getItem('selected_plan_id');
        const billingCycle = localStorage.getItem('selected_billing_cycle');
        const planDetails = localStorage.getItem('selected_plan_details');
        
        toast.success("Email verified successfully!");
        
        setTimeout(() => {
          navigate("/payment-required", {
            replace: true,
            state: {
              selectedPlanId: selectedPlanId,
              billingCycle: billingCycle,
              planDetails: planDetails ? JSON.parse(planDetails) : null
            }
          });
        }, 1500);
      } else {
        setError("Invalid verification code. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    setMessage("");

    try {
      await resendCode();
      setMessage("Verification code sent again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AuthBrandPanel />
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto w-20 h-20 gradient-primary rounded-full flex items-center justify-center shadow-lg">
            <MailCheck className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Verify Your Email</h1>
          <p className="text-muted-foreground text-sm font-body">
            We sent a 6-digit code to <strong className="text-foreground">{admin?.email || "your email"}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            After verification, you'll be redirected to complete your subscription.
          </p>

          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-body">{error}</div>}
          {message && <div className="p-3 rounded-lg bg-success/10 text-success text-sm font-body">{message}</div>}

          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            className="w-full gradient-primary text-primary-foreground font-semibold h-11 font-body"
            onClick={handleVerify}
            disabled={code.length < 6 || loading}
          >
            {loading ? "Verifying..." : "Verify & Continue"}
          </Button>

          <p className="text-sm text-muted-foreground font-body">
            Didn't receive the code?{" "}
            <button
              className="text-primary font-medium hover:underline"
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? "Sending..." : "Resend Code"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;