// csms-frontend/src/pages/settings/components/DangerZone.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Power, Trash2, Loader2, Mail, Clock, X, CheckCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface DangerZoneProps {
  admin: any;
  onToast?: (message: string, type: "success" | "error" | "info" | "warning") => void;
}

const DangerZone = ({ admin, onToast }: DangerZoneProps) => {
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteVerification, setDeleteVerification] = useState("");
  const [pendingDeletion, setPendingDeletion] = useState<{ scheduled: boolean; scheduledDate: string | null }>({ scheduled: false, scheduledDate: null });
  const [cancelling, setCancelling] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkPendingDeletion();
  }, []);

  const checkPendingDeletion = async () => {
    try {
      const token = localStorage.getItem('csm_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${apiUrl}/account/deletion-status`, { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      if (result.success && result.data?.pending) {
        setPendingDeletion({ scheduled: true, scheduledDate: result.data.scheduled_date });
      }
    } catch (error) {
      console.error("Error checking deletion status:", error);
    }
  };

  const handleDeactivateAccount = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('csm_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      await fetch(`${apiUrl}/account/deactivate`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      onToast?.("Account deactivated successfully", "info");
      setTimeout(() => { window.location.href = "/login"; }, 2000);
    } catch (error) {
      onToast?.("Failed to deactivate account", "error");
    } finally {
      setLoading(false);
      setShowDeactivateConfirm(false);
    }
  };

  const handleScheduleDeletion = async () => {
    if (deleteVerification !== "DELETE MY ACCOUNT") {
      onToast?.('Type "DELETE MY ACCOUNT" to confirm', "warning");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('csm_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${apiUrl}/account/schedule-deletion`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ confirm: true }) });
      const result = await response.json();
      if (result.success) {
        setPendingDeletion({ scheduled: true, scheduledDate: result.data.scheduled_date });
        onToast?.("Account deletion scheduled. A confirmation email has been sent.", "warning");
      } else {
        onToast?.("Failed to schedule deletion", "error");
      }
    } catch (error) {
      onToast?.("Failed to schedule deletion", "error");
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
      setDeleteVerification("");
    }
  };

  const handleCancelDeletion = async () => {
    setCancelling(true);
    try {
      const token = localStorage.getItem('csm_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      await fetch(`${apiUrl}/account/cancel-deletion`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      setPendingDeletion({ scheduled: false, scheduledDate: null });
      onToast?.("Deletion cancelled. Your account is safe.", "success");
    } catch (error) {
      onToast?.("Failed to cancel deletion", "error");
    } finally {
      setCancelling(false);
    }
  };

  const formatScheduledDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {pendingDeletion.scheduled && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-600 dark:text-red-400">Account Deletion Scheduled</p>
              <p className="text-sm text-muted-foreground mt-1">Your account is scheduled for deletion on {formatScheduledDate(pendingDeletion.scheduledDate!)}. A confirmation email has been sent.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={handleCancelDeletion} disabled={cancelling}>
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                Cancel Deletion
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 rounded-lg border border-orange-500/20 bg-orange-500/5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2"><Power className="h-5 w-5 text-orange-500" /><p className="font-semibold">Deactivate Account</p></div>
            <p className="text-sm text-muted-foreground mt-1">Temporarily deactivate your account. You can reactivate later by logging in.</p>
          </div>
          <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500/10" onClick={() => setShowDeactivateConfirm(true)} disabled={loading || pendingDeletion.scheduled}>
            <Power className="h-4 w-4 mr-2" /> Deactivate
          </Button>
        </div>
      </div>

      <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-red-500" /><p className="font-semibold">Delete Account</p></div>
            <p className="text-sm text-muted-foreground mt-1">Permanently delete your account. Deletion occurs after 2 days, giving you time to cancel.</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">⚠️ This action cannot be undone. All data will be permanently removed.</p>
          </div>
          <Button variant="outline" className="border-red-500 text-red-500 hover:bg-red-500/10" onClick={() => setShowDeleteConfirm(true)} disabled={loading || pendingDeletion.scheduled}>
            <Trash2 className="h-4 w-4 mr-2" /> Schedule Deletion
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeactivateConfirm} onOpenChange={setShowDeactivateConfirm}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Deactivate Account?</AlertDialogTitle><AlertDialogDescription>Your account will be temporarily disabled. You can reactivate it by logging in again.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeactivateAccount} className="bg-orange-500 hover:bg-orange-600">Deactivate</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="text-red-600">Delete Account Permanently?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. Type <strong>"DELETE MY ACCOUNT"</strong> to confirm.</AlertDialogDescription></AlertDialogHeader>
          <Input value={deleteVerification} onChange={(e) => setDeleteVerification(e.target.value)} placeholder='Type "DELETE MY ACCOUNT" to confirm' className="mt-2" />
          <AlertDialogFooter className="mt-4"><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleScheduleDeletion} className="bg-red-500 hover:bg-red-600" disabled={loading || deleteVerification !== "DELETE MY ACCOUNT"}>{loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Schedule Deletion (2 days)</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
        <div className="flex items-start gap-3"><Mail className="h-5 w-5 text-blue-500 flex-shrink-0" /><div><p className="text-sm font-medium">Need help?</p><p className="text-xs text-muted-foreground">Contact support before deleting your account. We're here to help resolve any issues.</p></div></div>
        <Button variant="link" className="text-blue-500 p-0 h-auto mt-2">Contact Support →</Button>
      </div>
    </div>
  );
};

export default DangerZone;