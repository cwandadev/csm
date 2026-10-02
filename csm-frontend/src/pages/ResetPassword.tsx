// csms-frontend/src/pages/ResetPassword.tsx
import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LockKeyhole, CheckCircle, ArrowLeft, AlertCircle, Eye, EyeOff, X, Info } from "lucide-react";
import { authApi } from "@/lib/api";
import AuthBrandPanel from "@/components/AuthBrandPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" | "warning" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" | "warning") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    if (!token) {
      showToast("Invalid reset link. Please request a new password reset.", "error");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      showToast("Invalid reset link. Please request a new password reset.", "error");
      return;
    }

    if (password.length < 6) {
      showToast("Password must be at least 6 characters.", "warning");
      return;
    }

    if (password !== confirmPassword) {
      showToast("Passwords do not match.", "warning");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.resetPassword(token, password);
      
      if (!res.success) {
        throw new Error(res.error || "Failed to reset password");
      }

      setSuccess(true);
      showToast("Password reset successful! Redirecting to login...", "success");
      
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reset password";
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <AuthBrandPanel />

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden text-center">
            <div className="mx-auto w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center mb-3 shadow-lg">
              {success ? (
                <CheckCircle className="h-7 w-7 text-primary-foreground" />
              ) : (
                <LockKeyhole className="h-7 w-7 text-primary-foreground" />
              )}
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-heading font-bold text-foreground">
              {success ? "Password Updated" : "Create New Password"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-body">
              {success
                ? "Your password has been reset successfully. Redirecting to login..."
                : "Enter and confirm your new password to complete account recovery."}
            </p>
          </div>

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="font-body">New Password</Label>
                <div className="relative">
                  <Input
                    className="h-11 font-body pr-10"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
              </div>

              <div className="space-y-2">
                <Label className="font-body">Confirm Password</Label>
                <div className="relative">
                  <Input
                    className="h-11 font-body pr-10"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gradient-primary text-primary-foreground font-semibold h-11 font-body"
                disabled={loading || !token}
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          ) : (
            <Button
              className="w-full gradient-primary text-primary-foreground font-semibold h-11 font-body"
              onClick={() => navigate("/login")}
            >
              Go to Sign In
            </Button>
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

export default ResetPassword;