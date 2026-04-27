// csms-frontend/src/pages/LiveDisplay.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw, Users, Clock, Calendar, CheckCircle, XCircle,
  AlertCircle, UserCheck, UserX, Activity, Wifi, WifiOff,
  Tv, Presentation, ScanLine, Fingerprint, Smartphone, 
  Camera, CreditCard, LogIn, LogOut, Eye, Lock, Share2,
  Copy, Check, Loader2, Building2, GraduationCap, Briefcase,
  Maximize2, Minimize2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { attendanceApi, liveViewApi } from "@/lib/api";
import { format, formatDistanceToNow, isToday } from "date-fns";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

interface LiveAttendanceRecord {
  id: number;
  user_id: number;
  user_name: string;
  user_image?: string;
  user_role?: string;
  department_name?: string;
  position_name?: string;
  section_name?: string;
  class_name?: string;
  method: "card" | "backup_code" | "fingerprint" | "manual" | "face_recognition";
  status: "check_in" | "check_out" | "present" | "absent" | "late" | "early_leave";
  timestamp: string;
  device: string;
  schedule_name?: string;
  is_late?: boolean;
  late_minutes?: number;
}

interface AttendanceStats {
  total_today: number;
  checked_in: number;
  checked_out: number;
  present: number;
  absent: number;
  late: number;
  early_leave: number;
  attendance_rate: number;
  on_time_rate: number;
}

interface RecentActivity {
  id: number;
  user_name: string;
  user_image?: string;
  action: "check_in" | "check_out";
  timestamp: string;
  method: string;
  device: string;
}

interface LiveSessionInfo {
  session_id: string;
  organization_id: string;
  organization_name: string;
  organization_type: string;
  created_by: string;
  created_by_name: string;
  expires_at: string;
  is_active: boolean;
}

// ============================================
// PUBLIC/SHAREABLE VIEW COMPONENT
// ============================================

interface PublicViewProps {
  sessionInfo: LiveSessionInfo;
  onClose?: () => void;
}

