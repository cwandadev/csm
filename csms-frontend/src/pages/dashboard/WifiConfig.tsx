// csms-frontend/src/pages/dashboard/WifiConfig.tsx

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ExternalLink, AlertCircle, Wifi, Eye, EyeOff, Loader2, WifiOff, XCircle, RefreshCw, Plus, Save } from "lucide-react";
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
  last_seen: string;
}

interface AddWifiForm {
  ssid: string;
  password: string;
  api: string;
}

const WifiConfig = () => {
  const { admin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [devicesWithoutWifi, setDevicesWithoutWifi] = useState<Device[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [addForm, setAddForm] = useState<AddWifiForm>({
    ssid: "",
    password: "",
    api: "https://api.csm.cwanda.site/v1/verify"
  });
  const [saving, setSaving] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);

  useEffect(() => {
    if (admin?.organizationId) {
      fetchDevicesWithoutWifi();
    }
  }, [admin]);

  const fetchDevicesWithoutWifi = async () => {
    setLoading(true);
    try {
      const devicesRes = await deviceApi.getDevices(admin?.organizationId || "");
      
      if (devicesRes.success && devicesRes.data) {
        const devices = devicesRes.data as any[];
        
        const devicesWithout: Device[] = [];
        
        for (const device of devices) {
          try {
            const deviceDetails = await deviceApi.getDevice(device.id.toString());
            
            if (deviceDetails.success && deviceDetails.data) {
              const wifiCreds = deviceDetails.data.wifiCredentials;
              
              let isOnline = 0;
              if (device.last_seen) {
                const lastSeenDate = new Date(device.last_seen);
                const now = new Date();
                const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
                isOnline = diffMinutes <= 5 ? 1 : 0;
              }
              
              // Only add devices that DON'T have WiFi credentials
              if (!wifiCreds || !wifiCreds.ssid || wifiCreds.ssid === "Not configured") {
                devicesWithout.push({
                  id: device.id,
                  device_name: device.device_name,
                  unique_device_id: device.unique_device_id,
                  device_type: device.device_type,
                  status: device.status,
                  is_online: isOnline,
                  last_seen: device.last_seen ? new Date(device.last_seen).toLocaleString() : "Never"
                });
              }
            }
          } catch (error) {
            console.error(`Error fetching WiFi for device ${device.id}:`, error);
          }
        }
        
        setDevicesWithoutWifi(devicesWithout);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      toast.error("Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    setDevicesWithoutWifi([]);
    await fetchDevicesWithoutWifi();
    setRefreshing(false);
    toast.success("Devices refreshed");
  };

  const openAddModal = (device: Device) => {
    setSelectedDevice(device);
    setAddForm({
      ssid: "",
      password: "",
      api: "https://api.csm.cwanda.site/v1/verify"
    });
    setIsAddModalOpen(true);
  };

  const handleAddWifiCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    
    if (!addForm.ssid || !addForm.password) {
      toast.error("SSID and Password are required");
      return;
    }
    
    setSaving(true);
    try {
      const res = await deviceApi.updateWifiCredentials?.(
        selectedDevice.id.toString(),
        {
          ssid: addForm.ssid,
          password: addForm.password,
          api: addForm.api
        }
      );
      
      if (!res?.success && res?.error) {
        toast.error(res.error || "Failed to save WiFi credentials");
        return;
      }
      
      toast.success(`WiFi credentials saved for ${selectedDevice.device_name}`);
      setIsAddModalOpen(false);
      await fetchDevicesWithoutWifi();
      
    } catch (error) {
      console.error("Error saving WiFi credentials:", error);
      toast.error("Failed to save WiFi credentials");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Wifi className="h-6 w-6 text-primary" /> WiFi Configuration
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Add WiFi credentials to devices that need them.
          </p>
        </div>
        <Button variant="outline" onClick={refreshData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {/* Devices without WiFi - Add credentials */}
      {devicesWithoutWifi.length === 0 ? (
        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-blue-500 mb-4" />
            <p className="text-muted-foreground text-center">All devices have WiFi credentials</p>
            <p className="text-xs text-muted-foreground mt-1">
              No devices need configuration
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Devices Needing WiFi Credentials</h2>
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
              {devicesWithoutWifi.length} device(s)
            </Badge>
          </div>
          <div className="space-y-4">
            {devicesWithoutWifi.map(device => (
              <Card key={device.id} className="border-0 shadow-sm bg-card hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <CardTitle className="font-heading text-base flex items-center gap-2">
                      <WifiOff className="h-4 w-4 text-yellow-500" />
                      {device.device_name}
                    </CardTitle>
                    <Badge className="bg-yellow-500/10 text-yellow-500 border-0">
                      <XCircle className="h-3 w-3 mr-1" />
                      No Credentials
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Device ID</p>
                      <div className="p-2 bg-muted/30 rounded-md border">
                        <p className="font-mono text-xs text-foreground break-all">
                          {device.unique_device_id.slice(0, 16)}...
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Device Type</p>
                      <div className="p-2 bg-muted/30 rounded-md border">
                        <p className="text-sm text-foreground">{device.device_type}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      This device needs WiFi credentials. Click the button below to add them.
                    </p>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openAddModal(device)}
                      className="text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add WiFi Credentials
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
            <strong className="text-foreground"> CSM_Config</strong> (no password). Connect to it and the configuration page will help you set up WiFi.
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
              <a 
                href="http://192.168.4.1"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline flex items-center gap-1"
              >
                http://192.168.4.1 <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">API Endpoint:</span>
              <span className="font-mono text-foreground text-xs break-all">https://api.csm.cwanda.site/v1/verify</span>
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <strong>Note:</strong> After adding WiFi credentials, the device will be ready to connect to your network.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add WiFi Credentials Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              Add WiFi Credentials for {selectedDevice?.device_name}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleAddWifiCredentials} className="space-y-4">
            <div>
              <Label>SSID (Network Name) *</Label>
              <Input 
                required
                placeholder="Your WiFi Network Name"
                value={addForm.ssid}
                onChange={(e) => setAddForm({ ...addForm, ssid: e.target.value })}
              />
            </div>
            
            <div>
              <Label>WiFi Password *</Label>
              <div className="flex gap-2 mt-1">
                <Input 
                  required
                  type={showAddPassword ? "text" : "password"}
                  placeholder="WiFi Password"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  className="flex-1"
                />
                <Button 
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddPassword(!showAddPassword)}
                  className="px-2"
                >
                  {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This password will be stored and sent to the ESP device
              </p>
            </div>
            
            <div>
              <Label>API Endpoint</Label>
              <Input 
                placeholder="https://api.csm.cwanda.site/v1/verify"
                value={addForm.api}
                onChange={(e) => setAddForm({ ...addForm, api: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The endpoint where the device will send attendance data
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                After saving, you can go to Device Configuration page to send these credentials to the ESP device.
              </p>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="flex-1 gradient-primary text-primary-foreground">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Credentials
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default WifiConfig;