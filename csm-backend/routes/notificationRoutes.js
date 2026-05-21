// csms-backend/routes/notificationRoutes.js
import express from 'express';
import { authenticateToken, requireOrganization } from '../middleware/auth.js';
import {
  getOrganizationNotifications,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  createNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  registerPushDevice,
  unregisterPushDevice,
  getPushDevices
} from '../controllers/notificationController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken, requireOrganization);

// Notification CRUD
router.get('/', getOrganizationNotifications);
router.get('/unread', getUnreadNotifications);
router.post('/', createNotification);
router.put('/:id/read', markAsRead);
router.put('/read/all', markAllAsRead);
router.delete('/:id', deleteNotification);
router.delete('/clear/all', clearAllNotifications);

// Preferences
router.get('/preferences', getNotificationPreferences);
router.put('/preferences', updateNotificationPreferences);

// Push devices
router.post('/devices/register', registerPushDevice);
router.post('/devices/unregister', unregisterPushDevice);
router.get('/devices', getPushDevices);

export default router;