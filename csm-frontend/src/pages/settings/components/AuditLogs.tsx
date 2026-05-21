// csms-frontend/src/pages/settings/components/AuditLogs.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  History,
  Download,
  Filter,
  Search,
  User,
  Building2,
  Shield,
  Settings,
  UserPlus,
  UserMinus,
  LogIn,
  LogOut,
  Edit,
  Trash2,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle,
  Clock,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Smartphone,
  FileText,
  Activity,
  Eye,
  Lock,
  Unlock,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Globe,
  Link2,
  Unlink,
  Fingerprint,
  Wifi,
  Bell,
  Database,
  Server,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { SettingsTabProps } from "../types";
import { toast } from "sonner";

// Action type icons and colors
const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string; bgClass: string }> = {
  // Authentication actions
  login: { icon: <LogIn className="h-4 w-4" />, color: "text-green-500", label: "Login", bgClass: "bg-green-500/10" },
  logout: { icon: <LogOut className="h-4 w-4" />, color: "text-gray-500", label: "Logout", bgClass: "bg-gray-500/10" },
  login_failed: { icon: <AlertCircle className="h-4 w-4" />, color: "text-red-500", label: "Login Failed", bgClass: "bg-red-500/10" },
  
  // Profile actions
  profile_update: { icon: <User className="h-4 w-4" />, color: "text-blue-500", label: "Profile Update", bgClass: "bg-blue-500/10" },
  password_change: { icon: <Lock className="h-4 w-4" />, color: "text-amber-500", label: "Password Changed", bgClass: "bg-amber-500/10" },
  avatar_upload: { icon: <Eye className="h-4 w-4" />, color: "text-purple-500", label: "Avatar Updated", bgClass: "bg-purple-500/10" },
  
  // Organization actions
  org_update: { icon: <Building2 className="h-4 w-4" />, color: "text-indigo-500", label: "Organization Updated", bgClass: "bg-indigo-500/10" },
  org_logo_upload: { icon: <Building2 className="h-4 w-4" />, color: "text-indigo-500", label: "Logo Updated", bgClass: "bg-indigo-500/10" },
  
  // Admin management
  admin_added: { icon: <UserPlus className="h-4 w-4" />, color: "text-green-500", label: "Admin Added", bgClass: "bg-green-500/10" },
  admin_removed: { icon: <UserMinus className="h-4 w-4" />, color: "text-red-500", label: "Admin Removed", bgClass: "bg-red-500/10" },
  admin_role_change: { icon: <Shield className="h-4 w-4" />, color: "text-amber-500", label: "Role Changed", bgClass: "bg-amber-500/10" },
  admin_status_change: { icon: <Activity className="h-4 w-4" />, color: "text-amber-500", label: "Status Changed", bgClass: "bg-amber-500/10" },
  
  // User management
  user_added: { icon: <UserPlus className="h-4 w-4" />, color: "text-green-500", label: "User Added", bgClass: "bg-green-500/10" },
  user_updated: { icon: <Edit className="h-4 w-4" />, color: "text-blue-500", label: "User Updated", bgClass: "bg-blue-500/10" },
  user_deleted: { icon: <Trash2 className="h-4 w-4" />, color: "text-red-500", label: "User Deleted", bgClass: "bg-red-500/10" },
  user_activated: { icon: <CheckCircle className="h-4 w-4" />, color: "text-green-500", label: "User Activated", bgClass: "bg-green-500/10" },
  user_deactivated: { icon: <X className="h-4 w-4" />, color: "text-red-500", label: "User Deactivated", bgClass: "bg-red-500/10" },
  
  // Device management
  device_added: { icon: <Smartphone className="h-4 w-4" />, color: "text-green-500", label: "Device Added", bgClass: "bg-green-500/10" },
  device_updated: { icon: <Edit className="h-4 w-4" />, color: "text-blue-500", label: "Device Updated", bgClass: "bg-blue-500/10" },
  device_deleted: { icon: <Trash2 className="h-4 w-4" />, color: "text-red-500", label: "Device Deleted", bgClass: "bg-red-500/10" },
  device_status_change: { icon: <Activity className="h-4 w-4" />, color: "text-amber-500", label: "Device Status Changed", bgClass: "bg-amber-500/10" },
  device_wifi_update: { icon: <Wifi className="h-4 w-4" />, color: "text-cyan-500", label: "WiFi Updated", bgClass: "bg-cyan-500/10" },
  
  // Attendance actions
  attendance_recorded: { icon: <CheckCircle className="h-4 w-4" />, color: "text-green-500", label: "Attendance Recorded", bgClass: "bg-green-500/10" },
  attendance_modified: { icon: <Edit className="h-4 w-4" />, color: "text-amber-500", label: "Attendance Modified", bgClass: "bg-amber-500/10" },
  
  // Subscription/Billing
  subscription_upgraded: { icon: <CreditCard className="h-4 w-4" />, color: "text-green-500", label: "Plan Upgraded", bgClass: "bg-green-500/10" },
  subscription_cancelled: { icon: <CreditCard className="h-4 w-4" />, color: "text-red-500", label: "Plan Cancelled", bgClass: "bg-red-500/10" },
  payment_made: { icon: <CreditCard className="h-4 w-4" />, color: "text-green-500", label: "Payment Made", bgClass: "bg-green-500/10" },
  
  // Settings
  settings_change: { icon: <Settings className="h-4 w-4" />, color: "text-purple-500", label: "Settings Changed", bgClass: "bg-purple-500/10" },
  theme_change: { icon: <Eye className="h-4 w-4" />, color: "text-purple-500", label: "Theme Changed", bgClass: "bg-purple-500/10" },
  notification_preference: { icon: <Bell className="h-4 w-4" />, color: "text-amber-500", label: "Notification Settings", bgClass: "bg-amber-500/10" },
  
  // Google Auth
  google_connect: { icon: <Mail className="h-4 w-4" />, color: "text-blue-500", label: "Google Connected", bgClass: "bg-blue-500/10" },
  google_disconnect: { icon: <Mail className="h-4 w-4" />, color: "text-red-500", label: "Google Disconnected", bgClass: "bg-red-500/10" },
  
  // Default
  default: { icon: <Activity className="h-4 w-4" />, color: "text-gray-500", label: "Action", bgClass: "bg-gray-500/10" },
};

// Entity type icons
const ENTITY_ICONS: Record<string, React.ReactNode> = {
  admin: <Shield className="h-3 w-3" />,
  user: <User className="h-3 w-3" />,
  organization: <Building2 className="h-3 w-3" />,
  device: <Smartphone className="h-3 w-3" />,
  attendance: <Clock className="h-3 w-3" />,
  subscription: <CreditCard className="h-3 w-3" />,
  settings: <Settings className="h-3 w-3" />,
  profile: <User className="h-3 w-3" />,
  wifi: <Wifi className="h-3 w-3" />,
  notification: <Bell className="h-3 w-3" />,
};

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  admin_id: string;
  admin_name: string;
  admin_email: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

interface FilterOptions {
  search: string;
  action: string;
  entity_type: string;
  // date_from: string;
  // date_to: string;
  admin_id: string;
}

const AuditLogs = ({ admin, onToast }: SettingsTabProps) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    search: "",
    action: "all",
    entity_type: "all",
    // date_from: "",
    // date_to: "",
    admin_id: "all",
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  
  // Available actions and entities for filtering
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableEntities, setAvailableEntities] = useState<string[]>([]);
  const [availableAdmins, setAvailableAdmins] = useState<{ id: string; name: string }[]>([]);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    uniqueAdmins: 0,
    activeDays: 0,
    createdActions: 0,
    deletedActions: 0,
    updatedActions: 0,
  });

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, filters, currentPage, itemsPerPage]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      // Try to get from localStorage first (mock data)
      const savedLogs = localStorage.getItem("audit_logs_detailed");
      
      if (savedLogs) {
        const parsed = JSON.parse(savedLogs);
        setLogs(parsed);
        calculateStats(parsed);
        
        // Extract filter options
        const actions = [...new Set(parsed.map((log: AuditLog) => log.action))];
        const entities = [...new Set(parsed.map((log: AuditLog) => log.entity_type))];
        const admins = [...new Map(parsed.map((log: AuditLog) => [log.admin_id, { id: log.admin_id, name: log.admin_name }])).values()];
        
        setAvailableActions(actions);
        setAvailableEntities(entities);
        setAvailableAdmins(admins);
      } else {
        generateMockLogs();
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      generateMockLogs();
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (logsData: AuditLog[]) => {
    const uniqueAdmins = new Set(logsData.map(l => l.admin_id)).size;
    const activeDays = new Set(logsData.map(l => new Date(l.created_at).toLocaleDateString())).size;
    const createdActions = logsData.filter(l => l.action.includes('add') || l.action.includes('create') || l.action.includes('added')).length;
    const deletedActions = logsData.filter(l => l.action.includes('delete') || l.action.includes('remove') || l.action.includes('deleted')).length;
    const updatedActions = logsData.filter(l => l.action.includes('update') || l.action.includes('edit') || l.action.includes('change')).length;
    
    setStats({
      total: logsData.length,
      uniqueAdmins,
      activeDays,
      createdActions,
      deletedActions,
      updatedActions,
    });
  };

  const generateMockLogs = () => {
    const mockLogs: AuditLog[] = [];
    const actions = Object.keys(ACTION_CONFIG);
    const entityTypes = ["admin", "user", "organization", "device", "attendance", "subscription", "settings", "wifi", "notification"];
    const adminNames = [admin?.firstName + " " + admin?.lastName || "John Doe", "Jane Smith", "Mike Johnson", "Sarah Williams"];
    const adminEmails = [admin?.email || "admin@example.com", "jane@example.com", "mike@example.com", "sarah@example.com"];
    const adminIds = ["admin_1", "admin_2", "admin_3", "admin_4"];
    
    const ipAddresses = ["192.168.1.100", "10.0.0.25", "172.16.0.50", "192.168.1.200", "10.0.0.10"];
    const userAgents = [
      "Chrome 120.0 on Windows 11",
      "Firefox 121.0 on macOS 14",
      "Safari 17.1 on iPhone iOS 17",
      "Edge 120.0 on Windows 11",
      "Chrome 120.0 on Android 14",
    ];
    
    for (let i = 0; i < 150; i++) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      const entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)];
      const adminIndex = Math.floor(Math.random() * adminNames.length);
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 60));
      date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
      
      const details = generateMockDetails(action, entityType);
      
      mockLogs.push({
        id: `log_${i}`,
        action: action,
        entity_type: entityType,
        entity_id: `entity_${Math.floor(Math.random() * 100)}`,
        admin_id: adminIds[adminIndex],
        admin_name: adminNames[adminIndex],
        admin_email: adminEmails[adminIndex],
        old_values: details.oldValues,
        new_values: details.newValues,
        ip_address: ipAddresses[Math.floor(Math.random() * ipAddresses.length)],
        user_agent: userAgents[Math.floor(Math.random() * userAgents.length)],
        created_at: date.toISOString(),
      });
    }
    
    // Sort by date descending
    mockLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setLogs(mockLogs);
    calculateStats(mockLogs);
    
    // Set filter options
    setAvailableActions([...actions]);
    setAvailableEntities([...entityTypes]);
    setAvailableAdmins(adminNames.map((name, idx) => ({ id: adminIds[idx], name })));
    
    // Save to localStorage for persistence
    localStorage.setItem("audit_logs_detailed", JSON.stringify(mockLogs));
  };

  const generateMockDetails = (action: string, entityType: string) => {
    const fields = {
      user: ["first_name", "last_name", "email", "phone", "role", "card_uid"],
      device: ["device_name", "device_type", "status", "location", "firmware_version"],
      organization: ["org_name", "address", "contact_email", "contact_phone", "logo"],
      admin: ["first_name", "last_name", "username", "email", "role_id"],
      attendance: ["timestamp", "status", "method", "notes"],
      subscription: ["plan_id", "billing_cycle", "auto_renew", "amount"],
    };
    
    const relevantFields = fields[entityType as keyof typeof fields] || ["value"];
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};
    
    relevantFields.forEach(field => {
      if (Math.random() > 0.5) {
        oldValues[field] = `${field}_old_${Math.floor(Math.random() * 100)}`;
        newValues[field] = `${field}_new_${Math.floor(Math.random() * 100)}`;
      }
    });
    
    if (Object.keys(oldValues).length === 0) {
      newValues[relevantFields[0]] = `${relevantFields[0]}_${Math.floor(Math.random() * 100)}`;
    }
    
    return { oldValues, newValues };
  };

  const applyFilters = () => {
    let filtered = [...logs];
    
    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(log => 
        ACTION_CONFIG[log.action]?.label.toLowerCase().includes(searchLower) ||
        log.entity_type.toLowerCase().includes(searchLower) ||
        log.admin_name.toLowerCase().includes(searchLower) ||
        log.admin_email.toLowerCase().includes(searchLower) ||
        log.ip_address.includes(searchLower)
      );
    }
    
    // Apply action filter
    if (filters.action !== "all") {
      filtered = filtered.filter(log => log.action === filters.action);
    }
    
    // Apply entity type filter
    if (filters.entity_type !== "all") {
      filtered = filtered.filter(log => log.entity_type === filters.entity_type);
    }
    
    // Apply admin filter
    if (filters.admin_id !== "all") {
      filtered = filtered.filter(log => log.admin_id === filters.admin_id);
    }
    
    // Apply date filters
    // if (filters.date_from) {
    //   const fromDate = new Date(filters.date_from);
    //   fromDate.setHours(0, 0, 0, 0);
    //   filtered = filtered.filter(log => new Date(log.created_at) >= fromDate);
    // }
    
    // if (filters.date_to) {
    //   const toDate = new Date(filters.date_to);
    //   toDate.setHours(23, 59, 59, 999);
    //   filtered = filtered.filter(log => new Date(log.created_at) <= toDate);
    // }
    
    // Update pagination
    setTotalPages(Math.ceil(filtered.length / itemsPerPage));
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    setFilteredLogs(filtered.slice(start, end));
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      action: "all",
      entity_type: "all",
      // date_from: "",
      // date_to: "",
      admin_id: "all",
    });
    setCurrentPage(1);
  };

  const exportLogs = () => {
    const exportData = filteredLogs.map(log => ({
      Date: new Date(log.created_at).toLocaleString(),
      Action: ACTION_CONFIG[log.action]?.label || log.action,
      Entity: log.entity_type,
      Admin: log.admin_name,
      Email: log.admin_email,
      IP: log.ip_address,
      "User Agent": log.user_agent,
      Details: JSON.stringify(log.new_values || log.old_values || {}),
    }));
    
    const csv = [
      Object.keys(exportData[0] || {}).join(","),
      ...exportData.map(row => Object.values(row).map(value => `"${value}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Audit logs exported successfully!");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      full: date.toLocaleString(),
      relative: getRelativeTime(date),
    };
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getActionConfig = (action: string) => {
    return ACTION_CONFIG[action] || ACTION_CONFIG.default;
  };

  const getEntityIcon = (entityType: string) => {
    return ENTITY_ICONS[entityType] || <Activity className="h-3 w-3" />;
  };

  const getChangesSummary = (log: AuditLog) => {
    if (log.new_values && log.old_values) {
      const changes = Object.keys(log.new_values).filter(key => log.old_values?.[key] !== log.new_values[key]);
      if (changes.length > 0) {
        return `Changed: ${changes.slice(0, 2).join(", ")}${changes.length > 2 ? ` +${changes.length - 2}` : ""}`;
      }
    }
    if (log.new_values) {
      const keys = Object.keys(log.new_values);
      return `${keys.slice(0, 2).join(", ")}${keys.length > 2 ? ` +${keys.length - 2}` : ""} updated`;
    }
    return "No additional details";
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (

    <div className="space-y-6">

      {/* Header with Stats */}
    <div className=" sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <CardTitle className="font-heading flex items-center gap-2">
            <History className="h-5 w-5" /> Audit Logs 
            {/*<div className="p-1 rounded-lg bg-primary/5 border border-primary/10 text-center"><p className="text-2xl font-bold text-primary"> {stats.total} </p></div>*/}
        </CardTitle>
            <p className="text-sm text-muted-foreground">Track all actions performed on your account and organization</p>
      </div>



      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportLogs}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
        <Button 
          variant={showFilters ? "default" : "outline"} 
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? "gradient-primary gap-2" : "gap-2"}
        >
          <Filter className="h-4 w-4" />
          Filters
          {(filters.action !== "all" || filters.entity_type !== "all" || filters.admin_id !== "all" || filters.search ) && (
            <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
              Active
            </Badge>
          )}
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="border border-border">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-xs">
                  <Search className="h-3 w-3" /> Search
                </Label>
                <Input
                  placeholder="Search actions, admins, IP..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs">Action Type</Label>
                <Select value={filters.action} onValueChange={(v) => setFilters({ ...filters, action: v })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {availableActions.map(action => (
                      <SelectItem key={action} value={action}>
                        <div className="flex items-center gap-2">
                          {getActionConfig(action).icon}
                          <span>{getActionConfig(action).label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs">Entity Type</Label>
                <Select value={filters.entity_type} onValueChange={(v) => setFilters({ ...filters, entity_type: v })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All entities</SelectItem>
                    {availableEntities.map(entity => (
                      <SelectItem key={entity} value={entity}>
                        <div className="flex items-center gap-2">
                          {getEntityIcon(entity)}
                          <span className="capitalize">{entity}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs">Admin User</Label>
                <Select value={filters.admin_id} onValueChange={(v) => setFilters({ ...filters, admin_id: v })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All admins" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" size="sm">All admins</SelectItem>
                    {availableAdmins.map(adminUser => (
                      <SelectItem key={adminUser.id} value={adminUser.id}>
                        {adminUser.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
             {/* <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-xs">
                  <Calendar className="h-3 w-3" /> From Date
                </Label>
                <Input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>*/}
              
              {/*<div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-xs">
                  <Calendar className="h-3 w-3" /> To Date
                </Label>
                <Input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>*/}
            </div>
            
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Logs Table */}
      <Card className="border-0 shadow-sm bg-card">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            {/*<CardTitle className="font-heading flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-primary" />Audit Logs 
            </CardTitle>*/}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Show:</Label>
              <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(parseInt(v)); setCurrentPage(1); }}>
                <SelectTrigger className="w-20 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/*<p className="text-sm text-muted-foreground">Track all actions performed on your account and organization</p>*/}
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No audit logs found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {filteredLogs.map((log) => {
                  const actionConfig = getActionConfig(log.action);
                  const date = formatDate(log.created_at);
                  
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-full ${actionConfig.bgClass} flex items-center justify-center flex-shrink-0`}>
                        <span className={actionConfig.color}>{actionConfig.icon}</span>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{actionConfig.label}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {getEntityIcon(log.entity_type)}
                              <span className="capitalize">{log.entity_type}</span>
                              {log.entity_id && <span>#{log.entity_id}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{date.date}</span>
                            <Badge variant="outline" className="text-xs font-normal">
                              {date.time}
                            </Badge>
                            <span className="text-xs text-primary/70">{date.relative}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.admin_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Server className="h-3 w-3" />
                            {log.ip_address}
                          </span>
                          <span className="flex items-center gap-1">
                            <Smartphone className="h-3 w-3" />
                            {log.user_agent?.split(' ')[0]}
                          </span>
                        </div>
                        
                        {/* Changes Summary */}
                        {(log.new_values || log.old_values) && (
                          <div className="mt-2 p-2 rounded bg-muted/50 text-xs">
                            <p className="text-muted-foreground">{getChangesSummary(log)}</p>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs mt-1">
                                  View Details
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="max-w-md p-3">
                                <pre className="text-xs overflow-auto max-h-60">
                                  {JSON.stringify(log.new_values || log.old_values || {}, null, 2)}
                                </pre>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} entries
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogs;