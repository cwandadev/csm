// csms-frontend/src/pages/dashboard/UsersManagement.tsx
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi, enhancedUsersApi, organizeApi, deviceApi, billingApi } from "@/lib/api";
import { 
  Loader2, Pencil, Trash2, UserPlus, Search, Filter, 
  Camera, QrCode, Plus, Upload, Building2, GraduationCap, 
  Briefcase, AlertCircle, TrendingUp, Users as UsersIcon, 
  CheckCircle, XCircle, Download, Upload as UploadIcon
} from "lucide-react";
import { toast } from "sonner";

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: 'student' | 'employee';
  is_active: number;
  image: string | null;
  gender: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  card_uid: string | null;
  custom_category_id?: number;
  custom_category_name?: string;
  custom_value?: string;
}

interface Section {
  id: number;
  name: string;
  description?: string;
}

interface Class {
  id: number;
  name: string;
  section_id: number;
  grade_level?: string;
  capacity?: number;
}

interface Department {
  id: number;
  name: string;
  description?: string;
}

interface Position {
  id: number;
  name: string;
  department_id: number;
  salary_range?: string;
}

interface UserLimitInfo {
  currentUsers: number;
  maxUsers: number | string;
  planName: string;
  remainingSlots: number | string;
  isUnlimited: boolean;
  percentageUsed: number;
}

const UsersManagement = () => {
  const { admin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "student" | "employee">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [scanningCard, setScanningCard] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [userLimit, setUserLimit] = useState<UserLimitInfo | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Modal states for adding categories
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showAddDepartmentModal, setShowAddDepartmentModal] = useState(false);
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  
  // Form states for adding categories
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [newClassGrade, setNewClassGrade] = useState("");
  const [newClassCapacity, setNewClassCapacity] = useState("");
  const [newPositionSalary, setNewPositionSalary] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    section_id: "",
    class_id: "",
    department_id: "",
    position_id: "",
    is_active: true,
    image: ""
  });
   

   // Add this useEffect at the top of the component

