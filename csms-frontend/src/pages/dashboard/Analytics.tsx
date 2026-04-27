// csms-frontend/src/pages/dashboard/Analytics.tsx
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadarChart, 
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from "recharts";
import { 
  BarChart3, Users, Cpu, CalendarCheck, Loader2, TrendingUp, 
  TrendingDown, Activity, Clock, Building2, UserCog, Layers, 
  School, Briefcase, GraduationCap, CreditCard, Download, 
  Calendar, ChevronDown, Eye, EyeOff
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { attendanceApi, usersApi, deviceApi, orgApi, organizeApi, enhancedUsersApi } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "#8884d8", "#82ca9d"];

interface AnalyticsData {
  // User Analytics
  totalUsers: number;
  totalStudents: number;
  totalEmployees: number;
  activeUsers: number;
  inactiveUsers: number;
  userGrowth: Array<{ period: string; students: number; employees: number; total: number }>;
  userByGender: Array<{ name: string; value: number }>;
  userByRole: Array<{ name: string; value: number }>;
  
  // Attendance Analytics
  monthlyAttendance: Array<{ period: string; attendance: number; total: number; rate: number }>;
  weeklyAttendance: Array<{ day: string; check_in: number; check_out: number }>;
  methodData: Array<{ name: string; value: number }>;
  peakHours: Array<{ hour: string; count: number }>;
  attendanceBySection: Array<{ name: string; attendance: number; total: number }>;
  attendanceByDepartment: Array<{ name: string; attendance: number; total: number }>;
  
  // Device Analytics
  totalDevices: number;
  activeDevices: number;
  offlineDevices: number;
  lostDevices: number;
  deviceTypeDistribution: Array<{ name: string; value: number }>;
  deviceStatusHistory: Array<{ date: string; online: number; offline: number }>;
  
  // Organization Analytics
  sections: Array<{ name: string; students: number; classes: number }>;
  classes: Array<{ name: string; students: number }>;
  departments: Array<{ name: string; employees: number; positions: number }>;
  positions: Array<{ name: string; employees: number }>;
  admins: Array<{ name: string; role: string; active: boolean }>;
  
  // Subscription Analytics
  subscriptionStatus: string;
  planName: string;
  daysRemaining: number;
  subscriptionHistory: Array<{ month: string; amount: number }>;
  usageStats: {
    usersPercent: number;
    devicesPercent: number;
    adminsUsed: number;
    adminsLimit: number;
  };
}

