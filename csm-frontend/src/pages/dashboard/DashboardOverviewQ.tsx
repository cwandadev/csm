// csmsa/src/pages/dasboard/DashboardOverview.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Cpu, Plus, UserRoundPlus, Users, Loader2, X, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi, attendanceApi, deviceApi, orgApi } from "@/lib/api";
// import AddUserModal from "@/components/modals/AddUserModal";
// import AddDeviceModal from "@/components/modals/AddDeviceModal";

const generateLiveLink = async () => {
  try {
    const token = localStorage.getItem("csm_token");
    const res = await fetch("http://localhost:3000/api/live-view/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        organization_id: admin?.organizationId,
        duration_minutes: 60,
        admin_id: admin?.id
      })
    });
    
    const data = await res.json();
    if (data.success) {
      const link = data.data.shareable_link;
      const expiresAt = new Date(data.data.expires_at);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(link);
      toast.success(`Live link copied! Expires at ${expiresAt.toLocaleTimeString()}`);
      
      // Optionally open in new tab
      window.open(link, "_blank");
    } else {
      toast.error(data.error || "Failed to generate live link");
    }
  } catch (error) {
    console.error("Error generating live link:", error);
    toast.error("Failed to generate live view link");
  }
};
// Toast Component
const Toast = ({ message, type, onClose }: { message: string; type: "success" | "error" | "info"; onClose: () => void }) => {
  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />
  };

  const bgColors = {
    success: "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900",
    error: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900",
    info: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900"
  };

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 p-4 rounded-lg shadow-lg border ${bgColors[type]} animate-slide-in`}>
      {icons[type]}
      <p className="text-sm font-body text-foreground">{message}</p>
      <button onClick={onClose} className="ml-4 text-muted-foreground hover:text-foreground transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

interface DashboardStats {
  totalStudents: number;
  totalEmployees: number;
  totalUsers: number;
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  recentUsers: Array<{ id: number; firstName: string; lastName: string; role: string; image?: string }>;
  organizationName: string;
  plan: string;
  usersLimit: number;
}

const DashboardOverview = () => {
  const { admin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalEmployees: 0,
    totalUsers: 0,
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    recentUsers: [],
    organizationName: "",
    plan: "Free Trial",
    usersLimit: 500,
  });

  useEffect(() => {
    if (admin?.organizationId) {
      fetchDashboardData();
    }
  }, [admin]);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const usersRes = await usersApi.getUsers(admin?.organizationId || "");
      if (usersRes.success && usersRes.data) {
        const users = usersRes.data as any[];
        const students = users.filter((u: any) => u.role === "student");
        const employees = users.filter((u: any) => u.role === "employee");
        
        // Get recent users (last 5)
        const recent = users.slice(0, 5).map((u: any) => ({
          id: u.id,
          firstName: u.first_name,
          lastName: u.last_name,
          role: u.role,
          image: u.image,
        }));

        setStats(prev => ({
          ...prev,
          totalStudents: students.length,
          totalEmployees: employees.length,
          totalUsers: users.length,
          recentUsers: recent,
        }));
      }

      // Fetch devices
      const devicesRes = await deviceApi.getDevices(admin?.organizationId || "");
      if (devicesRes.success && devicesRes.data) {
        const devices = devicesRes.data as any[];
        const online = devices.filter((d: any) => d.status === "active");
        const offline = devices.filter((d: any) => d.status === "inactive" || d.status === "lost");
        
        setStats(prev => ({
          ...prev,
          totalDevices: devices.length,
          onlineDevices: online.length,
          offlineDevices: offline.length,
        }));
      }

      // Fetch today's attendance
      const attendanceRes = await attendanceApi.getAttendance(admin?.organizationId || "");
      if (attendanceRes.success && attendanceRes.data) {
        const records = attendanceRes.data as any[];
        const today = new Date().toISOString().split('T')[0];
        const todayRecords = records.filter((r: any) => 
          new Date(r.timestamp).toISOString().split('T')[0] === today
        );
        const present = todayRecords.filter((r: any) => r.status === "check_in");
        
        setStats(prev => ({
          ...prev,
          presentToday: present.length,
          lateToday: 0,
          absentToday: stats.totalUsers - present.length,
        }));
      }

      // Fetch organization details
      const orgRes = await orgApi.getOrganization(admin?.organizationId || "");
      if (orgRes.success && orgRes.data) {
        const org = orgRes.data as any;
        setStats(prev => ({
          ...prev,
          organizationName: org.org_name,
          plan: org.subscription_status === "active" ? "Active Plan" : "Free Trial",
        }));
      }

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      showToast("Failed to load dashboard data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUserAdded = () => {
    showToast("User added successfully!", "success");
    fetchDashboardData();
  };

  const handleDeviceAdded = () => {
    showToast("Device added successfully!", "success");
    fetchDashboardData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Add User Modal */}
      <AddUserModal 
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        onSuccess={handleUserAdded}
      />
      
      {/* Add Device Modal */}
      <AddDeviceModal 
        isOpen={showAddDeviceModal}
        onClose={() => setShowAddDeviceModal(false)}
        onSuccess={handleDeviceAdded}
      />

      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Welcome back, {admin?.firstName}!</h1>
          <p className="text-muted-foreground text-sm mt-1">{stats.organizationName} - Track users, devices, and attendance in one place.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button 
            variant="ghost" 
            className="rounded-full gradient-primary text-primary-foreground"
            onClick={() => window.open(`/live/${admin?.organizationId}`, '_blank')}
          >
            <i className="bx bx-user-voice bx-flashing" style={{ fontSize: '20px' }} />
            Live View
          </Button>
          <Button 
            variant="outline" 
            className="rounded-full"
            onClick={() => setShowAddUserModal(true)}
          >
            <UserRoundPlus className="h-4 w-4 mr-2" /> Add User
          </Button>
          <Button 
            variant="outline" 
            className="rounded-full"
            onClick={() => setShowAddDeviceModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" /> Add Device
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border border-border/60 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-foreground text-3xl">Users Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border bg-accent/60 p-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-heading font-bold text-foreground">{stats.totalUsers}</p>
              </div>
              <div className="rounded-xl border border-border bg-accent/60 p-3">
                <p className="text-xs text-muted-foreground">Students</p>
                <p className="text-2xl font-heading font-bold text-foreground">{stats.totalStudents}</p>
              </div>
              <div className="rounded-xl border border-border bg-accent/60 p-3">
                <p className="text-xs text-muted-foreground">Employees</p>
                <p className="text-2xl font-heading font-bold text-foreground">{stats.totalEmployees}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Recent Users</p>
              <div className="flex items-center gap-2">
                {stats.recentUsers.map((user) => (
                  <div key={user.id} className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                    {user.firstName[0]}{user.lastName[0]}
                  </div>
                ))}
                <div className="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center text-foreground font-semibold">+</div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Recently added users</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-3xl text-foreground">Devices Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border bg-accent/60 p-3 text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-heading font-bold text-foreground">{stats.totalDevices}</p>
              </div>
              <div className="rounded-xl border border-border bg-accent/60 p-3 text-center">
                <p className="text-xs text-muted-foreground">Online</p>
                <p className="text-2xl font-heading font-bold text-success">{stats.onlineDevices}</p>
              </div>
              <div className="rounded-xl border border-border bg-accent/60 p-3 text-center">
                <p className="text-xs text-muted-foreground">Offline</p>
                <p className="text-2xl font-heading font-bold text-destructive">{stats.offlineDevices}</p>
              </div>
            </div>

            <Button variant="outline" className="rounded-full w-full" onClick={() => window.location.href = "/dashboard/devices"}>
              Manage Devices
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card">
          <CardHeader>
            <CardTitle className="font-heading text-3xl text-foreground">Your Enterprise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-accent/60 p-4">
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="text-xl font-heading font-bold">{stats.plan}</p>
            </div>
            <div className="rounded-xl border border-border bg-accent/60 p-4">
              <p className="text-sm text-muted-foreground">Users</p>
              <p className="text-xl font-heading font-bold">{stats.totalUsers} / {stats.usersLimit}</p>
            </div>
            <Button 
            className="w-full rounded-full gradient-primary text-primary-foreground"
             onClick={() => window.location.href = "/dashboard/billing"}>
              Upgrade Plan
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border/60 bg-card">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-foreground flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" /> Today's Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <span className="w-3 h-3 rounded-full bg-success" />
                Present
              </span>
              <span className="font-semibold text-foreground">{stats.presentToday}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <span className="w-3 h-3 rounded-full bg-warning" />
                Late Arrivals
              </span>
              <span className="font-semibold text-foreground">{stats.lateToday}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <span className="w-3 h-3 rounded-full bg-destructive" />
                Absent
              </span>
              <span className="font-semibold text-foreground">{stats.absentToday}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Recent Members
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recentUsers.slice(0, 3).map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-xl border border-border bg-accent/40 p-3">
                <div>
                  <p className="font-medium text-foreground">{member.firstName} {member.lastName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                </div>
                <p className="text-xs text-muted-foreground">New</p>
              </div>
            ))}
            {stats.recentUsers.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No users yet. Click "Add User" to get started!</p>
            )}
          </CardContent>
        </Card>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default DashboardOverview;