// csms-frontend/src/pages/dashboard/Notifications.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, CheckCircle, AlertTriangle, Info, X, Volume2, VolumeX, Trash2, CheckCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import api from "@/lib/api";
import { notificationApi } from "@/lib/notificationApi";

import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  organization_id: number;
  admin_id: number | null;
  user_id: number | null;
  type: 'system' | 'attendance' | 'device' | 'subscription' | 'report' | 'alert' | 'reminder';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  is_sent: boolean;
  sent_at: string;
  read_at: string | null;
  action_url: string | null;
  action_text: string | null;
  expires_at: string | null;
  created_at: string;
}

const iconMap = {
  system: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
  attendance: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  device: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10" },
  subscription: { icon: Bell, color: "text-purple-500", bg: "bg-purple-500/10" },
  report: { icon: Bell, color: "text-cyan-500", bg: "bg-cyan-500/10" },
  alert: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
  reminder: { icon: Bell, color: "text-yellow-500", bg: "bg-yellow-500/10" }
};

const priorityColors = {
  low: "bg-gray-500",
  normal: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-500 animate-pulse"
};

const Notifications = () => {
  const { admin } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastNotificationRef = useRef<number | null>(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio("/notification.mp3");
    audioRef.current.volume = 0.5;
    
    if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!admin?.organizationId) return;
    
    try {
      const response = await notificationApi.getNotifications(admin.organizationId, 50);
      if (response.success && response.data) {
        const newNotifications = response.data;
        setNotifications(newNotifications);
        
        const unread = newNotifications.filter((n: Notification) => !n.is_read).length;
        setUnreadCount(unread);
        
        if (lastNotificationRef.current) {
          const latestId = newNotifications[0]?.id;
          if (latestId && latestId > lastNotificationRef.current) {
            const newOnes = newNotifications.filter((n: Notification) => n.id > lastNotificationRef.current!);
            newOnes.forEach(notify => {
              if (soundEnabled && audioRef.current) {
                audioRef.current.play().catch(e => console.log("Audio play failed:", e));
              }
              if (Notification.permission === "granted" && document.hidden) {
                new Notification(notify.title, {
                  body: notify.message,
                  icon: "/logo.png",
                  tag: notify.id.toString(),
                  requireInteraction: notify.priority === "urgent"
                });
              }
            });
          }
        }
        lastNotificationRef.current = newNotifications[0]?.id;
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [admin?.organizationId, soundEnabled]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (id: number) => {
  try {
    const response = await notificationApi.markAsRead(id);
    if (response.success) {
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      toast.success("Notification marked as read");
    }
  } catch (error) {
    console.error("Error marking as read:", error);
    toast.error("Failed to mark as read");
  }
};

  const markAllAsRead = async () => {
    try {
      const response = await notificationApi.markAllAsRead(admin?.organizationId);
      if (response.success) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
        toast.success("All notifications marked as read");
      }
    } catch (error) {
      toast.error("Failed to mark all as read");
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      const response = await notificationApi.deleteNotification(id);
      if (response.success) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        toast.success("Notification deleted");
      }
    } catch (error) {
      toast.error("Failed to delete notification");
    }
  };

  const clearAll = async () => {
    try {
      const response = await notificationApi.clearAll(admin?.organizationId);
      if (response.success) {
        setNotifications([]);
        setUnreadCount(0);
        toast.success("All notifications cleared");
      }
    } catch (error) {
      toast.error("Failed to clear notifications");
    }
  };

  const enablePushNotifications = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        toast.success("Push notifications enabled");
        new Notification("CSMS Notifications Enabled", {
          body: "You will now receive real-time alerts",
          icon: "/logo.png"
        });
      } else {
        toast.error("Push notifications blocked");
      }
    } else {
      toast.error("Browser doesn't support notifications");
    }
  };

  const getFilteredNotifications = () => {
    if (activeTab === "unread") {
      return notifications.filter(n => !n.is_read);
    }
    return notifications;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> 
            Notifications
            {unreadCount > 0 && (
              <Badge className="ml-2 bg-primary text-primary-foreground">
                {unreadCount} new
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Stay updated with real-time alerts and system notifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSoundEnabled(!soundEnabled)} className="gap-2">
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {soundEnabled ? "Sound On" : "Sound Off"}
          </Button>
          <Button variant="outline" size="sm" onClick={enablePushNotifications} className="gap-2">
            <Bell className="h-4 w-4" />
            Enable Push
          </Button>
          {notifications.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-2" disabled={unreadCount === 0}>
                <CheckCheck className="h-4 w-4" />
                Mark All Read
              </Button>
              <Button variant="outline" size="sm" onClick={clearAll} className="gap-2 text-red-500 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
                Clear All
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 && (
              <span className="ml-2 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="space-y-3">
            {getFilteredNotifications().length === 0 ? (
              <Card className="border-0 shadow-sm bg-card">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                    <Bell className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">No notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    {activeTab === "unread" ? "You've read all your notifications" : "You're all caught up! New notifications will appear here"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              getFilteredNotifications().map((notification) => {
                const { icon: Icon, color, bg } = iconMap[notification.type] || iconMap.system;
                const isUnread = !notification.is_read;
                
                return (
                  <Card key={notification.id} className={cn("border-0 shadow-sm bg-card transition-all hover:shadow-md", isUnread && "border-l-4 border-l-primary")}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", bg)}>
                        <Icon className={cn("h-5 w-5", color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-heading font-semibold text-foreground text-sm">{notification.title}</h3>
                              <div className={cn("w-1.5 h-1.5 rounded-full", priorityColors[notification.priority])} />
                              <span className="text-xs text-muted-foreground capitalize">{notification.priority}</span>
                              {!notification.is_read && <Badge variant="default" className="text-xs bg-primary">New</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{notification.message}</p>
                            {notification.action_url && notification.action_text && (
                              <Button variant="link" size="sm" className="p-0 h-auto mt-2 text-primary" onClick={() => window.open(notification.action_url!, "_blank")}>
                                {notification.action_text} →
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(notification.sent_at)}</span>
                            {!notification.is_read && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markAsRead(notification.id)}>
                                <CheckCheck className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => deleteNotification(notification.id)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Notifications;