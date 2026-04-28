// csms-backend/jobs/deviceStatusUpdater.js
// Add this file for periodic status updates

import pool from '../config/database.js';

// Run this function every hour to update device statuses based on attendance
export const updateAllDeviceStatuses = async () => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get all devices with their last attendance
    const [devices] = await connection.execute(`
      SELECT 
        d.id,
        d.status as current_status,
        MAX(a.timestamp) as last_attendance_time,
        d.last_seen
      FROM devices d
      LEFT JOIN attendance a ON d.id = a.device_id
      WHERE d.organization_id IS NOT NULL
      GROUP BY d.id
    `);
    
    const now = new Date();
    let updatedCount = 0;
    
    for (const device of devices) {
      let newStatus = device.current_status;
      const lastActivityTime = device.last_attendance_time 
        ? new Date(device.last_attendance_time)
        : (device.last_seen ? new Date(device.last_seen) : null);
      
      if (!lastActivityTime) {
        newStatus = 'inactive';
      } else {
        const hoursSinceLastActivity = (now.getTime() - lastActivityTime.getTime()) / (1000 * 60 * 60);
        const daysSinceLastActivity = hoursSinceLastActivity / 24;
        
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
      
      if (newStatus !== device.current_status) {
        await connection.execute(
          `UPDATE devices SET status = ?, updated_at = NOW() WHERE id = ?`,
          [newStatus, device.id]
        );
        
        await connection.execute(
          `INSERT INTO device_status_history (device_id, status, is_online, changed_at, duration, notes)
           VALUES (?, ?, 0, NOW(), 0, 'Auto-updated by scheduled job')`,
          [device.id, newStatus === 'active' ? 1 : 0]
        );
        
        updatedCount++;
        console.log(`[JOB] Device ${device.id} status updated from ${device.current_status} to ${newStatus}`);
      }
    }
    
    await connection.commit();
    console.log(`[JOB] Device status update completed. Updated ${updatedCount} devices.`);
    return { success: true, updatedCount };
    
  } catch (error) {
    await connection.rollback();
    console.error('[JOB] Device status update error:', error);
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
};

// Schedule the job to run every hour
export const startDeviceStatusScheduler = () => {
  // Run every hour (3600000 ms)
  setInterval(async () => {
    console.log('[SCHEDULER] Running device status update job...');
    await updateAllDeviceStatuses();
  }, 60 * 60 * 1000);
  
  console.log('[SCHEDULER] Device status updater scheduled (every hour)');
};