useEffect(() => {
  // Check for pending card UID from notification
  const pendingCardUid = sessionStorage.getItem('pendingCardUid');
  const pendingTimestamp = sessionStorage.getItem('pendingCardTimestamp');
  
  if (pendingCardUid) {
    // Check if the pending card is from within the last 5 minutes
    const timestamp = pendingTimestamp ? new Date(pendingTimestamp) : null;
    const isValid = timestamp && (new Date().getTime() - timestamp.getTime()) < 5 * 60 * 1000;
    
    if (isValid) {
      // Pre-fill the card UID in form data
      setFormData(prev => ({ ...prev, card_uid: pendingCardUid }));
      
      // Open the add user modal
      setIsAddModalOpen(true);
      
      // Show a toast notification
      toast.info(`Card UID ${pendingCardUid} pre-filled. Complete the registration.`);
      
      // Clear the session storage
      sessionStorage.removeItem('pendingCardUid');
      sessionStorage.removeItem('pendingCardTimestamp');
    } else {
      // Clear invalid/expired pending card
      sessionStorage.removeItem('pendingCardUid');
      sessionStorage.removeItem('pendingCardTimestamp');
    }
  }
  
  // Check URL parameter for opening add modal
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('openAddModal') === 'true') {
    setIsAddModalOpen(true);
    // Clean URL without reloading
    const newUrl = window.location.pathname + '?view=list';
    window.history.replaceState({}, '', newUrl);
  }
}, []);

  useEffect(() => {
    if (admin?.organizationId) {
      fetchData();
      fetchUserLimit();
    }
  }, [admin]);

  // Fetch classes when section changes
  useEffect(() => {
    if (formData.section_id && admin?.organizationType === "school") {
      fetchClassesForSection(parseInt(formData.section_id));
    } else {
      setClasses([]);
    }
  }, [formData.section_id]);

  // Fetch positions when department changes
  useEffect(() => {
    if (formData.department_id && (admin?.organizationType === "company" || formData.role === "employee")) {
      fetchPositionsForDepartment(parseInt(formData.department_id));
    } else {
      setPositions([]);
    }
  }, [formData.department_id]);

  const fetchUserLimit = async () => {
    try {
      const res = await usersApi.getUserLimitInfo();
      if (res.success && res.data) {
        setUserLimit(res.data as UserLimitInfo);
      }
    } catch (error) {
      console.error("Error fetching user limit:", error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const usersRes = await enhancedUsersApi.getEnhancedUsers(admin?.organizationId || "");
      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data as User[]);
      }
      
      if (admin?.organizationType === "school") {
        // Fetch sections for students
        const sectionsRes = await organizeApi.getSections();
        if (sectionsRes.success && sectionsRes.data) {
          setSections(sectionsRes.data);
        }
        
        // Also fetch departments for employees in schools
        const deptsRes = await organizeApi.getDepartments();
        if (deptsRes.success && deptsRes.data) {
          setDepartments(deptsRes.data);
        }
      } else {
        // For companies, fetch only departments and positions
        const deptsRes = await organizeApi.getDepartments();
        if (deptsRes.success && deptsRes.data) {
          setDepartments(deptsRes.data);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchClassesForSection = async (sectionId: number) => {
    try {
      const classesRes = await organizeApi.getClasses(sectionId);
      if (classesRes.success && classesRes.data) {
        setClasses(classesRes.data);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const fetchPositionsForDepartment = async (departmentId: number) => {
    try {
      const positionsRes = await organizeApi.getPositions(departmentId);
      if (positionsRes.success && positionsRes.data) {
        setPositions(positionsRes.data);
      }
    } catch (error) {
      console.error("Error fetching positions:", error);
    }
  };

  // Scan card from API
  const scanCard = async () => {
    setScanningCard(true);
    try {
      const cardUid = prompt("Tap or enter the card UID:");
      if (cardUid) {
        // Verify card with backend
        const verifyRes = await deviceApi.verifyCard(cardUid);
        if (verifyRes.success && verifyRes.data) {
          setFormData({ ...formData, card_uid: cardUid });
          toast.success(`Card detected for: ${verifyRes.data.name}`);
        } else {
          setFormData({ ...formData, card_uid: cardUid });
          toast.info("Card UID added. You can assign it to a user.");
        }
      }
    } catch (error) {
      console.error("Error scanning card:", error);
      toast.error("Failed to scan card");
    } finally {
      setScanningCard(false);
    }
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB");
      return;
    }
    
    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image: reader.result as string });
        toast.success("Image uploaded successfully");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  // Add new section (for schools)
  const handleAddSection = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Please enter a section name");
      return;
    }
    
    try {
      const res = await organizeApi.createSection({
        name: newCategoryName,
        description: newCategoryDesc
      });
      
      if (res.success) {
        toast.success("Section added successfully");
        setShowAddSectionModal(false);
        setNewCategoryName("");
        setNewCategoryDesc("");
        fetchData();
      } else {
        toast.error(res.error || "Failed to add section");
      }
    } catch (error) {
      console.error("Error adding section:", error);
      toast.error("Failed to add section");
    }
  };

  // Add new class (for schools)
  const handleAddClass = async () => {
    if (!newCategoryName.trim() || !formData.section_id) {
      toast.error("Please enter a class name and select a section");
      return;
    }
    
    try {
      const res = await organizeApi.createClass({
        name: newCategoryName,
        section_id: parseInt(formData.section_id),
        grade_level: newClassGrade || undefined,
        capacity: newClassCapacity ? parseInt(newClassCapacity) : undefined
      });
      
      if (res.success) {
        toast.success("Class added successfully");
        setShowAddClassModal(false);
        setNewCategoryName("");
        setNewClassGrade("");
        setNewClassCapacity("");
        fetchClassesForSection(parseInt(formData.section_id));
      } else {
        toast.error(res.error || "Failed to add class");
      }
    } catch (error) {
      console.error("Error adding class:", error);
      toast.error("Failed to add class");
    }
  };

  // Add new department (for companies/schools)
  const handleAddDepartment = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Please enter a department name");
      return;
    }
    
    try {
      const res = await organizeApi.createDepartment({
        name: newCategoryName,
        description: newCategoryDesc
      });
      
      if (res.success) {
        toast.success("Department added successfully");
        setShowAddDepartmentModal(false);
        setNewCategoryName("");
        setNewCategoryDesc("");
        fetchData();
      } else {
        toast.error(res.error || "Failed to add department");
      }
    } catch (error) {
      console.error("Error adding department:", error);
      toast.error("Failed to add department");
    }
  };

  // Add new position (for companies/schools)
  const handleAddPosition = async () => {
    if (!newCategoryName.trim() || !formData.department_id) {
      toast.error("Please enter a position name and select a department");
      return;
    }
    
    try {
      const res = await organizeApi.createPosition({
        name: newCategoryName,
        department_id: parseInt(formData.department_id),
        salary_range: newPositionSalary || undefined
      });
      
      if (res.success) {
        toast.success("Position added successfully");
        setShowAddPositionModal(false);
        setNewCategoryName("");
        setNewPositionSalary("");
        fetchPositionsForDepartment(parseInt(formData.department_id));
      } else {
        toast.error(res.error || "Failed to add position");
      }
    } catch (error) {
      console.error("Error adding position:", error);
      toast.error("Failed to add position");
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.first_name || !formData.last_name) {
      toast.error("First name and last name are required");
      return;
    }
    
    if (formData.role === "student" && !formData.section_id) {
      toast.error("Please select a section for the student");
      return;
    }
    
    if (formData.role === "employee" && !formData.department_id) {
      toast.error("Please select a department for the employee");
      return;
    }
    
    try {
      const payload: any = {
        firstName: formData.first_name,
        lastName: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        role: formData.role,
        gender: formData.gender || null,
        country: formData.country || null,
        province: formData.province || null,
        city: formData.city || null,
        card_uid: formData.card_uid || null,
        backup_code: formData.backup_code || null,
        is_active: formData.is_active,
        image: formData.image || null
      };
      
      if (formData.role === "student") {
        payload.section_id = formData.section_id ? parseInt(formData.section_id) : null;
        payload.class_id = formData.class_id ? parseInt(formData.class_id) : null;
      } else {
        payload.department_id = formData.department_id ? parseInt(formData.department_id) : null;
        payload.position_id = formData.position_id ? parseInt(formData.position_id) : null;
      }
      
      const res = await enhancedUsersApi.createEnhancedUser(payload);
      if (res.success) {
        toast.success(res.message || "User added successfully");
        if (res.data?.tempPassword) {
          toast.info(`Temporary password: ${res.data.tempPassword}`, { duration: 10000 });
        }
        setIsAddModalOpen(false);
        resetForm();
        fetchData();
        fetchUserLimit();
      } else {
        if (res.error?.includes("maximum")) {
          setShowUpgradeModal(true);
        }
        toast.error(res.error || "Failed to add user");
      }
    } catch (error: any) {
      console.error("Error adding user:", error);
      if (error?.error?.includes("maximum")) {
        setShowUpgradeModal(true);
      }
      toast.error(error?.error || "Failed to add user");
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    try {
      const payload: any = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        role: formData.role,
        is_active: formData.is_active ? 1 : 0,
        gender: formData.gender || null,
        country: formData.country || null,
        province: formData.province || null,
        city: formData.city || null,
        card_uid: formData.card_uid || null,
        backup_code: formData.backup_code || null,
        image: formData.image || null
      };
      
      if (formData.role === "student") {
        payload.section_id = formData.section_id ? parseInt(formData.section_id) : null;
        payload.class_id = formData.class_id ? parseInt(formData.class_id) : null;
      } else {
        payload.department_id = formData.department_id ? parseInt(formData.department_id) : null;
        payload.position_id = formData.position_id ? parseInt(formData.position_id) : null;
      }
      
      const res = await enhancedUsersApi.updateEnhancedUser(selectedUser.id.toString(), payload);
      if (res.success) {
        toast.success("User updated successfully");
        setIsEditModalOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(res.error || "Failed to update user");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    
    try {
      const res = await usersApi.deleteUser(userId.toString());
      if (res.success) {
        toast.success("User deleted successfully");
        fetchData();
        fetchUserLimit();
      } else {
        toast.error(res.error || "Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      role: "student",
      gender: "",
      country: "",
      province: "",
      city: "",
      card_uid: "",
      backup_code: "",
      section_id: "",
      class_id: "",
      department_id: "",
      position_id: "",
      is_active: true,
      image: ""
    });
    setSelectedUser(null);
    setClasses([]);
    setPositions([]);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
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
      backup_code: "",
      section_id: user.custom_category_id?.toString() || "",
      class_id: "",
      department_id: user.custom_category_id?.toString() || "",
      position_id: "",
      is_active: user.is_active === 1,
      image: user.image || ""
    });
    
    // Fetch positions if employee
    if (user.role === "employee" && user.custom_category_id) {
      fetchPositionsForDepartment(user.custom_category_id);
    }
    
    // Fetch classes if student
    if (user.role === "student" && user.custom_category_id) {
      fetchClassesForSection(user.custom_category_id);
    }
    
    setIsEditModalOpen(true);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Check if user limit is reached
  const isLimitReached = userLimit && !userLimit.isUnlimited && 
    typeof userLimit.maxUsers === 'number' && 
    userLimit.currentUsers >= userLimit.maxUsers;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Users Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage {admin?.organizationType === "school" ? "students and employees" : "employees"}
          </p>
        </div>
        
        <Button 
          onClick={() => setIsAddModalOpen(true)} 
          className="gradient-primary text-primary-foreground"
          disabled={isLimitReached}
        >
          <UserPlus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      {/* User Limit Card */}
      {userLimit && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-full">
                  <UsersIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plan: <span className="font-semibold">{userLimit.planName}</span></p>
                  <p className="text-2xl font-bold">
                    {userLimit.currentUsers} / {userLimit.maxUsers}
                    <span className="text-sm font-normal text-muted-foreground ml-1">users</span>
                  </p>
                </div>
              </div>
              
              <div className="flex-1 w-full max-w-md">
                <div className="flex justify-between text-sm mb-1">
                  <span>Usage</span>
                  <span>{Math.round(userLimit.percentageUsed)}%</span>
                </div>
                <Progress value={userLimit.percentageUsed} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {userLimit.isUnlimited ? (
                    "Unlimited users on your current plan"
                  ) : userLimit.remainingSlots === 0 ? (
                    <span className="text-destructive">You've reached your user limit. Upgrade to add more users.</span>
                  ) : (
                    `${userLimit.remainingSlots} slots remaining`
                  )}
                </p>
              </div>
              
              {!userLimit.isUnlimited && userLimit.remainingSlots === 0 && (
                <Button variant="outline" onClick={() => setShowUpgradeModal(true)}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>All Users</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search users..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="employee">Employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Photo</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email/Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Card UID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.image || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {user.first_name[0]}{user.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{user.email || "—"}</div>
                        <div className="text-xs text-muted-foreground">{user.phone || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === "student" ? "default" : "secondary"} className="capitalize">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.role === "student" ? (
                          <span className="text-muted-foreground">
                            {user.custom_category_name ? `${user.custom_category_name}` : "Not assigned"}
                            {user.custom_value ? ` - ${user.custom_value}` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {user.custom_category_name ? `${user.custom_category_name}` : "Not assigned"}
                            {user.custom_value ? ` - ${user.custom_value}` : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.card_uid ? (
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">{user.card_uid}</code>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active === 1 ? "success" : "destructive"}>
                          {user.is_active === 1 ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openEditModal(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Add User Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            {isLimitReached && (
              <DialogDescription className="text-destructive">
                You've reached your user limit. Please upgrade your plan to add more users.
              </DialogDescription>
            )}
          </DialogHeader>
          
          {isLimitReached ? (
            <div className="space-y-4 py-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-muted-foreground">Your current plan only allows {userLimit?.maxUsers} users.</p>
              <Button onClick={() => {
                setIsAddModalOpen(false);
                setShowUpgradeModal(true);
              }}>
                Upgrade Plan
              </Button>
            </div>
          ) : (
            <form onSubmit={handleAddUser} className="space-y-4">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="contact">Contact & Location</TabsTrigger>
                  <TabsTrigger value="assignment">Assignment</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                </TabsList>
                
                {/* Basic Info Tab */}
                <TabsContent value="basic" className="space-y-4">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                        {formData.image ? (
                          <img src={formData.image} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <Camera className="h-12 w-12 text-muted-foreground" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 p-1.5 bg-primary rounded-full text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Click upload to add profile image (max 2MB)</p>
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
                    <Select value={formData.role} onValueChange={(v: any) => {
                      setFormData({ ...formData, role: v, section_id: "", class_id: "", department_id: "", position_id: "" });
                    }}>
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
                    <Switch 
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>
                </TabsContent>
                
                {/* Contact & Location Tab */}
                <TabsContent value="contact" className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">If provided, user will receive login credentials via email</p>
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
                
                {/* Assignment Tab - Dynamic based on organization type and role */}
                <TabsContent value="assignment" className="space-y-4">
                  {admin?.organizationType === "school" && formData.role === "student" ? (
                    // School Student Assignment
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Section *</Label>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setShowAddSectionModal(true)}
                            className="text-primary h-6 px-2"
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add Section
                          </Button>
                        </div>
                        <Select 
                          value={formData.section_id} 
                          onValueChange={(v) => setFormData({ ...formData, section_id: v, class_id: "" })}
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
                          <div className="flex items-center justify-between">
                            <Label>Class</Label>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setShowAddClassModal(true)}
                              className="text-primary h-6 px-2"
                            >
                              <Plus className="h-3 w-3 mr-1" /> Add Class
                            </Button>
                          </div>
                          <Select 
                            value={formData.class_id} 
                            onValueChange={(v) => setFormData({ ...formData, class_id: v })}
                            disabled={classes.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={classes.length === 0 ? "No classes available" : "Select class"} />
                            </SelectTrigger>
                            <SelectContent>
                              {classes.map((cls) => (
                                <SelectItem key={cls.id} value={cls.id.toString()}>
                                  {cls.name} {cls.grade_level ? `(${cls.grade_level})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  ) : (admin?.organizationType === "school" && formData.role === "employee") || admin?.organizationType === "company" ? (
                    // Employee Assignment (both school employees and company employees)
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Department *</Label>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setShowAddDepartmentModal(true)}
                            className="text-primary h-6 px-2"
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add Department
                          </Button>
                        </div>
                        <Select 
                          value={formData.department_id} 
                          onValueChange={(v) => setFormData({ ...formData, department_id: v, position_id: "" })}
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
                          <div className="flex items-center justify-between">
                            <Label>Position</Label>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setShowAddPositionModal(true)}
                              className="text-primary h-6 px-2"
                            >
                              <Plus className="h-3 w-3 mr-1" /> Add Position
                            </Button>
                          </div>
                          <Select 
                            value={formData.position_id} 
                            onValueChange={(v) => setFormData({ ...formData, position_id: v })}
                            disabled={positions.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={positions.length === 0 ? "No positions available" : "Select position"} />
                            </SelectTrigger>
                            <SelectContent>
                              {positions.map((pos) => (
                                <SelectItem key={pos.id} value={pos.id.toString()}>
                                  {pos.name} {pos.salary_range ? `(${pos.salary_range})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  ) : null}
                </TabsContent>
                
                {/* Security Tab */}
                <TabsContent value="security" className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Label>Card UID</Label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={scanCard}
                        disabled={scanningCard}
                      >
                        {scanningCard ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                        <span className="ml-1">Scan</span>
                      </Button>
                    </div>
                    <Input 
                      placeholder="RFID Card UID (scan or type manually)"
                      value={formData.card_uid}
                      onChange={(e) => setFormData({ ...formData, card_uid: e.target.value })}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Tap card on reader or enter UID manually</p>
                  </div>
                  
                  <div>
                    <Label>Backup Code</Label>
                    <Input 
                      placeholder="Emergency backup code"
                      value={formData.backup_code}
                      onChange={(e) => setFormData({ ...formData, backup_code: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Optional backup code for attendance without card</p>
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                  Add User
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="contact">Contact & Location</TabsTrigger>
                <TabsTrigger value="assignment">Assignment</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>
              
              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4">
                <div className="flex flex-col items-center space-y-3">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {formData.image ? (
                        <img src={formData.image} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1.5 bg-primary rounded-full text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  </div>
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
                  <Select value={formData.role} onValueChange={(v: any) => {
                    setFormData({ ...formData, role: v, section_id: "", class_id: "", department_id: "", position_id: "" });
                  }}>
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
                  <Switch 
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </TabsContent>
              
              {/* Contact & Location Tab */}
              <TabsContent value="contact" className="space-y-4">
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
              <TabsContent value="assignment" className="space-y-4">
                {formData.role === "student" ? (
                  // Student Assignment
                  <>
                    <div className="space-y-2">
                      <Label>Section</Label>
                      <Select 
                        value={formData.section_id} 
                        onValueChange={(v) => setFormData({ ...formData, section_id: v, class_id: "" })}
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
                  // Employee Assignment
                  <>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select 
                        value={formData.department_id} 
                        onValueChange={(v) => setFormData({ ...formData, department_id: v, position_id: "" })}
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
              <TabsContent value="security" className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Label>Card UID</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={scanCard}
                      disabled={scanningCard}
                    >
                      {scanningCard ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                      <span className="ml-1">Scan</span>
                    </Button>
                  </div>
                  <Input 
                    placeholder="RFID Card UID"
                    value={formData.card_uid}
                    onChange={(e) => setFormData({ ...formData, card_uid: e.target.value })}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label>Backup Code</Label>
                  <Input 
                    placeholder="Emergency backup code"
                    value={formData.backup_code}
                    onChange={(e) => setFormData({ ...formData, backup_code: e.target.value })}
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                Update User
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Section Modal */}
      <Dialog open={showAddSectionModal} onOpenChange={setShowAddSectionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Section Name *</Label>
              <Input 
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., MPC, SOD, Primary"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input 
                value={newCategoryDesc}
                onChange={(e) => setNewCategoryDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddSectionModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleAddSection} className="flex-1 gradient-primary text-primary-foreground">
                Add Section
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Class Modal */}
      <Dialog open={showAddClassModal} onOpenChange={setShowAddClassModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Class Name *</Label>
              <Input 
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., S4B, P5C"
              />
            </div>
            <div>
              <Label>Grade Level</Label>
              <Input 
                value={newClassGrade}
                onChange={(e) => setNewClassGrade(e.target.value)}
                placeholder="e.g., Senior 4, Primary 5"
              />
            </div>
            <div>
              <Label>Capacity</Label>
              <Input 
                type="number"
                value={newClassCapacity}
                onChange={(e) => setNewClassCapacity(e.target.value)}
                placeholder="Maximum students"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddClassModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleAddClass} className="flex-1 gradient-primary text-primary-foreground">
                Add Class
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Department Modal */}
      <Dialog open={showAddDepartmentModal} onOpenChange={setShowAddDepartmentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Department Name *</Label>
              <Input 
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., IT, HR, Sales"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input 
                value={newCategoryDesc}
                onChange={(e) => setNewCategoryDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddDepartmentModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleAddDepartment} className="flex-1 gradient-primary text-primary-foreground">
                Add Department
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Position Modal */}
      <Dialog open={showAddPositionModal} onOpenChange={setShowAddPositionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Position</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Position Name *</Label>
              <Input 
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Manager, Developer"
              />
            </div>
            <div>
              <Label>Salary Range</Label>
              <Input 
                value={newPositionSalary}
                onChange={(e) => setNewPositionSalary(e.target.value)}
                placeholder="e.g., $50k - $70k"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddPositionModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleAddPosition} className="flex-1 gradient-primary text-primary-foreground">
                Add Position
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Plan Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upgrade Your Plan</DialogTitle>
            <DialogDescription>
              You've reached the maximum number of users for your current plan.
              Upgrade to add more users and unlock additional features.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-3">
              <div className="flex justify-between items-center p-3 rounded-lg border bg-muted/50">
                <div>
                  <p className="font-medium">Current Plan</p>
                  <p className="text-sm text-muted-foreground">{userLimit?.planName}</p>
                </div>
                <Badge variant="outline">{userLimit?.maxUsers} users max</Badge>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Recommended Plans:</p>
                <div className="grid gap-2">
                  <div className="flex justify-between items-center p-3 rounded-lg border cursor-pointer hover:bg-primary/5 transition-colors">
                    <div>
                      <p className="font-medium">Professional</p>
                      <p className="text-sm text-muted-foreground">Up to 500 users</p>
                    </div>
                    <Button variant="outline" size="sm">Upgrade</Button>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg border cursor-pointer hover:bg-primary/5 transition-colors">
                    <div>
                      <p className="font-medium">Enterprise</p>
                      <p className="text-sm text-muted-foreground">Unlimited users</p>
                    </div>
                    <Button variant="outline" size="sm">Contact Sales</Button>
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={() => setShowUpgradeModal(false)} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersManagement;