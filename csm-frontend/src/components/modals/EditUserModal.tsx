// csms-frontend/src/components/modals/EditUserModal.tsx
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, Camera, Upload, X, RefreshCw, Fingerprint } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi, organizeApi, enhancedUsersApi } from "@/lib/api";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: {
    id: number;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    role: 'student' | 'employee';
    gender: string | null;
    country: string | null;
    province: string | null;
    city: string | null;
    card_uid: string | null;
    backup_code: string | null;
    fingerprint_template: string | null;
    image: string | null;
    is_active: number;
    custom_category_id?: number;
    custom_category_name?: string;
    custom_value?: string;
    payment_status?: string;
  } | null;
}

// Generate a random backup code (6-8 digits)
const generateBackupCode = (): string => {
  const length = Math.floor(Math.random() * 3) + 6;
  return Math.floor(Math.random() * Math.pow(10, length)).toString().padStart(length, '0');
};

const EditUserModal = ({ isOpen, onClose, onSuccess, user }: EditUserModalProps) => {
  const { admin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [scanningCard, setScanningCard] = useState(false);
  const [sections, setSections] = useState<{ id: number; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [positions, setPositions] = useState<{ id: number; name: string }[]>([]);
  const [generatingCode, setGeneratingCode] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "student" as "student" | "employee",
    gender: "",
    country: "",
    province: "",
    city: "",
    card_uid: "",
    backup_code: "",
    fingerprint_template: "",
    section_id: "",
    class_id: "",
    department_id: "",
    position_id: "",
    is_active: true,
    image: "",
    payment_status: "pending" as "paid" | "pending" | "not_paid"
  });
  
  const [imagePreview, setImagePreview] = useState<string>("");

  const isSchool = admin?.organizationType === "school";

  useEffect(() => {
    if (isOpen && user) {
      // Fetch categories
      fetchCategories();
      
      // Populate form with user data
      setFormData({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email || "",
        phone: user.phone || "",
        role: user.role,
        gender: user.gender || "",
        country: user.country || "",
        province: user.province || "",
        city: user.city || "",
        card_uid: user.card_uid || "",
        backup_code: user.backup_code || generateBackupCode(),
        fingerprint_template: user.fingerprint_template || "",
        section_id: user.role === "student" ? user.custom_category_id?.toString() || "" : "",
        class_id: "",
        department_id: user.role === "employee" ? user.custom_category_id?.toString() || "" : "",
        position_id: "",
        is_active: user.is_active === 1,
        image: user.image || "",
        payment_status: (user.payment_status as "paid" | "pending" | "not_paid") || "pending"
      });
      
      // Set image preview
      if (user.image) {
        setImagePreview(getUserImageUrl(user.image));
      }
      
      // Fetch related data based on role
      if (user.role === "student" && user.custom_category_id) {
        fetchClassesForSection(user.custom_category_id);
      }
      if (user.role === "employee" && user.custom_category_id) {
        fetchPositionsForDepartment(user.custom_category_id);
      }
    }
  }, [isOpen, user]);

  const fetchCategories = async () => {
    try {
      if (isSchool) {
        const sectionsRes = await organizeApi.getSections();
        if (sectionsRes.success && sectionsRes.data) {
          setSections(sectionsRes.data);
        }
        const deptsRes = await organizeApi.getDepartments();
        if (deptsRes.success && deptsRes.data) {
          setDepartments(deptsRes.data);
        }
      } else {
        const deptsRes = await organizeApi.getDepartments();
        if (deptsRes.success && deptsRes.data) {
          setDepartments(deptsRes.data);
        }
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchClassesForSection = async (sectionId: number) => {
    try {
      const res = await organizeApi.getClasses(sectionId);
      if (res.success && res.data) {
        setClasses(res.data);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const fetchPositionsForDepartment = async (departmentId: number) => {
    try {
      const res = await organizeApi.getPositions(departmentId);
      if (res.success && res.data) {
        setPositions(res.data);
      }
    } catch (error) {
      console.error("Error fetching positions:", error);
    }
  };

  const getUserImageUrl = (image: string | null | undefined) => {
    if (!image) return "";
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    if (image.startsWith('data:image')) return image;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const staticBaseUrl = baseUrl.replace('/api', '');
    if (image.startsWith('user-')) {
      return `${staticBaseUrl}/uploads/users/${image}`;
    }
    return `${staticBaseUrl}/uploads/users/${image}`;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB");
      return;
    }
    
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    
    setUploadingImage(true);
    try {
      const result = await usersApi.uploadTempUserImage(file);
      if (result.success && result.data) {
        const filename = result.data.temp_filename || result.data.filename;
        setFormData(prev => ({ ...prev, image: filename }));
        toast.success("Image uploaded successfully");
      } else {
        toast.error(result.error || "Failed to upload image");
        setImagePreview("");
      }
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error("Failed to upload image");
      setImagePreview("");
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setImagePreview("");
    setFormData(prev => ({ ...prev, image: "" }));
  };

  const handleGenerateBackupCode = () => {
    setGeneratingCode(true);
    const newCode = generateBackupCode();
    setFormData(prev => ({ ...prev, backup_code: newCode }));
    toast.success(`New backup code generated: ${newCode}`);
    setGeneratingCode(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name || !formData.last_name) {
      toast.error("First name and last name are required");
      return;
    }
    
    setLoading(true);
    
    try {
      const payload: any = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        role: formData.role,
        gender: formData.gender || null,
        country: formData.country || null,
        province: formData.province || null,
        city: formData.city || null,
        card_uid: formData.card_uid || null,
        backup_code: formData.backup_code || null,
        fingerprint_template: formData.fingerprint_template || null,
        is_active: formData.is_active ? 1 : 0,
        image: formData.image || null,
        payment_status: formData.payment_status
      };
      
      if (formData.role === "student") {
        payload.section_id = formData.section_id ? parseInt(formData.section_id) : null;
        payload.class_id = formData.class_id ? parseInt(formData.class_id) : null;
      } else {
        payload.department_id = formData.department_id ? parseInt(formData.department_id) : null;
        payload.position_id = formData.position_id ? parseInt(formData.position_id) : null;
      }
      
      const res = await enhancedUsersApi.updateEnhancedUser(user!.id.toString(), payload);
      if (res.success) {
        toast.success("User updated successfully");
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "Failed to update user");
      }
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error(error?.message || "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update information for {user.first_name} {user.last_name}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="assignment">Assignment</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              {isSchool && <TabsTrigger value="payment">Payment</TabsTrigger>}
            </TabsList>
            
            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="flex flex-col items-center space-y-3">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Profile preview" className="w-full h-full object-cover" />
                    ) : formData.image ? (
                      <img src={getUserImageUrl(formData.image)} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-1.5 gradient-primary rounded-full text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors">
                    {uploadingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <input 
                      type="file" 
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" 
                      className="hidden" 
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                  </label>
                  {(imagePreview || formData.image) && (
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">JPEG, PNG, GIF up to 2MB</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name *</Label>
                  <Input 
                    required 
                    value={formData.first_name} 
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} 
                  />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input 
                    required 
                    value={formData.last_name} 
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} 
                  />
                </div>
              </div>
              
              <div>
                <Label>Role *</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(v: any) => setFormData({ ...formData, role: v, section_id: "", class_id: "", department_id: "", position_id: "" })}
                  disabled={admin?.organizationType === "company"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Gender</Label>
                <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Active Status</Label>
                <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
              </div>
            </TabsContent>
            
            {/* Contact Tab */}
            <TabsContent value="contact" className="space-y-4 pt-4">
              <div>
                <Label>Email</Label>
                <Input 
                  type="email" 
                  value={formData.email} 
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                />
              </div>
              
              <div>
                <Label>Phone</Label>
                <Input 
                  value={formData.phone} 
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                />
              </div>
              
              <div>
                <Label>Country</Label>
                <Input 
                  value={formData.country} 
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })} 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Province/State</Label>
                  <Input 
                    value={formData.province} 
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })} 
                  />
                </div>
                <div>
                  <Label>City</Label>
                  <Input 
                    value={formData.city} 
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })} 
                  />
                </div>
              </div>
            </TabsContent>
            
            {/* Assignment Tab */}
            <TabsContent value="assignment" className="space-y-4 pt-4">
              {formData.role === "student" ? (
                <>
                  <div className="space-y-2">
                    <Label>Section</Label>
                    <Select 
                      value={formData.section_id} 
                      onValueChange={(v) => {
                        setFormData({ ...formData, section_id: v, class_id: "" });
                        if (v) fetchClassesForSection(parseInt(v));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map((section) => (
                          <SelectItem key={section.id} value={section.id.toString()}>
                            {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {formData.section_id && (
                    <div className="space-y-2">
                      <Label>Class</Label>
                      <Select 
                        value={formData.class_id} 
                        onValueChange={(v) => setFormData({ ...formData, class_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id.toString()}>
                              {cls.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select 
                      value={formData.department_id} 
                      onValueChange={(v) => {
                        setFormData({ ...formData, department_id: v, position_id: "" });
                        if (v) fetchPositionsForDepartment(parseInt(v));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id.toString()}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {formData.department_id && (
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <Select 
                        value={formData.position_id} 
                        onValueChange={(v) => setFormData({ ...formData, position_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                        <SelectContent>
                          {positions.map((pos) => (
                            <SelectItem key={pos.id} value={pos.id.toString()}>
                              {pos.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
            
            {/* Security Tab */}
            <TabsContent value="security" className="space-y-4 pt-4">
              <div>
                <Label>Card UID</Label>
                <Input 
                  placeholder="RFID Card UID" 
                  value={formData.card_uid} 
                  onChange={(e) => setFormData({ ...formData, card_uid: e.target.value })} 
                />
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Label>Backup Code</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleGenerateBackupCode}
                    disabled={generatingCode}
                  >
                    {generatingCode ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    <span className="ml-1">Generate New</span>
                  </Button>
                </div>
                <Input 
                  placeholder="6-8 digit emergency backup code" 
                  value={formData.backup_code} 
                  onChange={(e) => setFormData({ ...formData, backup_code: e.target.value })} 
                  className="font-mono"
                />
              </div>
              
              <div>
                <Label>Fingerprint Template</Label>
                <Input 
                  placeholder="Fingerprint template ID" 
                  value={formData.fingerprint_template} 
                  onChange={(e) => setFormData({ ...formData, fingerprint_template: e.target.value })} 
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Will be updated when user registers fingerprint on device
                </p>
              </div>
            </TabsContent>
            
            {/* Payment Tab (School Only) */}
            {isSchool && (
              <TabsContent value="payment" className="space-y-4 pt-4">
                <div>
                  <Label>Payment Status</Label>
                  <Select 
                    value={formData.payment_status} 
                    onValueChange={(v: any) => setFormData({ ...formData, payment_status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="not_paid">Not Paid</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.role === "student" ? "Student fee payment status" : "Employee salary payment status"}
                  </p>
                </div>
              </TabsContent>
            )}
          </Tabs>
          
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading || uploadingImage} className="flex-1">
              {(loading || uploadingImage) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserModal;