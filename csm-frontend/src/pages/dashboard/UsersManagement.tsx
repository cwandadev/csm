// csms-frontend/src/pages/dashboard/UsersManagement.tsx
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { usersApi, enhancedUsersApi, organizeApi } from "@/lib/api";
import { toast } from "sonner";
import AddUserModal from "@/components/modals/AddUserModal";
import EditUserModal from "@/components/modals/EditUserModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Make sure to add Box Icons CSS to your index.html:
// <link href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet">

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
  fingerprint_template: string | null;
  backup_code: string | null;
  created_at: string;
  custom_category_id?: number;
  custom_category_name?: string;
  custom_value?: string;
  payment_status?: 'paid' | 'pending' | 'not_paid';
}

interface UserLimitInfo {
  currentUsers: number;
  maxUsers: number | string;
  planName: string;
  remainingSlots: number | string;
  isUnlimited: boolean;
  percentageUsed: number;
}

type SortOrder = 'newest' | 'oldest' | 'a-z' | 'z-a';

// Empty State Component
const EmptyState = ({ title, description, buttonText, onButtonClick, icon }: { 
  title: string; 
  description: string; 
  buttonText?: string; 
  onButtonClick?: () => void;
  icon: string;
}) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <i className={`bx ${icon} text-5xl text-muted-foreground mb-4`}></i>
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm mb-4">{description}</p>
    {buttonText && onButtonClick && (
      <Button onClick={onButtonClick} variant="outline" className="mt-2">
        <i className='bx bx-plus mr-2'></i>
        {buttonText}
      </Button>
    )}
  </div>
);

