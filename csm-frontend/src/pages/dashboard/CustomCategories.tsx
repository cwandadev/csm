// csms-frontend/src/pages/dashboard/CustomCategories.tsx
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { organizeApi } from "@/lib/api";
import { 
  Loader2, Plus, Pencil, Trash2, Users, Briefcase, 
  GraduationCap, Layers, Building2, School, UserCog, 
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

// Types for Schools
interface Section {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  user_count?: number;
  class_count?: number;
}

interface Class {
  id: number;
  name: string;
  grade_level?: string;
  capacity?: number;
  user_count?: number;
  created_at: string;
}

// Types for Companies
interface Department {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  user_count?: number;
  position_count?: number;
}

interface Position {
  id: number;
  name: string;
  salary_range?: string;
  user_count?: number;
  created_at: string;
}

const CustomCategories = () => {
  const { admin } = useAuth();
  
  // School states
  const [sections, setSections] = useState<Section[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  
  // Company states
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  
  // Common states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("sections");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    grade_level: "",
    capacity: "",
    salary_range: ""
  });

  useEffect(() => {
    if (admin?.organizationId) {
      fetchData();
    }
  }, [admin, activeTab, selectedSectionId, selectedDepartmentId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (admin?.organizationType === "school") {
        // Fetch sections
        if (activeTab === "sections" || activeTab === "classes") {
          const sectionsRes = await organizeApi.getSections();
          if (sectionsRes.success && sectionsRes.data) {
            setSections(sectionsRes.data as Section[]);
            if (sectionsRes.data.length > 0 && !selectedSectionId && activeTab === "classes") {
              setSelectedSectionId(sectionsRes.data[0].id);
            }
          }
        }
        
        // Fetch classes for selected section
        if (activeTab === "classes" && selectedSectionId) {
          const classesRes = await organizeApi.getClasses(selectedSectionId);
          if (classesRes.success && classesRes.data) {
            setClasses(classesRes.data as Class[]);
          }
        }
        
        // Fetch departments for employees
        if (activeTab === "departments" || activeTab === "positions") {
          const deptsRes = await organizeApi.getDepartments();
          if (deptsRes.success && deptsRes.data) {
            setDepartments(deptsRes.data as Department[]);
            if (deptsRes.data.length > 0 && !selectedDepartmentId && activeTab === "positions") {
              setSelectedDepartmentId(deptsRes.data[0].id);
            }
          }
        }
        
        // Fetch positions for selected department
        if (activeTab === "positions" && selectedDepartmentId) {
          const positionsRes = await organizeApi.getPositions(selectedDepartmentId);
          if (positionsRes.success && positionsRes.data) {
            setPositions(positionsRes.data as Position[]);
          }
        }
      } else {
        // Fetch departments
        if (activeTab === "departments" || activeTab === "positions") {
          const deptsRes = await organizeApi.getDepartments();
          if (deptsRes.success && deptsRes.data) {
            setDepartments(deptsRes.data as Department[]);
            if (deptsRes.data.length > 0 && !selectedDepartmentId && activeTab === "positions") {
              setSelectedDepartmentId(deptsRes.data[0].id);
            }
          }
        }
        
        // Fetch positions for selected department
        if (activeTab === "positions" && selectedDepartmentId) {
          const positionsRes = await organizeApi.getPositions(selectedDepartmentId);
          if (positionsRes.success && positionsRes.data) {
            setPositions(positionsRes.data as Position[]);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    
    try {
      let response;
      
      if (admin?.organizationType === "school") {
        if (activeTab === "sections") {
          response = await organizeApi.createSection({
            name: formData.name,
            description: formData.description
          });
        } else if (activeTab === "classes") {
          if (!selectedSectionId) {
            toast.error("Please select a section first");
            return;
          }
          response = await organizeApi.createClass({
            name: formData.name,
            section_id: selectedSectionId,
            grade_level: formData.grade_level || undefined,
            capacity: formData.capacity ? parseInt(formData.capacity) : undefined
          });
        } else if (activeTab === "departments") {
          response = await organizeApi.createDepartment({
            name: formData.name,
            description: formData.description
          });
        } else if (activeTab === "positions") {
          if (!selectedDepartmentId) {
            toast.error("Please select a department first");
            return;
          }
          response = await organizeApi.createPosition({
            name: formData.name,
            department_id: selectedDepartmentId,
            salary_range: formData.salary_range || undefined
          });
        }
      } else {
        // Company
        if (activeTab === "departments") {
          response = await organizeApi.createDepartment({
            name: formData.name,
            description: formData.description
          });
        } else if (activeTab === "positions") {
          if (!selectedDepartmentId) {
            toast.error("Please select a department first");
            return;
          }
          response = await organizeApi.createPosition({
            name: formData.name,
            department_id: selectedDepartmentId,
            salary_range: formData.salary_range || undefined
          });
        }
      }
      
      if (response?.success) {
        toast.success(`${formData.name} added successfully`);
        setIsAddModalOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(response?.error || "Failed to add");
      }
    } catch (error) {
      console.error("Error adding:", error);
      toast.error("Failed to add");
    }
  };

  const handleUpdate = async () => {
    if (!editingItem || !formData.name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    
    try {
      let response;
      
      if (admin?.organizationType === "school") {
        if (activeTab === "sections") {
          response = await organizeApi.updateSection(editingItem.id, {
            name: formData.name,
            description: formData.description
          });
        } else if (activeTab === "classes") {
          response = await organizeApi.updateClass(editingItem.id, {
            name: formData.name,
            grade_level: formData.grade_level || undefined,
            capacity: formData.capacity ? parseInt(formData.capacity) : undefined
          });
        } else if (activeTab === "departments") {
          response = await organizeApi.updateDepartment(editingItem.id, {
            name: formData.name,
            description: formData.description
          });
        } else if (activeTab === "positions") {
          response = await organizeApi.updatePosition(editingItem.id, {
            name: formData.name,
            salary_range: formData.salary_range || undefined
          });
        }
      } else {
        // Company
        if (activeTab === "departments") {
          response = await organizeApi.updateDepartment(editingItem.id, {
            name: formData.name,
            description: formData.description
          });
        } else if (activeTab === "positions") {
          response = await organizeApi.updatePosition(editingItem.id, {
            name: formData.name,
            salary_range: formData.salary_range || undefined
          });
        }
      }
      
      if (response?.success) {
        toast.success("Updated successfully");
        setIsEditModalOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(response?.error || "Failed to update");
      }
    } catch (error) {
      console.error("Error updating:", error);
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This may affect assigned users.`)) return;
    
    try {
      let response;
      
      if (admin?.organizationType === "school") {
        if (activeTab === "sections") {
          response = await organizeApi.deleteSection(id);
        } else if (activeTab === "classes") {
          response = await organizeApi.deleteClass(id);
        } else if (activeTab === "departments") {
          response = await organizeApi.deleteDepartment(id);
        } else if (activeTab === "positions") {
          response = await organizeApi.deletePosition(id);
        }
      } else {
        // Company
        if (activeTab === "departments") {
          response = await organizeApi.deleteDepartment(id);
        } else if (activeTab === "positions") {
          response = await organizeApi.deletePosition(id);
        }
      }
      
      if (response?.success) {
        toast.success("Deleted successfully");
        fetchData();
      } else {
        toast.error(response?.error || "Failed to delete");
      }
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Failed to delete");
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      grade_level: item.grade_level || "",
      capacity: item.capacity?.toString() || "",
      salary_range: item.salary_range || ""
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      grade_level: "",
      capacity: "",
      salary_range: ""
    });
    setEditingItem(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ============ SCHOOL RENDER (Manages both Students and Employees) ============
  if (admin?.organizationType === "school") {
    const getTabTitle = () => {
      switch(activeTab) {
        case "sections": return "Sections";
        case "classes": return "Classes";
        case "departments": return "Departments";
        case "positions": return "Positions";
        default: return "";
      }
    };

    const getTabDescription = () => {
      switch(activeTab) {
        case "sections": return "Manage school sections/departments for students (e.g., MPC, SOD, Primary)";
        case "classes": return "Manage classes under each section for students (e.g., S4B, P5C)";
        case "departments": return "Manage staff departments for employees (e.g., Teaching, Administration)";
        case "positions": return "Manage positions under each department for employees (e.g., Teacher, Principal)";
        default: return "";
      }
    };

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-2">
              <School className="h-8 w-8 text-primary" />
              School Organization
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage sections & classes for students, departments & positions for employees
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)} className="gradient-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />
              Add {getTabTitle()}
            </Button>
          </div>
        </div>
        
        {/* Main Tabs for School */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="sections" className="gap-2">
              <Layers className="h-4 w-4" />
              Sections
            </TabsTrigger>
            <TabsTrigger value="classes" className="gap-2">
              <GraduationCap className="h-4 w-4" />
              Classes
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="positions" className="gap-2">
              <UserCog className="h-4 w-4" />
              Positions
            </TabsTrigger>
          </TabsList>
          
          {/* Sections Tab - For Students */}
          <TabsContent value="sections" className="mt-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Academic Sections
              </h2>
              <p className="text-sm text-muted-foreground">{getTabDescription()}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sections.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  No sections found. Click "Add Section" to create one.
                </div>
              ) : (
                sections.map((section) => (
                  <Card key={section.id} className="border border-border/60 hover:shadow-md transition-all">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{section.name}</h3>
                          {section.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{section.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Created: {new Date(section.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(section)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDelete(section.id, section.name)} 
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>{section.user_count || 0} Students</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <GraduationCap className="h-4 w-4" />
                            <span>{section.class_count || 0} Classes</span>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedSectionId(section.id);
                            setActiveTab("classes");
                          }}
                        >
                          View Classes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
          
          {/* Classes Tab - For Students */}
          <TabsContent value="classes" className="mt-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Classes / Grade Levels
              </h2>
              <p className="text-sm text-muted-foreground">{getTabDescription()}</p>
            </div>
            
            {sections.length > 0 && (
              <div className="mb-4">
                <Label>Select Section</Label>
                <Select 
                  value={selectedSectionId?.toString()} 
                  onValueChange={(v) => {
                    setSelectedSectionId(parseInt(v));
                    setClasses([]);
                  }}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Choose a section" />
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
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  No classes found for this section. Click "Add Class" to create one.
                </div>
              ) : (
                classes.map((cls) => (
                  <Card key={cls.id} className="border border-border/60 hover:shadow-md transition-all">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{cls.name}</h3>
                          {cls.grade_level && (
                            <p className="text-sm text-muted-foreground">Grade: {cls.grade_level}</p>
                          )}
                          {cls.capacity && (
                            <p className="text-sm text-muted-foreground">Capacity: {cls.capacity} students</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Created: {new Date(cls.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(cls)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDelete(cls.id, cls.name)} 
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{cls.user_count || 0} Students Enrolled</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
          
          {/* Departments Tab - For Employees */}
          <TabsContent value="departments" className="mt-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Staff Departments
              </h2>
              <p className="text-sm text-muted-foreground">{getTabDescription()}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  No departments found. Click "Add Department" to create one.
                </div>
              ) : (
                departments.map((dept) => (
                  <Card key={dept.id} className="border border-border/60 hover:shadow-md transition-all">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{dept.name}</h3>
                          {dept.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{dept.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Created: {new Date(dept.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(dept)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDelete(dept.id, dept.name)} 
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>{dept.user_count || 0} Employees</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Briefcase className="h-4 w-4" />
                            <span>{dept.position_count || 0} Positions</span>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedDepartmentId(dept.id);
                            setActiveTab("positions");
                          }}
                        >
                          View Positions
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
          
          {/* Positions Tab - For Employees */}
          <TabsContent value="positions" className="mt-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary" />
                Staff Positions / Roles
              </h2>
              <p className="text-sm text-muted-foreground">{getTabDescription()}</p>
            </div>
            
            {departments.length > 0 && (
              <div className="mb-4">
                <Label>Select Department</Label>
                <Select 
                  value={selectedDepartmentId?.toString()} 
                  onValueChange={(v) => {
                    setSelectedDepartmentId(parseInt(v));
                    setPositions([]);
                  }}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Choose a department" />
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
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {positions.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  No positions found for this department. Click "Add Position" to create one.
                </div>
              ) : (
                positions.map((pos) => (
                  <Card key={pos.id} className="border border-border/60 hover:shadow-md transition-all">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{pos.name}</h3>
                          {pos.salary_range && (
                            <p className="text-sm text-muted-foreground">Salary Range: {pos.salary_range}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Created: {new Date(pos.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(pos)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDelete(pos.id, pos.name)} 
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{pos.user_count || 0} Employees in this position</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Add Modal - Dynamic based on active tab */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Add New {activeTab === "sections" ? "Section" : 
                          activeTab === "classes" ? "Class" :
                          activeTab === "departments" ? "Department" : "Position"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={
                    activeTab === "sections" ? "e.g., MPC, SOD, Primary" :
                    activeTab === "classes" ? "e.g., S4B, P5C" :
                    activeTab === "departments" ? "e.g., Teaching, Administration" :
                    "e.g., Teacher, Manager"
                  }
                  autoFocus
                />
              </div>
              
              {(activeTab === "sections" || activeTab === "departments") && (
                <div>
                  <Label>Description</Label>
                  <Textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                    rows={3}
                  />
                </div>
              )}
              
              {activeTab === "classes" && (
                <>
                  <div>
                    <Label>Grade Level</Label>
                    <Input 
                      value={formData.grade_level}
                      onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                      placeholder="e.g., Senior 4, Primary 5"
                    />
                  </div>
                  <div>
                    <Label>Capacity</Label>
                    <Input 
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      placeholder="Maximum number of students"
                    />
                  </div>
                </>
              )}
              
              {activeTab === "positions" && (
                <div>
                  <Label>Salary Range</Label>
                  <Input 
                    value={formData.salary_range}
                    onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
                    placeholder="e.g., $30,000 - $50,000"
                  />
                </div>
              )}
              
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                  Add {activeTab === "sections" ? "Section" : 
                         activeTab === "classes" ? "Class" :
                         activeTab === "departments" ? "Department" : "Position"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        
        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Edit {activeTab === "sections" ? "Section" : 
                       activeTab === "classes" ? "Class" :
                       activeTab === "departments" ? "Department" : "Position"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleUpdate(); }} className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              
              {(activeTab === "sections" || activeTab === "departments") && (
                <div>
                  <Label>Description</Label>
                  <Textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
              )}
              
              {activeTab === "classes" && (
                <>
                  <div>
                    <Label>Grade Level</Label>
                    <Input 
                      value={formData.grade_level}
                      onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Capacity</Label>
                    <Input 
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    />
                  </div>
                </>
              )}
              
              {activeTab === "positions" && (
                <div>
                  <Label>Salary Range</Label>
                  <Input 
                    value={formData.salary_range}
                    onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
                  />
                </div>
              )}
              
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                  Save Changes
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  
  // ============ COMPANY RENDER (Manages only Employees) ============
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            Company Organization
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage departments and positions for employees
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)} className="gradient-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" />
            Add {activeTab === "departments" ? "Department" : "Position"}
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="departments" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="positions" className="gap-2">
            <UserCog className="h-4 w-4" />
            Positions
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="departments" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No departments found. Click "Add Department" to create one.
              </div>
            ) : (
              departments.map((dept) => (
                <Card key={dept.id} className="border border-border/60 hover:shadow-md transition-all">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{dept.name}</h3>
                        {dept.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{dept.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Created: {new Date(dept.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(dept)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(dept.id, dept.name)} 
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{dept.user_count || 0} Employees</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Briefcase className="h-4 w-4" />
                          <span>{dept.position_count || 0} Positions</span>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedDepartmentId(dept.id);
                          setActiveTab("positions");
                        }}
                      >
                        View Positions
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="positions" className="mt-6">
          {departments.length > 0 && (
            <div className="mb-4">
              <Label>Select Department</Label>
              <Select 
                value={selectedDepartmentId?.toString()} 
                onValueChange={(v) => {
                  setSelectedDepartmentId(parseInt(v));
                  setPositions([]);
                }}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Choose a department" />
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
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {positions.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No positions found for this department. Click "Add Position" to create one.
              </div>
            ) : (
              positions.map((pos) => (
                <Card key={pos.id} className="border border-border/60 hover:shadow-md transition-all">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{pos.name}</h3>
                        {pos.salary_range && (
                          <p className="text-sm text-muted-foreground">Salary: {pos.salary_range}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Created: {new Date(pos.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(pos)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(pos.id, pos.name)} 
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{pos.user_count || 0} Employees in this position</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Add Modal for Company */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {activeTab === "departments" ? "Department" : "Position"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={activeTab === "departments" ? "e.g., IT, HR, Sales" : "e.g., Manager, Developer"}
                autoFocus
              />
            </div>
            {activeTab === "departments" && (
              <div>
                <Label>Description</Label>
                <Textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
            )}
            {activeTab === "positions" && (
              <div>
                <Label>Salary Range</Label>
                <Input 
                  value={formData.salary_range}
                  onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
                  placeholder="e.g., $50,000 - $70,000"
                />
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                Add {activeTab === "departments" ? "Department" : "Position"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Modal for Company */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {activeTab === "departments" ? "Department" : "Position"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleUpdate(); }} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            {activeTab === "departments" && (
              <div>
                <Label>Description</Label>
                <Textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
            )}
            {activeTab === "positions" && (
              <div>
                <Label>Salary Range</Label>
                <Input 
                  value={formData.salary_range}
                  onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
                />
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomCategories;