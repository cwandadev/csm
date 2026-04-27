// csms-frontend/src/pages/AccountSettings.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  UserCircle, Mail, Camera, Loader2, CheckCircle, AlertCircle, Info, X, 
  Users, Twitter, Facebook, Instagram, Linkedin, Globe, MapPin, 
  Calendar, Shield, Eye, EyeOff, Share2, GraduationCap, Briefcase
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Helper function to format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

// Helper function to get image URL for any admin
const getAdminImageUrl = (profileImage: string | null | undefined) => {
  if (!profileImage) return null;
  
  // If it's a full URL
  if (profileImage.startsWith('http://') || profileImage.startsWith('https://')) {
    return profileImage;
  }
  
  // If it's a data URL (base64) - skip these, they shouldn't be stored
  if (profileImage.startsWith('data:image')) {
    return null;
  }
  
  // If it's a filename (no slashes, no http), construct the URL
  if (!profileImage.includes('/') && !profileImage.includes('http')) {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const staticBaseUrl = baseUrl.replace('/api', '');
    return `${staticBaseUrl}/uploads/${profileImage}`;
  }
  
  // Default: assume it's already a path
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const staticBaseUrl = baseUrl.replace('/api', '');
  return `${staticBaseUrl}${profileImage}`;
};

// Avatar Component for public admins
const AdminAvatar = ({ profile, firstName, lastName, size = "md", isPublic = false }: { profile: string | null; firstName: string; lastName: string; size?: "sm" | "md" | "lg"; isPublic?: boolean }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = getAdminImageUrl(profile);
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-base"
  };
  
  if (imageUrl && !imageError) {
    return (
      <div className="relative">
        <img
          src={imageUrl}
          alt={`${firstName} ${lastName}`}
          className={`${sizeClasses[size]} rounded-full object-cover ${isPublic ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-background' : ''}`}
          onError={() => setImageError(true)}
        />
        {isPublic && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background"></div>
        )}
      </div>
    );
  }
  
  return (
    <div className={`relative ${sizeClasses[size]} gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold ${isPublic ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-background' : ''}`}>
      {firstName?.[0]}{lastName?.[0]}
      {isPublic && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background"></div>
      )}
    </div>
  );
};

interface PublicAdmin {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  profile: string;
  is_public: boolean;
  bio: string;
  location: string;
  website: string;
  twitter: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  created_at: string;
  organization_id: number;
  organization_name: string;
  organization_type: 'school' | 'company';
}

const AccountSettings = () => {
  const { admin, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [publicAdmins, setPublicAdmins] = useState<PublicAdmin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [showPublicProfiles, setShowPublicProfiles] = useState(false);
  
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
    isPublic: false,
  });

  // Load admin data when component mounts
  useEffect(() => {
    if (admin) {
      setForm({
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
        isPublic: (admin as any).isPublic || false,
      });
      
      if (admin.profile) {
        setProfileImage(admin.profile);
        setImageError(false);
      }
    }
  }, [admin]);

  // Fetch public admins when toggled
  useEffect(() => {
    if (showPublicProfiles) {
      fetchPublicAdmins();
    }
  }, [showPublicProfiles]);

  const fetchPublicAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('csm_token');
      
      const response = await fetch(`${apiUrl}/admins/public`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setPublicAdmins(result.data);
      }
    } catch (error) {
      console.error("Error fetching public admins:", error);
      toast.error("Failed to load public profiles");
    } finally {
      setLoadingAdmins(false);
    }
  };

