// csmsa/src/components/modals/AddDeviceModal.tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { deviceApi } from "@/lib/api";
import { toast } from "sonner";

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddDeviceModal = ({ isOpen, onClose, onSuccess }: AddDeviceModalProps) => {
  const { admin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    device_name: "",
    unique_device_id: "",
    device_type: "ESP32" as "ESP32" | "ESP8266"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.device_name || !formData.unique_device_id) {
      toast.error("Device name and unique ID are required");
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await deviceApi.addDevice({
        device_name: formData.device_name,
        unique_device_id: formData.unique_device_id,
        device_type: formData.device_type,
        organization_id: admin?.organizationId,
        added_by: admin?.id
      });
      
      if (res.success) {
        toast.success("Device added successfully");
        onSuccess();
        onClose();
        setFormData({ device_name: "", unique_device_id: "", device_type: "ESP32" });
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Device</DialogTitle>
          <DialogDescription>
            Register a new CSM device to your organization
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Device Name *</Label>
            <Input 
              placeholder="e.g., Main Gate, Back Door, Classroom 1"
              value={formData.device_name}
              onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label>Unique Device ID *</Label>
            <Input 
              placeholder="ESP32 MAC address or unique identifier"
              value={formData.unique_device_id}
              onChange={(e) => setFormData({ ...formData, unique_device_id: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              This is the unique identifier from your ESP32 device
            </p>
          </div>
          
          <div>
            <Label>Device Type *</Label>
            <Select 
              value={formData.device_type} 
              onValueChange={(v: any) => setFormData({ ...formData, device_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ESP32">ESP32</SelectItem>
                <SelectItem value="ESP8266">ESP8266</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Device
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddDeviceModal;