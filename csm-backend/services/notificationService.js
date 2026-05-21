// csms-backend/services/notificationService.js
import pool from '../config/database.js';
import {
  notifyUnregisteredCard,
  notifyDeviceAdded,
  notifyDeviceStatusChange,
  notifyAttendanceEvent,
  notifyUserAdded,
  notifySubscriptionEvent,
  notifyAdminAction
} from '../controllers/notificationController.js';

// =====================================================
// NOTIFICATION SERVICE - Auto-create notifications for system events
// =====================================================

class NotificationService {
  
  // Unregistered card scan
  static async unregisteredCard(organizationId, cardId, deviceId) {
    await notifyUnregisteredCard(organizationId, cardId, deviceId);
  }

  // Device added
  static async deviceAdded(organizationId, deviceName, deviceId, addedBy) {
    await notifyDeviceAdded(organizationId, deviceName, deviceId, addedBy);
  }

  // Device status change (online/offline)
  static async deviceStatusChange(organizationId, deviceName, deviceId, isOnline) {
    // Rate limit: don't create too many offline notifications
    const [recent] = await pool.execute(
      `SELECT id FROM notifications 
       WHERE organization_id = ? 
       AND type = 'device' 
       AND JSON_EXTRACT(data, '$.status') = ? 
       AND created_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE)`,
      [organizationId, isOnline ? 'online' : 'offline']
    );
    
    if (recent.length === 0 || isOnline) {
      // Always notify for online, rate limit offline
      await notifyDeviceStatusChange(organizationId, deviceName, deviceId, isOnline);
    }
  }

