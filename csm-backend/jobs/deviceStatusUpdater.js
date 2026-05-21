// csms-backend/jobs/deviceStatusUpdater.js
// Complete device status updater with notification service integration

import pool from '../config/database.js';
import NotificationService from '../services/notificationService.js';

// Track previous device statuses for change detection
let deviceStatusCache = new Map();

// Run this function every hour to update device statuses based on attendance
export const updateAllDeviceStatuses = async () => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get all devices with their last attendance and current status
    const [devices] = await connection.execute(`
      SELECT 
        d.id,
        d.device_name,
        d.unique_device_id,
        d.organization_id,
        d.status as current_status,
        d.is_online,
        d.last_seen,
        MAX(a.timestamp) as last_attendance_time
      FROM devices d
      LEFT JOIN attendance a ON d.id = a.device_id
      WHERE d.organization_id IS NOT NULL
      GROUP BY d.id
    `);
    
    const now = new Date();
    let updatedCount = 0;
    let statusChanges = [];
    
    for (const device of devices) {
      let newStatus = device.current_status;
      let newIsOnline = device.is_online;
      
      const lastActivityTime = device.last_attendance_time 
        ? new Date(device.last_attendance_time)
        : (device.last_seen ? new Date(device.last_seen) : null);
      
      // Calculate status based on last activity
      if (!lastActivityTime) {
        newStatus = 'inactive';
        newIsOnline = 0;
      } else {
        const hoursSinceLastActivity = (now.getTime() - lastActivityTime.getTime()) / (1000 * 60 * 60);
        const daysSinceLastActivity = hoursSinceLastActivity / 24;
        
        // Online status (heartbeat within 5 minutes)
        newIsOnline = hoursSinceLastActivity <= 0.083 ? 1 : 0; // 5 minutes = 0.083 hours
        
        // Device status based on activity
        if (hoursSinceLastActivity < 12) {
          newStatus = 'active';
        } else if (hoursSinceLastActivity >= 12 && hoursSinceLastActivity < 24) {
          newStatus = 'inactive';
        } else if (daysSinceLastActivity >= 7) {
          newStatus = 'lost';
        } else {
          newStatus = 'inactive';
        }
      }
      
      // Check for status changes
      const statusChanged = newStatus !== device.current_status;
      const onlineChanged = newIsOnline !== device.is_online;
      
      if (statusChanged || onlineChanged) {
        // Update devices table
        await connection.execute(
          `UPDATE devices 
           SET status = ?, is_online = ?, updated_at = NOW() 
           WHERE id = ?`,
          [newStatus, newIsOnline, device.id]
        );
        
        // Calculate duration since last status change
        let duration = 0;
        const [lastHistory] = await connection.execute(
          `SELECT changed_at FROM device_status_history 
           WHERE device_id = ? ORDER BY changed_at DESC LIMIT 1`,
          [device.id]
        );
        
        if (lastHistory.length > 0) {
          const lastChangeTime = new Date(lastHistory[0].changed_at);
          duration = Math.floor((now.getTime() - lastChangeTime.getTime()) / 1000);
        }
        
        // Add to status history
        await connection.execute(
          `INSERT INTO device_status_history 
           (device_id, status, is_online, changed_at, duration, notes)
           VALUES (?, ?, ?, NOW(), ?, ?)`,
          [
            device.id, 
            newStatus === 'active' ? 1 : 0, 
            newIsOnline, 
            duration,
            `Auto-updated by scheduled job - Status: ${device.current_status} → ${newStatus}, Online: ${device.is_online} → ${newIsOnline}`
          ]
        );
        
        updatedCount++;
        statusChanges.push({
          device_id: device.id,
          device_name: device.device_name,
          organization_id: device.organization_id,
          unique_device_id: device.unique_device_id,
          old_status: device.current_status,
          new_status: newStatus,
          old_online: device.is_online,
          new_online: newIsOnline
        });
        
        console.log(`[JOB] Device ${device.device_name} (${device.id}): ${device.current_status} → ${newStatus}, Online: ${device.is_online} → ${newIsOnline}`);
      }
    }
    
    await connection.commit();
    
    // Send notifications for status changes (outside transaction)
    for (const change of statusChanges) {
      // Notify for online/offline changes
      if (change.old_online !== change.new_online) {
        await NotificationService.deviceStatusChange(
          change.organization_id,
          change.device_name,
          change.unique_device_id,
          change.new_online === 1
        );
      }
      
      // Notify for critical status changes (lost devices)
      if (change.old_status !== 'lost' && change.new_status === 'lost') {
        await NotificationService.deviceLost(
          change.organization_id,
          change.device_name,
          change.unique_device_id,
          change.new_online === 1
        );
      }
      
      // Notify for device coming back active
      if (change.old_status !== 'active' && change.new_status === 'active') {
        await NotificationService.deviceReactivated(
          change.organization_id,
          change.device_name,
          change.unique_device_id
        );
      }
    }
    
    console.log(`[JOB] Device status update completed. Updated ${updatedCount} devices.`);
    return { success: true, updatedCount, statusChanges };
    
  } catch (error) {
    await connection.rollback();
    console.error('[JOB] Device status update error:', error);
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
};

