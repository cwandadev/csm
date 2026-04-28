// csms-frontend/src/pages/dashboard/AttendanceManagement.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CalendarCheck, Search, Download, Plus, Clock, Edit, Trash2,
  RefreshCw, Users, BarChart3, UserPlus, Loader2, CalendarIcon,
  ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertCircle,
  Building2, GraduationCap, Briefcase, ChevronRight as ChevronRightIcon,
  X
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { attendanceApi } from "@/lib/api";
import { format } from "date-fns";

interface AttendanceRecord {
  id: number;
  user_name: string;
  user_image?: string;
  user_role?: string;
  department_name?: string;
  position_name?: string;
  section_name?: string;
  class_name?: string;
  method: "card" | "backup_code" | "fingerprint" | "manual" | "face_recognition";
  status: "check_in" | "check_out" | "present" | "absent" | "late" | "early_leave" | "holiday" | "weekend";
  timestamp: string;
  device: string;
  attendance_type?: string;
  notes?: string;
  schedule_name?: string;
}

interface Schedule {
  id: number;
  name: string;
  description: string;
  type: "check_in" | "check_out" | "both";
  start_time: string;
  end_time: string;
  days_of_week: string[];
  is_active: boolean | number;
  target_type: "all" | "departments" | "positions" | "sections" | "classes" | "specific_users";
  target_ids: number[] | null;
  grace_minutes: number;
  late_threshold_minutes: number;
  early_leave_threshold_minutes: number;
  created_at?: string;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean | number;
  image?: string;
}

interface Department {
  id: number;
  name: string;
  description?: string;
  positions?: Position[];
}

interface Position {
  id: number;
  name: string;
  salary_range?: string;
}

interface Section {
  id: number;
  name: string;
  description?: string;
  classes?: Class[];
}

interface Class {
  id: number;
  name: string;
  grade_level?: string;
}