  // Device lost notification (inactive for 7+ days)
  static async deviceLost(organizationId, deviceName, deviceId, wasOnline) {
    const [existing] = await pool.execute(
      `SELECT id FROM notifications 
       WHERE organization_id = ? 
       AND type = 'alert' 
       AND JSON_EXTRACT(data, '$.device_id') = ? 
       AND JSON_EXTRACT(data, '$.alert_type') = 'device_lost'
       AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
      [organizationId, deviceId]
    );
    
    if (existing.length === 0) {
      // Get all super admins and owners for this organization
      const [admins] = await pool.execute(
        `SELECT id, email, first_name, last_name 
         FROM admins 
         WHERE organization_id = ? AND role_level IN (1, 2) AND is_active = 1`,
        [organizationId]
      );
      
      for (const admin of admins) {
        await this.createNotification({
          organization_id: organizationId,
          admin_id: admin.id,
          type: 'alert',
          priority: 'urgent',
          title: '⚠️ Device Possibly Lost',
          message: `Device "${deviceName}" (${deviceId}) has been inactive for over 7 days. Last seen ${wasOnline ? 'online' : 'offline'}. Please investigate.`,
          action_url: `/devices/${deviceId}`,
          action_text: 'View Device',
          data: JSON.stringify({
            device_id: deviceId,
            device_name: deviceName,
            alert_type: 'device_lost',
            was_online: wasOnline
          }),
          created_by: 1 // System admin
        });
        
        // Send email for critical alerts
        await this.sendEmail(admin.email, '⚠️ Device Lost Alert', 
          `Dear ${admin.first_name},\n\nDevice "${deviceName}" (${deviceId}) has been inactive for over 7 days and may be lost. Please investigate immediately.\n\nBest regards,\nCSMS Team`);
      }
    }
  }

  // Device reactivated notification
  static async deviceReactivated(organizationId, deviceName, deviceId) {
    const [admins] = await pool.execute(
      `SELECT id FROM admins WHERE organization_id = ? AND is_active = 1`,
      [organizationId]
    );
    
    for (const admin of admins) {
      await this.createNotification({
        organization_id: organizationId,
        admin_id: admin.id,
        type: 'device',
        priority: 'normal',
        title: '✅ Device Reactivated',
        message: `Device "${deviceName}" (${deviceId}) is active again after being inactive.`,
        action_url: `/devices/${deviceId}`,
        action_text: 'View Device',
        data: JSON.stringify({
          device_id: deviceId,
          device_name: deviceName,
          status: 'reactivated'
        }),
        created_by: 1
      });
    }
  }

  // Attendance event (late, early leave, absent)
  static async attendanceEvent(organizationId, userId, userName, status, minutes, deviceId) {
    await notifyAttendanceEvent(organizationId, userId, userName, status, minutes, deviceId);
  }

  // New user added
  static async userAdded(organizationId, userName, userRole, addedBy) {
    await notifyUserAdded(organizationId, userName, userRole, addedBy);
  }

  // Subscription event
  static async subscriptionEvent(organizationId, eventType, details) {
    await notifySubscriptionEvent(organizationId, eventType, details);
  }

  // Admin action
  static async adminAction(organizationId, action, adminName, targetType, targetName) {
    await notifyAdminAction(organizationId, action, adminName, targetType, targetName);
  }

  // Exchange rate alert notification
  static async exchangeRateAlert(rateChanges) {
    try {
      for (const change of rateChanges) {
        // Get all super admins and organization admins
        const [admins] = await pool.execute(`
          SELECT DISTINCT a.id, a.email, a.first_name, a.last_name, a.organization_id
          FROM admins a
          WHERE a.role_level IN (1, 2) AND a.is_active = 1
        `);
        
        const emoji = change.direction === 'up' ? '📈' : '📉';
        const trend = change.direction === 'up' ? 'increased' : 'decreased';
        
        const title = `${emoji} Significant Exchange Rate Change`;
        const message = `${change.currency_name} (${change.currency_code}) has ${trend} by ${change.percent_change}% against USD. New rate: ${change.new_rate.toFixed(4)} (was ${change.old_rate.toFixed(4)})`;
        
        for (const admin of admins) {
          await this.createNotification({
            organization_id: admin.organization_id,
            admin_id: admin.id,
            type: 'alert',
            priority: 'high',
            title: title,
            message: message,
            action_url: '/finance/currency-rates',
            action_text: 'View Rates',
            data: JSON.stringify({
              currency_code: change.currency_code,
              old_rate: change.old_rate,
              new_rate: change.new_rate,
              percent_change: change.percent_change,
              direction: change.direction
            }),
            created_by: 1 // System admin
          });
          
          // Also send email for critical changes (>5%)
          if (parseFloat(change.percent_change) > 5) {
            await this.sendEmail(admin.email, title, 
              `Dear ${admin.first_name},\n\n${message}\n\nThis may affect your subscription and payment amounts. Please review your financial settings.\n\nBest regards,\nCSMS Team`);
          }
        }
      }
    } catch (error) {
      console.error('[NOTIFICATION] Exchange rate alert error:', error);
    }
  }

  // New organization welcome notification
  static async welcomeNewOrganization(organizationId, adminId) {
    try {
      const [org] = await pool.execute(
        `SELECT org_name, subscription_status, trial_ends_at, type FROM organizations WHERE id = ?`,
        [organizationId]
      );
      
      const [admin] = await pool.execute(
        `SELECT first_name, last_name, email FROM admins WHERE id = ?`,
        [adminId]
      );
      
      if (org.length === 0 || admin.length === 0) return;
      
      const trialEndDate = new Date(org[0].trial_ends_at);
      const daysLeft = Math.ceil((trialEndDate - new Date()) / (1000 * 60 * 60 * 24));
      
      // Welcome notification for the admin
      await this.createNotification({
        organization_id: organizationId,
        admin_id: adminId,
        type: 'system',
        priority: 'high',
        title: '🎉 Welcome to CSMS!',
        message: `Welcome ${admin[0].first_name}! Your ${org[0].type} "${org[0].org_name}" has been successfully created. Your trial period ends on ${trialEndDate.toLocaleDateString()} (${daysLeft} days left).`,
        action_url: '/dashboard',
        action_text: 'Go to Dashboard',
        data: JSON.stringify({
          organization_id: organizationId,
          trial_days_left: daysLeft,
          organization_type: org[0].type
        }),
        created_by: 1
      });
      
      // Setup checklist notification
      await this.createNotification({
        organization_id: organizationId,
        admin_id: adminId,
        type: 'reminder',
        priority: 'normal',
        title: '✅ Setup Checklist',
        message: 'Complete these steps to get started:\n✓ Add your devices\n✓ Add users (students/employees)\n✓ Configure attendance schedules\n✓ Set up your subscription plan',
        action_url: '/getting-started',
        action_text: 'View Checklist',
        data: JSON.stringify({
          checklist_items: ['devices', 'users', 'schedules', 'subscription']
        }),
        created_by: 1
      });
      
      // Currency rates info
      const [currencies] = await pool.execute(
        `SELECT code, rate_to_usd FROM currencies WHERE code IN ('USD', 'EUR', 'GBP') ORDER BY code`
      );
      
      let currencyMessage = 'Your organization can operate in multiple currencies. Current exchange rates:\n';
      for (const curr of currencies) {
        currencyMessage += `• ${curr.code}: ${parseFloat(curr.rate_to_usd).toFixed(4)} USD\n`;
      }
      currencyMessage += '\nRates are updated automatically every 6 hours.';
      
      await this.createNotification({
        organization_id: organizationId,
        admin_id: adminId,
        type: 'system',
        priority: 'normal',
        title: '💱 Multi-Currency Support',
        message: currencyMessage,
        action_url: '/settings/currencies',
        action_text: 'View Currencies',
        data: JSON.stringify({
          currencies: currencies,
          update_frequency: '6 hours'
        }),
        created_by: 1
      });
      
      // Device setup reminder (if organization type is school/company)
      if (org[0].type === 'school' || org[0].type === 'company') {
        await this.createNotification({
          organization_id: organizationId,
          admin_id: adminId,
          type: 'reminder',
          priority: 'normal',
          title: '🔧 Device Setup Required',
          message: 'To start tracking attendance, you need to add and configure your IoT devices. Each device needs to be registered with its unique ID and assigned to a location.',
          action_url: '/devices/add',
          action_text: 'Add Device',
          data: JSON.stringify({
            device_setup_required: true
          }),
          created_by: 1
        });
      }
      
      console.log(`[NOTIFICATION] Welcome notifications sent to admin ${adminId} for org ${organizationId}`);
      
    } catch (error) {
      console.error('[NOTIFICATION] Welcome notification error:', error);
    }
  }

  // Helper method to create notification
  static async createNotification(data) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO notifications 
         (organization_id, admin_id, user_id, type, priority, title, message, 
          data, action_url, action_text, is_read, is_sent, sent_at, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, NOW(), ?, NOW())`,
        [
          data.organization_id,
          data.admin_id,
          data.user_id || null,
          data.type,
          data.priority,
          data.title,
          data.message,
          data.data || null,
          data.action_url || null,
          data.action_text || null,
          data.created_by
        ]
      );
      return { success: true, id: result.insertId };
    } catch (error) {
      console.error('[NOTIFICATION] Create error:', error);
      return { success: false, error: error.message };
    } finally {
      connection.release();
    }
  }

  // Send email notification
  static async sendEmail(to, subject, message) {
    try {
      // Implement your email sending logic here (Nodemailer, SendGrid, etc.)
      console.log(`[EMAIL] To: ${to}, Subject: ${subject}`);
      console.log(`[EMAIL] Message: ${message}`);
      
      // Example with nodemailer (commented out - configure with your email provider)
      /*
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      
      await transporter.sendMail({
        from: '"CSMS System" <noreply@csms.com>',
        to: to,
        subject: subject,
        text: message,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`
      });
      */
      
      return { success: true };
    } catch (error) {
      console.error('[EMAIL] Send error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send bulk notification to all admins in organization
  static async broadcastToOrganization(organizationId, type, priority, title, message, actionUrl, actionText, createdBy) {
    try {
      const [admins] = await pool.execute(
        `SELECT id FROM admins WHERE organization_id = ? AND is_active = 1`,
        [organizationId]
      );
      
      let createdCount = 0;
      for (const admin of admins) {
        await this.createNotification({
          organization_id: organizationId,
          admin_id: admin.id,
          type: type,
          priority: priority,
          title: title,
          message: message,
          action_url: actionUrl,
          action_text: actionText,
          created_by: createdBy
        });
        createdCount++;
      }
      
      console.log(`[BROADCAST] Sent "${title}" to ${createdCount} admins in org ${organizationId}`);
      return { success: true, count: createdCount };
      
    } catch (error) {
      console.error('[BROADCAST] Error:', error);
      return { success: false, error: error.message };
    }
  }

  // Check expiring subscriptions (run daily via cron)
  static async checkExpiringSubscriptions() {
    try {
      // Subscriptions expiring in 7 days
      const [expiringSoon] = await pool.execute(
        `SELECT o.id as organization_id, o.org_name, o.subscription_expires_at, s.plan_id, sp.name as plan_name
         FROM organizations o
         JOIN subscriptions s ON o.id = s.organization_id
         JOIN subscription_plans sp ON s.plan_id = sp.id
         WHERE o.subscription_status = 'active'
         AND o.subscription_expires_at IS NOT NULL
         AND DATE(o.subscription_expires_at) = DATE(DATE_ADD(NOW(), INTERVAL 7 DAY))`,
        []
      );

      for (const org of expiringSoon) {
        const days = Math.ceil((new Date(org.subscription_expires_at) - new Date()) / (1000 * 60 * 60 * 24));
        
        // Send to all admins in organization
        await this.broadcastToOrganization(
          org.organization_id,
          'subscription',
          'high',
          '⚠️ Subscription Expiring Soon',
          `Your ${org.plan_name} subscription will expire in ${days} days on ${new Date(org.subscription_expires_at).toLocaleDateString()}. Please renew to avoid service interruption.`,
          '/subscription/renew',
          'Renew Now',
          1
        );
      }

      // Subscriptions expired today
      const [expired] = await pool.execute(
        `SELECT o.id as organization_id, o.org_name, s.plan_id, sp.name as plan_name
         FROM organizations o
         JOIN subscriptions s ON o.id = s.organization_id
         JOIN subscription_plans sp ON s.plan_id = sp.id
         WHERE o.subscription_status = 'active'
         AND DATE(o.subscription_expires_at) = CURDATE()`,
        []
      );

      for (const org of expired) {
        await this.broadcastToOrganization(
          org.organization_id,
          'subscription',
          'urgent',
          '🚨 Subscription Expired',
          `Your ${org.plan_name} subscription has expired. Please renew immediately to continue using all features.`,
          '/subscription/renew',
          'Renew Now',
          1
        );
      }
      
      // Trial ending in 3 days
      const [trialEnding] = await pool.execute(
        `SELECT o.id as organization_id, o.org_name, o.trial_ends_at
         FROM organizations o
         WHERE o.subscription_status = 'trial'
         AND o.trial_ends_at IS NOT NULL
         AND DATE(o.trial_ends_at) = DATE(DATE_ADD(NOW(), INTERVAL 3 DAY))`,
        []
      );
      
      for (const org of trialEnding) {
        const days = Math.ceil((new Date(org.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
        await this.broadcastToOrganization(
          org.organization_id,
          'subscription',
          'high',
          '⚠️ Trial Ending Soon',
          `Your free trial will end in ${days} days on ${new Date(org.trial_ends_at).toLocaleDateString()}. Choose a subscription plan to continue using CSMS.`,
          '/subscription/plans',
          'View Plans',
          1
        );
      }
      
      console.log(`[CRON] Subscription check completed - Expiring: ${expiringSoon.length}, Expired: ${expired.length}, Trial ending: ${trialEnding.length}`);
      
    } catch (error) {
      console.error('Check expiring subscriptions error:', error);
    }
  }

  // Get unread notification count for admin
  static async getUnreadCount(adminId, organizationId) {
    try {
      const [result] = await pool.execute(
        `SELECT COUNT(*) as count FROM notifications 
         WHERE admin_id = ? AND organization_id = ? AND is_read = 0`,
        [adminId, organizationId]
      );
      return result[0].count;
    } catch (error) {
      console.error('[NOTIFICATION] Get unread count error:', error);
      return 0;
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId, adminId) {
    try {
      await pool.execute(
        `UPDATE notifications SET is_read = 1, read_at = NOW() 
         WHERE id = ? AND admin_id = ?`,
        [notificationId, adminId]
      );
      return { success: true };
    } catch (error) {
      console.error('[NOTIFICATION] Mark as read error:', error);
      return { success: false, error: error.message };
    }
  }

  // Mark all notifications as read for admin
  static async markAllAsRead(adminId, organizationId) {
    try {
      await pool.execute(
        `UPDATE notifications SET is_read = 1, read_at = NOW() 
         WHERE admin_id = ? AND organization_id = ? AND is_read = 0`,
        [adminId, organizationId]
      );
      return { success: true };
    } catch (error) {
      console.error('[NOTIFICATION] Mark all as read error:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete old notifications (run monthly)
  static async cleanupOldNotifications() {
    try {
      const [result] = await pool.execute(
        `DELETE FROM notifications 
         WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
         AND is_read = 1`,
        []
      );
      console.log(`[CLEANUP] Deleted ${result.affectedRows} old notifications`);
      return { success: true, deleted: result.affectedRows };
    } catch (error) {
      console.error('[CLEANUP] Error:', error);
      return { success: false, error: error.message };
    }
  }
}

export default NotificationService;