// Skeleton Loading Component
const SkeletonRow = () => (
  <div className="animate-pulse">
    <div className="border rounded-lg overflow-hidden">
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
            <div className="h-8 w-20 bg-muted rounded" />
            <div className="h-8 w-20 bg-muted rounded" />
            <div className="h-8 w-8 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const UsersManagement = () => {
  const { admin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userLimit, setUserLimit] = useState<UserLimitInfo | null>(null);
  
  // Get view from URL params with sync
  const currentView = searchParams.get("view") || "list";

  // Filters
  const [roleFilter, setRoleFilter] = useState<"all" | "student" | "employee">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "pending" | "not_paid">("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<"all" | "card" | "fingerprint" | "backup_code">("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  // Dropdown data
  const [sections, setSections] = useState<{ id: number; name: string; user_count?: number }[]>([]);
  const [classes, setClasses] = useState<{ id: number; name: string; user_count?: number }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string; user_count?: number; position_count?: number }[]>([]);
  const [positions, setPositions] = useState<{ id: number; name: string; user_count?: number }[]>([]);

  const isSchool = admin?.organizationType === "school";

  // Handle tab change with URL sync
  const handleTabChange = (value: string) => {
    setSearchParams({ view: value });
    navigate(`/dashboard/users?view=${value}`);
  };

  useEffect(() => {
    if (admin?.organizationId) {
      fetchData();
      fetchUserLimit();
      fetchCategories();
    }
  }, [admin]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [users, searchTerm, roleFilter, statusFilter, paymentFilter, 
      departmentFilter, positionFilter, sectionFilter, classFilter, 
      methodFilter, sortOrder]);

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

  const fetchCategories = async () => {
  try {
    if (isSchool) {
      const sectionsRes = await organizeApi.getSections();
      if (sectionsRes.success && sectionsRes.data) {
        setSections(sectionsRes.data);
        if (sectionsRes.data.length > 0) {
          const classesRes = await organizeApi.getClasses(sectionsRes.data[0].id);
          if (classesRes.success && classesRes.data) {
            setClasses(classesRes.data);
          }
        }
      }
      
      const deptsRes = await organizeApi.getDepartments();
      if (deptsRes.success && deptsRes.data) {
        setDepartments(deptsRes.data);
        if (deptsRes.data.length > 0) {
          const positionsRes = await organizeApi.getPositions(deptsRes.data[0].id);
          if (positionsRes.success && positionsRes.data) {
            setPositions(positionsRes.data);
          }
        }
      }
    } else {
      const deptsRes = await organizeApi.getDepartments();
      if (deptsRes.success && deptsRes.data) {
        setDepartments(deptsRes.data);
        if (deptsRes.data.length > 0) {
          const positionsRes = await organizeApi.getPositions(deptsRes.data[0].id);
          if (positionsRes.success && positionsRes.data) {
            setPositions(positionsRes.data);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error fetching categories:", error);
  }
};

useEffect(() => {
  if (!isSchool) return;
  
  const loadClasses = async () => {
    try {
      let sectionId = null;
      
      if (sectionFilter && sectionFilter !== "all") {
        const selectedSection = sections.find(s => s.name === sectionFilter);
        sectionId = selectedSection?.id;
      } else if (sections.length > 0) {
        sectionId = sections[0]?.id;
      }
      
      if (sectionId) {
        const res = await organizeApi.getClasses(sectionId);
        if (res.success && res.data) {
          setClasses(res.data);
        }
      }
    } catch (error) {
      console.error("Error loading classes:", error);
    }
  };
  
  loadClasses();
}, [sectionFilter, sections, isSchool]);

useEffect(() => {
  if (!isSchool) return;
  
  const loadPositions = async () => {
    try {
      let deptId = null;
      
      if (departmentFilter && departmentFilter !== "all") {
        const selectedDept = departments.find(d => d.name === departmentFilter);
        deptId = selectedDept?.id;
      } else if (departments.length > 0) {
        deptId = departments[0]?.id;
      }
      
      if (deptId) {
        const res = await organizeApi.getPositions(deptId);
        if (res.success && res.data) {
          setPositions(res.data);
        }
      }
    } catch (error) {
      console.error("Error loading positions:", error);
    }
  };
  
  loadPositions();
}, [departmentFilter, departments, isSchool]);

useEffect(() => {
  if (!isSchool) return;
  
  const loadTabData = async () => {
    if (currentView === "classes") {
      let sectionId = sections[0]?.id;
      if (sectionFilter && sectionFilter !== "all") {
        const selectedSection = sections.find(s => s.name === sectionFilter);
        if (selectedSection) sectionId = selectedSection.id;
      }
      
      if (sectionId) {
        const res = await organizeApi.getClasses(sectionId);
        if (res.success && res.data) {
          setClasses(res.data);
        }
      }
    }
    
    if (currentView === "positions") {
      let deptId = departments[0]?.id;
      if (departmentFilter && departmentFilter !== "all") {
        const selectedDept = departments.find(d => d.name === departmentFilter);
        if (selectedDept) deptId = selectedDept.id;
      }
      
      if (deptId) {
        const res = await organizeApi.getPositions(deptId);
        if (res.success && res.data) {
          setPositions(res.data);
        }
      }
    }
  };
  
  loadTabData();
}, [currentView, sections, departments, sectionFilter, departmentFilter, isSchool]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersRes = await enhancedUsersApi.getEnhancedUsers(admin?.organizationId || "");
      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data as User[]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const getUserImageUrl = (image: string | null | undefined) => {
    if (!image) return undefined;
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    if (image.startsWith('data:image')) return image;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const staticBaseUrl = baseUrl.replace('/api', '');
    if (image.startsWith('user-')) {
      return `${staticBaseUrl}/uploads/users/${image}`;
    }
    return `${staticBaseUrl}/uploads/users/${image}`;
  };

  const applyFiltersAndSort = () => {
    let filtered = [...users];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(term) ||
        (user.card_uid && user.card_uid.toLowerCase().includes(term)) ||
        (user.fingerprint_template && user.fingerprint_template.toLowerCase().includes(term)) ||
        (user.backup_code && user.backup_code.toLowerCase().includes(term))
      );
    }

    if (isSchool && roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(user =>
        statusFilter === "active" ? user.is_active === 1 : user.is_active === 0
      );
    }

    if (isSchool && paymentFilter !== "all") {
      filtered = filtered.filter(user => user.payment_status === paymentFilter);
    }

    if (departmentFilter !== "all") {
      filtered = filtered.filter(user => 
        user.role === "employee" && user.custom_category_name === departmentFilter
      );
    }

    if (positionFilter !== "all") {
      filtered = filtered.filter(user => 
        user.role === "employee" && user.custom_value === positionFilter
      );
    }

    if (sectionFilter !== "all") {
      filtered = filtered.filter(user => 
        user.role === "student" && user.custom_category_name === sectionFilter
      );
    }

    if (classFilter !== "all") {
      filtered = filtered.filter(user => 
        user.role === "student" && user.custom_value === classFilter
      );
    }

    if (methodFilter !== "all") {
      filtered = filtered.filter(user => {
        if (methodFilter === "card") return user.card_uid;
        if (methodFilter === "fingerprint") return user.fingerprint_template;
        if (methodFilter === "backup_code") return user.backup_code;
        return true;
      });
    }

    filtered.sort((a, b) => {
      switch (sortOrder) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "a-z":
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
        case "z-a":
          return `${b.first_name} ${b.last_name}`.localeCompare(`${a.first_name} ${a.last_name}`);
        default:
          return 0;
      }
    });

    setFilteredUsers(filtered);
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

  const handleUserAdded = () => {
    fetchData();
    fetchUserLimit();
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const getAssignmentDisplay = (user: User) => {
    if (user.role === "student") {
      return (
        <div className="text-sm">
          <span className="text-muted-foreground">
            {user.custom_category_name || "—"}
          </span>
          {user.custom_value && (
            <span className="text-xs text-muted-foreground block">
              {user.custom_value}
            </span>
          )}
        </div>
      );
    } else {
      return (
        <div className="text-sm">
          <span className="text-muted-foreground">
            {user.custom_category_name || "—"}
          </span>
          {user.custom_value && (
            <span className="text-xs text-muted-foreground block">
              {user.custom_value}
            </span>
          )}
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div>
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-4 w-64 bg-muted rounded mt-2" />
          </div>
          <div className="h-10 w-32 bg-muted rounded" />
        </div>
        <div className="h-24 bg-muted rounded-xl" />
        <div className="h-10 w-80 bg-muted rounded-lg" />
        <div className="h-20 bg-muted rounded-xl" />
        <SkeletonRow />
      </div>
    );
  }

  // ============ COMPANY VIEW ============
  if (!isSchool) {
    const companyTabs = [
      { value: "list", label: "Employees List", icon: "bxs-user-detail" },
      { value: "departments", label: "Departments", icon: "bx-building-house" },
      { value: "positions", label: "Positions", icon: "bx-briefcase" }
    ];

    const showEmployeeFilters = roleFilter === "employee" || roleFilter === "all";

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-2">
              <i className='bx bx-group text-3xl'></i>
              Employee Management
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Manage all employees in your organization</p>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)} className="gradient-primary text-primary-foreground">
            <i className='bx bx-user-plus mr-2'></i> Add Employee
          </Button>
        </div>

        {userLimit && (
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-full">
                    <i className='bx bx-group text-primary text-xl'></i>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Plan: <span className="font-semibold">{userLimit.planName}</span></p>
                    <p className="text-2xl font-bold">{userLimit.currentUsers} / {userLimit.maxUsers}<span className="text-sm font-normal text-muted-foreground ml-1">employees</span></p>
                  </div>
                </div>
                <div className="flex-1 w-full max-w-md">
                  <div className="flex justify-between text-sm mb-1"><span>Usage</span><span>{Math.round(userLimit.percentageUsed)}%</span></div>
                  <Progress value={userLimit.percentageUsed} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={currentView} onValueChange={handleTabChange} className="w-full">
          <TabsList className="bg-muted/50">
            {companyTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                <i className={`bx ${tab.icon}`}></i>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="list" className="mt-6 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <i className='bx bx-list-check'></i>
                    All Employees ({filteredUsers.length})
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-48">
                      <i className='bx bx-search absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm'></i>
                      <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-7 h-8 text-sm" />
                    </div>
                    <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                      <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                    </Select>
                    {showEmployeeFilters && (
                      <>
                        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Department" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Depts</SelectItem>
                            {departments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={positionFilter} onValueChange={setPositionFilter}>
                          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Position" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Positions</SelectItem>
                            {positions.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                    <Select value={methodFilter} onValueChange={(v: any) => setMethodFilter(v)}>
                      <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="Method" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Methods</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="fingerprint">Fingerprint</SelectItem><SelectItem value="backup_code">Backup Code</SelectItem></SelectContent>
                    </Select>
                    <Select value={sortOrder} onValueChange={(v: SortOrder) => setSortOrder(v)}>
                      <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="Sort" /></SelectTrigger>
                      <SelectContent><SelectItem value="newest">Newest</SelectItem><SelectItem value="oldest">Oldest</SelectItem><SelectItem value="a-z">A-Z</SelectItem><SelectItem value="z-a">Z-A</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Photo</TableHead><TableHead>Name</TableHead><TableHead>Contact</TableHead>
                        <TableHead>Department</TableHead><TableHead>Position</TableHead><TableHead>Card UID</TableHead>
                        <TableHead>Status</TableHead><TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8}>
                            <EmptyState 
                              icon="bx-user"
                              title="No employees found"
                              description="Get started by adding your first employee to the system."
                              buttonText="Add Employee"
                              onButtonClick={() => setIsAddModalOpen(true)}
                            />
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell><Avatar className="h-9 w-9"><AvatarImage src={getUserImageUrl(user.image)} /><AvatarFallback className="bg-primary/10 text-primary text-xs">{user.first_name[0]}{user.last_name[0]}</AvatarFallback></Avatar></TableCell>
                            <TableCell className="font-medium">{user.first_name} {user.last_name}</TableCell>
                            <TableCell><div className="text-xs">{user.email || "—"}</div><div className="text-xs text-muted-foreground">{user.phone || "—"}</div></TableCell>
                            <TableCell className="text-sm">{user.custom_category_name || "—"}</TableCell>
                            <TableCell className="text-sm">{user.custom_value || "—"}</TableCell>
                            <TableCell><code className="text-xs bg-muted px-1 py-0.5 rounded">{user.card_uid || "—"}</code></TableCell>
                            <TableCell><Badge variant={user.is_active === 1 ? "success" : "destructive"} className="text-xs">{user.is_active === 1 ? "Active" : "Inactive"}</Badge></TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><i className='bx bx-dots-vertical-rounded text-lg'></i></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-32">
                                  <DropdownMenuItem onClick={() => openEditModal(user)} className="cursor-pointer"><i className='bx bx-edit-alt mr-2'></i> Edit</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDeleteUser(user.id)} className="cursor-pointer text-destructive"><i className='bx bx-trash mr-2'></i> Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departments" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className='bx bx-building-house'></i>
                  Departments
                </CardTitle>
              </CardHeader>
              <CardContent>
                {departments.length === 0 ? (
                  <EmptyState 
                    icon="bx-building"
                    title="No Departments yet"
                    description="Create departments to organize your employees by teams."
                    buttonText="Add Department"
                    onButtonClick={() => navigate("/dashboard/categories")}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {departments.map(dept => (
                      <div key={dept.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <span className="font-medium">{dept.name}</span>
                        <Badge variant="outline">{dept.user_count || 0} employees</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="positions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className='bx bx-briefcase'></i>
                  Positions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {positions.length === 0 ? (
                  <EmptyState 
                    icon="bx-briefcase-alt-2"
                    title="No Positions yet"
                    description="Create positions to define job roles for your employees."
                    buttonText="Add Position"
                    onButtonClick={() => navigate("/dashboard/categories")}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {positions.map(pos => (
                      <div key={pos.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <span className="font-medium">{pos.name}</span>
                        <Badge variant="outline">{pos.user_count || 0} employees</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <AddUserModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={handleUserAdded} />
        <EditUserModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSuccess={handleUserAdded} user={selectedUser} />
      </div>
    );
  }

  // ============ SCHOOL VIEW ============
  const schoolTabs = [
    { value: "list", label: "Members List", icon: "bxs-user-detail" },
    { value: "sections", label: "Sections", icon: "bx-layer" },
    { value: "classes", label: "Classes", icon: "bx-book-open" },
    { value: "departments", label: "Departments", icon: "bx-building-house" },
    { value: "positions", label: "Positions", icon: "bx-briefcase" }
  ];

  const showStudentFilters = roleFilter === "student";
  const showEmployeeFilters = roleFilter === "employee";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-2">
            <i className='bx bx-group text-3xl'></i>
            Users Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage students and employees in your school</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="gradient-primary text-primary-foreground">
          <i className='bx bx-user-plus mr-2'></i> Add User
        </Button>
      </div>

      {userLimit && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-full">
                  <i className='bx bx-group text-primary text-xl'></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plan: <span className="font-semibold">{userLimit.planName}</span></p>
                  <p className="text-2xl font-bold">{userLimit.currentUsers} / {userLimit.maxUsers}<span className="text-sm font-normal text-muted-foreground ml-1">users</span></p>
                </div>
              </div>
              <div className="flex-1 w-full max-w-md">
                <div className="flex justify-between text-sm mb-1"><span>Usage</span><span>{Math.round(userLimit.percentageUsed)}%</span></div>
                <Progress value={userLimit.percentageUsed} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={currentView} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-muted/50 flex-wrap h-auto">
          {schoolTabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
              <i className={`bx ${tab.icon}`}></i>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="list" className="mt-6 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <i class='bx bx-list-check'></i>
                  All Members ({filteredUsers.length})
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-48">
                    <i className='bx bx-search absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm'></i>
                    <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-7 h-8 text-sm" />
                  </div>
                  <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                    <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="Role" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Role</SelectItem><SelectItem value="student">Students</SelectItem><SelectItem value="employee">Employees</SelectItem></SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                  </Select>
                  <Select value={methodFilter} onValueChange={(v: any) => setMethodFilter(v)}>
                    <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="Method" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Methods</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="fingerprint">Fingerprint</SelectItem><SelectItem value="backup_code">Backup Code</SelectItem></SelectContent>
                  </Select>
                  <Select value={sortOrder} onValueChange={(v: SortOrder) => setSortOrder(v)}>
                    <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="Sort" /></SelectTrigger>
                    <SelectContent><SelectItem value="newest">Newest</SelectItem><SelectItem value="oldest">Oldest</SelectItem><SelectItem value="a-z">A-Z</SelectItem><SelectItem value="z-a">Z-A</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
                {showStudentFilters && (
                  <>
                    <Select value={sectionFilter} onValueChange={setSectionFilter}>
                      <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Sections" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Sections</SelectItem>{sections.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={classFilter} onValueChange={setClassFilter}>
                      <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Classes" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Classes</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={paymentFilter} onValueChange={(v: any) => setPaymentFilter(v)}>
                      <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="Payment" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Payments</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="not_paid">Not Paid</SelectItem></SelectContent>
                    </Select>
                  </>
                )}
                {showEmployeeFilters && (
                  <>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Departments" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Depts</SelectItem>{departments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={positionFilter} onValueChange={setPositionFilter}>
                      <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Positions" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Positions</SelectItem>{positions.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={paymentFilter} onValueChange={(v: any) => setPaymentFilter(v)}>
                      <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="Payment" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Payments</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="not_paid">Not Paid</SelectItem></SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Photo</TableHead><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Role</TableHead>
                      <TableHead>Assignment</TableHead><TableHead>Card UID</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead><TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <EmptyState 
                            icon="bx-user"
                            title="No users found"
                            description="Get started by adding your first student or employee."
                            buttonText="Add User"
                            onButtonClick={() => setIsAddModalOpen(true)}
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell><Avatar className="h-9 w-9"><AvatarImage src={getUserImageUrl(user.image)} /><AvatarFallback className="bg-primary/10 text-primary text-xs">{user.first_name[0]}{user.last_name[0]}</AvatarFallback></Avatar></TableCell>
                          <TableCell className="font-medium">{user.first_name} {user.last_name}</TableCell>
                          <TableCell><div className="text-xs">{user.email || "—"}</div><div className="text-xs text-muted-foreground">{user.phone || "—"}</div></TableCell>
                          <TableCell><Badge variant={user.role === "student" ? "default" : "secondary"} className="text-xs capitalize">{user.role}</Badge></TableCell>
                          <TableCell className="text-sm">{getAssignmentDisplay(user)}</TableCell>
                          <TableCell><code className="text-xs bg-muted px-1 py-0.5 rounded">{user.card_uid || "—"}</code></TableCell>
                          <TableCell><Badge variant={user.payment_status === "paid" ? "success" : user.payment_status === "pending" ? "warning" : "destructive"} className="text-xs capitalize">{user.payment_status || "—"}</Badge></TableCell>
                          <TableCell><Badge variant={user.is_active === 1 ? "success" : "destructive"} className="text-xs">{user.is_active === 1 ? "Active" : "Inactive"}</Badge></TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><i className='bx bx-dots-vertical-rounded text-lg'></i></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-32">
                                <DropdownMenuItem onClick={() => openEditModal(user)} className="cursor-pointer"><i className='bx bx-edit-alt mr-2'></i> Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteUser(user.id)} className="cursor-pointer text-destructive"><i className='bx bx-trash mr-2'></i> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className='bx bx-layer'></i>
                Sections
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sections.length === 0 ? (
                <EmptyState 
                  icon="bx-layer"
                  title="No Sections yet"
                  description="Create sections to organize students by groups or grades."
                  buttonText="Add Section"
                  onButtonClick={() => navigate("/dashboard/categories")}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sections.map(section => (
                    <div key={section.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="font-medium">{section.name}</span>
                      <Badge variant="outline">{section.user_count || 0} students</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className='bx bx-book-open'></i>
                Classes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <EmptyState 
                  icon="bx-book"
                  title="No Classes yet"
                  description="Create classes under sections to organize students."
                  buttonText="Add Class"
                  onButtonClick={() => navigate("/dashboard/categories")}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map(cls => (
                    <div key={cls.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="font-medium">{cls.name}</span>
                      <Badge variant="outline">{cls.user_count || 0} students</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className='bx bx-building-house'></i>
                Departments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {departments.length === 0 ? (
                <EmptyState 
                  icon="bx-building"
                  title="No Departments yet"
                  description="Create departments to organize employees by teams."
                  buttonText="Add Department"
                  onButtonClick={() => navigate("/dashboard/categories")}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departments.map(dept => (
                    <div key={dept.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="font-medium">{dept.name}</span>
                      <Badge variant="outline">{dept.user_count || 0} employees</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className='bx bx-briefcase'></i>
                Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {positions.length === 0 ? (
                <EmptyState 
                  icon="bx-briefcase-alt-2"
                  title="No Positions yet"
                  description="Create positions to define job roles for employees."
                  buttonText="Add Position"
                  onButtonClick={() => navigate("/dashboard/categories")}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {positions.map(pos => (
                    <div key={pos.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="font-medium">{pos.name}</span>
                      <Badge variant="outline">{pos.user_count || 0} employees</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddUserModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={handleUserAdded} />
      <EditUserModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSuccess={handleUserAdded} user={selectedUser} />
    </div>
  );
};

export default UsersManagement;