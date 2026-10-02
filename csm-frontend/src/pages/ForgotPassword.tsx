// csms-frontend/src/pages/ForgotPassword.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, CheckCircle, AlertCircle, X, Info } from "lucide-react";
import AuthBrandPanel from "@/components/AuthBrandPanel";

// Toast Component
const Toast = ({ message, type, onClose }: { message: string; type: "success" | "error" | "info" | "warning"; onClose: () => void }) => {
  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertCircle className="h-5 w-5 text-yellow-500" />,
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

const ForgotPassword = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" | "warning" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" | "warning") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const sendResetLink = async () => {
    setLoading(true);

    try {
      await resetPassword(email);
      setSent(true);
      showToast("Password reset link sent! Check your email.", "success");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send reset link";
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showToast("Please enter your email address", "warning");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("Please enter a valid email address", "warning");
      return;
    }
    await sendResetLink();
  };

  return (
    <div className="min-h-screen flex bg-background">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <AuthBrandPanel />
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden text-center">
            <div className="mx-auto w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center mb-3 shadow-lg">
              {sent ? (
                <CheckCircle className="h-7 w-7 text-primary-foreground" />
              ) : (
                <Mail className="h-7 w-7 text-primary-foreground" />
              )}
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-heading font-bold text-foreground">
              {sent ? "Check Your Email" : "Reset Password"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-body">
              {sent 
                ? `We sent a reset link to ${email}` 
                : "Enter your email to receive a password reset link"}
            </p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="font-body">Email Address</Label>
                <Input 
                  className="h-11 font-body" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="admin@example.com" 
                  required 
                  autoFocus
                />
              </div>
              <Button 
                type="submit" 
                className="w-full gradient-primary text-primary-foreground font-semibold h-11 font-body" 
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <Button
                className="w-full gradient-primary text-primary-foreground font-semibold h-11 font-body"
                onClick={sendResetLink}
                disabled={loading}
              >
                {loading ? "Sending..." : "Resend Email"}
              </Button>
            </div>
          )}

          <div className="text-center">
            <Link to="/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1 font-body">
              <ArrowLeft className="h-3 w-3" /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;