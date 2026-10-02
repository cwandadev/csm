// csms-frontend/src/lib/notificationApi.js
import api from './api';

export const notificationApi = {
  // Get all notifications for organization
  getNotifications: async (organizationId, limit = 50, filters = {}) => {
    const { type, priority, unreadOnly } = filters;
    let url = `/notifications?limit=${limit}`;
    if (organizationId) url += `&org_id=${organizationId}`;
    if (type && type !== 'all') url += `&type=${type}`;
    if (priority && priority !== 'all') url += `&priority=${priority}`;
    if (unreadOnly) url += `&unread_only=true`;
    return await api.get(url);
  },

  // Get unread notifications only
  getUnreadNotifications: async () => {
    return await api.get('/notifications/unread');
  },

  // Mark a single notification as read
  markAsRead: async (id) => {
    return await api.put(`/notifications/${id}/read`);
  },

  // Mark all notifications as read
  markAllAsRead: async (organizationId) => {
    return await api.put('/notifications/read/all');
  },

  // Delete a notification
  deleteNotification: async (id) => {
    return await api.delete(`/notifications/${id}`);
  },

  // Clear all notifications (owner only)
  clearAll: async (organizationId) => {
    return await api.delete('/notifications/clear/all');
  },

  // Create custom notification
  createNotification: async (data) => {
    return await api.post('/notifications', data);
  },

  // Get notification preferences
  getPreferences: async () => {
    return await api.get('/notifications/preferences');
  },

  // Update notification preferences
  updatePreferences: async (preferences) => {
    return await api.put('/notifications/preferences', preferences);
  },

  // Register device for push notifications
  registerPushDevice: async (deviceToken, platform, deviceName) => {
    return await api.post('/notifications/devices/register', {
      device_token: deviceToken,
      platform,
      device_name: deviceName
    });
  },

  // Unregister push device
  unregisterPushDevice: async (deviceToken) => {
    return await api.post('/notifications/devices/unregister', { device_token: deviceToken });
  }
};