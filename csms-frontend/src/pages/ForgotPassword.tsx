import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import AuthBrandPanel from "@/components/AuthBrandPanel";

const ForgotPassword = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendResetLink = async () => {
    setLoading(true);
    setError("");

    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendResetLink();
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AuthBrandPanel />
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden text-center">
            <div className="mx-auto w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center mb-3 shadow-lg">
              {sent ? <CheckCircle className="h-7 w-7 text-primary-foreground" /> : <Mail className="h-7 w-7 text-primary-foreground" />}
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-heading font-bold text-foreground">
              {sent ? "Check Your Email" : "Reset Password"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-body">
              {sent ? `We sent a reset link to ${email}` : "Enter your email to receive a password reset link"}
            </p>
          </div>

          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-body">{error}</div>}

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="font-body">Email Address</Label>
                <Input className="h-11 font-body" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required />
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground font-semibold h-11 font-body" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          ) : (
            <Button
              className="w-full gradient-primary text-primary-foreground font-semibold h-11 font-body"
              onClick={sendResetLink}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Again"}
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

export default ForgotPassword;
