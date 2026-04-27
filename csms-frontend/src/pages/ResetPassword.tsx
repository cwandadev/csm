import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LockKeyhole, CheckCircle, ArrowLeft } from "lucide-react";
import { authApi } from "@/lib/api";
import AuthBrandPanel from "@/components/AuthBrandPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid reset link. Please request a new password reset email.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.resetPassword(token, password);
      if (!res.success) {
        throw new Error(res.error || "Failed to reset password");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
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
                ? "Your password has been reset successfully."
                : "Enter and confirm your new password to complete account recovery."}
            </p>
          </div>

          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-body">{error}</div>}

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="font-body">New Password</Label>
                <Input
                  className="h-11 font-body"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="font-body">Confirm Password</Label>
                <Input
                  className="h-11 font-body"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full gradient-primary text-primary-foreground font-semibold h-11 font-body"
                disabled={loading}
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