interface Stats {
  total_records: number;
  check_ins: number;
  absents: number;
  lates: number;
  present_percentage?: number;
  late_percentage?: number;
  absent_percentage?: number;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL: Record<string, string> = {
  Mon: "monday", Tue: "tuesday", Wed: "wednesday", Thu: "thursday",
  Fri: "friday", Sat: "saturday", Sun: "sunday",
};

const statusColor: Record<string, string> = {
  check_in: "bg-green-500/10 text-green-600",
  check_out: "bg-blue-500/10 text-blue-600",
  present: "bg-green-500/10 text-green-600",
  absent: "bg-red-500/10 text-red-600",
  late: "bg-yellow-500/10 text-yellow-600",
  early_leave: "bg-orange-500/10 text-orange-600",
  holiday: "bg-gray-500/10 text-gray-600",
  weekend: "bg-gray-500/10 text-gray-600",
};

const AttendanceManagement = () => {
  const { admin } = useAuth();
  const orgType = admin?.organizationType ?? "school";

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_records: 0,
    check_ins: 0,
    absents: 0,
    lates: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const isMounted = useRef(true);
  const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Date view state
  const [dateView, setDateView] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  
  // Schedule dialog
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    name: "",
    description: "",
    type: "both" as "check_in" | "check_out" | "both",
    start_time: "08:00",
    end_time: "17:00",
    days_of_week: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    is_active: true,
    target_type: "all" as Schedule["target_type"],
    grace_minutes: 0,
    late_threshold_minutes: 15,
    early_leave_threshold_minutes: 15
  });
  
  // Targeting state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [targetDepartments, setTargetDepartments] = useState<number[]>([]);
  const [targetPositions, setTargetPositions] = useState<number[]>([]);
  const [targetSections, setTargetSections] = useState<number[]>([]);
  const [targetClasses, setTargetClasses] = useState<number[]>([]);
  const [previewUsers, setPreviewUsers] = useState<User[]>([]);
  
  // Manual attendance dialog
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualUser, setManualUser] = useState("");
  const [manualUserId, setManualUserId] = useState<number | null>(null);
  const [manualStatus, setManualStatus] = useState<"check_in" | "check_out">("check_in");
  const [manualNote, setManualNote] = useState("");
  const [manualScheduleId, setManualScheduleId] = useState<number | null>(null);
  const [userSchedules, setUserSchedules] = useState<Schedule[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  
  // Record detail modal
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [showRecordDetail, setShowRecordDetail] = useState(false);
  
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("records");

  // Helper: Get date range based on view
  const getDateRangeFromView = (view: string, date: Date) => {
    const start = new Date(date);
    const end = new Date(date);
    
    switch(view) {
      case "daily":
        break;
      case "weekly":
        start.setDate(date.getDate() - date.getDay());
        end.setDate(start.getDate() + 6);
        break;
      case "monthly":
        start.setDate(1);
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        break;
      case "yearly":
        start.setMonth(0, 1);
        end.setMonth(11, 31);
        break;
    }
    
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd")
    };
  };

  // Check if schedule is currently active based on time
  const isScheduleCurrentlyActive = (schedule: Schedule): boolean => {
    if (!schedule.is_active) return false;
    
    const now = new Date();
    const currentTime = format(now, "HH:mm");
    const currentDay = format(now, "EEEE").toLowerCase();
    
    const dayMatch = schedule.days_of_week.includes(currentDay);
    const timeMatch = currentTime >= schedule.start_time && currentTime <= schedule.end_time;
    
    return dayMatch && timeMatch;
  };

  // Fetch data
  const fetchRecords = useCallback(async () => {
    if (!isMounted.current) return;
    
    try {
      const params: Record<string, any> = { page: currentPage, limit: 50 };
      if (search) params.search = search;
      if (statusFilter !== "all") params.status = statusFilter;
      if (methodFilter !== "all") params.method = methodFilter;
      if (scheduleFilter !== "all") params.schedule_id = scheduleFilter;
      if (dateRange.start) params.startDate = dateRange.start;
      if (dateRange.end) params.endDate = dateRange.end;
      
      const response = await attendanceApi.getRecords(params);
      if (response.success && isMounted.current) {
        setRecords(response.data || []);
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages);
          setTotalRecords(response.pagination.total);
        }
      } else if (isMounted.current) {
        toast.error(response.error || "Failed to load records");
      }
    } catch (error) {
      console.error("Failed to fetch records:", error);
      if (isMounted.current) toast.error("Failed to load attendance records");
    }
  }, [search, statusFilter, methodFilter, scheduleFilter, currentPage, dateRange.start, dateRange.end]);
  
  const fetchStats = useCallback(async () => {
    if (!isMounted.current) return;
    
    try {
      const response = await attendanceApi.getTodayStats();
      if (response.success && response.data && isMounted.current) {
        const total = response.data.total_records || 1;
        setStats({
          ...response.data,
          present_percentage: Math.round((response.data.check_ins / total) * 100),
          late_percentage: Math.round((response.data.lates / total) * 100),
          absent_percentage: Math.round((response.data.absents / total) * 100)
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);
  
  const fetchSchedules = useCallback(async () => {
    if (!isMounted.current) return;
    
    setLoadingSchedules(true);
    try {
      const response = await attendanceApi.getSchedules();
      if (response.success && isMounted.current) {
        setSchedules(response.data || []);
      } else if (isMounted.current) {
        toast.error(response.error || "Failed to load schedules");
      }
    } catch (error) {
      console.error("Failed to fetch schedules:", error);
      if (isMounted.current) toast.error("Failed to load schedules");
    } finally {
      if (isMounted.current) setLoadingSchedules(false);
    }
  }, []);
  
  const fetchUsers = useCallback(async (query?: string) => {
    if (!isMounted.current) return;
    
    try {
      const response = await attendanceApi.getUsers(query);
      if (response.success && isMounted.current) {
        setUsers(response.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }, []);
  
  const fetchOrgStructure = useCallback(async () => {
    if (!isMounted.current) return;
    
    try {
      const response = await attendanceApi.getOrganizationStructure();
      if (response.success && response.data && isMounted.current) {
        if (response.data.departments) setDepartments(response.data.departments);
        if (response.data.sections) setSections(response.data.sections);
      }
    } catch (error) {
      console.error("Failed to fetch organization structure:", error);
    }
  }, []);
  
  const fetchUserSchedules = async (userId: number) => {
    try {
      const response = await attendanceApi.getUserSchedules(userId);
      if (response.success && isMounted.current) {
        setUserSchedules(response.data || []);
        
        // Auto-select the currently active schedule
        if (response.data && response.data.length > 0) {
          const now = new Date();
          const currentTime = format(now, "HH:mm");
          const currentDay = format(now, "EEEE").toLowerCase();
          
          const activeSchedules = response.data.filter(schedule => {
            if (!schedule.is_active && schedule.is_active !== 1) return false;
            const dayMatch = schedule.days_of_week?.includes(currentDay) || false;
            if (!dayMatch) return false;
            const timeMatch = currentTime >= schedule.start_time && currentTime <= schedule.end_time;
            return timeMatch;
          });
          
          if (activeSchedules.length > 0 && isMounted.current) {
            setManualScheduleId(activeSchedules[0].id);
            toast.success(`Auto-selected active schedule: ${activeSchedules[0].name}`);
          } else {
            setManualScheduleId(null);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch user schedules:", error);
    }
  };
  
  const previewTargetUsers = async () => {
    let targetIds: number[] = [];
    let targetType = scheduleForm.target_type;
    
    if (targetType === "departments") targetIds = targetDepartments;
    else if (targetType === "positions") targetIds = targetPositions;
    else if (targetType === "sections") targetIds = targetSections;
    else if (targetType === "classes") targetIds = targetClasses;
    
    if (targetType !== "all" && targetIds.length === 0) {
      toast.info("Please select at least one item to preview");
      return;
    }
    
    try {
      const response = await attendanceApi.getTargetUsers(targetType, targetIds);
      if (response.success && isMounted.current) {
        setPreviewUsers(response.data || []);
        if (response.data?.length === 0) {
          toast.info("No users found matching the selected criteria");
        } else {
          toast.success(`${response.data?.length} users found`);
        }
      }
    } catch (error) {
      console.error("Preview users error:", error);
      toast.error("Failed to preview users");
    }
  };
  
  // Initial data load
  useEffect(() => {
    isMounted.current = true;
    
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchRecords(),
        fetchStats(),
        fetchSchedules(),
        fetchUsers(),
        fetchOrgStructure()
      ]);
      setLoading(false);
    };
    
    loadData();
    
    return () => {
      isMounted.current = false;
    };
  }, [fetchRecords, fetchStats, fetchSchedules, fetchUsers, fetchOrgStructure]);
  
  // Auto-refresh every 30 seconds (realtime)
  useEffect(() => {
    if (autoRefreshInterval.current) {
      clearInterval(autoRefreshInterval.current);
    }
    
    autoRefreshInterval.current = setInterval(() => {
      if (!refreshing && isMounted.current && !loading) {
        fetchRecords();
        fetchStats();
      }
    }, 30000);
    
    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
      }
    };
  }, [fetchRecords, fetchStats, refreshing, loading]);
  
  // Re-fetch when filters change (excluding auto-refresh)
  useEffect(() => {
    if (isMounted.current && !loading) {
      fetchRecords();
    }
  }, [search, statusFilter, methodFilter, scheduleFilter, currentPage, dateRange.start, dateRange.end, fetchRecords, loading]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchRecords(),
      fetchStats(),
      fetchSchedules(),
      fetchUsers(),
      fetchOrgStructure()
    ]);
    setRefreshing(false);
    toast.success("Attendance data refreshed");
  };

  // Schedule CRUD
  const createSchedule = async () => {
    let targetIds: number[] | null = null;
    if (scheduleForm.target_type === "departments") targetIds = targetDepartments;
    else if (scheduleForm.target_type === "positions") targetIds = targetPositions;
    else if (scheduleForm.target_type === "sections") targetIds = targetSections;
    else if (scheduleForm.target_type === "classes") targetIds = targetClasses;
    
    const payload = { ...scheduleForm, target_ids: targetIds };
    
    try {
      const response = await attendanceApi.createSchedule(payload);
      if (response.success) {
        toast.success("Schedule created successfully");
        setShowScheduleDialog(false);
        fetchSchedules();
        resetScheduleForm();
      } else {
        toast.error(response.error || "Failed to create schedule");
      }
    } catch (error) {
      console.error("Create schedule error:", error);
      toast.error("Failed to create schedule");
    }
  };
  
  const updateSchedule = async () => {
    if (!editingSchedule) return;
    
    let targetIds: number[] | null = null;
    if (scheduleForm.target_type === "departments") targetIds = targetDepartments;
    else if (scheduleForm.target_type === "positions") targetIds = targetPositions;
    else if (scheduleForm.target_type === "sections") targetIds = targetSections;
    else if (scheduleForm.target_type === "classes") targetIds = targetClasses;
    
    const payload = { ...scheduleForm, target_ids: targetIds };
    
    try {
      const response = await attendanceApi.updateSchedule(editingSchedule.id, payload);
      if (response.success) {
        toast.success("Schedule updated successfully");
        setShowScheduleDialog(false);
        fetchSchedules();
        resetScheduleForm();
      } else {
        toast.error(response.error || "Failed to update schedule");
      }
    } catch (error) {
      console.error("Update schedule error:", error);
      toast.error("Failed to update schedule");
    }
  };
  
  const deleteSchedule = async (id: number) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;
    try {
      const response = await attendanceApi.deleteSchedule(id);
      if (response.success) {
        toast.success("Schedule deleted successfully");
        fetchSchedules();
      } else {
        toast.error(response.error || "Failed to delete schedule");
      }
    } catch (error) {
      console.error("Delete schedule error:", error);
      toast.error("Failed to delete schedule");
    }
  };
  
  const resetScheduleForm = () => {
    setScheduleForm({
      name: "",
      description: "",
      type: "both",
      start_time: "08:00",
      end_time: "17:00",
      days_of_week: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      is_active: true,
      target_type: "all",
      grace_minutes: 0,
      late_threshold_minutes: 15,
      early_leave_threshold_minutes: 15
    });
    setTargetDepartments([]);
    setTargetPositions([]);
    setTargetSections([]);
    setTargetClasses([]);
    setPreviewUsers([]);
    setEditingSchedule(null);
  };
  
  const openNewSchedule = () => {
    resetScheduleForm();
    setShowScheduleDialog(true);
  };
  
  const openEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      name: schedule.name,
      description: schedule.description || "",
      type: schedule.type,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      days_of_week: schedule.days_of_week,
      is_active: schedule.is_active === 1 || schedule.is_active === true,
      target_type: schedule.target_type,
      grace_minutes: schedule.grace_minutes || 0,
      late_threshold_minutes: schedule.late_threshold_minutes || 15,
      early_leave_threshold_minutes: schedule.early_leave_threshold_minutes || 15
    });
    
    if (schedule.target_ids) {
      if (schedule.target_type === "departments") setTargetDepartments(schedule.target_ids);
      else if (schedule.target_type === "positions") setTargetPositions(schedule.target_ids);
      else if (schedule.target_type === "sections") setTargetSections(schedule.target_ids);
      else if (schedule.target_type === "classes") setTargetClasses(schedule.target_ids);
    }
    
    setShowScheduleDialog(true);
  };

  // Manual attendance
  const handleUserSearch = async (value: string) => {
    setUserSearch(value);
    setManualUser(value);
    if (value.length > 1) {
      await fetchUsers(value);
      const filtered = users.filter(u => 
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(value.toLowerCase()) ||
        u.email?.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredUsers(filtered);
      setShowUserDropdown(true);
    } else {
      setShowUserDropdown(false);
    }
  };
  
  const selectUser = async (user: User) => {
    setManualUser(`${user.first_name} ${user.last_name}`);
    setManualUserId(user.id);
    setUserSearch("");
    setShowUserDropdown(false);
    await fetchUserSchedules(user.id);
  };
  
  const submitManualAttendance = async () => {
    if (!manualUserId) {
      toast.error("Please select a user");
      return;
    }
    
    try {
      const response = await attendanceApi.recordManual({
        user_id: manualUserId,
        status: manualStatus,
        notes: manualNote,
        schedule_id: manualScheduleId
      });
      
      if (response.success) {
        toast.success(`Manual ${manualStatus.replace("_", " ")} recorded successfully`);
        setShowManualDialog(false);
        setManualUser("");
        setManualUserId(null);
        setManualNote("");
        setManualScheduleId(null);
        setUserSchedules([]);
        fetchRecords();
        fetchStats();
      } else {
        toast.error(response.error || "Failed to record manual attendance");
      }
    } catch (error) {
      console.error("Manual attendance error:", error);
      toast.error("Failed to record manual attendance");
    }
  };

  // Export
  const exportCSV = async () => {
    setExporting(true);
    try {
      const params: Record<string, any> = {};
      if (dateRange.start) params.startDate = dateRange.start;
      if (dateRange.end) params.endDate = dateRange.end;
      if (statusFilter !== "all") params.status = statusFilter;
      if (methodFilter !== "all") params.method = methodFilter;
      if (scheduleFilter !== "all") params.schedule_id = scheduleFilter;
      
      const response = await attendanceApi.exportAttendance(params);
      
      if (response.success && response.data && response.data.length > 0) {
        const headers = Object.keys(response.data[0]);
        const csvRows = [
          headers.join(","),
          ...response.data.map((row: any) => 
            headers.map(header => {
              const value = row[header];
              if (value === null || value === undefined) return "";
              if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            }).join(",")
          )
        ];
        
        const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `attendance_export_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success("Export completed successfully");
      } else {
        toast.info(response.message || "No data to export");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setExporting(false);
    }
  };
  
  const toggleDay = (day: string) => {
    const dayFull = DAY_FULL[day];
    setScheduleForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(dayFull)
        ? prev.days_of_week.filter(d => d !== dayFull)
        : [...prev.days_of_week, dayFull]
    }));
  };
  
  const handleDateViewChange = (view: "daily" | "weekly" | "monthly" | "yearly") => {
    setDateView(view);
    const range = getDateRangeFromView(view, calendarDate);
    setDateRange({ start: range.start, end: range.end });
    setCurrentPage(1);
  };
  
  const handleDateNavigate = (direction: "prev" | "next") => {
    const newDate = new Date(calendarDate);
    switch(dateView) {
      case "daily":
        newDate.setDate(calendarDate.getDate() + (direction === "next" ? 1 : -1));
        break;
      case "weekly":
        newDate.setDate(calendarDate.getDate() + (direction === "next" ? 7 : -7));
        break;
      case "monthly":
        newDate.setMonth(calendarDate.getMonth() + (direction === "next" ? 1 : -1));
        break;
      case "yearly":
        newDate.setFullYear(calendarDate.getFullYear() + (direction === "next" ? 1 : -1));
        break;
    }
    setCalendarDate(newDate);
    const range = getDateRangeFromView(dateView, newDate);
    setDateRange({ start: range.start, end: range.end });
    setCurrentPage(1);
  };
  
  const targetOptions = orgType === "company"
    ? [
        { value: "all", label: "All Users" },
        { value: "departments", label: "Department" },
        { value: "positions", label: "Position" }
      ]
    : [
        { value: "all", label: "All Users" },
        { value: "departments", label: "Department (Staff)" },
        { value: "positions", label: "Position (Staff)" },
        { value: "sections", label: "Section / Trade (Students)" },
        { value: "classes", label: "Class (Students)" }
      ];

  const activeSchedulesCount = schedules.filter(s => isScheduleCurrentlyActive(s)).length;

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-primary" /> Attendance Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track attendance records, manage schedules, and view statistics.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button size="sm" className="gradient-primary text-white hover:gradient-primary/90" onClick={() => setShowManualDialog(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Manual Attendance
          </Button>
          <Button size="sm" className="gradient-primary text-white hover:gradient-primary/90" onClick={openNewSchedule}>
            <Plus className="h-4 w-4 mr-1" /> New Schedule
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" /> {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>
      
      {/* Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl gradient-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-foreground">{stats.total_records}</p>
                <p className="text-xs text-muted-foreground">Total Records Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-green-600">{stats.check_ins}</p>
                <p className="text-xs text-muted-foreground">Present / Checked In</p>
              </div>
            </div>
            {stats.present_percentage && (
              <Badge className="bg-green-500/20 text-green-600">{stats.present_percentage}%</Badge>
            )}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-red-600">{stats.absents}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
            </div>
            {stats.absent_percentage && (
              <Badge className="bg-red-500/20 text-red-600">{stats.absent_percentage}%</Badge>
            )}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-yellow-600">{stats.lates}</p>
                <p className="text-xs text-muted-foreground">Late Arrivals</p>
              </div>
            </div>
            {stats.late_percentage && (
              <Badge className="bg-yellow-500/20 text-yellow-600">{stats.late_percentage}%</Badge>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Enhanced Date Filter Bar */}
      <Card className="border-0 shadow-sm bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleDateNavigate("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-[200px]">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(calendarDate, dateView === "yearly" ? "yyyy" : dateView === "monthly" ? "MMMM yyyy" : "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={calendarDate}
                    onSelect={(date) => {
                      if (date) {
                        setCalendarDate(date);
                        const range = getDateRangeFromView(dateView, date);
                        setDateRange({ start: range.start, end: range.end });
                        setCurrentPage(1);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Button variant="outline" size="sm" onClick={() => handleDateNavigate("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={dateView === "daily" ? "default" : "outline"}
                size="sm"
                onClick={() => handleDateViewChange("daily")}
              >
                Daily
              </Button>
              <Button
                variant={dateView === "weekly" ? "default" : "outline"}
                size="sm"
                onClick={() => handleDateViewChange("weekly")}
              >
                Weekly
              </Button>
              <Button
                variant={dateView === "monthly" ? "default" : "outline"}
                size="sm"
                onClick={() => handleDateViewChange("monthly")}
              >
                Monthly
              </Button>
              <Button
                variant={dateView === "yearly" ? "default" : "outline"}
                size="sm"
                onClick={() => handleDateViewChange("yearly")}
              >
                Yearly
              </Button>
            </div>
            
            {(dateRange.start || dateRange.end) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setDateRange({ start: "", end: "" });
                  setCalendarDate(new Date());
                  setDateView("daily");
                }}
              >
                Clear
              </Button>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground mt-3 text-center">
            Showing: {dateRange.start || "start"} to {dateRange.end || "end"}
          </div>
        </CardContent>
      </Card>
      
      {/* Rest of the component remains the same */}
      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="records">Records ({totalRecords})</TabsTrigger>
          <TabsTrigger value="schedules">
            Schedules 
            {activeSchedulesCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-green-500/20 text-green-600">
                {activeSchedulesCount} Active
              </Badge>
            )}  
          </TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>
        
        {/* Records Tab */}
        <TabsContent value="records">
          <Card className="border-0 shadow-sm bg-card">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="check_in">Check In</SelectItem>
                      <SelectItem value="check_out">Check Out</SelectItem>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                      <SelectItem value="late">Late</SelectItem>
                      <SelectItem value="early_leave">Early Leave</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Method" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="fingerprint">Fingerprint</SelectItem>
                      <SelectItem value="backup_code">Backup Code</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="face_recognition">Face</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="Filter by Schedule" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Schedules</SelectItem>
                      {schedules.map(schedule => (
                        <SelectItem key={schedule.id} value={schedule.id.toString()}>
                          {schedule.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading && !refreshing ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Assignment</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Device</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No attendance records found
                          </TableCell>
                        </TableRow>
                      ) : (
                        records.map(record => (
                          <TableRow 
                            key={record.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              setSelectedRecord(record);
                              setShowRecordDetail(true);
                            }}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={record.user_image} />
                                  <AvatarFallback className="gradient-primary/10 text-primary text-xs">
                                    {record.user_name?.split(" ").map(n => n[0]).join("") || "U"}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{record.user_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {record.department_name || record.section_name ? (
                                <div className="flex flex-col">
                                  <span className="text-xs">
                                    {record.department_name || record.section_name}
                                  </span>
                                  {(record.position_name || record.class_name) && (
                                    <span className="text-xs opacity-70">
                                      {record.position_name || record.class_name}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">
                                {record.method?.replace("_", " ") || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${statusColor[record.status] ?? "bg-muted text-muted-foreground"} border-0 capitalize`}>
                                {record.status?.replace(/_/g, " ") || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {record.schedule_name || "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {record.timestamp ? new Date(record.timestamp).toLocaleString() : "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {record.device || "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  
                  {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground py-2">Page {currentPage} of {totalPages}</span>
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Schedules Tab */}
        <TabsContent value="schedules">
          <Card className="border-0 shadow-sm bg-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Attendance Schedules ({schedules.length})
              </CardTitle>
              <Button size="sm" className="gradient-primary text-white hover:gradient-primary/90" onClick={openNewSchedule}>
                <Plus className="h-4 w-4 mr-1" /> New Schedule
              </Button>
            </CardHeader>
            <CardContent>
              {loadingSchedules ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No schedules created.</p>
                  <Button variant="link" onClick={openNewSchedule} className="mt-2">
                    Click here to create one
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {schedules.map(schedule => {
                    const isCurrentlyActive = isScheduleCurrentlyActive(schedule);
                    return (
                      <Card key={schedule.id} className={`border-l-4 ${isCurrentlyActive ? 'border-l-green-500' : schedule.is_active ? 'border-l-blue-500' : 'border-l-gray-300'}`}>
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-heading font-semibold text-foreground">{schedule.name}</h3>
                                <Badge variant={schedule.is_active ? "default" : "secondary"}>
                                  {schedule.is_active ? "Active" : "Inactive"}
                                </Badge>
                                {isCurrentlyActive && (
                                  <Badge className="bg-green-500/20 text-green-600 border-0">
                                    <CheckCircle className="h-3 w-3 mr-1" /> Running Now
                                  </Badge>
                                )}
                                <Badge variant="outline" className="capitalize">
                                  {schedule.type?.replace("_", " & ") || "both"}
                                </Badge>
                              </div>
                              {schedule.description && (
                                <p className="text-sm text-muted-foreground mt-1">{schedule.description}</p>
                              )}
                              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span>{schedule.start_time} – {schedule.end_time}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                                  <div className="flex gap-1">
                                    {DAYS.map(d => (
                                      <span key={d} className={`text-xs px-1.5 py-0.5 rounded ${
                                        schedule.days_of_week?.includes(DAY_FULL[d])
                                          ? "gradient-primary/20 text-primary font-medium"
                                          : "text-muted-foreground"
                                      }`}>{d}</span>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>Grace: {schedule.grace_minutes}m</span>
                                  <span>•</span>
                                  <span>Late: {schedule.late_threshold_minutes}m</span>
                                  <span>•</span>
                                  <span>Early Leave: {schedule.early_leave_threshold_minutes}m</span>
                                </div>
                              </div>
                              <div className="mt-2">
                                <Badge variant="secondary" className="text-xs">
                                  Target: {schedule.target_type === "all" ? "All Users" : schedule.target_type}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEditSchedule(schedule)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => deleteSchedule(schedule.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Statistics Tab */}
        <TabsContent value="statistics">
          <Card className="border-0 shadow-sm bg-card">
            <CardContent className="p-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Attendance Summary Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Today's Attendance Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Present</span>
                          <span>{stats.check_ins} / {stats.total_records}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${stats.present_percentage || 0}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Late</span>
                          <span>{stats.lates} / {stats.total_records}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-yellow-500 rounded-full transition-all"
                            style={{ width: `${stats.late_percentage || 0}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Absent</span>
                          <span>{stats.absents} / {stats.total_records}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-500 rounded-full transition-all"
                            style={{ width: `${stats.absent_percentage || 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Quick Stats Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Quick Stats</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Total Users</span>
                        <span className="font-bold text-lg">{users.length}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Active Schedules</span>
                        <span className="font-bold text-lg text-green-600">{activeSchedulesCount}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Attendance Rate</span>
                        <span className="font-bold text-lg text-primary">{stats.present_percentage || 0}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Dialogs - these remain the same as your original */}
      {/* Create/Edit Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingSchedule ? "Edit Attendance Schedule" : "Create Attendance Schedule"}
            </DialogTitle>
            <DialogDescription>
              Define when attendance should be tracked and for which users.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* ... rest of schedule form content (keep as original) ... */}
            <div className="space-y-1.5">
              <Label>Schedule Name *</Label>
              <Input placeholder="e.g., Morning Check-in, Office Hours" value={scheduleForm.name} onChange={e => setScheduleForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="Optional description" rows={2} value={scheduleForm.description} onChange={e => setScheduleForm(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Schedule Type</Label>
                <Select value={scheduleForm.type} onValueChange={v => setScheduleForm(prev => ({ ...prev, type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both Check In & Out</SelectItem>
                    <SelectItem value="check_in">Check In Only</SelectItem>
                    <SelectItem value="check_out">Check Out Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Active Status</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={scheduleForm.is_active} onCheckedChange={v => setScheduleForm(prev => ({ ...prev, is_active: v }))} />
                  <span className="text-sm text-foreground">{scheduleForm.is_active ? "Active" : "Inactive"}</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={scheduleForm.start_time} onChange={e => setScheduleForm(prev => ({ ...prev, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" value={scheduleForm.end_time} onChange={e => setScheduleForm(prev => ({ ...prev, end_time: e.target.value }))} />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Grace (min)</Label>
                <Input type="number" min="0" value={scheduleForm.grace_minutes} onChange={e => setScheduleForm(prev => ({ ...prev, grace_minutes: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Late (min)</Label>
                <Input type="number" min="0" value={scheduleForm.late_threshold_minutes} onChange={e => setScheduleForm(prev => ({ ...prev, late_threshold_minutes: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Early Leave (min)</Label>
                <Input type="number" min="0" value={scheduleForm.early_leave_threshold_minutes} onChange={e => setScheduleForm(prev => ({ ...prev, early_leave_threshold_minutes: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label>Days of Week *</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map(d => (
                  <button key={d} type="button" onClick={() => toggleDay(d)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${scheduleForm.days_of_week.includes(DAY_FULL[d]) ? "gradient-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Target Users Section */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Target Users</Label>
              
              <Select value={scheduleForm.target_type} onValueChange={(v: any) => {
                setScheduleForm(prev => ({ ...prev, target_type: v }));
                setTargetDepartments([]);
                setTargetPositions([]);
                setTargetSections([]);
                setTargetClasses([]);
                setPreviewUsers([]);
              }}>
                <SelectTrigger><SelectValue placeholder="Select who this schedule applies to" /></SelectTrigger>
                <SelectContent>
                  {targetOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              
              {/* Departments */}
              {scheduleForm.target_type === "departments" && departments.length > 0 && (
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {departments.map((dept) => (
                    <label key={dept.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={targetDepartments.includes(dept.id)} onChange={(e) => {
                        if (e.target.checked) setTargetDepartments([...targetDepartments, dept.id]);
                        else setTargetDepartments(targetDepartments.filter(id => id !== dept.id));
                      }} className="rounded border-gray-300" />
                      <span className="text-sm">{dept.name}</span>
                    </label>
                  ))}
                </div>
              )}
              
              {/* Positions */}
              {scheduleForm.target_type === "positions" && departments.length > 0 && (
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-3">
                  {departments.map((dept) => dept.positions && dept.positions.length > 0 && (
                    <div key={dept.id} className="space-y-1">
                      <div className="font-medium text-sm text-muted-foreground">{dept.name}</div>
                      {dept.positions.map((pos) => (
                        <label key={pos.id} className="flex items-center gap-2 cursor-pointer ml-4">
                          <input type="checkbox" checked={targetPositions.includes(pos.id)} onChange={(e) => {
                            if (e.target.checked) setTargetPositions([...targetPositions, pos.id]);
                            else setTargetPositions(targetPositions.filter(id => id !== pos.id));
                          }} className="rounded border-gray-300" />
                          <span className="text-sm">{pos.name}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Sections */}
              {scheduleForm.target_type === "sections" && sections.length > 0 && (
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {sections.map((section) => (
                    <label key={section.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={targetSections.includes(section.id)} onChange={(e) => {
                        if (e.target.checked) setTargetSections([...targetSections, section.id]);
                        else setTargetSections(targetSections.filter(id => id !== section.id));
                      }} className="rounded border-gray-300" />
                      <span className="text-sm">{section.name}</span>
                    </label>
                  ))}
                </div>
              )}
              
              {/* Classes */}
              {scheduleForm.target_type === "classes" && sections.length > 0 && (
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-3">
                  {sections.map((section) => section.classes && section.classes.length > 0 && (
                    <div key={section.id} className="space-y-1">
                      <div className="font-medium text-sm text-muted-foreground">{section.name}</div>
                      {section.classes.map((cls) => (
                        <label key={cls.id} className="flex items-center gap-2 cursor-pointer ml-4">
                          <input type="checkbox" checked={targetClasses.includes(cls.id)} onChange={(e) => {
                            if (e.target.checked) setTargetClasses([...targetClasses, cls.id]);
                            else setTargetClasses(targetClasses.filter(id => id !== cls.id));
                          }} className="rounded border-gray-300" />
                          <span className="text-sm">{cls.name}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Preview Button */}
              {scheduleForm.target_type !== "all" && (
                <Button type="button" variant="outline" size="sm" onClick={previewTargetUsers} className="w-full">
                  <Users className="h-3 w-3 mr-1" /> Preview Users ({previewUsers.length})
                </Button>
              )}
              
              {/* Preview List */}
              {previewUsers.length > 0 && (
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Preview ({previewUsers.length} users):</p>
                  <div className="space-y-1">
                    {previewUsers.slice(0, 10).map((user) => (
                      <div key={user.id} className="text-xs flex justify-between">
                        <span>{user.first_name} {user.last_name}</span>
                        <span className="text-muted-foreground capitalize">{user.role}</span>
                      </div>
                    ))}
                    {previewUsers.length > 10 && <p className="text-xs text-muted-foreground">+{previewUsers.length - 10} more...</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => { setShowScheduleDialog(false); resetScheduleForm(); }}>Cancel</Button>
            <Button className="gradient-primary text-white hover:gradient-primary/90" onClick={editingSchedule ? updateSchedule : createSchedule}>
              {editingSchedule ? "Update Schedule" : "Create Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Manual Attendance Dialog */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Manual Attendance</DialogTitle>
            <DialogDescription>Record attendance manually for a user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5 relative">
              <Label>User Name *</Label>
              <Input placeholder="Search or enter user name" value={manualUser} onChange={e => handleUserSearch(e.target.value)} onFocus={() => manualUser.length > 1 && setShowUserDropdown(true)} />
              {showUserDropdown && filteredUsers.length > 0 && (
                <div className="bg-muted absolute z-10 mt-1 w-full border rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredUsers.map(user => (
                    <div key={user.id} className="px-3 py-2 hover:bg-primary/20 cursor-pointer" onClick={() => selectUser(user)}>
                      <div className="font-medium">{user.first_name} {user.last_name}</div>
                      <div className="text-xs text-white/40">{user.email} • {user.role}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {manualUserId && userSchedules.length > 0 && (
              <div className="space-y-1.5">
                <Label>Schedule (Optional)</Label>
                <Select value={manualScheduleId?.toString() || "none"} onValueChange={(v) => setManualScheduleId(v === "none" ? null : parseInt(v))}>
                  <SelectTrigger><SelectValue placeholder="Select schedule" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None - Auto detect</SelectItem>
                    {userSchedules.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id.toString()}>
                        {schedule.name} ({schedule.start_time} - {schedule.end_time})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={manualStatus} onValueChange={v => setManualStatus(v as "check_in" | "check_out")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="check_in">Check In</SelectItem>
                  <SelectItem value="check_out">Check Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes..." rows={2} value={manualNote} onChange={e => setManualNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowManualDialog(false)}>Cancel</Button>
            <Button className="gradient-primary text-white hover:gradient-primary/90" onClick={submitManualAttendance}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Record Detail Modal */}
      <Dialog open={showRecordDetail} onOpenChange={setShowRecordDetail}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Attendance Details</DialogTitle>
            <DialogDescription>View detailed attendance information</DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedRecord.user_image} />
                  <AvatarFallback className="gradient-primary/20 text-primary text-xl">
                    {selectedRecord.user_name?.split(" ").map(n => n[0]).join("") || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{selectedRecord.user_name}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{selectedRecord.user_role || "User"}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Assignment</span>
                  <span className="font-medium">
                    {selectedRecord.department_name || selectedRecord.section_name || "—"}
                    {(selectedRecord.position_name || selectedRecord.class_name) && (
                      <span className="text-muted-foreground text-sm block">
                        {selectedRecord.position_name || selectedRecord.class_name}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={statusColor[selectedRecord.status]}>
                    {selectedRecord.status?.replace(/_/g, " ") || "—"}
                  </Badge>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Method</span>
                  <Badge variant="secondary" className="capitalize">
                    {selectedRecord.method?.replace("_", " ") || "—"}
                  </Badge>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Schedule</span>
                  <span>{selectedRecord.schedule_name || "No schedule"}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Date & Time</span>
                  <span>{selectedRecord.timestamp ? new Date(selectedRecord.timestamp).toLocaleString() : "—"}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Device</span>
                  <span>{selectedRecord.device || "—"}</span>
                </div>
                {selectedRecord.notes && (
                  <div className="py-2">
                    <span className="text-muted-foreground block mb-1">Notes</span>
                    <p className="text-sm bg-muted/30 p-2 rounded">{selectedRecord.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowRecordDetail(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceManagement;