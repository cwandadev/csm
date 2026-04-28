// csms-frontend/src/pages/dashboard/DeviceConfig.tsx

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
import { MonitorSmartphone, Wifi, WifiOff, Plus, Loader2, MapPin, Settings2, Cpu, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { deviceApi } from "@/lib/api";
import { toast } from "sonner";

interface Device {
  id: number;
  device_name: string;
  unique_device_id: string;
  device_type: string;
  status: string;
  is_online: number;
  last_seen: string | null;
  latitude?: number;
  longitude?: number;
  has_wifi_credentials?: boolean;
  added_at?: string;
}

interface WifiCredential {
  id: number;
  device_id: number;
  ssid: string;
  api: string | null;
  updated_at: string;
}

// Helper function to check if device is online based on last_seen
const isDeviceOnline = (lastSeen: string | null): boolean => {
  if (!lastSeen) return false;
  
  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
  
  return diffMinutes <= 5;
};

// Helper to format relative time
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

const DeviceConfig = () => {
  const { admin } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configForm, setConfigForm] = useState({
    ssid: "",
    password: "",
    api: "",
    latitude: "",
    longitude: ""
  });

  useEffect(() => {
    if (admin?.organizationId) {
      fetchDevicesWithoutWifi();
    }
  }, [admin]);

  // Fetch devices that don't have WiFi credentials
  const fetchDevicesWithoutWifi = async () => {
    setLoading(true);
    try {
      // Fetch all devices
      const devicesRes = await deviceApi.getDevices(admin?.organizationId || "");
      
      if (!devicesRes.success || !devicesRes.data) {
        toast.error("Failed to fetch devices");
        setLoading(false);
        return;
      }
      
      const allDevices = devicesRes.data as any[];
      
      // Fetch WiFi credentials for all devices
      // Since there's no getAllWifiCredentials endpoint, we'll fetch per device
      const devicesWithWifiSet = new Set<number>();
      
      // Check each device for WiFi credentials
      for (const device of allDevices) {
        try {
          const wifiRes = await deviceApi.getWifiCredentials(device.id.toString());
          if (wifiRes.success && wifiRes.data) {
            devicesWithWifiSet.add(device.id);
          }
        } catch (err) {
          // Device has no WiFi credentials - that's fine
          console.log(`No WiFi credentials for device ${device.id}`);
        }
      }
      
      const formatted: Device[] = allDevices.map((device: any) => {
        const online = isDeviceOnline(device.last_seen);
        
        return {
          id: device.id,
          device_name: device.device_name,
          unique_device_id: device.unique_device_id,
          device_type: device.device_type,
          status: device.status,
          is_online: online ? 1 : 0,
          last_seen: device.last_seen,
          latitude: device.latitude ? parseFloat(device.latitude) : undefined,
          longitude: device.longitude ? parseFloat(device.longitude) : undefined,
          has_wifi_credentials: devicesWithWifiSet.has(device.id),
          added_at: device.added_at
        };
      });
      
      // Filter: devices that don't have WiFi credentials
      const devicesWithoutWifi = formatted.filter(device => !device.has_wifi_credentials);
      setDevices(devicesWithoutWifi);
      
    } catch (error) {
      console.error("Error fetching devices:", error);
      toast.error("Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchDevicesWithoutWifi();
    setRefreshing(false);
    toast.success("Devices refreshed");
  };

  const handleConfigureDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    
    if (!configForm.ssid || !configForm.password) {
      toast.error("SSID and Password are required");
      return;
    }
    
    setLoading(true);
    try {
      // Update WiFi credentials using the correct API method
      const wifiRes = await deviceApi.updateWifiCredentials(
        selectedDevice.id.toString(),
        {
          ssid: configForm.ssid,
          password: configForm.password,
          api: configForm.api || "https://api.csm.cwanda.site/v1/verify"
        }
      );
      
      if (!wifiRes.success) {
        toast.error(wifiRes.error || "Failed to update WiFi credentials");
        return;
      }
      
      toast.success("WiFi credentials updated successfully");
      setIsConfigModalOpen(false);
      resetConfigForm();
      await fetchDevicesWithoutWifi();
    } catch (error) {
      console.error("Error configuring device:", error);
      toast.error("Failed to configure device");
    } finally {
      setLoading(false);
    }
  };

  const openConfigModal = (device: Device) => {
    setSelectedDevice(device);
    setConfigForm({
      ssid: "",
      password: "",
      api: "https://api.csm.cwanda.site/v1/verify",
      latitude: device.latitude?.toString() || "",
      longitude: device.longitude?.toString() || ""
    });
    setIsConfigModalOpen(true);
  };

  const resetConfigForm = () => {
    setConfigForm({
      ssid: "",
      password: "",
      api: "",
      latitude: "",
      longitude: ""
    });
    setSelectedDevice(null);
  };

  // Separate devices into offline and online
  const offlineDevicesWithoutWifi = devices.filter(device => device.is_online === 0);
  const onlineDevicesWithoutWifi = devices.filter(device => device.is_online === 1);

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <MonitorSmartphone className="h-6 w-6 text-primary" /> Device Configuration
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure WiFi settings for ESP devices that haven't been configured yet.
          </p>
        </div>
        <Button variant="outline" onClick={refreshData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {/* Devices Without WiFi Grid */}
      {devices.length === 0 ? (
        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-muted-foreground text-center">No unconfigured devices found</p>
            <p className="text-xs text-muted-foreground mt-1">
              All devices have WiFi credentials configured
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <WifiOff className="h-5 w-5 text-red-600 dark:text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">
                    Offline Devices Without WiFi
                  </p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-500">
                    {offlineDevicesWithoutWifi.length}
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-500 mt-1">
                    These devices need immediate configuration
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Wifi className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                    Online Devices Without WiFi
                  </p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                    {onlineDevicesWithoutWifi.length}
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">
                    These devices are online but need reconfiguration
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Offline Devices Section */}
          {offlineDevicesWithoutWifi.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mt-4">
                <WifiOff className="h-5 w-5 text-red-500" />
                Offline Devices Need Configuration ({offlineDevicesWithoutWifi.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {offlineDevicesWithoutWifi.map(device => (
                  <DeviceCard 
                    key={device.id} 
                    device={device} 
                    isOnline={false}
                    onConfigure={() => openConfigModal(device)}
                  />
                ))}
              </div>
            </>
          )}
          
          {/* Online Devices Section */}
          {onlineDevicesWithoutWifi.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mt-6">
                <Wifi className="h-5 w-5 text-yellow-500" />
                Online Devices Without WiFi ({onlineDevicesWithoutWifi.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {onlineDevicesWithoutWifi.map(device => (
                  <DeviceCard 
                    key={device.id} 
                    device={device} 
                    isOnline={true}
                    onConfigure={() => openConfigModal(device)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* AP Info Card */}
      <Card className="border-0 shadow-sm bg-card">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" /> Device Access Point Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            When an ESP device is not connected to Wi-Fi, it creates an access point named 
            <strong className="text-foreground"> CSM_Config</strong> (no password). Connect to it and visit 
            <strong className="text-foreground"> 192.168.4.1</strong> to configure Wi-Fi and API settings.
          </p>
          
          <div className="p-4 rounded-lg bg-accent/50 text-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">AP Name:</span>
              <span className="font-mono text-foreground font-semibold">CSM_Config</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">AP Password:</span>
              <span className="font-mono text-foreground">(none - open network)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Config URL:</span>
              <span className="font-mono text-foreground">http://192.168.4.1</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">API Endpoint:</span>
              <span className="font-mono text-foreground text-xs break-all">https://api.csm.cwanda.site/v1/verify</span>
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <strong>Note:</strong> After configuring WiFi, the device will automatically reboot and connect to your network.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Configure WiFi Modal */}
      <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Configure WiFi for {selectedDevice?.device_name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConfigureDevice} className="space-y-4">
            <div>
              <Label htmlFor="ssid">SSID (Network Name) *</Label>
              <Input 
                id="ssid"
                required
                placeholder="Your WiFi Network Name"
                value={configForm.ssid}
                onChange={(e) => setConfigForm({ ...configForm, ssid: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">The exact name of your WiFi network</p>
            </div>
            
            <div>
              <Label htmlFor="password">Password *</Label>
              <Input 
                id="password"
                required
                type="password"
                placeholder="WiFi Password"
                value={configForm.password}
                onChange={(e) => setConfigForm({ ...configForm, password: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="api">API Endpoint</Label>
              <Input 
                id="api"
                placeholder="https://api.csm.cwanda.site/v1/verify"
                value={configForm.api}
                onChange={(e) => setConfigForm({ ...configForm, api: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">The endpoint where the device will send attendance data</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="latitude">Latitude (Optional)</Label>
                <Input 
                  id="latitude"
                  type="number"
                  step="any"
                  placeholder="-1.9441"
                  value={configForm.latitude}
                  onChange={(e) => setConfigForm({ ...configForm, latitude: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude (Optional)</Label>
                <Input 
                  id="longitude"
                  type="number"
                  step="any"
                  placeholder="30.0619"
                  value={configForm.longitude}
                  onChange={(e) => setConfigForm({ ...configForm, longitude: e.target.value })}
                />
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsConfigModalOpen(false)} 
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading} 
                className="flex-1 gradient-primary text-primary-foreground"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Settings2 className="h-4 w-4 mr-2" />
                )}
                Save Configuration
              </Button>
            </div>
          </form>
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
        .gradient-primary {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        }
      `}</style>
    </div>
  );
};

// Device Card Component
interface DeviceCardProps {
  device: Device;
  isOnline: boolean;
  onConfigure: () => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device, isOnline, onConfigure }) => {
  return (
    <Card className="border-0 shadow-sm bg-card hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="font-heading text-foreground text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            {device.device_name}
          </CardTitle>
          <div className="flex gap-1">
            <Badge variant={isOnline ? "default" : "secondary"} className={isOnline ? "bg-yellow-500 hover:bg-yellow-600" : "bg-red-500 hover:bg-red-600"}>
              {isOnline ? (
                <><Wifi className="h-3 w-3 mr-1" />Online</>
              ) : (
                <><WifiOff className="h-3 w-3 mr-1" />Offline</>
              )}
            </Badge>
            <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3 mr-1" />
              No WiFi
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm">
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
            <span className={`text-xs ${isOnline ? 'text-green-500 font-medium' : 'text-muted-foreground'}`}>
              {formatRelativeTime(device.last_seen)}
            </span>
          </div>
          {device.latitude && device.longitude && (
            <div className="flex items-center gap-1 text-muted-foreground pt-1">
              <MapPin className="h-3 w-3" />
              <span className="text-xs">{device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}</span>
            </div>
          )}
        </div>
        
        <Button 
          variant="default" 
          size="sm" 
          className="w-full gradient-primary text-primary-foreground"
          onClick={onConfigure}
        >
          <Settings2 className="h-3 w-3 mr-2" />
          Configure WiFi
        </Button>
      </CardContent>
    </Card>
  );
};

export default DeviceConfig;