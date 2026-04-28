// csmsa/src/pages/VerifyEmail.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { MailCheck } from "lucide-react";
import AuthBrandPanel from "@/components/AuthBrandPanel";

const VerifyEmail = () => {
  const { verifyEmail, resendCode, admin } = useAuth();
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
      if (ok) navigate("/dashboard");
      else setError("Invalid verification code. Please try again.");
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
            {loading ? "Verifying..." : "Verify Email"}
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