const PublicView = ({ sessionInfo, onClose }: PublicViewProps) => {
  const [recentCheckIns, setRecentCheckIns] = useState<LiveAttendanceRecord[]>([]);
  const [stats, setStats] = useState({ today_count: 0, check_ins: 0, currently_inside: 0 });
  const [loading, setLoading] = useState(true);
  const [expiresIn, setExpiresIn] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const orgTypeDisplay = sessionInfo.organization_type === "school" ? "School" : "Organization";
  const orgIcon = sessionInfo.organization_type === "school" ? 
    <GraduationCap className="h-5 w-5" /> : 
    <Building2 className="h-5 w-5" />;

  // Fetch public data via SSE for real-time updates
  const setupSSE = useCallback(() => {
    const sseUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/live/sessions/${sessionInfo.session_id}/stream`;
    
    try {
      const eventSource = new EventSource(sseUrl);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            console.log('SSE connected for session:', data.sessionId);
          } else if (data.type === 'new_attendance') {
            const newRecord: LiveAttendanceRecord = {
              id: data.id,
              user_id: data.user_id,
              user_name: data.user_name,
              user_role: data.role,
              user_image: data.image,
              method: data.method || 'card',
              status: data.status === 'check_in' ? 'check_in' : data.status === 'late' ? 'late' : 'check_out',
              timestamp: data.timestamp,
              device: data.device_name || 'Unknown',
              is_late: data.status === 'late'
            };
            
            setRecentCheckIns(prev => [newRecord, ...prev.slice(0, 49)]);
            setStats(prev => ({
              ...prev,
              today_count: prev.today_count + 1,
              check_ins: data.status === 'check_in' ? prev.check_ins + 1 : prev.check_ins,
              currently_inside: data.status === 'check_in' ? prev.currently_inside + 1 : Math.max(0, prev.currently_inside - 1)
            }));
          } else if (data.type === 'stats_update') {
            setStats(prev => ({
              ...prev,
              currently_inside: data.currently_inside ?? prev.currently_inside
            }));
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource.close();
        setTimeout(() => setupSSE(), 5000);
      };
      
      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error('Failed to setup SSE:', error);
    }
  }, [sessionInfo.session_id]);

  // Initial fetch
  const fetchInitialData = useCallback(async () => {
    try {
      const response = await liveViewApi.getPublicAttendance(sessionInfo.session_id);
      if (response.success && response.data) {
        setRecentCheckIns(response.data.recent || []);
        
        // Calculate currently inside
        const checkedInUsers = new Set<number>();
        const checkedOutUsers = new Set<number>();
        
        (response.data.recent || []).forEach((record: any) => {
          if (record.status === 'check_in' || record.status === 'present' || record.status === 'late') {
            checkedInUsers.add(record.user_id);
          } else if (record.status === 'check_out') {
            checkedOutUsers.add(record.user_id);
          }
        });
        
        const currentlyInside = checkedInUsers.size - checkedOutUsers.size;
        
        setStats({
          today_count: response.data.today_count || 0,
          check_ins: response.data.check_ins || 0,
          currently_inside: Math.max(0, currentlyInside)
        });
      }
    } catch (error) {
      console.error("Failed to fetch public data:", error);
    } finally {
      setLoading(false);
    }
  }, [sessionInfo.session_id]);

  useEffect(() => {
    fetchInitialData();
    setupSSE();
    
    const timer = setInterval(() => {
      const expires = new Date(sessionInfo.expires_at);
      const now = new Date();
      const diff = expires.getTime() - now.getTime();
      if (diff <= 0) {
        setExpiresIn("Expired");
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setExpiresIn(`${minutes}m ${seconds}s`);
      }
    }, 1000);
    
    return () => {
      clearInterval(timer);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [fetchInitialData, setupSSE, sessionInfo.expires_at]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header Bar */}
      <div className="bg-black/30 backdrop-blur-md border-b border-white/10 px-6 py-4 sticky top-0 z-20">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-xl">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Live Attendance View</h1>
              <p className="text-xs text-white/50">
                {sessionInfo.organization_name} • {orgTypeDisplay}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={sessionInfo.is_active ? "default" : "destructive"} className="gap-1">
              <span className={`relative flex h-2 w-2 mr-1 ${sessionInfo.is_active ? 'bg-green-400' : 'bg-red-400'} rounded-full animate-pulse`} />
              {sessionInfo.is_active ? "Live" : "Expires in " + expiresIn}
            </Badge>
            
            <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="text-white/70 hover:text-white">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="text-white/70 hover:text-white">
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-r from-primary/20 to-primary/5 border-primary/30 backdrop-blur-md">
            <CardContent className="p-6 text-center">
              <p className="text-white/50 text-sm">Total Records Today</p>
              <p className="text-3xl font-bold text-white">{stats.today_count}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-500/20 to-green-500/5 border-green-500/30 backdrop-blur-md">
            <CardContent className="p-6 text-center">
              <p className="text-white/50 text-sm">Check Ins</p>
              <p className="text-3xl font-bold text-green-400">{stats.check_ins}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-blue-500/20 to-blue-500/5 border-blue-500/30 backdrop-blur-md">
            <CardContent className="p-6 text-center">
              <p className="text-white/50 text-sm">Currently Inside</p>
              <p className="text-3xl font-bold text-blue-400">{stats.currently_inside}</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Card */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Activity
              <span className="text-xs text-green-400 animate-pulse ml-2">● LIVE</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentCheckIns.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-white/30 mb-3" />
                <p className="text-white/50">No recent check-ins</p>
                <p className="text-xs text-white/30 mt-1">Activity will appear here in real-time</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {recentCheckIns.map((record, idx) => (
                  <div key={`${record.id}-${idx}`} className="flex items-center gap-4 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
                    <Avatar className="h-12 w-12 ring-2 ring-primary/30">
                      <AvatarImage src={record.user_image} />
                      <AvatarFallback className="bg-primary/30 text-primary text-lg">
                        {record.user_name?.split(" ").map(n => n[0]).join("") || "U"}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <p className="font-semibold text-white">{record.user_name}</p>
                      <div className="flex items-center gap-2 text-xs">
                        {record.status === "check_in" ? (
                          <span className="text-green-400 flex items-center gap-1">
                            <LogIn className="h-3 w-3" /> Checked In
                          </span>
                        ) : record.status === "check_out" ? (
                          <span className="text-blue-400 flex items-center gap-1">
                            <LogOut className="h-3 w-3" /> Checked Out
                          </span>
                        ) : record.status === "late" ? (
                          <span className="text-yellow-400 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Late
                          </span>
                        ) : (
                          <span className="text-white/50">{record.status}</span>
                        )}
                        <span className="text-white/30">•</span>
                        <span className="text-white/40 capitalize">{record.method?.replace("_", " ")}</span>
                      </div>
                      <p className="text-xs text-white/40 mt-1">
                        {record.department_name || record.section_name || record.user_role || "Member"}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm text-white/60">{format(new Date(record.timestamp), "HH:mm:ss")}</p>
                      <p className="text-xs text-white/30">{formatDistanceToNow(new Date(record.timestamp), { addSuffix: true })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-xs text-white/30">
            Live attendance feed • Session expires {format(new Date(sessionInfo.expires_at), "HH:mm:ss")}
          </p>
          <p className="text-xs text-white/20 mt-1">Created by {sessionInfo.created_by_name}</p>
        </div>
      </div>
    </div>
  );
};

// ============================================
// AUTHENTICATED ADMIN VIEW COMPONENT
// ============================================

const AdminLiveView = () => {
  const { admin, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<LiveAttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({
    total_today: 0,
    checked_in: 0,
    checked_out: 0,
    present: 0,
    absent: 0,
    late: 0,
    early_leave: 0,
    attendance_rate: 0,
    on_time_rate: 0
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [displayMode, setDisplayMode] = useState<"board" | "list">("board");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // New check-in animation
  const [newCheckIn, setNewCheckIn] = useState<LiveAttendanceRecord | null>(null);

  // Check authentication
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated || !admin) {
        console.log('[AdminLiveView] Not authenticated, redirecting to login');
        const currentPath = window.location.pathname;
        navigate(`/login?redirect=${currentPath}`);
        return;
      } else {
        console.log('[AdminLiveView] Authenticated as:', admin.firstName, admin.organizationId);
      }
    }
  }, [isAuthenticated, admin, authLoading, navigate]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!admin?.organizationId) return;
    
    try {
      const recordsRes = await attendanceApi.getRecords({ 
        startDate: format(new Date(), "yyyy-MM-dd"),
        endDate: format(new Date(), "yyyy-MM-dd"),
        limit: 100
      });
      
      if (recordsRes.success && recordsRes.data) {
        const formattedRecords = recordsRes.data.map((record: any) => ({
          ...record,
          is_late: record.status === "late" || (record.status === "check_in" && record.late_minutes > 0),
          late_minutes: record.late_minutes || 0
        }));
        setRecords(formattedRecords);
        setRecentActivities(formattedRecords.slice(0, 20).map((r: any) => ({
          id: r.id,
          user_name: r.user_name,
          user_image: r.user_image,
          action: r.status === "check_in" || r.status === "present" || r.status === "late" ? "check_in" : "check_out",
          timestamp: r.timestamp,
          method: r.method,
          device: r.device
        })));
      }
      
      const statsRes = await attendanceApi.getTodayStats();
      if (statsRes.success && statsRes.data) {
        const total = statsRes.data.total_records || 1;
        setStats({
          total_today: statsRes.data.total_records || 0,
          checked_in: statsRes.data.check_ins || 0,
          checked_out: statsRes.data.check_outs || 0,
          present: statsRes.data.present || 0,
          absent: statsRes.data.absents || 0,
          late: statsRes.data.lates || 0,
          early_leave: statsRes.data.early_leaves || 0,
          attendance_rate: Math.round(((statsRes.data.check_ins || 0) / Math.max(total, 1)) * 100),
          on_time_rate: Math.round(((statsRes.data.check_ins - (statsRes.data.lates || 0)) / Math.max(total, 1)) * 100)
        });
      }
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch live data:", error);
      toast.error("Failed to load live attendance data");
    } finally {
      setLoading(false);
    }
  }, [admin?.organizationId]);

  // Polling for real-time updates (simpler than SSE for now)
  const setupPolling = useCallback(() => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        fetchData();
      }, 5000); // Poll every 5 seconds for real-time feel
    }
  }, [autoRefresh, fetchData]);

  useEffect(() => {
    if (admin?.organizationId) {
      fetchData();
      setupPolling();
    }
    
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [fetchData, setupPolling, admin?.organizationId]);

  const generateShareableLink = async () => {
    if (!admin?.organizationId) {
      toast.error("Organization ID not found");
      return;
    }

    setGeneratingLink(true);
    try {
      const response = await liveViewApi.createLiveSession(
        admin.organizationId.toString(),
        admin.id.toString(),
        60
      );
      
      if (response.success && response.data) {
        const link = response.data.shareable_link;
        await navigator.clipboard.writeText(link);
        setCopied(true);
        toast.success("Shareable link copied to clipboard!");
        setTimeout(() => setCopied(false), 3000);
      } else {
        toast.error(response.error || "Failed to generate shareable link");
      }
    } catch (error: any) {
      console.error("Error generating shareable link:", error);
      toast.error(error.message || "Failed to generate shareable link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "fingerprint": return <Fingerprint className="h-3 w-3" />;
      case "face_recognition": return <Camera className="h-3 w-3" />;
      case "card": return <CreditCard className="h-3 w-3" />;
      case "backup_code": return <Smartphone className="h-3 w-3" />;
      default: return <ScanLine className="h-3 w-3" />;
    }
  };

  const getStatusBadge = (status: string, isLate?: boolean) => {
    if (status === "check_in") {
      return isLate ? 
        <Badge className="bg-yellow-500/20 text-yellow-400 border-0">Late In</Badge> :
        <Badge className="bg-green-500/20 text-green-400 border-0">Checked In</Badge>;
    }
    if (status === "check_out") {
      return <Badge className="bg-blue-500/20 text-blue-400 border-0">Checked Out</Badge>;
    }
    if (status === "late") {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-0">Late</Badge>;
    }
    if (status === "absent") {
      return <Badge className="bg-red-500/20 text-red-400 border-0">Absent</Badge>;
    }
    return <Badge variant="secondary" className="bg-white/10 text-white/70">{status}</Badge>;
  };

  const activeUsers = records.filter(r => r.status === "check_in").length;
  const onTimeCount = records.filter(r => r.status === "check_in" && !r.is_late).length;

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className={`bg-black/30 backdrop-blur-md border-b border-white/10 ${isFullscreen ? 'py-2' : 'py-4'} px-6 sticky top-0 z-20`}>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-xl">
              <Presentation className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Live Attendance Display</h1>
              <p className="text-xs text-white/50">
                {admin?.organizationName || "Organization"} • Admin Dashboard
                {autoRefresh && <span className="ml-2 text-green-400 animate-pulse">● LIVE</span>}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={generateShareableLink}
              disabled={generatingLink}
              className="border-primary/50 text-primary hover:bg-primary/20"
            >
              {generatingLink ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : copied ? (
                <Check className="h-4 w-4 mr-1" />
              ) : (
                <Share2 className="h-4 w-4 mr-1" />
              )}
              {copied ? "Copied!" : "Share Live View"}
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setAutoRefresh(!autoRefresh)} 
              className="text-white/70 hover:text-white"
              title={autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            >
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin-slow' : ''}`} />
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleFullscreen} 
              className="text-white/70 hover:text-white"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            
            <Button variant="ghost" size="sm" onClick={fetchData} className="text-white/70 hover:text-white" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="p-6">
        {/* New Check-in Animation */}
        {newCheckIn && (
          <div className="fixed top-24 right-6 z-50 animate-slide-in-right">
            <Card className="bg-gradient-to-r from-green-500/20 to-green-600/20 border-green-500/50 backdrop-blur-md shadow-xl">
              <CardContent className="p-4 flex items-center gap-4">
                <Avatar className="h-12 w-12 ring-2 ring-green-400">
                  <AvatarImage src={newCheckIn.user_image} />
                  <AvatarFallback className="bg-green-500 text-white">
                    {newCheckIn.user_name?.split(" ").map(n => n[0]).join("") || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-white">{newCheckIn.user_name}</p>
                  <p className="text-sm text-green-300">
                    {newCheckIn.status === "check_in" ? "Checked In" : newCheckIn.status === "late" ? "Late Arrival" : "Checked Out"}
                  </p>
                  <p className="text-xs text-white/50">{format(new Date(newCheckIn.timestamp), "HH:mm:ss")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white/50 text-sm">Today's Total</p>
                  <p className="text-3xl font-bold text-white">{stats.total_today}</p>
                  <p className="text-xs text-white/30 mt-1">Attendance records</p>
                </div>
                <div className="bg-primary/20 p-3 rounded-full"><Users className="h-6 w-6 text-primary" /></div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white/50 text-sm">Currently Inside</p>
                  <p className="text-3xl font-bold text-green-400">{activeUsers}</p>
                  <p className="text-xs text-white/30 mt-1">Active on premises</p>
                </div>
                <div className="bg-green-500/20 p-3 rounded-full"><UserCheck className="h-6 w-6 text-green-400" /></div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white/50 text-sm">Attendance Rate</p>
                  <p className="text-3xl font-bold text-white">{stats.attendance_rate}%</p>
                  <div className="w-full bg-white/20 rounded-full h-1.5 mt-2">
                    <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${stats.attendance_rate}%` }} />
                  </div>
                </div>
                <div className="bg-blue-500/20 p-3 rounded-full"><Activity className="h-6 w-6 text-blue-400" /></div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white/50 text-sm">On-Time Rate</p>
                  <p className="text-3xl font-bold text-yellow-400">{stats.on_time_rate}%</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-green-400">✓ {onTimeCount}</span>
                    <span className="text-xs text-yellow-400">⚠ {stats.late}</span>
                  </div>
                </div>
                <div className="bg-yellow-500/20 p-3 rounded-full"><Clock className="h-6 w-6 text-yellow-400" /></div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* View Toggle */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            <Button 
              variant={displayMode === "board" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setDisplayMode("board")}
              className={displayMode === "board" ? "bg-primary/30 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"}
            >
              <Presentation className="h-4 w-4 mr-2" /> Board View
            </Button>
            <Button 
              variant={displayMode === "list" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setDisplayMode("list")}
              className={displayMode === "list" ? "bg-primary/30 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"}
            >
              <Users className="h-4 w-4 mr-2" /> List View
            </Button>
          </div>
          
          <div className="text-xs text-white/40">
            Last updated: {format(lastUpdated, "HH:mm:ss")}
          </div>
        </div>
        
        {/* Board View */}
        {displayMode === "board" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {records.slice(0, 30).map((record) => (
              <Card key={record.id} className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all cursor-pointer">
                <CardContent className="p-4 text-center">
                  <Avatar className="h-16 w-16 mx-auto mb-3 ring-2 ring-primary/50">
                    <AvatarImage src={record.user_image} />
                    <AvatarFallback className="bg-primary/30 text-primary text-xl">
                      {record.user_name?.split(" ").map(n => n[0]).join("") || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-semibold text-white text-sm truncate">{record.user_name}</p>
                  <p className="text-xs text-white/50 mb-2">{record.user_role || "User"}</p>
                  {getStatusBadge(record.status, record.is_late)}
                  <p className="text-xs text-white/40 mt-2">{format(new Date(record.timestamp), "HH:mm")}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* List View */
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
  <CardContent className="p-0 overflow-x-auto">
    <table className="w-full">
      <thead className="border-b border-white/10 bg-white/5">
        <tr className="text-left text-white/50 text-sm">
          <th className="p-4">User</th>
          <th className="p-4">Role</th>
          <th className="p-4">Department/Section</th>
          <th className="p-4">Status</th>
          <th className="p-4">Method</th>
          <th className="p-4">Time</th>
          <th className="p-4">Device</th>
        </tr>
      </thead>
      <tbody>
        {records.map((record) => (
          <tr key={record.id} className="border-b border-white/5 hover:bg-white/5 transition">
            <td className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={record.user_image} />
                  <AvatarFallback className="bg-primary/30 text-primary text-xs">
                    {record.user_name?.split(" ").map(n => n[0]).join("") || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-white font-medium">{record.user_name}</span>
              </div>
            </td>
            <td className="p-4 text-white/70 text-sm capitalize">{record.user_role || "—"}</td>
            <td className="p-4 text-white/50 text-sm">{record.department_name || record.section_name || "—"}</td>
            <td className="p-4">{getStatusBadge(record.status, record.is_late)}</td>
            <td className="p-4">
              <div className="flex items-center gap-1 text-white/50 text-sm">
                {getMethodIcon(record.method)}
                <span className="capitalize">{record.method?.replace("_", " ") || "—"}</span>
              </div>
            </td>
            <td className="p-4 text-white/70 text-sm">{format(new Date(record.timestamp), "HH:mm:ss")}</td>
            <td className="p-4 text-white/50 text-sm">{record.device || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </CardContent>
</Card>
        )}
      </div>
      
      {/* Footer */}
      <div className="fixed bottom-4 left-0 right-0 text-center pointer-events-none">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-xs text-white/50 pointer-events-auto">
          {autoRefresh && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Live feed active
            </>
          )}
          <span>•</span>
          <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
          <span>•</span>
          <span>{format(new Date(), "HH:mm:ss")}</span>
        </div>
      </div>
      
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
        .animate-spin-slow { animation: spin 3s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

// ============================================
// MAIN COMPONENT - Routes based on URL params
// ============================================

const LiveDisplay = () => {
  const { sessionId, slug } = useParams();
  const { admin, isAuthenticated, isLoading: authLoading } = useAuth();
  const [sessionInfo, setSessionInfo] = useState<LiveSessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Determine route type
  // URL pattern: /live/s/{sessionId} - public shareable (starts with 's/')
  // URL pattern: /live/{slug} - admin view (any other string)
  const isPublicSession = sessionId !== undefined;
  const isAdminSession = slug !== undefined && slug !== 's';

  console.log('[LiveDisplay] Route detection:', { sessionId, slug, isPublicSession, isAdminSession, isAuthenticated });

  useEffect(() => {
    const validateSession = async () => {
      if (isPublicSession && sessionId) {
        // Validate public session
        try {
          const response = await liveViewApi.validateSession(sessionId);
          if (response.success && response.data) {
            setSessionInfo(response.data);
          } else {
            setError(response.error || "Invalid or expired session");
          }
        } catch (err) {
          console.error("Session validation error:", err);
          setError("Failed to validate session");
        } finally {
          setLoading(false);
        }
      } else if (isAdminSession && slug) {
        // Admin view - requires authentication
        if (!authLoading) {
          if (!isAuthenticated || !admin) {
            console.log('[LiveDisplay] Admin view - not authenticated, redirecting to login');
            navigate(`/login?redirect=/live/${slug}`);
            return;
          }
          console.log('[LiveDisplay] Admin view - authenticated, showing dashboard');
          setLoading(false);
        }
      } else {
        setError("Invalid URL format");
        setLoading(false);
      }
    };

    validateSession();
  }, [sessionId, slug, isAuthenticated, admin, authLoading, navigate, isPublicSession, isAdminSession]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-white/10 backdrop-blur-md border-white/20 max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Session Error</h2>
            <p className="text-white/70 mb-6">{error}</p>
            <Button onClick={() => navigate("/")} className="bg-primary">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render appropriate view
  if (isPublicSession && sessionInfo) {
    return <PublicView sessionInfo={sessionInfo} onClose={() => window.close()} />;
  }

  if (isAdminSession && isAuthenticated && admin) {
    return <AdminLiveView />;
  }

  return null;
};

export default LiveDisplay;