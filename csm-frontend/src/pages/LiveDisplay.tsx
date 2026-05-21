// csms-frontend/src/pages/LiveDisplay.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, Users, Clock, Activity, UserCheck, AlertCircle,
  Eye, Maximize2, Minimize2, Share2, Loader2, LogIn, LogOut,
  CheckCircle, XCircle, CreditCard, Fingerprint, Camera, ScanLine,
  Building2, GraduationCap, Wifi, WifiOff, Tv, Presentation, Calendar
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { attendanceApi, liveViewApi } from "@/lib/api";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const API_BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

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
  method: string;
  status: string;
  timestamp: string;
  late_minutes?: number;
  device?: string;
}

interface LiveSessionInfo {
  session_id: string;
  organization_id: string;
  organization_name: string;
  organization_type: string;
  created_by_name: string;
  expires_at: string;
  is_active: boolean;
}

// ============================================
// PUBLIC VIEW - FIXED
// ============================================

const PublicView = ({ sessionInfo }: { sessionInfo: LiveSessionInfo }) => {
  const [currentRecord, setCurrentRecord] = useState<LiveAttendanceRecord | null>(null);
  const [recentRecords, setRecentRecords] = useState<LiveAttendanceRecord[]>([]);
  const [stats, setStats] = useState({ today_count: 0, check_ins: 0, currently_inside: 0 });
  const [loading, setLoading] = useState(true);
  const [showTapMessage, setShowTapMessage] = useState(true);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "late" | "info">("info");
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [expiresIn, setExpiresIn] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await liveViewApi.getPublicAttendance(sessionInfo.session_id);
      if (response.success && response.data) {
        const records = response.data.recent || [];
        setRecentRecords(records);
        setStats({
          today_count: response.data.today_count || 0,
          check_ins: response.data.check_ins || 0,
          currently_inside: response.data.currently_inside || 0
        });
        
        if (records.length > 0 && showTapMessage) {
          showNewAttendance(records[0]);
        }
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [sessionInfo.session_id]);








const showNewAttendance = (record: LiveAttendanceRecord) => {
  if (hideTimeoutRef.current) {
    clearTimeout(hideTimeoutRef.current);
  }
  
  setCurrentRecord(record);
  setShowTapMessage(false);
  setLastUpdated(new Date());
  
  if (record.status === 'late') {
    setMessage(`Late by ${record.late_minutes || 5} minutes`);
    setMessageType("late");
  } else if (record.status === 'check_in') {
    setMessage("Checked In Successfully");
    setMessageType("success");
  } else if (record.status === 'check_out') {
    setMessage("Checked Out Successfully");
    setMessageType("info");
  }
  
  // CHANGE THIS: 3 minutes = 180000 milliseconds
  hideTimeoutRef.current = setTimeout(() => {
    setShowTapMessage(true);
    setCurrentRecord(null);
  }, 10000); // Changed from 4000 to 180000
};

  const setupSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    // CORRECT SSE URL - using /api prefix
    const sseUrl = `${API_BACKEND_URL}/live/sessions/${sessionInfo.session_id}/stream`;
    console.log("[SSE] Connecting to:", sseUrl);
    
    try {
      const eventSource = new EventSource(sseUrl);
      
      eventSource.onopen = () => {
        console.log("[SSE] Connected");
        setConnected(true);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            console.log("[SSE] Session connected");
          } else if (data.type === 'init_stats') {
            setStats({
              today_count: data.today_count || 0,
              check_ins: data.check_ins || 0,
              currently_inside: data.currently_inside || 0
            });
          } else if (data.type === 'new_attendance') {
            const newRecord: LiveAttendanceRecord = {
              id: data.id,
              user_id: data.user_id,
              user_name: data.user_name,
              user_role: data.user_role,
              user_image: data.user_image,
              department_name: data.department_name,
              section_name: data.section_name,
              position_name: data.position_name,
              class_name: data.class_name,
              status: data.status,
              timestamp: data.timestamp,
              method: data.method || 'card',
              late_minutes: data.late_minutes
            };
            
            setRecentRecords(prev => [newRecord, ...prev.slice(0, 9)]);
            setStats(prev => ({ 
              ...prev, 
              today_count: prev.today_count + 1,
              check_ins: data.status === 'check_in' || data.status === 'late' ? prev.check_ins + 1 : prev.check_ins,
              currently_inside: data.status === 'check_in' || data.status === 'late' 
                ? prev.currently_inside + 1 
                : data.status === 'check_out' 
                  ? Math.max(0, prev.currently_inside - 1)
                  : prev.currently_inside
            }));
            
            showNewAttendance(newRecord);
          } else if (data.type === 'stats_update') {
            setStats(prev => ({
              ...prev,
              today_count: data.today_count ?? prev.today_count,
              check_ins: data.check_ins ?? prev.check_ins,
              currently_inside: data.currently_inside ?? prev.currently_inside
            }));
          }
        } catch (err) {
          console.error("[SSE] Parse error:", err);
        }
      };
      
      eventSource.onerror = () => {
        console.error("[SSE] Connection error");
        setConnected(false);
        eventSource.close();
        
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("[SSE] Attempting to reconnect...");
          setupSSE();
        }, 5000);
      };
      
      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error("[SSE] Setup error:", error);
      setConnected(false);
    }
  }, [sessionInfo.session_id]);

  // Countdown timer for expiry
  useEffect(() => {
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
    
    return () => clearInterval(timer);
  }, [sessionInfo.expires_at]);

  useEffect(() => {
    fetchData();
    setupSSE();
    
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [fetchData, setupSSE]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "U";
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return "";
    try {
      return format(new Date(timestamp), "h:mm a");
    } catch {
      return "";
    }
  };

  const getAssignment = (record: LiveAttendanceRecord) => {
    if (record.department_name) return record.department_name;
    if (record.section_name) return record.section_name;
    if (record.position_name) return record.position_name;
    if (record.class_name) return record.class_name;
    return record.user_role || "Member";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white/80 dark:bg-black/30 backdrop-blur-md border-b border-border sticky top-0 z-20 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold gradient-text">{sessionInfo.organization_name}</h1>
            <p className="text-xs text-muted-foreground">Live Attendance System</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
              connected 
                ? "bg-success/10 text-success" 
                : "bg-destructive/10 text-destructive"
            }`}>
              <div className={`h-2 w-2 rounded-full ${connected ? "bg-success animate-pulse" : "bg-destructive"}`} />
              <span className="font-medium">{connected ? "LIVE" : "Reconnecting..."}</span>
            </div>
            <Badge variant="outline" className="text-muted-foreground">
              <Calendar className="h-3 w-3 mr-1" />
              {format(new Date(), "MMM d, yyyy")}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              Expires: {expiresIn}
            </Badge>
            <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="text-muted-foreground">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-4xl px-4 py-8">
        
        {/* Stats Cards */}
       {/* <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-xl border-border border p-4 text-center">
            <Users className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.today_count}</p>
            <p className="text-xs text-muted-foreground">Total Records</p>
          </div>
          <div className="bg-card rounded-xl border-border border p-4 text-center">
            <UserCheck className="h-6 w-6 text-success mx-auto mb-2" />
            <p className="text-2xl font-bold text-success">{stats.check_ins}</p>
            <p className="text-xs text-muted-foreground">Check Ins</p>
          </div>
          <div className="bg-card rounded-xl border-border border p-4 text-center">
            <Activity className="h-6 w-6 text-info mx-auto mb-2" />
            <p className="text-2xl font-bold text-info">{stats.currently_inside}</p>
            <p className="text-xs text-muted-foreground">Inside</p>
          </div>
        </div>*/}

        {/* Main Display Card */}
        <div className="w-full max-w-lg mx-auto">
          {showTapMessage ? (
            <div className="bg-card rounded-2xl border-border border p-12 text-center shadow-lg">
              <div className="flex flex-col items-center gap-6">
                <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <CreditCard className="h-14 w-14 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Hey! Tap Your Card...</h2>
                  <p className="text-sm text-muted-foreground mt-2">Please tap your RFID card on the reader</p>
                </div>
                <div className="flex gap-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            currentRecord && (
              <div className={`rounded-2xl border p-8 text-center shadow-lg transition-all duration-300 animate-in fade-in zoom-in ${
                messageType === "success" ? "bg-success/10 border-success/30" :
                messageType === "late" ? "bg-warning/10 border-warning/30" :
                "bg-info/10 border-info/30"
              }`}>
                <div className={`w-28 h-28 rounded-full mx-auto mb-5 flex items-center justify-center ${
                  messageType === "success" ? "bg-success/20" :
                  messageType === "late" ? "bg-warning/20" :
                  "bg-info/20"
                }`}>
                  {currentRecord.user_image ? (
                    <img src={currentRecord.user_image} alt="" className="w-24 h-24 rounded-full object-cover" />
                  ) : (
                    <span className="text-4xl font-bold text-foreground">
                      {getInitials(currentRecord.user_name)}
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-bold text-foreground mb-1">{currentRecord.user_name}</h2>
                <p className="text-sm text-muted-foreground mb-4">{getAssignment(currentRecord)}</p>
                
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-5 ${
                  messageType === "success" ? "bg-success/20 text-success" :
                  messageType === "late" ? "bg-warning/20 text-warning" :
                  "bg-info/20 text-info"
                }`}>
                  {messageType === "success" && <CheckCircle className="h-4 w-4" />}
                  {messageType === "late" && <AlertCircle className="h-4 w-4" />}
                  {messageType === "info" && <LogOut className="h-4 w-4" />}
                  <span className="text-sm font-medium">{message}</span>
                </div>

                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-xl font-mono">{formatTime(currentRecord.timestamp)}</span>
                </div>
              </div>
            )
          )}
        </div>

        {/* Recent Activity */}
        {recentRecords.length > 0 && !showTapMessage && (
          <div className="mt-8 max-w-lg mx-auto">
            <div className="bg-card rounded-xl border-border border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-3 w-3" />
                  Recent Activity
                </p>
              </div>
              <div className="divide-y divide-border max-h-64 overflow-y-auto custom-scrollbar">
                {recentRecords.slice(0, 5).map((record, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(record.user_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{record.user_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{getAssignment(record)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-muted-foreground">{formatTime(record.timestamp)}</p>
                      <Badge variant="outline" className={`text-[10px] mt-1 ${
                        record.status === "check_in" ? "text-success border-success/30" : "text-info border-info/30"
                      }`}>
                        {record.status === "check_in" ? "IN" : "OUT"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="text-center mt-8">
          <p className="text-[10px] text-muted-foreground">
            {connected ? "● Live feed active" : "○ Connecting to live feed..."}
          </p>
          <p className="text-[9px] text-muted-foreground/50 mt-1">
            Last updated: {format(lastUpdated, "h:mm:ss a")}
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================
// ADMIN VIEW
// ============================================

const AdminLiveView = () => {
  const { admin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<LiveAttendanceRecord[]>([]);
  const [stats, setStats] = useState({ total_today: 0, checked_in: 0, late: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !admin) {
      navigate('/login?redirect=/live');
      return;
    }
    fetchData();
    
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(fetchData, 10000);
    }
    
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [admin, isAuthenticated, navigate, autoRefresh]);

  const fetchData = async () => {
    if (!admin?.organizationId) return;
    try {
      const [recordsRes, statsRes] = await Promise.all([
        attendanceApi.getRecords({ limit: 50 }),
        attendanceApi.getTodayStats()
      ]);
      
      if (recordsRes.success) setRecords(recordsRes.data || []);
      // if (statsRes.success && statsRes.data) {
      //   setStats({
      //     total_today: statsRes.data.total_records || 0,
      //     checked_in: statsRes.data.check_ins || 0,
      //     late: statsRes.data.lates || 0
      //   });
      // }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateLink = async () => {
    if (!admin?.organizationId) return;
    setGenerating(true);
    try {
      const response = await liveViewApi.createLiveSession(
        admin.organizationId.toString(),
        admin.id.toString(),
        60
      );
      if (response.success && response.data) {
        const link = response.data.shareable_link;
        setShareLink(link);
        await navigator.clipboard.writeText(link);
        setCopied(true);
        toast.success("Shareable link copied!");
        setTimeout(() => setCopied(false), 3000);
      } else {
        toast.error(response.error || "Failed to generate link");
      }
    } catch (error) {
      toast.error("Failed to generate link");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border sticky top-0 z-20 py-4 px-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
              <Presentation className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Live Attendance Display</h1>
              <p className="text-xs text-muted-foreground">{admin?.organizationName} • Admin Dashboard</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? "border-success text-success" : ""}
            >
              <Activity className={`h-4 w-4 mr-1 ${autoRefresh ? "text-success" : ""}`} />
              {autoRefresh ? "Auto" : "Manual"}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={generateLink}
              disabled={generating}
              className="border-primary text-primary hover:bg-primary/10"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> :
               copied ? <CheckCircle className="h-4 w-4 mr-1" /> :
               <Share2 className="h-4 w-4 mr-1" />}
              {copied ? "Copied!" : "Share"}
            </Button>
            {/*<Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>*/}
          </div>
        </div>
        
        {shareLink && (
          <div className="mt-3 p-2 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Shareable link:</p>
            <code className="text-xs text-primary break-all">{shareLink}</code>
          </div>
        )}
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-xl border-border border p-5">
            <div className="flex justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Total</p>
                <p className="text-3xl font-bold text-foreground">{stats.total_today}</p>
              </div>
              <div className="bg-primary/10 p-3 rounded-full"><Users className="h-6 w-6 text-primary" /></div>
            </div>
          </div>
          <div className="bg-card rounded-xl border-border border p-5">
            <div className="flex justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Checked In</p>
                <p className="text-3xl font-bold text-success">{stats.checked_in}</p>
              </div>
              <div className="bg-success/10 p-3 rounded-full"><UserCheck className="h-6 w-6 text-success" /></div>
            </div>
          </div>
          <div className="bg-card rounded-xl border-border border p-5">
            <div className="flex justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Late Arrivals</p>
                <p className="text-3xl font-bold text-warning">{stats.late}</p>
              </div>
              <div className="bg-warning/10 p-3 rounded-full"><Clock className="h-6 w-6 text-warning" /></div>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-xl border-border border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="font-semibold text-foreground">Recent Records</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/20">
                <tr className="text-left text-muted-foreground text-sm">
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Time</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-t border-border hover:bg-muted/10">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(record.user_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-foreground">{record.user_name}</span>
                      </div>
                    </td>
                    <td className="text-muted-foreground text-sm capitalize">{record.user_role || "—"}</td>
                    <td>
                      <Badge className={record.status === "check_in" ? "bg-success/20 text-success" : "bg-info/20 text-info"}>
                        {record.status === "check_in" ? "IN" : "OUT"}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground text-sm capitalize">{record.method || "card"}</td>
                    <td className="text-muted-foreground font-mono text-sm">{format(new Date(record.timestamp), "h:mm a")}</td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted-foreground py-8">No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function for initials
function getInitials(name: string): string {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "U";
}

// ============================================
// MAIN COMPONENT
// ============================================

// ============================================
// MAIN COMPONENT - COMPLETELY FIXED
// ============================================

const LiveDisplay = () => {
  const { admin, isAuthenticated } = useAuth();
  const [sessionInfo, setSessionInfo] = useState<LiveSessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const pathname = window.location.pathname;

  // Get the base API URL without any trailing slashes
  const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
  // Remove trailing /api if present for the base URL
  const BASE_URL = BACKEND_URL.replace(/\/api$/, '');

  useEffect(() => {
    const init = async () => {
      console.log("[LiveDisplay] Path:", pathname);
      console.log("[LiveDisplay] Authenticated:", isAuthenticated);
      console.log("[LiveDisplay] Admin exists:", !!admin);
      console.log("[LiveDisplay] BASE_URL:", BASE_URL);
      
      // CASE 1: Public shareable link: /live/s/xxxxx
      if (pathname.match(/^\/live\/s\/[a-f0-9]{32}$/)) {
        const token = pathname.replace('/live/s/', '');
        console.log("[LiveDisplay] Public session token:", token);
        
        try {
          const response = await liveViewApi.validateSession(token);
          if (response.success && response.data) {
            setSessionInfo(response.data);
          } else {
            setError(response.error || "Session not found or expired");
          }
        } catch (err) {
          setError("Failed to validate session");
        } finally {
          setLoading(false);
        }
        return;
      }
      
      // CASE 2: Admin dashboard: /live or /live/
      if (pathname === '/live' || pathname === '/live/') {
        if (!isAuthenticated || !admin) {
          console.log("[LiveDisplay] Not authenticated, redirecting to login");
          navigate('/login?redirect=/live');
          return;
        }
        console.log("[LiveDisplay] Showing admin dashboard");
        setLoading(false);
        return;
      }
      
      // CASE 3: Organization slug: /live/tieflabs
      if (pathname.startsWith('/live/') && !pathname.startsWith('/live/s/') && pathname !== '/live' && pathname !== '/live/') {
        const slug = pathname.replace('/live/', '');
        
        if (slug && slug.length > 0) {
          console.log("[LiveDisplay] Organization slug detected:", slug);
          
          // 🔥 CRITICAL: If user is logged in, show ADMIN VIEW - NO API CALL
          if (isAuthenticated && admin) {
            console.log("[LiveDisplay] ✅ User is logged in - showing ADMIN DASHBOARD directly (NO API call)");
            setLoading(false);
            return;
          }
          
          // Not logged in - redirect to public view
          console.log("[LiveDisplay] ❌ User not logged in - fetching public view for slug:", slug);
          try {
            // Use the correct API URL - BASE_URL + /api/live/by-slug
            const apiUrl = `${BASE_URL}/api/live/by-slug/${encodeURIComponent(slug)}`;
            console.log("[LiveDisplay] Fetching from:", apiUrl);
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            if (data.success && data.data?.view_url) {
              console.log("[LiveDisplay] Redirecting to public view:", data.data.view_url);
              window.location.href = data.data.view_url;
              return;
            } else {
              setError(data.error || "Organization not found");
            }
          } catch (err) {
            console.error("[LiveDisplay] Slug error:", err);
            setError("Failed to load organization");
          } finally {
            setLoading(false);
          }
          return;
        }
      }
      
      setError("Invalid live view URL");
      setLoading(false);
    };

    init();
  }, [pathname, isAuthenticated, admin, navigate, BASE_URL]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Error</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate("/")} className="bg-primary">Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessionInfo) {
    return <PublicView sessionInfo={sessionInfo} />;
  }

  return <AdminLiveView />;
};
export default LiveDisplay;