// Update single device status (called from device heartbeat)
export const updateDeviceHeartbeat = async (deviceId, additionalData = {}) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get current device state
    const [devices] = await connection.execute(
      `SELECT id, device_name, unique_device_id, organization_id, 
              status as current_status, is_online as was_online, last_seen
       FROM devices 
       WHERE id = ?`,
      [deviceId]
    );
    
    if (devices.length === 0) {
      await connection.rollback();
      return { success: false, error: 'Device not found' };
    }
    
    const device = devices[0];
    const now = new Date();
    const wasOnline = device.was_online;
    const isNowOnline = 1; // Heartbeat means device is online
    
    // Update last_seen and is_online
    await connection.execute(
      `UPDATE devices 
       SET last_seen = NOW(), is_online = ?, updated_at = NOW()
       WHERE id = ?`,
      [isNowOnline, deviceId]
    );
    
    // Add status history entry for online status
    const [lastHistory] = await connection.execute(
      `SELECT changed_at, status FROM device_status_history 
       WHERE device_id = ? ORDER BY changed_at DESC LIMIT 1`,
      [deviceId]
    );
    
    if (lastHistory.length > 0 && lastHistory[0].status === 0) {
      // Device was offline, now online - record status change
      let duration = Math.floor((now.getTime() - new Date(lastHistory[0].changed_at).getTime()) / 1000);
      
      await connection.execute(
        `INSERT INTO device_status_history 
         (device_id, status, is_online, changed_at, duration, notes)
         VALUES (?, 1, 1, NOW(), ?, 'Heartbeat received - Device came online')`,
        [deviceId, duration]
      );
    } else {
      // Just update last_seen without new status history entry
      await connection.execute(
        `INSERT INTO device_status_history 
         (device_id, status, is_online, changed_at, duration, notes)
         VALUES (?, 1, 1, NOW(), 0, 'Heartbeat received')`,
        [deviceId]
      );
    }
    
    // Update location if provided
    if (additionalData.latitude && additionalData.longitude) {
      await connection.execute(
        `INSERT INTO device_locations (device_id, latitude, longitude, recorded_at) 
         VALUES (?, ?, ?, NOW())`,
        [deviceId, additionalData.latitude, additionalData.longitude]
      );
    }
    
    // Update firmware version if provided
    if (additionalData.firmware_version) {
      await connection.execute(
        `UPDATE devices SET firmware_version = ? WHERE id = ?`,
        [additionalData.firmware_version, deviceId]
      );
    }
    
    // Update battery level if provided
    if (additionalData.battery_level !== undefined) {
      await connection.execute(
        `UPDATE devices SET battery_level = ? WHERE id = ?`,
        [additionalData.battery_level, deviceId]
      );
    }
    
    // Update signal strength if provided
    if (additionalData.signal_strength !== undefined) {
      await connection.execute(
        `UPDATE devices SET signal_strength = ? WHERE id = ?`,
        [additionalData.signal_strength, deviceId]
      );
    }
    
    await connection.commit();
    
    // Send notification for status change (offline → online)
    if (wasOnline === 0) {
      await NotificationService.deviceStatusChange(
        device.organization_id,
        device.device_name,
        device.unique_device_id,
        true
      );
    }
    
    console.log(`[HEARTBEAT] Device ${device.device_name} (${deviceId}): Heartbeat received, online status updated`);
    
    return { 
      success: true, 
      message: 'Heartbeat recorded',
      data: {
        device_id: deviceId,
        device_name: device.device_name,
        was_online: wasOnline,
        is_online: isNowOnline
      }
    };
    
  } catch (error) {
    await connection.rollback();
    console.error('[HEARTBEAT] Error:', error);
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
};

