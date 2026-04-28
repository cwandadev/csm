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
import { 
  MonitorSmartphone, AlertCircle, Wifi, WifiOff, Loader2, MapPin, 
  Settings2, Cpu, RefreshCw, ExternalLink, Globe, Save,
  CheckCircle, XCircle, Eye, EyeOff
} from "lucide-react";
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
  latitude?: number;
  longitude?: number;
  has_location: boolean;
  has_wifi: boolean;
  ssid?: string;
  api_url?: string;
  password?: string;
}

interface DeviceWifiInfo {
  ssid: string;
  password: string;
  api: string;
  has_credentials: boolean;
}

const DeviceConfig = () => {
  const { admin } = useAuth();
  const [devicesMissingLocation, setDevicesMissingLocation] = useState<Device[]>([]);
  const [devicesOffline, setDevicesOffline] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [configForm, setConfigForm] = useState({
    latitude: "",
    longitude: ""
  });
  const [wifiForm, setWifiForm] = useState({
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [deviceWifiInfo, setDeviceWifiInfo] = useState<DeviceWifiInfo | null>(null);
  const [loadingWifi, setLoadingWifi] = useState(false);
  const [configMode, setConfigMode] = useState<"location" | "wifi">("location");

  useEffect(() => {
    if (admin?.organizationId) {
      fetchDevicesWithIssues();
    }
  }, [admin]);

  const fetchDevicesWithIssues = async () => {
    setLoading(true);
    try {
      const res = await deviceApi.getDevices(admin?.organizationId || "");
      if (res.success && res.data) {
        const data = res.data as any[];
        
        // Fetch WiFi credentials and location for all devices
        const devicesWithInfo = await Promise.all(
          data.map(async (device: any) => {
            let hasWifi = false;
            let ssid = "";
            let apiUrl = "";
            let password = "";
            let hasLocation = false;
            let latitude = null;
            let longitude = null;
            
            try {
              const deviceDetails = await deviceApi.getDevice(device.id.toString());
              if (deviceDetails.success && deviceDetails.data) {
                const wifiCreds = deviceDetails.data.wifiCredentials;
                hasWifi = !!wifiCreds && wifiCreds.ssid && wifiCreds.ssid !== "Not configured";
                ssid = wifiCreds?.ssid || "";
                apiUrl = wifiCreds?.api || "";
                password = wifiCreds?.password || "";
                
                // Check if device has location from device_locations table
                const locations = deviceDetails.data.locations;
                if (locations && locations.length > 0) {
                  hasLocation = true;
                  latitude = locations[0]?.latitude;
                  longitude = locations[0]?.longitude;
                }
              }
            } catch (error) {
              console.error(`Error fetching details for device ${device.id}:`, error);
            }
            
            // Calculate online status
            let isOnline = 0;
            if (device.last_seen) {
              const lastSeenDate = new Date(device.last_seen);
              const now = new Date();
              const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
              isOnline = diffMinutes <= 5 ? 1 : 0;
            }
            
            return {
              id: device.id,
              device_name: device.device_name,
              unique_device_id: device.unique_device_id,
              device_type: device.device_type,
              status: device.status,
              is_online: isOnline,
              last_seen: device.last_seen ? new Date(device.last_seen).toLocaleString() : "Never",
              latitude: latitude || device.latitude,
              longitude: longitude || device.longitude,
              has_location: hasLocation || !!(device.latitude && device.longitude),
              has_wifi: hasWifi,
              ssid: ssid,
              api_url: apiUrl,
              password: password
            };
          })
        );
        
        // Filter devices that have WiFi but NO location
        const missingLocation = devicesWithInfo.filter(device => device.has_wifi && !device.has_location);
        
        // Filter devices that have WiFi but are OFFLINE (and have location or not)
        const offline = devicesWithInfo.filter(device => device.has_wifi && device.is_online === 0);
        
        setDevicesMissingLocation(missingLocation);
        setDevicesOffline(offline);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      toast.error("Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const fetchDeviceWifiInfo = async (deviceId: number) => {
    setLoadingWifi(true);
    try {
      const res = await deviceApi.getDevice(deviceId.toString());
      if (res.success && res.data) {
        const wifiCreds = res.data.wifiCredentials;
        setDeviceWifiInfo({
          ssid: wifiCreds?.ssid || "Not configured",
          password: wifiCreds?.password || "",
          api: wifiCreds?.api || "https://api.csm.cwanda.site/v1/verify",
          has_credentials: !!wifiCreds
        });
        // Pre-fill password form with stored password (if any)
        if (wifiCreds?.password) {
          setWifiForm({ password: wifiCreds.password });
        }
      }
    } catch (error) {
      console.error("Error fetching WiFi info:", error);
      setDeviceWifiInfo({
        ssid: "Not configured",
        password: "",
        api: "https://api.csm.cwanda.site/v1/verify",
        has_credentials: false
      });
    } finally {
      setLoadingWifi(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchDevicesWithIssues();
    setRefreshing(false);
    toast.success("Devices refreshed");
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    
    if (!configForm.latitude || !configForm.longitude) {
      toast.error("Please provide both latitude and longitude coordinates");
      return;
    }
    
    setSavingLocation(true);
    try {
      // Save location to database
      const locationRes = await deviceApi.updateDeviceLocation?.(
        selectedDevice.id.toString(),
        parseFloat(configForm.latitude),
        parseFloat(configForm.longitude)
      );
      
      if (!locationRes?.success && locationRes?.error) {
        toast.error(locationRes.error || "Failed to save location");
        return;
      }
      
      toast.success("Location coordinates saved successfully");
      
      // Close modal and refresh
      setIsConfigModalOpen(false);
      resetConfigForm();
      await fetchDevicesWithIssues();
      
    } catch (error) {
      console.error("Error saving location:", error);
      toast.error("Failed to save location");
    } finally {
      setSavingLocation(false);
    }
  };

  const handleOpenEspConfig = () => {
    if (!selectedDevice || !deviceWifiInfo) return;
    
    // Use the password from the form (user can modify it)
    const passwordToUse = wifiForm.password || deviceWifiInfo.password;
    
    // Build URL for ESP device configuration with plain text password
    const espConfigUrl = `http://192.168.4.1/submit?ssid=${encodeURIComponent(deviceWifiInfo.ssid)}&password=${encodeURIComponent(passwordToUse)}&server=${encodeURIComponent(deviceWifiInfo.api)}`;
    
    console.log("Opening ESP config with:", {
      ssid: deviceWifiInfo.ssid,
      password: passwordToUse ? "********" : "(empty)",
      api: deviceWifiInfo.api
    });
    
    window.open(espConfigUrl, "_blank");
    
    toast.info(`Opening configuration page for ${selectedDevice.device_name}. Make sure you're connected to the device's AP.`);
    
    // Close modal
    setIsConfigModalOpen(false);
    resetConfigForm();
  };

  const openLocationModal = async (device: Device) => {
    setConfigMode("location");
    setSelectedDevice(device);
    setConfigForm({
      latitude: device.latitude?.toString() || "",
      longitude: device.longitude?.toString() || ""
    });
    setIsConfigModalOpen(true);
  };

  const openWifiModal = async (device: Device) => {
    setConfigMode("wifi");
    setSelectedDevice(device);
    setWifiForm({ password: device.password || "" });
    await fetchDeviceWifiInfo(device.id);
    setIsConfigModalOpen(true);
  };

  const resetConfigForm = () => {
    setConfigForm({
      latitude: "",
      longitude: ""
    });
    setWifiForm({ password: "" });
    setShowPassword(false);
    setSelectedDevice(null);
    setDeviceWifiInfo(null);
  };

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setConfigForm({
            ...configForm,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString()
          });
          toast.success("Current location detected");
        },
        (error) => {
          console.error("Geolocation error:", error);
          toast.error("Unable to get current location. Please check permissions.");
        }
      );
    } else {
      toast.error("Geolocation is not supported by this browser");
    }
  };

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasDevicesToShow = devicesMissingLocation.length > 0 || devicesOffline.length > 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <MonitorSmartphone className="h-6 w-6 text-primary" /> Device Configuration
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure location coordinates or reconfigure WiFi for offline devices.
          </p>
        </div>
        <Button variant="outline" onClick={refreshData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {/* Devices Missing Location Section */}
      {devicesMissingLocation.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Devices Missing Location</h2>
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
              {devicesMissingLocation.length} device(s)
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {devicesMissingLocation.map(device => (
              <Card key={device.id} className="border-0 shadow-sm bg-card hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="font-heading text-foreground text-base flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-primary" />
                      {device.device_name}
                    </CardTitle>
                    <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-0">
                      <MapPin className="h-3 w-3 mr-1" /> No Location
                    </Badge>
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
                      <Badge variant="outline" className={device.is_online ? "bg-green-500/10 text-green-500" : "bg-orange-500/10 text-orange-500"}>
                        {device.is_online ? "Online" : "Offline"}
                      </Badge>
                    </div>
                    {device.ssid && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">WiFi SSID</span>
                        <span className="text-foreground text-xs">{device.ssid}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => openLocationModal(device)}
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      Add Location
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Offline Devices Section */}
      {devicesOffline.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-4">
            <h2 className="text-lg font-semibold text-foreground">Offline Devices</h2>
            <Badge variant="outline" className="bg-orange-500/10 text-orange-500">
              {devicesOffline.length} device(s)
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {devicesOffline.map(device => (
              <Card key={device.id} className="border-0 shadow-sm bg-card hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="font-heading text-foreground text-base flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-primary" />
                      {device.device_name}
                    </CardTitle>
                    <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 border-0">
                      <WifiOff className="h-3 w-3 mr-1" /> Offline
                    </Badge>
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
                      <span className="text-muted-foreground">Last Seen</span>
                      <span className="text-foreground text-xs">{device.last_seen}</span>
                    </div>
                    {device.ssid && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">WiFi SSID</span>
                        <span className="text-foreground text-xs">{device.ssid}</span>
                      </div>
                    )}
                    {device.latitude && device.longitude && (
                      <div className="flex items-center gap-1 text-green-600">
                        <MapPin className="h-3 w-3" />
                        <span className="text-xs">Location set</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => openWifiModal(device)}
                    >
                      <Wifi className="h-3 w-3 mr-1" />
                      Reconfigure WiFi
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* No Devices to Show */}
      {!hasDevicesToShow && (
        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-muted-foreground text-center">All devices are properly configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              No devices missing location or offline
            </p>
            <div className="flex gap-2 mt-4">
                    <Button 
                       variant="default"
                        onClick={() => window.location.href = "/dashboard/wifi-config"}
                        className="gap-2 gradient-primary text-primary-foreground"
                    >
                      <Wifi className="h-3 w-3 mr-1" />
                      Go to WiFi Configure
                    </Button>
                  </div>
          </CardContent>
        </Card>
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
              <strong>Note:</strong> After reconfiguring WiFi, the CSM device will automatically reboot and connect to the network. Make sure your PC is connected to "CSM_Config" WiFi.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              <strong>Quick Setup:</strong>
            </p>
            <ol className="text-xs text-green-700 dark:text-green-400 list-decimal list-inside mt-2 space-y-1">
              <li>Connect your computer to the device's "CSM_Config" WiFi network</li>
              <li>Click the "Reconfigure WiFi" button above</li>
              <li>Enter or update the WiFi password in the modal</li>
              <li>Click "Open Device Config" to open the device's configuration page</li>
              <li>The SSID and password will be pre-filled - click save</li>
              <li>The device will reboot and connect to your WiFi</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Configure Modal - Location Mode (NO WiFi credentials) */}
      <Dialog open={isConfigModalOpen && configMode === "location"} onOpenChange={(open) => !open && resetConfigForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Add Location for {selectedDevice?.device_name}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSaveLocation} className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Location Coordinates
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Latitude *</Label>
                  <Input 
                    required
                    type="number"
                    step="any"
                    placeholder="-1.9441"
                    value={configForm.latitude}
                    onChange={(e) => setConfigForm({ ...configForm, latitude: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Longitude *</Label>
                  <Input 
                    required
                    type="number"
                    step="any"
                    placeholder="30.0619"
                    value={configForm.longitude}
                    onChange={(e) => setConfigForm({ ...configForm, longitude: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <Button 
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={useCurrentLocation}
                >
                  <Globe className="h-3 w-3 mr-1" />
                  Use Current Location
                </Button>
                
                {configForm.latitude && configForm.longitude && (
                  <a 
                    href={`https://www.google.com/maps?q=${configForm.latitude},${configForm.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    View on map <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsConfigModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={savingLocation} className="flex-1 gradient-primary text-primary-foreground">
                {savingLocation ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Location
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Configure Modal - WiFi Mode (with plain text password for ESP) */}
      <Dialog open={isConfigModalOpen && configMode === "wifi"} onOpenChange={(open) => !open && resetConfigForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              Reconfigure WiFi for {selectedDevice?.device_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Display current WiFi info */}
            {deviceWifiInfo && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground mb-2">
                  {deviceWifiInfo.has_credentials ? "Current WiFi Configuration:" : "Enter WiFi Configuration:"}
                </p>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">SSID</Label>
                    <Input 
                      type="text"
                      placeholder="Enter WiFi SSID"
                      value={deviceWifiInfo.ssid}
                      onChange={(e) => setDeviceWifiInfo({ ...deviceWifiInfo, ssid: e.target.value })}
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">WiFi Password</Label>
                    <div className="flex gap-2 mt-1">
                      <Input 
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter WiFi password"
                        value={wifiForm.password}
                        onChange={(e) => setWifiForm({ password: e.target.value })}
                        className="flex-1 font-mono"
                      />
                      <Button 
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                        className="px-2"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">API Endpoint</Label>
                    <Input 
                      type="text"
                      placeholder="API Endpoint"
                      value={deviceWifiInfo.api}
                      onChange={(e) => setDeviceWifiInfo({ ...deviceWifiInfo, api: e.target.value })}
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>
                {loadingWifi && (
                  <div className="flex justify-center mt-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
            
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <strong>Instructions:</strong>
              </p>
              <ol className="text-xs text-blue-700 dark:text-blue-400 list-decimal list-inside mt-2 space-y-1">
                <li>Connect your computer to the device's "CSM_Config" WiFi network</li>
                <li>Enter/update the WiFi password above</li>
                <li>Click the button below to open the configuration page</li>
                <li>The SSID and password will be pre-filled in the ESP page</li>
                <li>Click save on the ESP page</li>
                <li>The device will reboot and connect to your network</li>
              </ol>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsConfigModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="button" onClick={handleOpenEspConfig} className="flex-1 gradient-primary text-primary-foreground">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Device Config
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

export default DeviceConfig;