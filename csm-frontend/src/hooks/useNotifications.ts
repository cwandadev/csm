// csms-frontend/src/hooks/useNotifications.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationApi } from '@/lib/notificationApi';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';


export const useNotifications = () => {
  const { admin } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef(null);
  const lastCheckRef = useRef(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.5;
    audioRef.current.load();
  }, []);

  // Play sound
  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!admin?.organizationId) return;

    try {
      const response = await notificationApi.getNotifications(admin.organizationId, 1, { unreadOnly: true });
      if (response.success) {
        const count = response.unread_count || 0;
        
        // Check if count increased and play sound
        if (lastCheckRef.current !== null && count > lastCheckRef.current) {
          const newNotifications = count - lastCheckRef.current;
          if (newNotifications > 0) {
            playSound();
          }
        }
        
        setUnreadCount(count);
        lastCheckRef.current = count;
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    } finally {
      setLoading(false);
    }
  }, [admin?.organizationId, playSound]);

  // Initial fetch and polling
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Mark as read and update count
  const markAsRead = useCallback(async (id) => {
    try {
      const response = await notificationApi.markAsRead(id);
      if (response.success) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(n => 
          n.id === id ? { ...n, is_read: true } : n
        ));
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await notificationApi.markAllAsRead(admin?.organizationId);
      if (response.success) {
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [admin?.organizationId]);

  // Refresh notifications
  const refreshNotifications = useCallback(async () => {
    if (!admin?.organizationId) return;
    try {
      const response = await notificationApi.getNotifications(admin.organizationId, 50);
      if (response.success) {
        setNotifications(response.data || []);
        setUnreadCount(response.unread_count || 0);
      }
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    }
  }, [admin?.organizationId]);

  return {
    unreadCount,
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    playSound
  };
};