// Check for devices that haven't sent heartbeat in a while
export const checkStaleDevices = async () => {
  const connection = await pool.getConnection();
  
  try {
    const [staleDevices] = await connection.execute(`
      SELECT d.id, d.device_name, d.unique_device_id, d.organization_id, 
             d.status, d.is_online, d.last_seen,
             TIMESTAMPDIFF(MINUTE, d.last_seen, NOW()) as minutes_since_last_seen
      FROM devices d
      WHERE d.is_online = 1 
        AND d.last_seen IS NOT NULL
        AND d.last_seen < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
    `);
    
    let updatedCount = 0;
    
    for (const device of staleDevices) {
      await connection.execute(
        `UPDATE devices SET is_online = 0, updated_at = NOW() WHERE id = ?`,
        [device.id]
      );
      
      const [lastHistory] = await connection.execute(
        `SELECT changed_at FROM device_status_history 
         WHERE device_id = ? ORDER BY changed_at DESC LIMIT 1`,
        [device.id]
      );
      
      let duration = 0;
      if (lastHistory.length > 0) {
        const lastChangeTime = new Date(lastHistory[0].changed_at);
        duration = Math.floor((new Date().getTime() - lastChangeTime.getTime()) / 1000);
      }
      
      await connection.execute(
        `INSERT INTO device_status_history 
         (device_id, status, is_online, changed_at, duration, notes)
         VALUES (?, 0, 0, NOW(), ?, 'No heartbeat for ${device.minutes_since_last_seen} minutes')`,
        [device.id, duration]
      );
      
      updatedCount++;
      
      // Send offline notification
      await NotificationService.deviceStatusChange(
        device.organization_id,
        device.device_name,
        device.unique_device_id,
        false
      );
      
      console.log(`[STALE] Device ${device.device_name} (${device.id}): Marked offline - no heartbeat for ${device.minutes_since_last_seen} minutes`);
    }
    
    if (updatedCount > 0) {
      console.log(`[STALE] Marked ${updatedCount} stale devices as offline`);
    }
    
    return { success: true, updatedCount, staleCount: staleDevices.length };
    
  } catch (error) {
    console.error('[STALE] Error checking stale devices:', error);
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
};

// Get device status statistics
export const getDeviceStatusStats = async (organizationId = null) => {
  try {
    let query = `
      SELECT 
        COUNT(*) as total_devices,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_devices,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_devices,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost_devices,
        SUM(CASE WHEN is_online = 1 THEN 1 ELSE 0 END) as online_devices,
        SUM(CASE WHEN is_online = 0 THEN 1 ELSE 0 END) as offline_devices,
        AVG(CASE WHEN battery_level IS NOT NULL THEN battery_level ELSE NULL END) as avg_battery_level
      FROM devices
    `;
    
    const params = [];
    if (organizationId) {
      query += ` WHERE organization_id = ?`;
      params.push(organizationId);
    }
    
    const [stats] = await pool.execute(query, params);
    
    return { success: true, data: stats[0] };
    
  } catch (error) {
    console.error('[STATS] Error getting device stats:', error);
    return { success: false, error: error.message };
  }
};

// Initialize device status cache
export const initDeviceStatusCache = async () => {
  try {
    const [devices] = await pool.execute(
      `SELECT id, status, is_online FROM devices WHERE organization_id IS NOT NULL`
    );
    
    for (const device of devices) {
      deviceStatusCache.set(device.id, {
        status: device.status,
        is_online: device.is_online,
        last_check: new Date()
      });
    }
    
    console.log(`[CACHE] Initialized device status cache with ${deviceStatusCache.size} devices`);
    return { success: true, count: deviceStatusCache.size };
    
  } catch (error) {
    console.error('[CACHE] Error initializing device status cache:', error);
    return { success: false, error: error.message };
  }
};

// Get cached device status
export const getCachedDeviceStatus = (deviceId) => {
  return deviceStatusCache.get(deviceId) || null;
};

// Update cached device status
export const updateCachedDeviceStatus = (deviceId, status, isOnline) => {
  deviceStatusCache.set(deviceId, {
    status,
    is_online: isOnline,
    last_check: new Date()
  });
};

// Schedule all jobs
export const startDeviceStatusScheduler = () => {
  // Run every 5 minutes to check for stale devices (offline detection)
  setInterval(async () => {
    console.log('[SCHEDULER] Running stale device check...');
    await checkStaleDevices();
  }, 5 * 60 * 1000); // 5 minutes
  
  // Run every hour for full status update
  setInterval(async () => {
    console.log('[SCHEDULER] Running full device status update job...');
    await updateAllDeviceStatuses();
  }, 60 * 60 * 1000); // 1 hour
  
  // Run every 15 minutes for stats logging (optional)
  setInterval(async () => {
    const stats = await getDeviceStatusStats();
    if (stats.success && stats.data) {
      console.log(`[STATS] Device Status Summary:`, stats.data);
    }
  }, 15 * 60 * 1000); // 15 minutes
  
  console.log('[SCHEDULER] Device status updater scheduled:');
  console.log('  - Stale device check: every 5 minutes');
  console.log('  - Full status update: every hour');
  console.log('  - Stats logging: every 15 minutes');
};

// Export all functions
export default {
  updateAllDeviceStatuses,
  updateDeviceHeartbeat,
  checkStaleDevices,
  getDeviceStatusStats,
  initDeviceStatusCache,
  getCachedDeviceStatus,
  updateCachedDeviceStatus,
  startDeviceStatusScheduler
};
// // csms-backend/jobs/deviceStatusUpdater.js
// // Add this file for periodic status updates

// import pool from '../config/database.js';

// // Run this function every hour to update device statuses based on attendance
// export const updateAllDeviceStatuses = async () => {
//   const connection = await pool.getConnection();
  
//   try {
//     await connection.beginTransaction();
    
//     // Get all devices with their last attendance
//     const [devices] = await connection.execute(`
//       SELECT 
//         d.id,
//         d.status as current_status,
//         MAX(a.timestamp) as last_attendance_time,
//         d.last_seen
//       FROM devices d
//       LEFT JOIN attendance a ON d.id = a.device_id
//       WHERE d.organization_id IS NOT NULL
//       GROUP BY d.id
//     `);
    
//     const now = new Date();
//     let updatedCount = 0;
    
//     for (const device of devices) {
//       let newStatus = device.current_status;
//       const lastActivityTime = device.last_attendance_time 
//         ? new Date(device.last_attendance_time)
//         : (device.last_seen ? new Date(device.last_seen) : null);
      
//       if (!lastActivityTime) {
//         newStatus = 'inactive';
//       } else {
//         const hoursSinceLastActivity = (now.getTime() - lastActivityTime.getTime()) / (1000 * 60 * 60);
//         const daysSinceLastActivity = hoursSinceLastActivity / 24;
        
//         if (hoursSinceLastActivity < 12) {
//           newStatus = 'active';
//         } else if (hoursSinceLastActivity >= 12 && hoursSinceLastActivity < 24) {
//           newStatus = 'inactive';
//         } else if (daysSinceLastActivity >= 7) {
//           newStatus = 'lost';
//         } else {
//           newStatus = 'inactive';
//         }
//       }
      
//       if (newStatus !== device.current_status) {
//         await connection.execute(
//           `UPDATE devices SET status = ?, updated_at = NOW() WHERE id = ?`,
//           [newStatus, device.id]
//         );
        
//         await connection.execute(
//           `INSERT INTO device_status_history (device_id, status, is_online, changed_at, duration, notes)
//            VALUES (?, ?, 0, NOW(), 0, 'Auto-updated by scheduled job')`,
//           [device.id, newStatus === 'active' ? 1 : 0]
//         );
        
//         updatedCount++;
//         console.log(`[JOB] Device ${device.id} status updated from ${device.current_status} to ${newStatus}`);
//       }
//     }
    
//     await connection.commit();
//     console.log(`[JOB] Device status update completed. Updated ${updatedCount} devices.`);
//     return { success: true, updatedCount };
    
//   } catch (error) {
//     await connection.rollback();
//     console.error('[JOB] Device status update error:', error);
//     return { success: false, error: error.message };
//   } finally {
//     connection.release();
//   }
// };

// // Schedule the job to run every hour
// export const startDeviceStatusScheduler = () => {
//   // Run every hour (3600000 ms)
//   setInterval(async () => {
//     console.log('[SCHEDULER] Running device status update job...');
//     await updateAllDeviceStatuses();
//   }, 60 * 60 * 1000);
  
//   console.log('[SCHEDULER] Device status updater scheduled (every hour)');
// };