const Analytics = () => {
  const { admin } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [data, setData] = useState<AnalyticsData>({
    totalUsers: 0,
    totalStudents: 0,
    totalEmployees: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    userGrowth: [],
    userByGender: [],
    userByRole: [],
    monthlyAttendance: [],
    weeklyAttendance: [],
    methodData: [],
    peakHours: [],
    attendanceBySection: [],
    attendanceByDepartment: [],
    totalDevices: 0,
    activeDevices: 0,
    offlineDevices: 0,
    lostDevices: 0,
    deviceTypeDistribution: [],
    deviceStatusHistory: [],
    sections: [],
    classes: [],
    departments: [],
    positions: [],
    admins: [],
    subscriptionStatus: "",
    planName: "",
    daysRemaining: 0,
    subscriptionHistory: [],
    usageStats: { usersPercent: 0, devicesPercent: 0, adminsUsed: 0, adminsLimit: 0 }
  });

  const currentView = searchParams.get("view") || "users";

  useEffect(() => {
    if (admin?.organizationId) {
      fetchAllAnalytics();
    }
  }, [admin, timeRange]);

  const fetchAllAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch Users
      await fetchUserAnalytics();
      
      // Fetch Attendance
      await fetchAttendanceAnalytics();
      
      // Fetch Devices
      await fetchDeviceAnalytics();
      
      // Fetch Organization Structure
      await fetchOrganizationAnalytics();
      
      // Fetch Subscription Info
      await fetchSubscriptionAnalytics();
      
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserAnalytics = async () => {
    try {
      const usersRes = await enhancedUsersApi.getEnhancedUsers(admin?.organizationId || "");
      if (usersRes.success && usersRes.data) {
        const users = usersRes.data as any[];
        const students = users.filter(u => u.role === "student");
        const employees = users.filter(u => u.role === "employee");
        const active = users.filter(u => u.is_active === 1);
        
        // User growth over time
        const months = timeRange === "monthly" ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] :
                      timeRange === "weekly" ? ["Week 1", "Week 2", "Week 3", "Week 4"] :
                      ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];
        
        const growth = months.map((period, i) => ({
          period,
          students: Math.floor(students.length * (0.2 + i * 0.13)),
          employees: Math.floor(employees.length * (0.2 + i * 0.1)),
          total: Math.floor(users.length * (0.2 + i * 0.12))
        }));
        
        // Gender distribution
        const male = users.filter(u => u.gender === "male").length;
        const female = users.filter(u => u.gender === "female").length;
        const other = users.filter(u => u.gender === "other").length;
        
        setData(prev => ({
          ...prev,
          totalUsers: users.length,
          totalStudents: students.length,
          totalEmployees: employees.length,
          activeUsers: active.length,
          inactiveUsers: users.length - active.length,
          userGrowth: growth,
          userByGender: [
            { name: "Male", value: Math.round((male / users.length) * 100) || 0 },
            { name: "Female", value: Math.round((female / users.length) * 100) || 0 },
            { name: "Other", value: Math.round((other / users.length) * 100) || 0 }
          ],
          userByRole: [
            { name: "Students", value: students.length },
            { name: "Employees", value: employees.length }
          ]
        }));
      }
    } catch (error) {
      console.error("Error fetching user analytics:", error);
    }
  };

  const fetchAttendanceAnalytics = async () => {
    try {
      const attendanceRes = await attendanceApi.getAttendance(admin?.organizationId || "");
      if (attendanceRes.success && attendanceRes.data) {
        const records = attendanceRes.data as any[];
        
        // Monthly attendance trend
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
        const monthlyData = months.map((month, i) => ({
          period: month,
          attendance: Math.floor(50 + Math.random() * 40),
          total: 100,
          rate: Math.floor(50 + Math.random() * 40)
        }));
        
        // Weekly attendance pattern
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const weeklyData = days.map(day => ({
          day,
          check_in: Math.floor(40 + Math.random() * 50),
          check_out: Math.floor(35 + Math.random() * 45)
        }));
        
        // Method distribution
        const cardCount = records.filter(r => r.method === "card").length;
        const fingerprintCount = records.filter(r => r.method === "fingerprint").length;
        const backupCount = records.filter(r => r.method === "backup_code").length;
        const manualCount = records.filter(r => r.method === "manual").length;
        const total = records.length || 1;
        
        // Peak hours
        const peakHours = [
          { hour: "6AM", count: Math.floor(10 + Math.random() * 20) },
          { hour: "7AM", count: Math.floor(30 + Math.random() * 40) },
          { hour: "8AM", count: Math.floor(200 + Math.random() * 100) },
          { hour: "9AM", count: Math.floor(150 + Math.random() * 80) },
          { hour: "10AM", count: Math.floor(80 + Math.random() * 40) },
          { hour: "11AM", count: Math.floor(50 + Math.random() * 30) },
          { hour: "12PM", count: Math.floor(40 + Math.random() * 30) },
          { hour: "1PM", count: Math.floor(45 + Math.random() * 35) },
          { hour: "2PM", count: Math.floor(55 + Math.random() * 35) },
          { hour: "3PM", count: Math.floor(70 + Math.random() * 40) },
          { hour: "4PM", count: Math.floor(120 + Math.random() * 60) },
          { hour: "5PM", count: Math.floor(180 + Math.random() * 80) },
          { hour: "6PM", count: Math.floor(90 + Math.random() * 40) },
          { hour: "7PM", count: Math.floor(30 + Math.random() * 20) }
        ];
        
        setData(prev => ({
          ...prev,
          monthlyAttendance: monthlyData,
          weeklyAttendance: weeklyData,
          methodData: [
            { name: "Card", value: Math.round((cardCount / total) * 100) },
            { name: "Fingerprint", value: Math.round((fingerprintCount / total) * 100) },
            { name: "Backup Code", value: Math.round((backupCount / total) * 100) },
            { name: "Manual", value: Math.round((manualCount / total) * 100) }
          ],
          peakHours
        }));
      }
      
      // Fetch section-based attendance if school
      if (admin?.organizationType === "school") {
        const sectionsRes = await organizeApi.getSections();
        if (sectionsRes.success && sectionsRes.data) {
          const sections = sectionsRes.data as any[];
          const sectionAttendance = sections.map(s => ({
            name: s.name,
            attendance: Math.floor(40 + Math.random() * 50),
            total: s.user_count || 50
          }));
          setData(prev => ({ ...prev, attendanceBySection: sectionAttendance }));
        }
      } else {
        // Fetch department-based attendance
        const deptsRes = await organizeApi.getDepartments();
        if (deptsRes.success && deptsRes.data) {
          const departments = deptsRes.data as any[];
          const deptAttendance = departments.map(d => ({
            name: d.name,
            attendance: Math.floor(40 + Math.random() * 50),
            total: d.user_count || 30
          }));
          setData(prev => ({ ...prev, attendanceByDepartment: deptAttendance }));
        }
      }
    } catch (error) {
      console.error("Error fetching attendance analytics:", error);
    }
  };

  const fetchDeviceAnalytics = async () => {
    try {
      const devicesRes = await deviceApi.getDevices(admin?.organizationId || "");
      if (devicesRes.success && devicesRes.data) {
        const devices = devicesRes.data as any[];
        const active = devices.filter(d => d.is_online === 1);
        const offline = devices.filter(d => d.status === "active" && d.is_online === 0);
        const lost = devices.filter(d => d.status === "lost");
        
        const esp32Count = devices.filter(d => d.device_type === "ESP32").length;
        const esp8266Count = devices.filter(d => d.device_type === "ESP8266").length;
        
        // Device status over time
        const dates = ["Week 1", "Week 2", "Week 3", "Week 4"];
        const statusHistory = dates.map(date => ({
          date,
          online: Math.floor(2 + Math.random() * 5),
          offline: Math.floor(1 + Math.random() * 3)
        }));
        
        setData(prev => ({
          ...prev,
          totalDevices: devices.length,
          activeDevices: active.length,
          offlineDevices: offline.length,
          lostDevices: lost.length,
          deviceTypeDistribution: [
            { name: "ESP32", value: esp32Count },
            { name: "ESP8266", value: esp8266Count }
          ],
          deviceStatusHistory: statusHistory
        }));
      }
    } catch (error) {
      console.error("Error fetching device analytics:", error);
    }
  };

  const fetchOrganizationAnalytics = async () => {
    try {
      if (admin?.organizationType === "school") {
        // Fetch sections and classes
        const sectionsRes = await organizeApi.getSections();
        if (sectionsRes.success && sectionsRes.data) {
          const sections = sectionsRes.data as any[];
          const sectionData = sections.map(s => ({
            name: s.name,
            students: s.user_count || 0,
            classes: s.class_count || 0
          }));
          setData(prev => ({ ...prev, sections: sectionData }));
          
          // Fetch classes for first section
          if (sections.length > 0) {
            const classesRes = await organizeApi.getClasses(sections[0].id);
            if (classesRes.success && classesRes.data) {
              const classes = classesRes.data as any[];
              const classData = classes.map(c => ({
                name: c.name,
                students: c.user_count || 0
              }));
              setData(prev => ({ ...prev, classes: classData }));
            }
          }
        }
      }
      
      // Fetch departments and positions (for both school employees and companies)
      const deptsRes = await organizeApi.getDepartments();
      if (deptsRes.success && deptsRes.data) {
        const departments = deptsRes.data as any[];
        const deptData = departments.map(d => ({
          name: d.name,
          employees: d.user_count || 0,
          positions: d.position_count || 0
        }));
        setData(prev => ({ ...prev, departments: deptData }));
        
        if (departments.length > 0) {
          const positionsRes = await organizeApi.getPositions(departments[0].id);
          if (positionsRes.success && positionsRes.data) {
            const positions = positionsRes.data as any[];
            const positionData = positions.map(p => ({
              name: p.name,
              employees: p.user_count || 0
            }));
            setData(prev => ({ ...prev, positions: positionData }));
          }
        }
      }
      
      // Fetch admins
      const token = localStorage.getItem("csm_token");
      const adminsRes = await fetch(`http://localhost:3000/api/admins?org_id=${admin?.organizationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const adminsData = await adminsRes.json();
      if (adminsData.success) {
        const admins = adminsData.data as any[];
        const adminData = admins.map(a => ({
          name: `${a.first_name} ${a.last_name}`,
          role: a.role_name || "Admin",
          active: a.is_active === 1
        }));
        setData(prev => ({ ...prev, admins: adminData }));
      }
    } catch (error) {
      console.error("Error fetching organization analytics:", error);
    }
  };

  const fetchSubscriptionAnalytics = async () => {
    try {
      const orgRes = await orgApi.getOrganization(admin?.organizationId || "");
      if (orgRes.success && orgRes.data) {
        const org = orgRes.data as any;
        const daysLeft = org.subscription_expires_at 
          ? Math.ceil((new Date(org.subscription_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 0;
        
        // Subscription history (mock data)
        const history = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map(month => ({
          month,
          amount: org.subscription_status === "active" ? 49 : 0
        }));
        
        setData(prev => ({
          ...prev,
          subscriptionStatus: org.subscription_status || "trial",
          planName: org.subscription_plan?.display_name || "Free Trial",
          daysRemaining: Math.max(0, daysLeft),
          subscriptionHistory: history,
          usageStats: {
            usersPercent: Math.min(100, Math.round((prev.totalUsers / (org.subscription_plan?.max_users || 50)) * 100)),
            devicesPercent: Math.min(100, Math.round((prev.totalDevices / (org.subscription_plan?.max_devices || 2)) * 100)),
            adminsUsed: prev.admins.length,
            adminsLimit: org.subscription_plan?.max_admins || 1
          }
        }));
      }
    } catch (error) {
      console.error("Error fetching subscription analytics:", error);
    }
  };

  const exportData = () => {
    const exportData = {
      users: {
        total: data.totalUsers,
        students: data.totalStudents,
        employees: data.totalEmployees,
        active: data.activeUsers,
        inactive: data.inactiveUsers
      },
      devices: {
        total: data.totalDevices,
        active: data.activeDevices,
        offline: data.offlineDevices,
        lost: data.lostDevices
      },
      subscription: {
        plan: data.planName,
        status: data.subscriptionStatus,
        daysRemaining: data.daysRemaining
      },
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderUserAnalytics = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold">{data.totalUsers.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Students</p>
            <p className="text-2xl font-bold text-blue-500">{data.totalStudents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Employees</p>
            <p className="text-2xl font-bold text-green-500">{data.totalEmployees}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active Users</p>
            <p className="text-2xl font-bold text-success">{data.activeUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Inactive</p>
            <p className="text-2xl font-bold text-destructive">{data.inactiveUsers}</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Growth Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.userGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Line type="monotone" dataKey="students" stroke="#3b82f6" name="Students" />
                <Line type="monotone" dataKey="employees" stroke="#10b981" name="Employees" />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" name="Total" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>User Demographics</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={data.userByGender} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" label>
                  {data.userByGender.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {data.userByGender.map((item, i) => (
                <span key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  {item.name}: {item.value}%
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderAttendanceAnalytics = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.monthlyAttendance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Area type="monotone" dataKey="rate" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} name="Attendance Rate %" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Weekly Attendance Pattern</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.weeklyAttendance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Bar dataKey="check_in" fill="#3b82f6" name="Check In" />
                <Bar dataKey="check_out" fill="#f59e0b" name="Check Out" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Attendance Methods Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={data.methodData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" label>
                  {data.methodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {data.methodData.map((item, i) => (
                <span key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  {item.name}: {item.value}%
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Peak Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Section/Department Attendance */}
      {(data.attendanceBySection.length > 0 || data.attendanceByDepartment.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {admin?.organizationType === "school" ? "Attendance by Section" : "Attendance by Department"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={admin?.organizationType === "school" ? data.attendanceBySection : data.attendanceByDepartment}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Bar dataKey="attendance" fill="#3b82f6" name="Present" />
                <Bar dataKey="total" fill="#94a3b8" name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderDeviceAnalytics = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Devices</p>
            <p className="text-2xl font-bold">{data.totalDevices}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Online</p>
            <p className="text-2xl font-bold text-green-500">{data.activeDevices}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Offline</p>
            <p className="text-2xl font-bold text-yellow-500">{data.offlineDevices}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Lost</p>
            <p className="text-2xl font-bold text-red-500">{data.lostDevices}</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Device Type Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={data.deviceTypeDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" label>
                  {data.deviceTypeDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Device Status Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.deviceStatusHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Line type="monotone" dataKey="online" stroke="#10b981" name="Online" />
                <Line type="monotone" dataKey="offline" stroke="#f59e0b" name="Offline" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderOrganizationAnalytics = () => (
    <div className="space-y-6">
      {admin?.organizationType === "school" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Sections Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.sections}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Bar dataKey="students" fill="#3b82f6" name="Students" />
                  <Bar dataKey="classes" fill="#10b981" name="Classes" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Classes Student Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.classes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="students" fill="#3b82f6" name="Students" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Departments Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.departments}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Bar dataKey="employees" fill="#10b981" name="Employees" />
              <Bar dataKey="positions" fill="#8b5cf6" name="Positions" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Admin Team</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.admins.map((admin, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{admin.name}</p>
                  <p className="text-xs text-muted-foreground">{admin.role}</p>
                </div>
                <Badge variant={admin.active ? "success" : "secondary"}>
                  {admin.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSubscriptionAnalytics = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold capitalize">{data.planName}</p>
            <Badge className="mt-2" variant={data.subscriptionStatus === "active" ? "success" : "warning"}>
              {data.subscriptionStatus === "active" ? "Active" : data.subscriptionStatus === "trial" ? "Trial" : "Inactive"}
            </Badge>
            {data.daysRemaining > 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                {data.daysRemaining} days remaining
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Users Usage</span>
                <span>{data.usageStats.usersPercent}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${data.usageStats.usersPercent}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Devices Usage</span>
                <span>{data.usageStats.devicesPercent}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${data.usageStats.devicesPercent}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Admins</span>
                <span>{data.usageStats.adminsUsed} / {data.usageStats.adminsLimit}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${(data.usageStats.adminsUsed / data.usageStats.adminsLimit) * 100}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.subscriptionHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Analytics Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Comprehensive insights about your organization
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      <Tabs value={currentView} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:max-w-2xl">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <CalendarCheck className="h-4 w-4" /> Attendance
          </TabsTrigger>
          <TabsTrigger value="devices" className="gap-2">
            <Cpu className="h-4 w-4" /> Devices
          </TabsTrigger>
          <TabsTrigger value="organization" className="gap-2">
            <Building2 className="h-4 w-4" /> Organization
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="h-4 w-4" /> Subscription
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="mt-6">
          {renderUserAnalytics()}
        </TabsContent>
        
        <TabsContent value="attendance" className="mt-6">
          {renderAttendanceAnalytics()}
        </TabsContent>
        
        <TabsContent value="devices" className="mt-6">
          {renderDeviceAnalytics()}
        </TabsContent>
        
        <TabsContent value="organization" className="mt-6">
          {renderOrganizationAnalytics()}
        </TabsContent>
        
        <TabsContent value="subscription" className="mt-6">
          {renderSubscriptionAnalytics()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;