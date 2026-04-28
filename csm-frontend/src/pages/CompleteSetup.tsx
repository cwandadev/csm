// csms-frontend/src/pages/CompleteSetup.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Loader2 } from "lucide-react";
import AuthBrandPanel from "@/components/AuthBrandPanel";

const CompleteSetup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    orgName: "",
    orgType: "school",
    orgAddress: "",
    orgEmail: "",
    orgPhone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${apiUrl}/auth/complete-google-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('csm_token')}`
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to complete setup');
      }

      // Update stored admin with new org info
      const storedAdmin = localStorage.getItem('csm_admin');
      if (storedAdmin) {
        const admin = JSON.parse(storedAdmin);
        admin.organizationName = form.orgName;
        admin.organizationType = form.orgType;
        localStorage.setItem('csm_admin', JSON.stringify(admin));
      }

      navigate("/dashboard");
    } catch (err) {
      console.error('Setup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AuthBrandPanel />
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-heading font-bold text-foreground">Complete Your Setup</h1>
            <p className="text-muted-foreground text-sm mt-1">Tell us about your organization</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Organization Name *</Label>
              <Input
                value={form.orgName}
                onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                placeholder="My School or Company"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Organization Type *</Label>
              <Select value={form.orgType} onValueChange={(v) => setForm({ ...form, orgType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="school">School / Education Institute</SelectItem>
                  <SelectItem value="company">Company / Business Organization</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email (Optional)</Label>
              <Input
                type="email"
                value={form.orgEmail}
                onChange={(e) => setForm({ ...form, orgEmail: e.target.value })}
                placeholder="contact@organization.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Phone (Optional)</Label>
              <Input
                value={form.orgPhone}
                onChange={(e) => setForm({ ...form, orgPhone: e.target.value })}
                placeholder="+250 788 123 456"
              />
            </div>

            <div className="space-y-2">
              <Label>Address (Optional)</Label>
              <Input
                value={form.orgAddress}
                onChange={(e) => setForm({ ...form, orgAddress: e.target.value })}
                placeholder="Street address"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Complete Setup
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompleteSetup;