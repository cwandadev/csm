// csms-backend/controllers/notificationController.js
import pool from '../config/database.js';

// =====================================================
// NOTIFICATION CONTROLLER - Complete with all exports
// =====================================================

// Get all notifications for organization
export const getOrganizationNotifications = async (req, res) => {
  const { organizationId } = req;
  const { limit = 50, type, priority, unread_only } = req.query;

  try {
    let query = `
      SELECT n.*, 
             CONCAT(a.first_name, ' ', a.last_name) as created_by_name,
             CASE 
               WHEN n.admin_id IS NULL THEN 'all_admins'
               ELSE 'specific_admin'
             END as target_type
      FROM notifications n
      LEFT JOIN admins a ON n.created_by = a.id
      WHERE n.organization_id = ?
    `;
    
    const params = [organizationId];

    if (type && type !== 'all') {
      query += ` AND n.type = ?`;
      params.push(type);
    }

    if (priority && priority !== 'all') {
      query += ` AND n.priority = ?`;
      params.push(priority);
    }

    if (unread_only === 'true') {
      query += ` AND n.is_read = 0 AND (n.admin_id IS NULL OR n.admin_id = ?)`;
      params.push(req.adminId);
    } else {
      query += ` AND (n.admin_id IS NULL OR n.admin_id = ?)`;
      params.push(req.adminId);
    }

    query += ` AND (n.expires_at IS NULL OR n.expires_at > NOW())`;
    query += ` ORDER BY FIELD(n.priority, 'urgent', 'high', 'normal', 'low'), n.created_at DESC LIMIT ?`;
    params.push(parseInt(limit));

    const [notifications] = await pool.execute(query, params);

    const [unreadResult] = await pool.execute(
      `SELECT COUNT(*) as unread_count 
       FROM notifications 
       WHERE organization_id = ? 
       AND (admin_id IS NULL OR admin_id = ?) 
       AND is_read = 0
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [organizationId, req.adminId]
    );

    const parsedNotifications = notifications.map(n => ({
      ...n,
      data: n.data ? (typeof n.data === 'string' ? JSON.parse(n.data) : n.data) : null
    }));

    res.json({
      success: true,
      data: parsedNotifications,
      unread_count: unreadResult[0]?.unread_count || 0
    });
  } catch (error) {
    console.error('Get organization notifications error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
};

// Get unread notifications
export const getUnreadNotifications = async (req, res) => {
  const { organizationId, adminId } = req;

  try {
    const [notifications] = await pool.execute(
      `SELECT n.*, CONCAT(a.first_name, ' ', a.last_name) as created_by_name
       FROM notifications n
       LEFT JOIN admins a ON n.created_by = a.id
       WHERE n.organization_id = ? 
       AND (n.admin_id IS NULL OR n.admin_id = ?)
       AND n.is_read = 0
       AND (n.expires_at IS NULL OR n.expires_at > NOW())
       ORDER BY FIELD(n.priority, 'urgent', 'high', 'normal', 'low'), n.created_at DESC
       LIMIT 100`,
      [organizationId, adminId]
    );

    const parsedNotifications = notifications.map(n => ({
      ...n,
      data: n.data ? (typeof n.data === 'string' ? JSON.parse(n.data) : n.data) : null
    }));

    res.json({ success: true, data: parsedNotifications });
  } catch (error) {
    console.error('Get unread notifications error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
};

// Mark as read
export const markAsRead = async (req, res) => {
  const { id } = req.params;
  const { adminId, organizationId } = req;

  try {
    const [result] = await pool.execute(
      `UPDATE notifications SET is_read = 1, read_at = NOW() 
       WHERE id = ? AND organization_id = ? AND (admin_id IS NULL OR admin_id = ?)`,
      [id, organizationId, adminId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
};

// Mark all as read
export const markAllAsRead = async (req, res) => {
  const { adminId, organizationId } = req;

  try {
    await pool.execute(
      `UPDATE notifications SET is_read = 1, read_at = NOW() 
       WHERE organization_id = ? AND (admin_id IS NULL OR admin_id = ?) AND is_read = 0`,
      [organizationId, adminId]
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  const { id } = req.params;
  const { organizationId, adminId } = req;

  try {
    const [notification] = await pool.execute(
      `SELECT created_by FROM notifications WHERE id = ? AND organization_id = ?`,
      [id, organizationId]
    );

    if (notification.length === 0) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    const [admin] = await pool.execute(
      'SELECT role_level FROM admins WHERE id = ? AND organization_id = ?',
      [adminId, organizationId]
    );

    const canDelete = notification[0].created_by === adminId || (admin[0]?.role_level <= 2);
    
    if (!canDelete) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }

    await pool.execute('DELETE FROM notifications WHERE id = ?', [id]);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete notification' });
  }
};

// Clear all notifications
export const clearAllNotifications = async (req, res) => {
  const { organizationId, adminId } = req;

  try {
    const [admin] = await pool.execute(
      'SELECT role_level FROM admins WHERE id = ? AND organization_id = ?',
      [adminId, organizationId]
    );

    if (!admin[0] || admin[0].role_level > 2) {
      return res.status(403).json({ success: false, error: 'Only organization owners can clear all notifications' });
    }

    await pool.execute('DELETE FROM notifications WHERE organization_id = ?', [organizationId]);
    res.json({ success: true, message: 'All notifications cleared' });
  } catch (error) {
    console.error('Clear all notifications error:', error);
    res.status(500).json({ success: false, error: 'Failed to clear notifications' });
  }
};

// Create notification
export const createNotification = async (req, res) => {
  const { organizationId, adminId } = req;
  const { type = 'system', priority = 'normal', title, message, data, action_url, action_text, expires_at, admin_id = null } = req.body;

  if (!title || !message) {
    return res.status(400).json({ success: false, error: 'Title and message are required' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO notifications (organization_id, admin_id, user_id, type, priority, title, message, data, is_sent, sent_at, action_url, action_text, expires_at, created_by, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), ?, ?, ?, ?, NOW(), NOW())`,
      [organizationId, admin_id, null, type, priority, title, message, data ? JSON.stringify(data) : null, action_url || null, action_text || null, expires_at || null, adminId]
    );

    res.json({ success: true, data: { id: result.insertId }, message: 'Notification created successfully' });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ success: false, error: 'Failed to create notification' });
  }
};

// =====================================================
// NOTIFICATION PREFERENCES
// =====================================================

export const getNotificationPreferences = async (req, res) => {
  const { adminId, organizationId } = req;

  try {
    const [prefs] = await pool.execute(
      `SELECT * FROM notification_preferences WHERE admin_id = ? AND organization_id = ?`,
      [adminId, organizationId]
    );

    if (prefs.length === 0) {
      const defaultPrefs = {
        admin_id: adminId,
        organization_id: organizationId,
        push_enabled: 1,
        email_enabled: 0,
        sound_enabled: 1,
        types: JSON.stringify({ system: true, attendance: true, device: true, subscription: true, report: true, alert: true, reminder: true }),
        priorities: JSON.stringify({ low: true, normal: true, high: true, urgent: true })
      };

      await pool.execute(
        `INSERT INTO notification_preferences (admin_id, organization_id, push_enabled, email_enabled, sound_enabled, types, priorities, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [defaultPrefs.admin_id, defaultPrefs.organization_id, defaultPrefs.push_enabled, defaultPrefs.email_enabled, defaultPrefs.sound_enabled, defaultPrefs.types, defaultPrefs.priorities]
      );

      return res.json({ success: true, data: { ...defaultPrefs, types: JSON.parse(defaultPrefs.types), priorities: JSON.parse(defaultPrefs.priorities) } });
    }

    res.json({ success: true, data: { ...prefs[0], types: JSON.parse(prefs[0].types || '{}'), priorities: JSON.parse(prefs[0].priorities || '{}') } });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to get preferences' });
  }
};

export const updateNotificationPreferences = async (req, res) => {
  const { adminId, organizationId } = req;
  const { push_enabled, email_enabled, sound_enabled, types, priorities } = req.body;

  try {
    await pool.execute(
      `INSERT INTO notification_preferences (admin_id, organization_id, push_enabled, email_enabled, sound_enabled, types, priorities, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         push_enabled = VALUES(push_enabled), email_enabled = VALUES(email_enabled), sound_enabled = VALUES(sound_enabled),
         types = VALUES(types), priorities = VALUES(priorities), updated_at = NOW()`,
      [adminId, organizationId, push_enabled ? 1 : 0, email_enabled ? 1 : 0, sound_enabled ? 1 : 0, types ? JSON.stringify(types) : '{}', priorities ? JSON.stringify(priorities) : '{}']
    );

    res.json({ success: true, message: 'Preferences updated' });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
};

// =====================================================
// PUSH NOTIFICATION DEVICES
// =====================================================

export const registerPushDevice = async (req, res) => {
  const { adminId } = req;
  const { device_token, platform, device_name } = req.body;

  if (!device_token || !platform) {
    return res.status(400).json({ success: false, error: 'Device token and platform required' });
  }

  try {
    await pool.execute('DELETE FROM notification_devices WHERE device_token = ?', [device_token]);
    await pool.execute(
      `INSERT INTO notification_devices (admin_id, device_token, platform, device_name, is_active, last_used_at, created_at, updated_at) 
       VALUES (?, ?, ?, ?, 1, NOW(), NOW(), NOW())`,
      [adminId, device_token, platform, device_name || null]
    );

    res.json({ success: true, message: 'Device registered for push notifications' });
  } catch (error) {
    console.error('Register push device error:', error);
    res.status(500).json({ success: false, error: 'Failed to register device' });
  }
};

export const unregisterPushDevice = async (req, res) => {
  const { adminId } = req;
  const { device_token } = req.body;

  try {
    await pool.execute('DELETE FROM notification_devices WHERE admin_id = ? AND device_token = ?', [adminId, device_token]);
    res.json({ success: true, message: 'Device unregistered' });
  } catch (error) {
    console.error('Unregister push device error:', error);
    res.status(500).json({ success: false, error: 'Failed to unregister device' });
  }
};

export const getPushDevices = async (req, res) => {
  const { adminId } = req;

  try {
    const [devices] = await pool.execute(
      `SELECT id, device_token, platform, device_name, is_active, last_used_at, created_at
       FROM notification_devices WHERE admin_id = ? AND is_active = 1 ORDER BY created_at DESC`,
      [adminId]
    );

    res.json({ success: true, data: devices });
  } catch (error) {
    console.error('Get push devices error:', error);
    res.status(500).json({ success: false, error: 'Failed to get devices' });
  }
};

// =====================================================
// NOTIFICATION SERVICE FUNCTIONS (Used by other services)
// =====================================================

export const notifyUnregisteredCard = async (organizationId, cardId, deviceId) => {
  try {
    await pool.execute(
      `INSERT INTO notifications (organization_id, admin_id, type, priority, title, message, data, is_sent, sent_at, created_by, created_at, updated_at) 
       VALUES (?, NULL, 'alert', 'high', 'Unregistered Card Detected', ?, ?, 1, NOW(), 1, NOW(), NOW())`,
      [organizationId, `A card (${cardId.slice(-6)}) was scanned but is not registered.`, JSON.stringify({ card_id: cardId, device_id: deviceId })]
    );
    console.log(`[NOTIFICATION] Created unregistered card alert for org ${organizationId}`);
  } catch (error) {
    console.error('Create unregistered card notification error:', error);
  }
};

export const notifyDeviceAdded = async (organizationId, deviceName, deviceId, addedBy) => {
  try {
    await pool.execute(
      `INSERT INTO notifications (organization_id, admin_id, type, priority, title, message, data, is_sent, sent_at, created_by, created_at, updated_at) 
       VALUES (?, NULL, 'device', 'normal', 'New Device Added', ?, ?, 1, NOW(), ?, NOW(), NOW())`,
      [organizationId, `Device "${deviceName}" has been added to your system.`, JSON.stringify({ device_id: deviceId, device_name: deviceName }), addedBy]
    );
  } catch (error) {
    console.error('Create device added notification error:', error);
  }
};

export const notifyDeviceStatusChange = async (organizationId, deviceName, deviceId, isOnline) => {
  try {
    const status = isOnline ? 'online' : 'offline';
    const priority = isOnline ? 'normal' : 'high';
    const title = isOnline ? 'Device Back Online' : 'Device Offline';
    const message = isOnline ? `Device "${deviceName}" is back online.` : `Device "${deviceName}" is offline. Check connection.`;

    await pool.execute(
      `INSERT INTO notifications (organization_id, admin_id, type, priority, title, message, data, is_sent, sent_at, created_by, created_at, updated_at) 
       VALUES (?, NULL, 'device', ?, ?, ?, ?, 1, NOW(), 1, NOW(), NOW())`,
      [organizationId, priority, title, message, JSON.stringify({ device_id: deviceId, device_name: deviceName, status })]
    );
  } catch (error) {
    console.error('Create device status notification error:', error);
  }
};

export const notifyDeviceLost = async (organizationId, deviceName, deviceId, isOnline) => {
  try {
    await pool.execute(
      `INSERT INTO notifications (organization_id, admin_id, type, priority, title, message, data, is_sent, sent_at, created_by, created_at, updated_at) 
       VALUES (?, NULL, 'device', 'urgent', 'Device Lost', ?, ?, 1, NOW(), 1, NOW(), NOW())`,
      [organizationId, `Device "${deviceName}" has been marked as lost (inactive for 7+ days).`, JSON.stringify({ device_id: deviceId, device_name: deviceName, action: 'device_lost' })]
    );
  } catch (error) {
    console.error('Create device lost notification error:', error);
  }
};

export const notifyDeviceReactivated = async (organizationId, deviceName, deviceId) => {
  try {
    await pool.execute(
      `INSERT INTO notifications (organization_id, admin_id, type, priority, title, message, data, is_sent, sent_at, created_by, created_at, updated_at) 
       VALUES (?, NULL, 'device', 'normal', 'Device Reactivated', ?, ?, 1, NOW(), 1, NOW(), NOW())`,
      [organizationId, `Device "${deviceName}" has been reactivated after being inactive.`, JSON.stringify({ device_id: deviceId, device_name: deviceName, action: 'device_reactivated' })]
    );
  } catch (error) {
    console.error('Create device reactivated notification error:', error);
  }
};

export const notifyAttendanceEvent = async (organizationId, userId, userName, status, minutes, deviceId) => {
  try {
    let title, message, priority = 'normal';
    if (status === 'late') { title = 'Late Arrival'; message = `${userName} arrived late by ${minutes} minutes.`; priority = 'high'; }
    else if (status === 'early_leave') { title = 'Early Leave'; message = `${userName} left early by ${minutes} minutes.`; priority = 'high'; }
    else if (status === 'absent') { title = 'Absent Today'; message = `${userName} was marked absent today.`; priority = 'normal'; }
    else return;

    await pool.execute(
      `INSERT INTO notifications (organization_id, admin_id, type, priority, title, message, data, is_sent, sent_at, created_by, created_at, updated_at) 
       VALUES (?, NULL, 'attendance', ?, ?, ?, ?, 1, NOW(), 1, NOW(), NOW())`,
      [organizationId, priority, title, message, JSON.stringify({ user_id: userId, user_name: userName, status, minutes, device_id: deviceId })]
    );
  } catch (error) {
    console.error('Create attendance notification error:', error);
  }
};

export const notifyUserAdded = async (organizationId, userName, userRole, addedBy) => {
  try {
    await pool.execute(
      `INSERT INTO notifications (organization_id, admin_id, type, priority, title, message, data, is_sent, sent_at, created_by, created_at, updated_at) 
       VALUES (?, NULL, 'system', 'low', 'New User Added', ?, ?, 1, NOW(), ?, NOW(), NOW())`,
      [organizationId, `${userName} (${userRole}) has been added.`, JSON.stringify({ user_name: userName, role: userRole }), addedBy]
    );
  } catch (error) {
    console.error('Create user added notification error:', error);
  }
};

export const notifySubscriptionEvent = async (organizationId, eventType, details) => {
  try {
    let title, message, priority = 'high';
    if (eventType === 'expiring_soon') { title = 'Subscription Expiring Soon'; message = `Your subscription expires in ${details.days} days.`; priority = 'urgent'; }
    else if (eventType === 'expired') { title = 'Subscription Expired'; message = 'Your subscription has expired. Please renew.'; priority = 'urgent'; }
    else if (eventType === 'renewed') { title = 'Subscription Renewed'; message = `Subscription renewed until ${details.expiryDate}.`; priority = 'normal'; }
    else if (eventType === 'payment_failed') { title = 'Payment Failed'; message = 'Payment failed. Update your payment method.'; priority = 'urgent'; }
    else if (eventType === 'payment_success') { title = 'Payment Successful'; message = `Payment of ${details.amount} was successful.`; priority = 'normal'; }
    else return;

    await pool.execute(
      `INSERT INTO notifications (organization_id, admin_id, type, priority, title, message, data, is_sent, sent_at, created_by, created_at, updated_at) 
       VALUES (?, NULL, 'subscription', ?, ?, ?, ?, 1, NOW(), 1, NOW(), NOW())`,
      [organizationId, priority, title, message, JSON.stringify({ event_type: eventType, ...details })]
    );
  } catch (error) {
    console.error('Create subscription notification error:', error);
  }
};

export const notifyAdminAction = async (organizationId, action, adminName, targetType, targetName) => {
  try {
    let title, message;
    if (action === 'admin_added') { title = 'New Admin Added'; message = `${adminName} added as admin.`; }
    else if (action === 'admin_removed') { title = 'Admin Removed'; message = `${adminName} removed as admin.`; }
    else if (action === 'role_changed') { title = 'Role Changed'; message = `${adminName}'s role has been updated.`; }
    else if (action === 'org_updated') { title = 'Organization Updated'; message = `Settings updated by ${adminName}.`; }
    else return;

    await pool.execute(
      `INSERT INTO notifications (organization_id, admin_id, type, priority, title, message, data, is_sent, sent_at, created_by, created_at, updated_at) 
       VALUES (?, NULL, 'system', 'normal', ?, ?, ?, 1, NOW(), 1, NOW(), NOW())`,
      [organizationId, title, message, JSON.stringify({ action, admin_name: adminName, target_type: targetType, target_name: targetName })]
    );
  } catch (error) {
    console.error('Create admin action notification error:', error);
  }
};