// csmsa/src/components/modals/AddUserModal.tsx
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, Camera, Upload, QrCode, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi, organizeApi, deviceApi } from "@/lib/api";
import { toast } from "sonner";

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Section {
  id: number;
  name: string;
}

interface Class {
  id: number;
  name: string;
  section_id: number;
}

interface Department {
  id: number;
  name: string;
}

interface Position {
  id: number;
  name: string;
  department_id: number;
}

const AddUserModal = ({ isOpen, onClose, onSuccess }: AddUserModalProps) => {
  const { admin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [scanningCard, setScanningCard] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showAddClass, setShowAddClass] = useState(false);
  const [showAddDepartment, setShowAddDepartment] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newPositionName, setNewPositionName] = useState("");
  
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

  useEffect(() => {
    if (isOpen && admin?.organizationId) {
      fetchCategories();
    }
  }, [isOpen, admin]);

  useEffect(() => {
    if (formData.section_id) {
      fetchClasses(parseInt(formData.section_id));
    }
  }, [formData.section_id]);

  useEffect(() => {
    if (formData.department_id) {
      fetchPositions(parseInt(formData.department_id));
    }
  }, [formData.department_id]);

  const fetchCategories = async () => {
    try {
      const [sectionsRes, departmentsRes] = await Promise.all([
        organizeApi.getSections(),
        organizeApi.getDepartments()
      ]);
      
      if (sectionsRes.success) setSections(sectionsRes.data as Section[]);
      if (departmentsRes.success) setDepartments(departmentsRes.data as Department[]);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchClasses = async (sectionId: number) => {
    try {
      const res = await organizeApi.getClasses(sectionId);
      if (res.success) setClasses(res.data as Class[]);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const fetchPositions = async (departmentId: number) => {
    try {
      const res = await organizeApi.getPositions(departmentId);
      if (res.success) setPositions(res.data as Position[]);
    } catch (error) {
      console.error("Error fetching positions:", error);
    }
  };

  const scanCard = async () => {
    setScanningCard(true);
    try {
      const cardUid = prompt("Tap or enter the card UID:");
      if (cardUid) {
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB");
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, image: reader.result as string });
      toast.success("Image uploaded successfully");
    };
    reader.readAsDataURL(file);
  };

  const handleAddSection = async () => {
    if (!newSectionName.trim()) {
      toast.error("Please enter a section name");
      return;
    }
    try {
      const res = await organizeApi.createSection({ name: newSectionName });
      if (res.success) {
        toast.success("Section added successfully");
        setShowAddSection(false);
        setNewSectionName("");
        fetchCategories();
      }
    } catch (error) {
      toast.error("Failed to add section");
    }
  };

  const handleAddClass = async () => {
    if (!newClassName.trim() || !formData.section_id) {
      toast.error("Please enter a class name and select a section");
      return;
    }
    try {
      const res = await organizeApi.createClass({
        name: newClassName,
        section_id: parseInt(formData.section_id)
      });
      if (res.success) {
        toast.success("Class added successfully");
        setShowAddClass(false);
        setNewClassName("");
        fetchClasses(parseInt(formData.section_id));
      }
    } catch (error) {
      toast.error("Failed to add class");
    }
  };

  const handleAddDepartment = async () => {
    if (!newDepartmentName.trim()) {
      toast.error("Please enter a department name");
      return;
    }
    try {
      const res = await organizeApi.createDepartment({ name: newDepartmentName });
      if (res.success) {
        toast.success("Department added successfully");
        setShowAddDepartment(false);
        setNewDepartmentName("");
        fetchCategories();
      }
    } catch (error) {
      toast.error("Failed to add department");
    }
  };

  const handleAddPosition = async () => {
    if (!newPositionName.trim() || !formData.department_id) {
      toast.error("Please enter a position name and select a department");
      return;
    }
    try {
      const res = await organizeApi.createPosition({
        name: newPositionName,
        department_id: parseInt(formData.department_id)
      });
      if (res.success) {
        toast.success("Position added successfully");
        setShowAddPosition(false);
        setNewPositionName("");
        fetchPositions(parseInt(formData.department_id));
      }
    } catch (error) {
      toast.error("Failed to add position");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
    
    setLoading(true);
    
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
      
      const res = await usersApi.createUser(payload);
      if (res.success) {
        toast.success(res.message || "User added successfully");
        if (res.data?.tempPassword) {
          toast.info(`Temporary password: ${res.data.tempPassword}`, { duration: 10000 });
        }
        onSuccess();
        onClose();
        resetForm();
      } else {
        toast.error(res.error || "Failed to add user");
      }
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast.error(error?.message || "Failed to add user");
    } finally {
      setLoading(false);
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
    setClasses([]);
    setPositions([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Add a new {admin?.organizationType === "school" ? "student or employee" : "employee"} to your organization
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="assignment">Assgsfdgdfggfgignment</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>
            
            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="flex flex-col items-center space-y-3">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {formData.image ? (
                      <img src={formData.image} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-1.5 gradient-primary rounded-full text-primary-foreground cursor-pointer hover:bg-primary/90">
                    <Upload className="h-4 w-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name *</Label>
                  <Input required value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input required value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} />
                </div>
              </div>
              
              <div>
                <Label>Role *</Label>
                <Select value={formData.role} onValueChange={(v: any) => setFormData({ ...formData, role: v, section_id: "", class_id: "", department_id: "", position_id: "" })}>
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
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              
              <div>
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              
              <div>
                <Label>Country</Label>
                <Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Province/State</Label>
                  <Input value={formData.province} onChange={(e) => setFormData({ ...formData, province: e.target.value })} />
                </div>
                <div>
                  <Label>City</Label>
                  <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                </div>
              </div>
            </TabsContent>
            
            {/* Assignment Tab */}
            <TabsContent value="assignment" className="space-y-4 pt-4">
              {formData.role === "student" ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Section *</Label>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddSection(true)}>
                        <Plus className="h-3 w-3 mr-1" /> Add Section
                      </Button>
                    </div>
                    <Select value={formData.section_id} onValueChange={(v) => setFormData({ ...formData, section_id: v, class_id: "" })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map((section) => (
                          <SelectItem key={section.id} value={section.id.toString()}>{section.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {formData.section_id && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Class</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddClass(true)}>
                          <Plus className="h-3 w-3 mr-1" /> Add Class
                        </Button>
                      </div>
                      <Select value={formData.class_id} onValueChange={(v) => setFormData({ ...formData, class_id: v })} disabled={classes.length === 0}>
                        <SelectTrigger>
                          <SelectValue placeholder={classes.length === 0 ? "No classes available" : "Select class"} />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id.toString()}>{cls.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Department *</Label>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddDepartment(true)}>
                        <Plus className="h-3 w-3 mr-1" /> Add Department
                      </Button>
                    </div>
                    <Select value={formData.department_id} onValueChange={(v) => setFormData({ ...formData, department_id: v, position_id: "" })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {formData.department_id && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Position</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddPosition(true)}>
                          <Plus className="h-3 w-3 mr-1" /> Add Position
                        </Button>
                      </div>
                      <Select value={formData.position_id} onValueChange={(v) => setFormData({ ...formData, position_id: v })} disabled={positions.length === 0}>
                        <SelectTrigger>
                          <SelectValue placeholder={positions.length === 0 ? "No positions available" : "Select position"} />
                        </SelectTrigger>
                        <SelectContent>
                          {positions.map((pos) => (
                            <SelectItem key={pos.id} value={pos.id.toString()}>{pos.name}</SelectItem>
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
                <div className="flex items-center gap-2">
                  <Label>Card UID</Label>
                  <Button type="button" variant="outline" size="sm" onClick={scanCard} disabled={scanningCard}>
                    {scanningCard ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                    <span className="ml-1">Scan</span>
                  </Button>
                </div>
                <Input placeholder="RFID Card UID" value={formData.card_uid} onChange={(e) => setFormData({ ...formData, card_uid: e.target.value })} className="mt-1" />
              </div>
              
              <div>
                <Label>Backup Code</Label>
                <Input placeholder="Emergency backup code" value={formData.backup_code} onChange={(e) => setFormData({ ...formData, backup_code: e.target.value })} />
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add User
            </Button>
          </div>
        </form>
      </DialogContent>
      
      {/* Add Section Dialog */}
      <Dialog open={showAddSection} onOpenChange={setShowAddSection}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Section</DialogTitle></DialogHeader>
          <Input placeholder="Section name" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowAddSection(false)}>Cancel</Button>
            <Button onClick={handleAddSection}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Add Class Dialog */}
      <Dialog open={showAddClass} onOpenChange={setShowAddClass}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Class</DialogTitle></DialogHeader>
          <Input placeholder="Class name" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowAddClass(false)}>Cancel</Button>
            <Button onClick={handleAddClass}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Add Department Dialog */}
      <Dialog open={showAddDepartment} onOpenChange={setShowAddDepartment}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Department</DialogTitle></DialogHeader>
          <Input placeholder="Department name" value={newDepartmentName} onChange={(e) => setNewDepartmentName(e.target.value)} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowAddDepartment(false)}>Cancel</Button>
            <Button onClick={handleAddDepartment}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Add Position Dialog */}
      <Dialog open={showAddPosition} onOpenChange={setShowAddPosition}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Position</DialogTitle></DialogHeader>
          <Input placeholder="Position name" value={newPositionName} onChange={(e) => setNewPositionName(e.target.value)} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowAddPosition(false)}>Cancel</Button>
            <Button onClick={handleAddPosition}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default AddUserModal;