// csms-frontend/src/pages/dashboard/DashboardOverview.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, Cpu, Plus, UserRoundPlus, Users, Loader2, Wifi, WifiOff, Building2, Eye, BarChart3, PieChart, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi, attendanceApi, deviceApi, orgApi, liveViewApi } from "@/lib/api";
import AddUserModal from "@/components/modals/AddUserModal";
import AddDeviceModal from "@/components/modals/AddDeviceModal";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { toast } from "sonner";

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
  recentUsers: Array<{ id: number; firstName: string; lastName: string; role: string; image?: string; created_at?: string }>;
  organizationName: string;
  organizationType: string;
  plan: string;
  planName: string;
  usersLimit: number;
  devicesLimit: number;
  subscriptionStatus: string;
  subscriptionEndDate: string | null;
  trialEndsAt: string | null;
}

interface WeeklyData {
  day: string;
  present: number;
  absent: number;
  late: number;
}

// Helper function to get image URL
const getImageUrl = (image: string | undefined) => {
  if (!image) return null;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('data:image')) return image;
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const staticBaseUrl = baseUrl.replace('/api', '');
  return `${staticBaseUrl}/uploads/${image}`;
};

// Avatar Component with image support
const UserAvatar = ({ user, size = "md" }: { user: { firstName: string; lastName: string; image?: string }; size?: "sm" | "md" | "lg" }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = getImageUrl(user.image);
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base"
  };
  
  if (imageUrl && !imageError) {
    return (
      <img
        src={imageUrl}
        alt={`${user.firstName} ${user.lastName}`}
        className={`${sizeClasses[size]} rounded-full object-cover`}
        onError={() => setImageError(true)}
      />
    );
  }
  
  return (
    <div className={`${sizeClasses[size]} rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold`}>
      {user.firstName?.[0]}{user.lastName?.[0]}
    </div>
  );
};