const getProfileImageUrl = () => {
  if (!profileImage) return null;
  // Skip base64 images
  if (profileImage.startsWith('data:image')) {
    return null;
  }
  if (profileImage.startsWith('http://') || profileImage.startsWith('https://')) {
    return profileImage;
  }
  // If it's just a filename
  if (!profileImage.includes('/')) {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const staticBaseUrl = baseUrl.replace('/api', '');
    return `${staticBaseUrl}/uploads/${profileImage}`;
  }
  return profileImage;
};

  const getInitials = () => {
    const first = form.firstName?.[0] || '';
    const last = form.lastName?.[0] || '';
    if (first && last) return `${first}${last}`;
    if (first) return first;
    if (last) return last;
    return form.username?.[0]?.toUpperCase() || 'U';
  };

  const profileImageUrl = getProfileImageUrl();
  const showImage = profileImageUrl && !imageError;

  // Filter out current admin from the list
  const otherPublicAdmins = publicAdmins.filter(profile => profile.id !== parseInt(admin?.id || "0"));

  // Handle profile visibility toggle - realtime update without save button
  const handlePublicToggle = async (checked: boolean) => {
    // Update UI immediately
    setForm({ ...form, isPublic: checked });
    
    // Update local storage immediately for visual feedback
    if (admin) {
      const updatedAdmin = { ...admin, isPublic: checked };
      localStorage.setItem("csm_admin", JSON.stringify(updatedAdmin));
    }
    
    // Save to backend in background
    try {
      const updateData: any = { isPublic: checked };
      const res = await authApi.updateProfile(updateData);
      
      if (res.success) {
        if (checked) {
          toast.success("Your profile is now public! Other admins can see it.");
          // Refresh public admins list
          if (showPublicProfiles) {
            fetchPublicAdmins();
          }
        } else {
          toast.info("Your profile is now private.");
        }
      } else {
        // Revert on error
        setForm({ ...form, isPublic: !checked });
        if (admin) {
          const revertedAdmin = { ...admin, isPublic: !checked };
          localStorage.setItem("csm_admin", JSON.stringify(revertedAdmin));
        }
        toast.error(res.error || "Failed to update profile visibility");
      }
    } catch (error) {
      // Revert on error
      setForm({ ...form, isPublic: !checked });
      if (admin) {
        const revertedAdmin = { ...admin, isPublic: !checked };
        localStorage.setItem("csm_admin", JSON.stringify(revertedAdmin));
      }
      toast.error("Failed to update profile visibility");
    }
  };

  const handleProfileUpdate = async () => {
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
        // Don't include isPublic here, it's handled separately
      };
      
      if (profileImage && profileImage !== admin?.profile && !profileImage.startsWith('data:image')) {
        updateData.profile = profileImage;
      }
      
      const res = await authApi.updateProfile(updateData);
      
      if (res.success) {
        toast.success("Profile updated successfully!");
        if (admin) {
          const updatedAdmin = { 
            ...admin, 
            firstName: form.firstName, 
            lastName: form.lastName, 
            username: form.username,
            profile: profileImage || admin.profile,
            bio: form.bio,
            location: form.location,
            website: form.website,
            twitter: form.twitter,
            facebook: form.facebook,
            instagram: form.instagram,
            linkedin: form.linkedin,
          };
          localStorage.setItem("csm_admin", JSON.stringify(updatedAdmin));
          if (updateProfile) {
            updateProfile(updatedAdmin);
          }
        }
        // Refresh public admins list if showing
        if (showPublicProfiles) {
          fetchPublicAdmins();
        }
      } else {
        toast.error(res.error || "Failed to update profile");
      }
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  // Handle image upload - store as file, not base64
const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    toast.error("Image size should be less than 2MB");
    return;
  }

  if (!file.type.startsWith('image/')) {
    toast.error("Please upload an image file");
    return;
  }

  setUploadingImage(true);
  setImageError(false);
  
  try {
    // Use the file upload endpoint instead of base64
    const result = await authApi.uploadProfileImage(file);
    
    if (result.success && result.data?.filename) {
      const filename = result.data.filename;
      setProfileImage(filename);
      toast.success("Profile image updated successfully!");
      
      if (admin) {
        const updatedAdmin = { ...admin, profile: filename };
        localStorage.setItem("csm_admin", JSON.stringify(updatedAdmin));
        if (updateProfile) {
          updateProfile(updatedAdmin);
        }
      }
    } else {
      toast.error(result.error || "Failed to update profile image");
    }
  } catch (error) {
    console.error("Upload error:", error);
    toast.error("Failed to upload image");
  } finally {
    setUploadingImage(false);
    // Clear the input value so the same file can be uploaded again if needed
    e.target.value = '';
  }
};

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <UserCircle className="h-6 w-6 text-primary" /> Account Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile and connect with the CSM community</p>
      </div>

      {/* Main Profile Card */}
      <Card className="border-0 shadow-sm bg-card overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="space-y-6 -mt-12">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <div className="relative">
                {showImage ? (
                  <img
                    src={profileImageUrl!}
                    alt={`${form.firstName} ${form.lastName}`}
                    className={`w-28 h-28 rounded-full object-cover border-4 border-background shadow-lg ${form.isPublic ? 'w-28 h-28 rounded-full object-cover border-4 border-green-600 shadow-lg' : ''}`}
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className={`w-28 h-28 gradient-primary rounded-full flex items-center justify-center text-primary-foreground text-3xl font-bold shadow-lg ${form.isPublic ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-background' : ''}`}>
                    {getInitials()}
                  </div>
                )}
               
              </div>
              <label className="absolute bottom-1 right-1 w-8 h-8 bg-card border-2 border-background rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors shadow-sm">
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                />
              </label>
            </div>
            <div className="text-center sm:text-left flex-1 mt-14">
              <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                <p className="font-heading font-bold text-foreground text-xl">{form.firstName} {form.lastName}</p>
                {form.isPublic && (
                  <Badge variant="secondary" className="gap-1 bg-background text-green-600 ">
                    <Globe className="h-3 w-3" /> Public Profile
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">@{form.username}</p>
              {form.bio && <p className="text-sm mt-2 max-w-md">{form.bio}</p>}
              {uploadingImage && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Profile Visibility Switch - Real-time, no save button needed */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Make Profile Public</p>
                <p className="text-xs text-muted-foreground">Allow all CSM platform users (from any organization) to discover and connect with you</p>
              </div>
            </div>
            <Switch 
              checked={form.isPublic}
              onCheckedChange={handlePublicToggle}
            />
          </div>

          <Separator />

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>First Name</Label>
              <Input 
                value={form.firstName} 
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input 
                value={form.lastName} 
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input 
                value={form.username} 
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} disabled className="bg-muted" />
            </div>
          </div>

          {/* Bio & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Bio</Label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Tell the CSM community about yourself..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Location
              </Label>
              <Input 
                value={form.location} 
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="City, Country"
              />
            </div>
          </div>

          <Separator />

          {/* Social Media Handles */}
          <div>
            <Label className="text-base font-semibold flex items-center gap-2 mb-3">
              <Share2 className="h-4 w-4 text-primary" /> Social Media & Links
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <Twitter className="h-4 w-4 text-sky-500" /> Twitter/X
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">@</span>
                  <Input 
                    value={form.twitter} 
                    onChange={(e) => setForm({ ...form, twitter: e.target.value })}
                    placeholder="username"
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-blue-600" /> Facebook
                </Label>
                <Input 
                  value={form.facebook} 
                  onChange={(e) => setForm({ ...form, facebook: e.target.value })}
                  placeholder="facebook.com/username"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <Instagram className="h-4 w-4 text-pink-500" /> Instagram
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">@</span>
                  <Input 
                    value={form.instagram} 
                    onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                    placeholder="username"
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4 text-blue-700" /> LinkedIn
                </Label>
                <Input 
                  value={form.linkedin} 
                  onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                  placeholder="linkedin.com/in/username"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" /> Website
                </Label>
                <Input 
                  value={form.website} 
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://your-website.com"
                />
              </div>
            </div>
          </div>

          <Separator />

          <Button 
            className="gradient-primary text-primary-foreground w-full sm:w-auto"
            onClick={handleProfileUpdate}
            disabled={loading || uploadingImage}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Profile Changes
          </Button>
        </CardContent>
      </Card>

      {/* Public Admins Section */}
      <Card className="border-0 shadow-sm bg-card">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> CSM Community - Public Admins
          </CardTitle>
          <p className="text-sm text-muted-foreground">Discover and connect with admins from organizations across the CSM platform</p>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            className="mb-4"
            onClick={() => setShowPublicProfiles(!showPublicProfiles)}
          >
            {showPublicProfiles ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showPublicProfiles ? "Hide" : "Show"} Community Profiles ({publicAdmins.length - 1} others)
          </Button>

          {showPublicProfiles && (
            loadingAdmins ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : otherPublicAdmins.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherPublicAdmins.map((profile) => (
                  <div key={profile.id} className="p-4 rounded-lg border border-border bg-accent/30 hover:bg-accent/50 transition-all hover:shadow-md">
                    <div className="flex items-center gap-3 mb-3">
                      <AdminAvatar 
                        profile={profile.profile}
                        firstName={profile.first_name}
                        lastName={profile.last_name}
                        size="md"
                        isPublic={profile.is_public === 1}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{profile.first_name} {profile.last_name}</p>
                        <p className="text-xs text-muted-foreground">@{profile.username}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {profile.organization_type === 'school' ? (
                            <GraduationCap className="h-3 w-3 text-primary" />
                          ) : (
                            <Briefcase className="h-3 w-3 text-primary" />
                          )}
                          <span className="text-xs text-muted-foreground">{profile.organization_name}</span>
                        </div>
                      </div>
                    </div>
                    
                    {profile.bio && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{profile.bio}</p>
                    )}
                    
                    {profile.location && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {profile.location}
                      </p>
                    )}
                    
                    <div className="flex gap-2 mt-3 pt-2 border-t border-border">
                      {profile.twitter && (
                        <a href={`https://twitter.com/${profile.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-sky-500 transition-colors" title="Twitter">
                          <Twitter className="h-4 w-4" />
                        </a>
                      )}
                      {profile.instagram && (
                        <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-pink-500 transition-colors" title="Instagram">
                          <Instagram className="h-4 w-4" />
                        </a>
                      )}
                      {profile.linkedin && (
                        <a href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-blue-700 transition-colors" title="LinkedIn">
                          <Linkedin className="h-4 w-4" />
                        </a>
                      )}
                      {profile.website && (
                        <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Website">
                          <Globe className="h-4 w-4" />
                        </a>
                      )}
                      {profile.facebook && (
                        <a href={profile.facebook.startsWith('http') ? profile.facebook : `https://facebook.com/${profile.facebook}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-blue-600 transition-colors" title="Facebook">
                          <Facebook className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Joined {formatDate(profile.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No public admin profiles found yet</p>
                <p className="text-xs text-muted-foreground mt-1">Make your profile public to appear in the CSM community directory</p>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountSettings;