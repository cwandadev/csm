// csms-frontend/src/pages/settings/components/OrganizationSettings.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Building2, Camera, Loader2, Mail, Phone, MapPin, Globe } from "lucide-react";
import { orgApi } from "@/lib/api";
import { SettingsTabProps } from "../types";

const getImageUrl = (image: string | null | undefined) => {
  if (!image) return null;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (!image.includes('/')) {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const staticBaseUrl = baseUrl.replace('/api', '');
    return `${staticBaseUrl}/uploads/logos/${image}`;
  }
  return image;
};

const OrganizationSettings = ({ admin, onToast }: SettingsTabProps) => {
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  
  const [form, setForm] = useState({
    org_name: "",
    address: "",
    contact_email: "",
    contact_phone: "",
    api_slug: "",
    province: "",
    district: "",
  });

  useEffect(() => {
    fetchOrganization();
  }, [admin]);

  const fetchOrganization = async () => {
    try {
      const res = await orgApi.getOrganization(admin?.organizationId || "");
      if (res.success && res.data) {
        const org = res.data as any;
        setForm({
          org_name: org.org_name || "",
          address: org.address || "",
          contact_email: org.contact_email || "",
          contact_phone: org.contact_phone || "",
          api_slug: org.page_slug || "",
          province: org.province || "",
          district: org.district || "",
        });
        setOrgLogo(org.logo || null);
      }
    } catch (error) {
      console.error("Error fetching organization:", error);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      onToast?.("Image size should be less than 2MB", "error");
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const token = localStorage.getItem('csm_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      
      const response = await fetch(`${apiUrl}/organizations/${admin?.organizationId}/logo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      
      const result = await response.json();
      if (result.success && result.data?.filename) {
        setOrgLogo(result.data.filename);
        onToast?.("Organization logo updated!", "success");
      } else {
        onToast?.("Failed to update logo", "error");
      }
    } catch (error) {
      onToast?.("Failed to upload logo", "error");
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await orgApi.updateOrganization(admin?.organizationId || "", {
        org_name: form.org_name,
        address: form.address,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        province: form.province,
        district: form.district,
      });
      
      if (res.success) {
        onToast?.("Organization updated successfully!", "success");
      } else {
        onToast?.("Failed to update organization", "error");
      }
    } catch (error) {
      onToast?.("Failed to update organization", "error");
    } finally {
      setLoading(false);
    }
  };

  const logoUrl = getImageUrl(orgLogo);
  const showLogo = logoUrl && !logoError;
  const orgInitials = form.org_name?.[0] || 'C';

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative">
          {showLogo ? (
            <img
              src={logoUrl!}
              alt="Organization Logo"
              className="w-24 h-24 rounded-xl object-cover border-2 border-primary"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 flex items-center justify-center font-heading font-bold text-3xl text-primary">
              {orgInitials}
            </div>
          )}
          <label className="absolute bottom-0 right-0 w-8 h-8 bg-card border-2 border-background rounded-full flex items-center justify-center cursor-pointer shadow-sm">
            <Camera className="h-4 w-4" />
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
          </label>
        </div>
        <div className="text-center sm:text-left flex-1">
          <p className="font-heading font-bold text-foreground text-xl">{form.org_name}</p>
          <p className="text-muted-foreground capitalize">{admin?.organizationType}</p>
          {uploadingLogo && <p className="text-xs text-muted-foreground mt-1"><Loader2 className="h-3 w-3 animate-spin inline" /> Uploading...</p>}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Organization Name</Label>
          <Input 
            value={form.org_name} 
            onChange={(e) => setForm({ ...form, org_name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Organization Type</Label>
          <Input value={admin?.organizationType} disabled className="bg-muted capitalize" />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Contact Email</Label>
          <Input 
            type="email" 
            value={form.contact_email} 
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            placeholder="contact@organization.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> Contact Phone</Label>
          <Input 
            value={form.contact_phone} 
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            placeholder="+250 781 281 828"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Province/State</Label>
          <Input 
            value={form.province} 
            onChange={(e) => setForm({ ...form, province: e.target.value })}
            placeholder="e.g., Kigali"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> District/City</Label>
          <Input 
            value={form.district} 
            onChange={(e) => setForm({ ...form, district: e.target.value })}
            placeholder="e.g., Gasabo"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Address</Label>
          <Input 
            value={form.address} 
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Street address"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="flex items-center gap-2"><Globe className="h-4 w-4" /> Live View URL Slug</Label>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">csm.cwanda.site/live/</span>
            <Input 
              value={form.api_slug} 
              onChange={(e) => setForm({ ...form, api_slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
              className="max-w-[250px]" 
              placeholder="your-org-slug"
            />
          </div>
          <p className="text-xs text-muted-foreground">Custom URL for your organization's live view page</p>
        </div>
      </div>

      <Button className="gradient-primary" onClick={handleSave} disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
      </Button>
    </div>
  );
};

export default OrganizationSettings;