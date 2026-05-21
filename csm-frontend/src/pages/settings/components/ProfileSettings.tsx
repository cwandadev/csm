// csms-frontend/src/pages/settings/components/ProfileSettings.tsx
import { useState, useEffect, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  UserCircle, Camera, Loader2, MapPin, 
  Twitter, Facebook, Instagram, Linkedin, Share2, Globe
} from "lucide-react";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { SettingsTabProps } from "../types";
import { SettingsDirtyContext } from "../index";

// Helper function to get image URL
const getProfileImageUrl = (profile: string | null | undefined) => {
  if (!profile) return null;
  if (profile.startsWith('http://') || profile.startsWith('https://')) return profile;
  if (profile.startsWith('data:image')) return null;
  if (!profile.includes('/')) {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const staticBaseUrl = baseUrl.replace('/api', '');
    return `${staticBaseUrl}/uploads/profiles/${profile}`;
  }
  return profile;
};

const ProfileSettings = ({ admin, updateProfile, onToast }: SettingsTabProps) => {
  const { setDirty, isDirty, resetDirty } = useContext(SettingsDirtyContext);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileImageError, setProfileImageError] = useState(false);
  
  // Track original values for comparison
  const [originalForm, setOriginalForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    bio: "",
    location: "",
    website: "",
    twitter: "",
    facebook: "",
    instagram: "",
    linkedin: "",
  });
  
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    bio: "",
    location: "",
    website: "",
    twitter: "",
    facebook: "",
    instagram: "",
    linkedin: "",
  });

  // Check if form has changes
  const checkForChanges = (currentForm: typeof form, original: typeof originalForm) => {
    const hasChanges = 
      currentForm.firstName !== original.firstName ||
      currentForm.lastName !== original.lastName ||
      currentForm.username !== original.username ||
      currentForm.bio !== original.bio ||
      currentForm.location !== original.location ||
      currentForm.website !== original.website ||
      currentForm.twitter !== original.twitter ||
      currentForm.facebook !== original.facebook ||
      currentForm.instagram !== original.instagram ||
      currentForm.linkedin !== original.linkedin;
    
    setDirty(hasChanges);
    return hasChanges;
  };

  useEffect(() => {
    if (admin) {
      const newForm = {
        firstName: admin.firstName || "",
        lastName: admin.lastName || "",
        username: admin.username || "",
        email: admin.email || "",
        bio: (admin as any).bio || "",
        location: (admin as any).location || "",
        website: (admin as any).website || "",
        twitter: (admin as any).twitter || "",
        facebook: (admin as any).facebook || "",
        instagram: (admin as any).instagram || "",
        linkedin: (admin as any).linkedin || "",
      };
      setForm(newForm);
      setOriginalForm(newForm);
      setProfileImage(admin.profile || null);
      setProfileImageError(false);
      setDirty(false);
    }
  }, [admin]);

  const handleFormChange = (field: keyof typeof form, value: string) => {
    const newForm = { ...form, [field]: value };
    setForm(newForm);
    checkForChanges(newForm, originalForm);
  };

  const getInitials = () => {
    const first = form.firstName?.[0] || '';
    const last = form.lastName?.[0] || '';
    if (first && last) return `${first}${last}`.toUpperCase();
    if (first) return first.toUpperCase();
    if (last) return last.toUpperCase();
    return form.username?.[0]?.toUpperCase() || 'U';
  };

  const profileImageUrl = getProfileImageUrl(profileImage);
  const showImage = profileImageUrl && !profileImageError;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB");
      return;
    }

    setUploadingImage(true);
    
    try {
      const formData = new FormData();
      formData.append('profile', file);
      const token = localStorage.getItem('csm_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      
      const response = await fetch(`${apiUrl}/auth/upload-profile`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success && result.data?.filename) {
        setProfileImage(result.data.filename);
        setDirty(true); // Mark as dirty since image changed
        toast.success("Profile image updated! Click Save Profile to apply.");
      } else {
        toast.error(result.error || "Failed to update profile image");
      }
    } catch (error) {
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updateData: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        username: form.username,
        bio: form.bio,
        location: form.location,
        website: form.website,
        twitter: form.twitter,
        facebook: form.facebook,
        instagram: form.instagram,
        linkedin: form.linkedin,
      };
      
      if (profileImage && profileImage !== admin?.profile) {
        updateData.profile = profileImage;
      }
      
      const res = await authApi.updateProfile(updateData);
      
      if (res.success) {
        if (admin) {
          const updatedAdmin = { 
            ...admin, 
            ...updateData, 
            profile: profileImage || admin.profile,
          };
          localStorage.setItem("csm_admin", JSON.stringify(updatedAdmin));
          if (updateProfile) {
            updateProfile(updatedAdmin);
          }
        }
        // Reset dirty state
        setOriginalForm(form);
        setDirty(false);
        toast.success("Profile updated successfully!");
      } else {
        toast.error(res.error || "Failed to update profile");
      }
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative">
          {showImage ? (
            <img
              src={profileImageUrl!}
              alt={`${form.firstName} ${form.lastName}`}
              className="w-24 h-24 rounded-full object-cover border-4 border-background shadow-lg"
              onError={() => setProfileImageError(true)}
            />
          ) : (
            <div className="w-24 h-24 gradient-primary rounded-full flex items-center justify-center text-primary-foreground text-3xl font-bold shadow-lg">
              {getInitials()}
            </div>
          )}
          <label className="absolute bottom-0 right-0 w-8 h-8 bg-card border-2 border-background rounded-full flex items-center justify-center cursor-pointer shadow-sm">
           <i className="bx bxs-image-add" />
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload} 
              disabled={uploadingImage} 
            />
          </label>
        </div>
        <div className="text-center sm:text-left flex-1">
          <p className="font-heading font-bold text-foreground text-xl">{form.firstName} {form.lastName}</p>
          <p className="text-muted-foreground">@{form.username}</p>
          {uploadingImage && (
            <p className="text-xs text-muted-foreground mt-1">
              <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Uploading...
            </p>
          )}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>First Name</Label>
          <Input 
            value={form.firstName} 
            onChange={(e) => handleFormChange('firstName', e.target.value)}
            placeholder="First name"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Last Name</Label>
          <Input 
            value={form.lastName} 
            onChange={(e) => handleFormChange('lastName', e.target.value)}
            placeholder="Last name"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Username</Label>
          <Input 
            value={form.username} 
            onChange={(e) => handleFormChange('username', e.target.value)}
            placeholder="username"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={form.email} disabled className="bg-muted" />
        </div>
        
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Bio</Label>
          <textarea 
            value={form.bio} 
            onChange={(e) => handleFormChange('bio', e.target.value)} 
            placeholder="Tell others about yourself..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foregrounds focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            rows={3}
          />
        </div>
        
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Location
          </Label>
          <Input 
            value={form.location} 
            onChange={(e) => handleFormChange('location', e.target.value)}
            placeholder="City, Country"
          />
        </div>
      </div>

      <Separator />

      <div>
        <Label className="text-base font-semibold flex items-center gap-2 mb-3">
          <Share2 className="h-4 w-4 text-primary" /> Social Media & Links
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2"><Twitter className="h-4 w-4 text-sky-500" /> Twitter/X</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">@</span>
              <Input 
                value={form.twitter} 
                onChange={(e) => handleFormChange('twitter', e.target.value)}
                placeholder="username"
                className="pl-7"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2"><Facebook className="h-4 w-4 text-blue-600" /> Facebook</Label>
            <Input 
              value={form.facebook} 
              onChange={(e) => handleFormChange('facebook', e.target.value)}
              placeholder="facebook.com/username"
            />
          </div>
          
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2"><Instagram className="h-4 w-4 text-pink-500" /> Instagram</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">@</span>
              <Input 
                value={form.instagram} 
                onChange={(e) => handleFormChange('instagram', e.target.value)}
                placeholder="username"
                className="pl-7"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2"><Linkedin className="h-4 w-4 text-blue-700" /> LinkedIn</Label>
            <Input 
              value={form.linkedin} 
              onChange={(e) => handleFormChange('linkedin', e.target.value)}
              placeholder="linkedin.com/in/username"
            />
          </div>
          
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Website</Label>
            <Input 
              value={form.website} 
              onChange={(e) => handleFormChange('website', e.target.value)}
              placeholder="https://your-website.com"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button 
          className="gradient-primary text-primary-foreground"
          onClick={handleSave} 
          disabled={loading || uploadingImage || !isDirty}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Changes
        </Button>
        
        {isDirty && (
          <Button 
            variant="outline"
            onClick={() => {
              setForm(originalForm);
              setDirty(false);
              toast.info("Changes discarded");
            }}
            disabled={loading}
          >
            Discard
          </Button>
        )}
      </div>

        
    </div>
  );
};

export default ProfileSettings;