const DashboardOverview = () => {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [generatingLiveLink, setGeneratingLiveLink] = useState(false);
  const [weeklyAttendance, setWeeklyAttendance] = useState<WeeklyData[]>([]);
  const isMounted = useRef(true);
  const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);
  
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
    organizationType: "",
    plan: "Free Trial",
    planName: "Free Trial",
    usersLimit: 200,
    devicesLimit: 2,
    subscriptionStatus: "trial",
    subscriptionEndDate: null,
    trialEndsAt: null,
  });

  const fetchDashboardData = useCallback(async () => {
    if (!admin?.organizationId) return;
    
    try {
      const orgRes = await orgApi.getOrganization(admin?.organizationId || "");
      let orgType = "school";
      let usersLimit = 200;
      let devicesLimit = 2;
      let planName = "Free Trial";
      let subscriptionStatus = "trial";
      let trialEndsAt = null;
      let subscriptionEndDate = null;
      let orgName = "";
      
      if (orgRes.success && orgRes.data) {
        const org = orgRes.data as any;
        orgType = org.type || "school";
        orgName = org.org_name || "";
        subscriptionStatus = org.subscription_status || "trial";
        trialEndsAt = org.trial_ends_at;
        subscriptionEndDate = org.subscription_expires_at;
        
        if (org.subscription_plan) {
          usersLimit = org.subscription_plan.max_users === null ? 999999 : (org.subscription_plan.max_users || 200);
          devicesLimit = org.subscription_plan.max_devices === null ? 999999 : (org.subscription_plan.max_devices || 2);
          planName = org.subscription_plan.display_name || "Free Trial";
        }
      }
      
      const usersRes = await usersApi.getUsers(admin?.organizationId || "");
      let students: any[] = [];
      let employees: any[] = [];
      let allUsers: any[] = [];
      
      if (usersRes.success && usersRes.data) {
        allUsers = usersRes.data as any[];
        
        if (orgType === 'school') {
          students = allUsers.filter((u: any) => u.role === "student");
          employees = allUsers.filter((u: any) => u.role === "employee");
        } else if (orgType === 'company') {
          employees = allUsers.filter((u: any) => u.role === "employee");
          students = [];
        } else {
          students = allUsers.filter((u: any) => u.role === "student");
          employees = allUsers.filter((u: any) => u.role === "employee");
        }
      }
      
      const recent = [...allUsers]
        .sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 5)
        .map((u: any) => ({
          id: u.id,
          firstName: u.first_name,
          lastName: u.last_name,
          role: u.role,
          image: u.image,
          created_at: u.created_at,
        }));

      const devicesRes = await deviceApi.getDevices(admin?.organizationId || "");
      let devices: any[] = [];
      let onlineDevices = 0;
      let offlineDevices = 0;
      
      if (devicesRes.success && devicesRes.data) {
        devices = devicesRes.data as any[];
        
        onlineDevices = devices.filter((d: any) => {
          if (d.last_seen) {
            const lastSeenDate = new Date(d.last_seen);
            const now = new Date();
            const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
            return diffMinutes <= 5;
          }
          return false;
        }).length;
        
        offlineDevices = devices.length - onlineDevices;
      }

      // Get last 7 days attendance for chart
      const weeklyData: WeeklyData[] = [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const totalUsersCount = allUsers.length;
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const attendanceRes = await attendanceApi.getRecords({
          startDate: dateStr,
          endDate: dateStr,
          limit: 1000
        });
        
        let present = 0;
        let late = 0;
        
        if (attendanceRes.success && attendanceRes.data) {
          const records = attendanceRes.data as any[];
          const uniquePresent = new Set();
          const uniqueLate = new Set();
          
          records.forEach((r: any) => {
            if (r.status === "check_in" || r.status === "present") {
              uniquePresent.add(r.user_id || r.id);
            }
            if (r.status === "late") {
              uniqueLate.add(r.user_id || r.id);
            }
          });
          
          present = uniquePresent.size;
          late = uniqueLate.size;
        }
        
        weeklyData.push({
          day: days[date.getDay()],
          present: present,
          late: late,
          absent: Math.max(0, totalUsersCount - present)
        });
      }
      
      if (isMounted.current) {
        setWeeklyAttendance(weeklyData);
      }

      const today = new Date().toISOString().split('T')[0];
      const attendanceRes = await attendanceApi.getRecords({
        startDate: today,
        endDate: today,
        limit: 1000
      });

      let presentToday = 0;
      let lateToday = 0;

      if (attendanceRes.success && attendanceRes.data) {
        const records = attendanceRes.data as any[];
        const uniqueCheckedInUsers = new Set();
        const uniqueLateUsers = new Set();
        
        records.forEach((r: any) => {
          if (r.status === "check_in" || r.status === "present") {
            uniqueCheckedInUsers.add(r.user_id || r.id);
          }
          if (r.status === "late") {
            uniqueLateUsers.add(r.user_id || r.id);
          }
        });
        
        presentToday = uniqueCheckedInUsers.size;
        lateToday = uniqueLateUsers.size;
      }
      
      const totalUsers = allUsers.length;
      const absentToday = Math.max(0, totalUsers - presentToday);
      
      if (isMounted.current) {
        setStats({
          totalStudents: students.length,
          totalEmployees: employees.length,
          totalUsers: totalUsers,
          totalDevices: devices.length,
          onlineDevices: onlineDevices,
          offlineDevices: offlineDevices,
          presentToday: presentToday,
          lateToday: lateToday,
          absentToday: absentToday,
          recentUsers: recent,
          organizationName: orgName,
          organizationType: orgType,
          plan: subscriptionStatus === "active" ? "Active Plan" : subscriptionStatus === "trial" ? "Trial" : "Free",
          planName: planName,
          usersLimit: usersLimit,
          devicesLimit: devicesLimit,
          subscriptionStatus: subscriptionStatus,
          subscriptionEndDate: subscriptionEndDate,
          trialEndsAt: trialEndsAt,
        });
      }

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      if (isMounted.current) {
        toast.error("Failed to load dashboard data");
      }
    }
  }, [admin?.organizationId]);

  useEffect(() => {
    isMounted.current = true;
    
    const loadData = async () => {
      setLoading(true);
      await fetchDashboardData();
      setLoading(false);
    };
    
    loadData();
    
    return () => {
      isMounted.current = false;
    };
  }, [fetchDashboardData]);

  // Auto-refresh every 30 seconds (realtime)
  useEffect(() => {
    if (autoRefreshInterval.current) {
      clearInterval(autoRefreshInterval.current);
    }
    
    autoRefreshInterval.current = setInterval(() => {
      if (!refreshing && isMounted.current && !loading) {
        fetchDashboardData();
      }
    }, 30000);
    
    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
      }
    };
  }, [fetchDashboardData, refreshing, loading]);

  const generateLiveLink = async () => {
    if (!admin?.organizationId) {
      toast.error("Organization ID not found");
      return;
    }

    if (!admin?.id) {
      toast.error("User ID not found");
      return;
    }

    setGeneratingLiveLink(true);
    try {
      const response = await liveViewApi.createLiveSession(
        admin.organizationId.toString(),
        admin.id.toString(),
        60
      );
      
      if (response?.success && response.data) {
        const link = response.data.shareable_link;
        const expiresAt = new Date(response.data.expires_at);
        
        if (link) {
          await navigator.clipboard.writeText(link);
          toast.success(`Live link copied! Expires at ${expiresAt.toLocaleTimeString()}`);
          window.open(link, "_blank");
        } else {
          toast.error("No shareable link returned");
        }
      } else {
        const errorMsg = response?.error || response?.message || "Failed to generate live link";
        toast.error(errorMsg);
      }
    } catch (error: any) {
      console.error('[Live Link] Error:', error);
      toast.error(error.message || "Failed to generate live view link");
    } finally {
      setGeneratingLiveLink(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
    toast.success("Dashboard refreshed");
  };

  const handleUserAdded = () => {
    toast.success("User added successfully!");
    fetchDashboardData();
  };

  const handleDeviceAdded = () => {
    toast.success("Device added successfully!");
    fetchDashboardData();
  };

  const getDaysRemaining = () => {
    if (stats.trialEndsAt) {
      const endDate = new Date(stats.trialEndsAt);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    }
    return null;
  };

  const daysRemaining = getDaysRemaining();
  const isUsersLimitReached = stats.totalUsers >= stats.usersLimit && stats.usersLimit !== 999999;
  const isDevicesLimitReached = stats.totalDevices >= stats.devicesLimit && stats.devicesLimit !== 999999;
  const isSchool = stats.organizationType === "school";
  const hasDeviceLimit = stats.devicesLimit !== 999999;
  
  // Device distribution data
  const deviceDistribution = [
    { name: 'Online', value: stats.onlineDevices, color: '#22c55e' },
    { name: 'Offline', value: stats.offlineDevices, color: '#ef4444' },
  ];
  
  // Calculate attendance rate with capping at 100%
  const attendanceRate = stats.totalUsers > 0 ? Math.min(100, Math.round((stats.presentToday / stats.totalUsers) * 100)) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <AddUserModal 
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        onSuccess={handleUserAdded}
      />
      
      <AddDeviceModal 
        isOpen={showAddDeviceModal}
        onClose={() => setShowAddDeviceModal(false)}
        onSuccess={handleDeviceAdded}
      />

      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Welcome back, {admin?.firstName}!</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {stats.organizationName} - {isSchool ? "School Management" : "Business Management"} Dashboard
          </p>
          {stats.subscriptionStatus === "trial" && daysRemaining && daysRemaining <= 7 && (
            <p className="text-xs text-orange-500 mt-1">
              ⚠️ Trial ends in {daysRemaining} days. Upgrade to continue using all features.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="ghost" 
            className="rounded-full gradient-primary text-primary-foreground hover:shadow-lg transition-all"
            onClick={generateLiveLink}
            disabled={generatingLiveLink}
          >
            {generatingLiveLink ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Live View
          </Button>
          <Button 
            variant="outline" 
            className="rounded-full"
            onClick={() => setShowAddUserModal(true)}
            disabled={isUsersLimitReached}
            title={isUsersLimitReached ? `User limit reached (${stats.usersLimit} max)` : ""}
          >
            <UserRoundPlus className="h-4 w-4 mr-2" /> 
            Add User
            {isUsersLimitReached && (
              <span className="ml-1 text-xs text-destructive">(Limit reached)</span>
            )}
          </Button>
          <Button 
            variant="outline" 
            className="rounded-full"
            onClick={() => setShowAddDeviceModal(true)}
            disabled={isDevicesLimitReached}
            title={isDevicesLimitReached ? `Device limit reached (${stats.devicesLimit} max)` : ""}
          >
            <Plus className="h-4 w-4 mr-2" /> 
            Add Device
            {isDevicesLimitReached && (
              <span className="ml-1 text-xs text-destructive">(Limit reached)</span>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards - Navigation using navigate() */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border border-border/60 bg-card hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/dashboard/users")}>
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-foreground text-2xl flex items-center gap-2">
              <Users className="h-6 w-6" />
              {isSchool ? "Users Insights" : "Employee Insights"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`grid ${isSchool ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
              <div className="rounded-xl border border-border bg-accent/60 p-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-heading font-bold text-foreground">{stats.totalUsers}</p>
                <p className="text-xs text-muted-foreground">/ {stats.usersLimit === 999999 ? "∞" : stats.usersLimit}</p>
              </div>
              {isSchool ? (
                <>
                  <div className="rounded-xl border border-border bg-accent/60 p-3">
                    <p className="text-xs text-muted-foreground">Students</p>
                    <p className="text-2xl font-heading font-bold text-foreground">{stats.totalStudents}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-accent/60 p-3">
                    <p className="text-xs text-muted-foreground">Employees</p>
                    <p className="text-2xl font-heading font-bold text-foreground">{stats.totalEmployees}</p>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-border bg-accent/60 p-3">
                  <p className="text-xs text-muted-foreground">Staff</p>
                  <p className="text-2xl font-heading font-bold text-foreground">{stats.totalEmployees}</p>
                </div>
              )}
            </div>

            {stats.usersLimit !== 999999 && (
              <>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (stats.totalUsers / stats.usersLimit) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {stats.totalUsers} of {stats.usersLimit} users used
                  {stats.totalUsers >= stats.usersLimit && (
                    <span className="text-destructive block">⚠️ User limit reached. Upgrade to add more.</span>
                  )}
                </p>
              </>
            )}

            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Recent Members</p>
              <div className="flex items-center gap-2 flex-wrap">
                {stats.recentUsers.slice(0, 5).map((user) => (
                  <div 
                    key={user.id} 
                    className="cursor-pointer hover:scale-110 transition-transform"
                    title={`${user.firstName} ${user.lastName}`}
                  >
                    <UserAvatar user={user} size="sm" />
                  </div>
                ))}
                {stats.recentUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground">No users yet</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/dashboard/devices")}>
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-2xl text-foreground flex items-center gap-2">
              <Cpu className="h-6 w-6" />
              Devices Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border bg-accent/60 p-3 text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-heading font-bold text-foreground">{stats.totalDevices}</p>
                <p className="text-xs text-muted-foreground">/ {stats.devicesLimit === 999999 ? "∞" : stats.devicesLimit}</p>
              </div>
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Wifi className="h-3 w-3 text-green-500" /> Online
                </p>
                <p className="text-2xl font-heading font-bold text-green-500">{stats.onlineDevices}</p>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <WifiOff className="h-3 w-3 text-red-500" /> Offline
                </p>
                <p className="text-2xl font-heading font-bold text-destructive">{stats.offlineDevices}</p>
              </div>
            </div>

            {hasDeviceLimit && (
              <>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (stats.totalDevices / stats.devicesLimit) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {stats.totalDevices} of {stats.devicesLimit} devices used
                  {stats.totalDevices >= stats.devicesLimit && (
                    <span className="text-destructive block">⚠️ Device limit reached. Upgrade to add more.</span>
                  )}
                </p>
              </>
            )}

            <Button variant="outline" className="rounded-full w-full" onClick={(e) => { e.stopPropagation(); navigate("/dashboard/devices"); }}>
              Manage Devices
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/dashboard/billing")}>
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-foreground flex items-center gap-2">
              <Building2 className="h-6 w-6" /> Your Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-accent/60 p-4">
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="text-xl font-heading font-bold">{stats.planName}</p>
              <p className="text-xs text-muted-foreground mt-1 capitalize">{stats.plan}</p>
            </div>
            <div className="rounded-xl border border-border bg-accent/60 p-4">
              <p className="text-sm text-muted-foreground">Usage Summary</p>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Users</span>
                  <span className="font-semibold">{stats.totalUsers} / {stats.usersLimit === 999999 ? "∞" : stats.usersLimit}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Devices</span>
                  <span className="font-semibold">{stats.totalDevices} / {stats.devicesLimit === 999999 ? "∞" : stats.devicesLimit}</span>
                </div>
              </div>
            </div>
            {(stats.subscriptionStatus === "trial" || stats.plan === "Free") && (
              <Button 
                className="w-full rounded-full gradient-primary text-primary-foreground"
                onClick={(e) => { e.stopPropagation(); navigate("/dashboard/billing"); }}
              >
                Upgrade Plan
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Attendance Trend */}
        <Card className="border border-border/60 bg-card">
          <CardHeader>
            <CardTitle className="font-heading text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Weekly Attendance Trend
            </CardTitle>
            <p className="text-xs text-muted-foreground">Last 7 days attendance overview</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyAttendance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="day" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#f9fafb' }}
                />
                <Legend />
                <Bar dataKey="present" fill="#22c55e" name="Present" radius={[4, 4, 0, 0]} />
                <Bar dataKey="late" fill="#f97316" name="Late" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" fill="#ef4444" name="Absent" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Device Distribution */}
        <Card className="border border-border/60 bg-card">
          <CardHeader>
            <CardTitle className="font-heading text-foreground flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Device Distribution
            </CardTitle>
            <p className="text-xs text-muted-foreground">Online vs Offline devices</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ResponsiveContainer width="100%" height={250}>
                <RePieChart>
                  <Pie
                    data={deviceDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {deviceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RePieChart>
              </ResponsiveContainer>
              <div className="flex flex-col justify-center space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm text-foreground">Online</span>
                  </div>
                  <span className="font-semibold text-green-500 text-xl">{stats.onlineDevices}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm text-foreground">Offline</span>
                  </div>
                  <span className="font-semibold text-red-500 text-xl">{stats.offlineDevices}</span>
                </div>
                <div className="pt-2">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${stats.totalDevices > 0 ? (stats.onlineDevices / stats.totalDevices) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {stats.totalDevices > 0 ? Math.round((stats.onlineDevices / stats.totalDevices) * 100) : 0}% devices online
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border/60 bg-card hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-foreground flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" /> Today's Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                Present
              </span>
              <span className="font-semibold text-foreground">{stats.presentToday}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                Late Arrivals
              </span>
              <span className="font-semibold text-foreground">{stats.lateToday}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                Absent
              </span>
              <span className="font-semibold text-foreground">{stats.absentToday}</span>
            </div>
            
            {stats.totalUsers > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Attendance Rate</span>
                  <span className="font-semibold">{attendanceRate}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${attendanceRate}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Recent Members
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recentUsers.slice(0, 5).map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-xl border border-border bg-accent/40 p-3 hover:bg-accent/60 transition-colors">
                <div className="flex items-center gap-3">
                  <UserAvatar user={member} size="md" />
                  <div>
                    <p className="font-medium text-foreground">{member.firstName} {member.lastName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">New</Badge>
              </div>
            ))}
            {stats.recentUsers.length === 0 && (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No users yet</p>
                <Button onClick={() => setShowAddUserModal(true)} variant="link" className="mt-2">
                  Add your first user
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardOverview;