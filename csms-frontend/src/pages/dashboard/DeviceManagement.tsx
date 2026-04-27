// csms-frontend/src/pages/dashboard/DeviceManagement.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Cpu, Plus, MapPin, Wifi, WifiOff, Settings2, Loader2, 
  Trash2, Activity, AlertCircle, RefreshCw, Info, Clock, 
  History, Network, Database, Smartphone, ChevronRight, Signal,
  Calendar, TrendingUp, ExternalLink
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { deviceApi, orgApi } from "@/lib/api";
import { toast } from "sonner";

interface Device {
  id: number;
  device_name: string;
  unique_device_id: string;
  device_type: string;
  device_image?: string;
  status: string;
  is_online: number;
  last_seen: string;
  latitude?: number;
  longitude?: number;
  added_by_name?: string;
  added_by_last?: string;
  added_at: string;
  current_ssid?: string;
}

interface DeviceStats {
  total: number;
  active: number;
  inactive: number;
  lost: number;
  online: number;
  typeDistribution: Array<{ device_type: string; count: number }>;
}

interface SubscriptionInfo {
  max_devices: number;
  current_devices: number;
  plan_name: string;
  plan_display_name: string;
  subscription_status: string;
}

interface DeviceDetails {
  id: number;
  device_name: string;
  unique_device_id: string;
  device_type: string;
  device_image: string | null;
  status: string;
  is_online: number;
  last_seen: string | null;
  added_by_name: string;
  added_by_last: string;
  added_at: string;
  latitude: number | null;
  longitude: number | null;
  current_ssid: string | null;
  statusHistory: StatusHistoryEntry[];
  locations: LocationEntry[];
  wifiCredentials: WifiCredentials | null;
  total_attendance_records?: number;
  last_attendance_at?: string;
}

interface StatusHistoryEntry {
  id: number;
  device_id: number;
  status: number;
  is_online: number;
  changed_at: string;
  duration: number;
}

interface LocationEntry {
  id: number;
  device_id: number;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

interface WifiCredentials {
  ssid: string;
  password?: string;
  api: string | null;
  updated_at: string;
}

// Helper function for relative time formatting
const formatRelativeTime = (dateString: string | null): string => {
  if (!dateString) return "Never";
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
  if (diffMinutes < 43200) return `${Math.floor(diffMinutes / 1440)} days ago`;
  return date.toLocaleDateString();
};

const DeviceManagement = () => {
  const { admin } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceDetails, setDeviceDetails] = useState<DeviceDetails | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const [formData, setFormData] = useState({
    device_name: "",
    unique_device_id: "",
    device_type: "ESP32",
    device_image: "",
    location_lat: "",
    location_lng: ""
  });
  
  const [editFormData, setEditFormData] = useState({
    device_name: "",
    status: "active"
  });

  useEffect(() => {
    if (admin?.organizationId) {
      fetchDevices();
      fetchStats();
      fetchOrganizationAndSubscription();
    }
  }, [admin]);

