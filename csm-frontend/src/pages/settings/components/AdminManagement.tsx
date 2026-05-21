// csms-frontend/src/pages/settings/components/AdminManagement.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Users, UserPlus, Loader2, Mail, Shield, Crown, MoreVertical, 
  Trash2, Edit, UserCheck, UserX, Calendar, Key, CheckCircle, XCircle
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AdminUser } from "../types";

interface AdminManagementProps {
  admin: any;
  onToast?: (message: string, type: "success" | "error" | "info" | "warning") => void;
}

const AdminManagement = ({ admin, onToast }: AdminManagementProps) => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ firstName: "", lastName: "", email: "", username: "", password: "", role: "basic_admin" });
  const [submitting, setSubmitting] = useState(false);
  const [maxAdminsAllowed, setMaxAdminsAllowed] = useState(5);
  const [currentAdminCount, setCurrentAdminCount] = useState(0);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('csm_token');
      const response = await fetch(`${apiUrl}/admins`, { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      if (result.success) {
        setAdmins(result.data);
        setCurrentAdminCount(result.data.length);
        setMaxAdminsAllowed(result.max_admins || 5);
      }
    } catch (error) {
      console.error("Error fetching admins:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!addForm.firstName || !addForm.lastName || !addForm.email || !addForm.username || !addForm.password) {
      onToast?.("Please fill all required fields", "warning");
      return;
    }

    if (currentAdminCount >= maxAdminsAllowed) {
      onToast?.(`Maximum ${maxAdminsAllowed} admins allowed for your plan`, "error");
      return;
    }

    setSubmitting(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('csm_token');
      const response = await fetch(`${apiUrl}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(addForm)
      });
      const result = await response.json();
      if (result.success) {
        onToast?.("Admin added successfully!", "success");
        setShowAddDialog(false);
        setAddForm({ firstName: "", lastName: "", email: "", username: "", password: "", role: "basic_admin" });
        fetchAdmins();
      } else {
        onToast?.("Failed to add admin", "error");
      }
    } catch (error) {
      onToast?.("Failed to add admin", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (adminId: string, currentStatus: boolean) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('csm_token');
      await fetch(`${apiUrl}/admins/${adminId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      onToast?.(`Admin ${!currentStatus ? 'activated' : 'deactivated'}`, "success");
      fetchAdmins();
    } catch (error) {
      onToast?.("Failed to update admin status", "error");
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!confirm("Are you sure you want to remove this admin?")) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('csm_token');
      await fetch(`${apiUrl}/admins/${adminId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      onToast?.("Admin removed successfully", "success");
      fetchAdmins();
    } catch (error) {
      onToast?.("Failed to remove admin", "error");
    }
  };

  const getRoleIcon = (role: string) => {
    if (role === 'owner_admin') return <Crown className="h-4 w-4 text-yellow-500" />;
    if (role === 'super_admin') return <Shield className="h-4 w-4 text-red-500" />;
    return <UserCheck className="h-4 w-4 text-primary" />;
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            {currentAdminCount} / {maxAdminsAllowed} admins used • {maxAdminsAllowed - currentAdminCount} slots available
          </p>
        </div>
        {currentAdminCount < maxAdminsAllowed && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="gradient-primary"><UserPlus className="h-4 w-4 mr-2" /> Add Admin</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add New Admin</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>First Name *</Label><Input value={addForm.firstName} onChange={(e) => setAddForm({...addForm, firstName: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Last Name *</Label><Input value={addForm.lastName} onChange={(e) => setAddForm({...addForm, lastName: e.target.value})} /></div>
                </div>
                <div className="space-y-1"><Label>Email *</Label><Input type="email" value={addForm.email} onChange={(e) => setAddForm({...addForm, email: e.target.value})} /></div>
                <div className="space-y-1"><Label>Username *</Label><Input value={addForm.username} onChange={(e) => setAddForm({...addForm, username: e.target.value})} /></div>
                <div className="space-y-1"><Label>Password *</Label><Input type="password" value={addForm.password} onChange={(e) => setAddForm({...addForm, password: e.target.value})} /></div>
                <div className="space-y-1"><Label>Role</Label>
                  <Select value={addForm.role} onValueChange={(v) => setAddForm({...addForm, role: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic_admin">Basic Admin</SelectItem>
                      <SelectItem value="owner_admin">Owner Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full gradient-primary" onClick={handleAddAdmin} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Add Admin
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-3">
        {admins.map((adminUser) => (
          <div key={adminUser.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/30 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                {adminUser.firstName[0]}{adminUser.lastName[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{adminUser.firstName} {adminUser.lastName}</p>
                  <div className="flex items-center gap-1 text-xs">
                    {getRoleIcon(adminUser.role)}
                    <span className="capitalize text-muted-foreground">{adminUser.role.replace('_', ' ')}</span>
                  </div>
                  {adminUser.isPrimary && <Badge variant="outline" className="text-xs">Owner</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">@{adminUser.username} • {adminUser.email}</p>
                {adminUser.lastLogin && <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Last login: {new Date(adminUser.lastLogin).toLocaleDateString()}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!adminUser.isPrimary && (
                <>
                  <Badge variant={adminUser.isActive ? "default" : "secondary"} className="gap-1">
                    {adminUser.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {adminUser.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleToggleStatus(adminUser.id, adminUser.isActive)}>
                        {adminUser.isActive ? <UserX className="h-4 w-4 mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                        {adminUser.isActive ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteAdmin(adminUser.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {admins.length === 0 && (
        <div className="text-center py-8"><Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">No other admins found</p><p className="text-xs text-muted-foreground">Add team members to help manage your organization</p></div>
      )}
    </div>
  );
};

export default AdminManagement;