  // Helper function to determine if device is online based on last_seen
  const isDeviceOnline = (lastSeen: string | null): boolean => {
    if (!lastSeen) return false;
    
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
    
    // Device is online if last seen within 5 minutes
    return diffMinutes <= 5;
  };

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await deviceApi.getDevices(admin?.organizationId || "");
      if (res.success && res.data) {
        const data = res.data as any[];
        const formatted = data.map((device: any) => {
          // Calculate online status based on last_seen timestamp
          const online = isDeviceOnline(device.last_seen);
          
          return {
            id: device.id,
            device_name: device.device_name,
            unique_device_id: device.unique_device_id,
            device_type: device.device_type,
            device_image: device.device_image,
            status: device.status,
            is_online: online ? 1 : 0,
            last_seen: device.last_seen,
            latitude: device.latitude,
            longitude: device.longitude,
            added_by_name: device.added_by_name,
            added_by_last: device.added_by_last,
            added_at: device.added_at,
            current_ssid: device.current_ssid
          };
        });
        setDevices(formatted);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      toast.error("Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await deviceApi.getDeviceStats();
      if (res.success && res.data) {
        setStats(res.data as DeviceStats);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchOrganizationAndSubscription = async () => {
    try {
      const orgRes = await orgApi.getOrganization(admin?.organizationId || "");
      if (orgRes.success && orgRes.data) {
        const org = orgRes.data as any;
        
        let maxDevices = 2;
        let planDisplayName = "Free Trial";
        let subscriptionStatus = org.subscription_status || "trial";
        
        if (org.subscription_plan) {
          maxDevices = org.subscription_plan.max_devices === null ? 999999 : (org.subscription_plan.max_devices || 2);
          planDisplayName = org.subscription_plan.display_name || "Free Trial";
        }
        
        setSubscription({
          max_devices: maxDevices,
          current_devices: devices.length,
          plan_name: org.subscription_plan?.name || "free",
          plan_display_name: planDisplayName,
          subscription_status: subscriptionStatus
        });
      }
    } catch (error) {
      console.error("Error fetching organization:", error);
      setSubscription({
        max_devices: 999,
        current_devices: devices.length,
        plan_name: "enterprise",
        plan_display_name: "Enterprise",
        subscription_status: "active"
      });
    }
  };

  const fetchDeviceDetails = async (deviceId: number) => {
    console.log(`[DEBUG] Fetching details for device ${deviceId}`);
    
    try {
      const res = await deviceApi.getDevice(deviceId.toString());
      console.log('[DEBUG] API Response:', res);
      
      if (res.success && res.data) {
        const data = res.data as any;
        
        console.log('[DEBUG] Data received:', {
          deviceName: data.device_name,
          statusHistoryCount: data.statusHistory?.length || 0,
          locationsCount: data.locations?.length || 0,
          hasWifi: !!data.wifiCredentials,
          attendanceCount: data.attendance_stats?.total || 0
        });
        
        // Process status history
        const statusHistory: StatusHistoryEntry[] = (data.statusHistory || []).map((h: any) => ({
          id: h.id,
          device_id: h.device_id,
          status: h.status,
          is_online: h.is_online,
          changed_at: h.changed_at,
          duration: h.duration || 0
        }));
        
        // Process locations
        const locations: LocationEntry[] = (data.locations || []).map((l: any) => ({
          id: l.id,
          device_id: l.device_id,
          latitude: parseFloat(l.latitude),
          longitude: parseFloat(l.longitude),
          recorded_at: l.recorded_at
        }));
        
        // Process WiFi credentials
        let wifiCredentials: WifiCredentials | null = null;
        if (data.wifiCredentials) {
          wifiCredentials = {
            ssid: data.wifiCredentials.ssid,
            api: data.wifiCredentials.api,
            updated_at: data.wifiCredentials.updated_at
          };
        }
        
        const details: DeviceDetails = {
          id: data.id,
          device_name: data.device_name,
          unique_device_id: data.unique_device_id,
          device_type: data.device_type,
          device_image: data.device_image,
          status: data.status,
          is_online: isDeviceOnline(data.last_seen) ? 1 : 0,
          last_seen: data.last_seen,
          added_by_name: data.added_by_name || "System",
          added_by_last: data.added_by_last || "",
          added_at: data.added_at,
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,
          current_ssid: data.current_ssid || null,
          statusHistory,
          locations,
          wifiCredentials,
          total_attendance_records: data.attendance_stats?.total || 0,
          last_attendance_at: data.attendance_stats?.last_attendance
        };
        
        setDeviceDetails(details);
        setIsDetailsModalOpen(true);
      } else {
        toast.error(res.error || "Failed to load device details");
      }
    } catch (error) {
      console.error("Error fetching device details:", error);
      toast.error("Failed to load device details");
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([fetchDevices(), fetchStats(), fetchOrganizationAndSubscription()]);
    setRefreshing(false);
    toast.success("Data refreshed");
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.device_name || !formData.unique_device_id) {
      toast.error("Device name and ID are required");
      return;
    }
    
    if (subscription && devices.length >= subscription.max_devices) {
      toast.error(`Device limit reached (${subscription.max_devices}). Please upgrade your plan to add more devices.`);
      return;
    }
    
    setLoading(true);
    try {
      const payload: any = {
        device_name: formData.device_name,
        unique_device_id: formData.unique_device_id,
        device_type: formData.device_type,
        device_image: formData.device_image || null,
      };
      
      if (formData.location_lat && formData.location_lng) {
        payload.location = {
          latitude: parseFloat(formData.location_lat),
          longitude: parseFloat(formData.location_lng)
        };
      }
      
      const res = await deviceApi.addDevice(payload);
      if (res.success) {
        toast.success("Device added successfully");
        setIsAddModalOpen(false);
        resetForm();
        await fetchDevices();
        await fetchStats();
        await fetchOrganizationAndSubscription();
      } else {
        toast.error(res.error || "Failed to add device");
      }
    } catch (error) {
      console.error("Error adding device:", error);
      toast.error("Failed to add device");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    
    setLoading(true);
    try {
      const res = await deviceApi.updateDevice(selectedDevice.id.toString(), {
        device_name: editFormData.device_name,
        status: editFormData.status
      });
      
      if (res.success) {
        toast.success("Device updated successfully");
        setIsEditModalOpen(false);
        resetEditForm();
        await fetchDevices();
        await fetchStats();
      } else {
        toast.error(res.error || "Failed to update device");
      }
    } catch (error) {
      console.error("Error updating device:", error);
      toast.error("Failed to update device");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDevice = async () => {
    if (!deviceToDelete) return;
    
    setLoading(true);
    try {
      const res = await deviceApi.deleteDevice(deviceToDelete.id.toString());
      if (res.success) {
        toast.success("Device deleted successfully");
        setIsDeleteModalOpen(false);
        setDeviceToDelete(null);
        await fetchDevices();
        await fetchStats();
        await fetchOrganizationAndSubscription();
      } else {
        toast.error(res.error || "Failed to delete device");
      }
    } catch (error) {
      console.error("Error deleting device:", error);
      toast.error("Failed to delete device");
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (device: Device) => {
    setSelectedDevice(device);
    setEditFormData({
      device_name: device.device_name,
      status: device.status
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      device_name: "",
      unique_device_id: "",
      device_type: "ESP32",
      device_image: "",
      location_lat: "",
      location_lng: ""
    });
  };

  const resetEditForm = () => {
    setEditFormData({
      device_name: "",
      status: "active"
    });
    setSelectedDevice(null);
  };

  const getDeviceCardColor = (device: Device) => {
    if (device.status === "active" && device.is_online === 1) {
      return "bg-green-500/5 border-green-500/20";
    }
    if (device.status === "active" && device.is_online === 0) {
      return "bg-card";
    }
    if (device.status === "inactive") {
      return "bg-yellow-500/5 border-yellow-500/20";
    }
    if (device.status === "lost") {
      return "bg-red-500/5 border-red-500/20";
    }
    return "bg-card";
  };

  const canAddDevice = () => {
    if (!subscription) return true;
    return devices.length < subscription.max_devices;
  };

  const isDevicesLimitReached = !canAddDevice() && subscription && subscription.max_devices !== 999999;

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  };

  if (loading && !refreshing) {
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
            <Cpu className="h-6 w-6 text-primary" /> Device Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor and manage all ESP devices in your organization.</p>
          {subscription && (
            <p className="text-xs text-muted-foreground mt-1">
              Devices: {devices.length} / {subscription.max_devices === 999999 ? "∞" : subscription.max_devices} | Plan: {subscription.plan_display_name}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={refreshData} 
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {/*Refresh*/}
          </Button>
          <Button 
            variant="outline"
            onClick={() => setIsAddModalOpen(true)} 
            disabled={!canAddDevice()}
            title={!canAddDevice() ? `Device limit reached (${subscription?.max_devices} max)` : ""}
            className={!canAddDevice() ? "text-destructive border-destructive/50 hover:bg-destructive/10" : "gradient-primary text-primary-foreground"}
          >
            <Plus className="h-4 w-4 mr-2" /> 
            Add Device
            {isDevicesLimitReached && (
              <span className="ml-1 text-xs">(Limit reached)</span>
            )}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-border/60">
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Devices</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-green-500">{stats.online}</p>
              <p className="text-xs text-muted-foreground">Online</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-yellow-500">{stats.active - stats.online}</p>
              <p className="text-xs text-muted-foreground">Offline</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-red-500">{stats.lost || 0}</p>
              <p className="text-xs text-muted-foreground">Lost</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-primary">{stats.typeDistribution?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Types</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Devices Grid */}
      {devices.length === 0 ? (
        <Card className="border border-border/60 bg-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Cpu className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No devices registered yet</p>
            <Button 
              onClick={() => setIsAddModalOpen(true)} 
              variant="outline"
              disabled={!canAddDevice()}
              className={!canAddDevice() ? "text-destructive border-destructive/50" : "gradient-primary text-primary-foreground"}
            >
              <Plus className="h-4 w-4 mr-2" /> Add Your First Device
              {isDevicesLimitReached && (
                <span className="ml-1 text-xs">(Limit reached)</span>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map(device => (
            <Card 
              key={device.id} 
              className={`border-0 shadow-sm hover:shadow-md transition-all ${getDeviceCardColor(device)}`}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="font-heading text-foreground text-base">{device.device_name}</CardTitle>
                  {device.is_online ? (
                    <Badge className="bg-green-500/10 text-green-500 border-0">
                      <Wifi className="h-3 w-3 mr-1" />Online
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-muted-foreground">
                      <WifiOff className="h-3 w-3 mr-1" />Offline
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Device ID</span>
                    <span className="font-mono text-foreground text-xs">{device.unique_device_id.slice(0, 12)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="text-foreground">{device.device_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className={
                      device.status === "active" ? "border-green-500 text-green-500" :
                      device.status === "inactive" ? "border-yellow-500 text-yellow-500" :
                      "border-red-500 text-red-500"
                    }>
                      {device.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Seen</span>
                    <span className="text-foreground text-xs">{formatRelativeTime(device.last_seen)}</span>
                  </div>
                  {device.latitude && device.longitude && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="text-xs">{device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => fetchDeviceDetails(device.id)}
                  >
                    <Info className="h-3 w-3 mr-1" />
                    Device Info
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openEditModal(device)}
                  >
                    <Settings2 className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setDeviceToDelete(device);
                      setIsDeleteModalOpen(true);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Device Info Modal with Full Tabs */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              Device Details: {deviceDetails?.device_name}
              {deviceDetails?.is_online ? (
                <Badge className="bg-green-500/10 text-green-500 ml-2">
                  <Wifi className="h-3 w-3 mr-1" /> Online
                </Badge>
              ) : (
                <Badge variant="secondary" className="ml-2">
                  <WifiOff className="h-3 w-3 mr-1" /> Offline
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {deviceDetails && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info" className="flex items-center gap-2">
                  <Info className="h-4 w-4" /> Info
                </TabsTrigger>
                <TabsTrigger value="status" className="flex items-center gap-2">
                  <History className="h-4 w-4" /> Status History
                </TabsTrigger>
                <TabsTrigger value="locations" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Locations
                </TabsTrigger>
                <TabsTrigger value="wifi" className="flex items-center gap-2">
                  <Wifi className="h-4 w-4" /> WiFi Details
                </TabsTrigger>
              </TabsList>
              
              {/* TAB 1: INFO */}
              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Device Name</Label>
                      <p className="text-foreground font-medium mt-1">{deviceDetails.device_name}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Unique Device ID</Label>
                      <p className="font-mono text-sm mt-1 break-all">{deviceDetails.unique_device_id}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Device Type</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        <p>{deviceDetails.device_type}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Added By</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                          {deviceDetails.added_by_name?.[0] || "S"}
                        </div>
                        <p>{deviceDetails.added_by_name} {deviceDetails.added_by_last}</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Added At</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <p>{new Date(deviceDetails.added_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Last Seen</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <p>{formatRelativeTime(deviceDetails.last_seen)}</p>
                      </div>
                    </div>
                    {deviceDetails.latitude && deviceDetails.longitude && (
                      <div className="p-3 rounded-lg bg-muted/30">
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Current Location</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <MapPin className="h-4 w-4 text-primary" />
                          <p className="font-mono text-sm">{deviceDetails.latitude.toFixed(6)}, {deviceDetails.longitude.toFixed(6)}</p>
                          <a 
                            href={`https://www.google.com/maps?q=${deviceDetails.latitude},${deviceDetails.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline ml-2 flex items-center gap-1"
                          >
                            View map <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Usage Statistics */}
                <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Device Usage Statistics <Badge className={`mt-1 ${deviceDetails.status === "active" ? "bg-green-500/10 text-green-500" : deviceDetails.status === "inactive" ? "bg-yellow-500/10 text-yellow-500" : "bg-red-500/10 text-red-500"}`}>
                        {deviceDetails.status}
                      </Badge>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Attendance Records</p>
                      <p className="text-2xl font-bold text-primary">{deviceDetails.total_attendance_records || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last Attendance</p>
                      <p className="text-sm font-medium">
                        {deviceDetails.last_attendance_at ? formatRelativeTime(deviceDetails.last_attendance_at) : "Never"}
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              {/* TAB 2: STATUS HISTORY */}
              <TabsContent value="status" className="mt-4">
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {deviceDetails.statusHistory && deviceDetails.statusHistory.length > 0 ? (
                    deviceDetails.statusHistory.map((status: StatusHistoryEntry, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${status.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <Activity className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {status.status === 1 ? "Active" : "Inactive"}
                              </span>
                              <Badge variant="outline" className={`text-xs ${status.is_online ? 'text-green-500 border-green-500/30' : 'text-gray-500'}`}>
                                {status.is_online ? "Healthy" : "Un healthy"}
                              </Badge>
                            </div>
                            {status.duration > 0 && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Duration: {formatDuration(status.duration)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {new Date(status.changed_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No status history available</p>
                      <p className="text-xs mt-1">Status history will appear here when the device reports its status</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              {/* TAB 3: LOCATIONS */}
              <TabsContent value="locations" className="mt-4">
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {deviceDetails.locations && deviceDetails.locations.length > 0 ? (
                    deviceDetails.locations.map((loc: LocationEntry, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-mono text-sm font-medium">
                              {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                            </p>
                            <div className="flex items-center gap-4 mt-1">
                              <a 
                                href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                              >
                                View on map <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(loc.recorded_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No location history available</p>
                      <p className="text-xs mt-1">Locations will appear here when the device reports its GPS coordinates</p>
                      <div className="mt-6">
                      <Button 
                        variant="default"
                        onClick={() => window.location.href = "/dashboard/device-config"}
                        className="gap-2 gradient-primary text-primary-foreground"
                      >
                        <Settings2 className="h-4 w-4" />
                        Go to Device Configuration
                      </Button>
                    </div>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              {/* TAB 4: WIFI DETAILS */}
              <TabsContent value="wifi" className="mt-4">
                {deviceDetails.wifiCredentials ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 rounded-full bg-green-500/10">
                          <Wifi className="h-5 w-5 text-green-500" />
                        </div>
                        <h3 className="font-semibold text-foreground">Connected WiFi Network</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-muted/30">
                          <Label className="text-muted-foreground text-xs uppercase tracking-wider">SSID (Network Name)</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Network className="h-4 w-4 text-muted-foreground" />
                            <p className="text-foreground font-mono text-sm">{deviceDetails.wifiCredentials.ssid}</p>
                          </div>
                        </div>
                        
                        <div className="p-3 rounded-lg bg-muted/30">
                          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Password</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="p-1.5 rounded bg-muted">
                              <Signal className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <p className="text-foreground font-mono text-sm">••••••••</p>
                            <span className="text-xs text-muted-foreground ml-2">(Hidden for security)</span>
                          </div>
                        </div>
                        
                        {deviceDetails.wifiCredentials.api && (
                          <div className="p-3 rounded-lg bg-muted/30">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">API Endpoint</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Database className="h-4 w-4 text-muted-foreground" />
                              <p className="text-foreground text-sm break-all">{deviceDetails.wifiCredentials.api}</p>
                            </div>
                          </div>
                        )}
                        
                        <div className="p-3 rounded-lg bg-muted/30">
                          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Last Updated</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <p className="text-foreground text-sm">
                              {deviceDetails.wifiCredentials.updated_at 
                                ? new Date(deviceDetails.wifiCredentials.updated_at).toLocaleString() 
                                : "Never"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        WiFi credentials are stored encrypted. The device will automatically connect to this network.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <WifiOff className="h-14 w-14 mx-auto mb-4 opacity-30" />
                    <p className="font-medium">No WiFi Credentials Configured</p>
                    <p className="text-xs mt-2 max-w-md mx-auto">
                      WiFi credentials will appear here once configured. 
                      The device needs these to connect to your network and communicate with the server.
                    </p>
                    <div className="mt-6">
                      <Button 
                        variant="default"
                        onClick={() => window.location.href = "/dashboard/device-config"}
                        className="gap-2 gradient-primary text-primary-foreground"
                      >
                        <Settings2 className="h-4 w-4" />
                        Go to Device Configuration
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Device Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Device</DialogTitle>
            {subscription && (
              <p className="text-xs text-muted-foreground mt-1">
                {devices.length} / {subscription.max_devices === 999999 ? "∞" : subscription.max_devices} devices used
              </p>
            )}
          </DialogHeader>
          <form onSubmit={handleAddDevice} className="space-y-4">
            <div>
              <Label>Device Name *</Label>
              <Input 
                required
                placeholder="e.g., Main Gate Scanner"
                value={formData.device_name}
                onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Unique Device ID *</Label>
              <Input 
                required
                placeholder="ESP32-001A2B3C"
                value={formData.unique_device_id}
                onChange={(e) => setFormData({ ...formData, unique_device_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">This is the MAC address or unique identifier of your ESP device</p>
            </div>
            
            <div>
              <Label>Device Type</Label>
              <Select value={formData.device_type} onValueChange={(v) => setFormData({ ...formData, device_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ESP32">ESP32</SelectItem>
                  <SelectItem value="ESP8266">ESP8266</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Latitude (Optional)</Label>
                <Input 
                  type="number"
                  step="any"
                  placeholder="-1.9441"
                  value={formData.location_lat}
                  onChange={(e) => setFormData({ ...formData, location_lat: e.target.value })}
                />
              </div>
              <div>
                <Label>Longitude (Optional)</Label>
                <Input 
                  type="number"
                  step="any"
                  placeholder="30.0619"
                  value={formData.location_lng}
                  onChange={(e) => setFormData({ ...formData, location_lng: e.target.value })}
                />
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1 gradient-primary text-primary-foreground"
                disabled={!canAddDevice()}
              >
                Add Device
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Device Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateDevice} className="space-y-4">
            <div>
              <Label>Device Name</Label>
              <Input 
                value={editFormData.device_name}
                onChange={(e) => setEditFormData({ ...editFormData, device_name: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Status</Label>
              <Select value={editFormData.status} onValueChange={(v) => setEditFormData({ ...editFormData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {editFormData.status === "lost" && "Mark as lost if the device cannot be recovered."}
                {editFormData.status === "inactive" && "Temporarily deactivate the device."}
                {editFormData.status === "active" && "Device is operational and can record attendance."}
              </p>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                Update Device
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Device
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center py-4">
              <AlertCircle className="h-12 w-12 text-destructive/80 mx-auto mb-4" />
              <p className="text-foreground font-medium">
                Are you sure you want to delete "{deviceToDelete?.device_name}"?
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                This action cannot be undone. The device will be permanently removed from your organization.
              </p>
              {deviceToDelete && deviceToDelete.status === "active" && (
                <p className="text-xs text-destructive mt-2">
                  ⚠️ This device is currently active. Deleting it may affect attendance recording.
                </p>
              )}
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDeleteModalOpen(false)} 
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleDeleteDevice}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Device
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default DeviceManagement;