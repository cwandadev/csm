// csms-backend/controllers/deviceController.js

import pool from '../config/database.js';

// Get all devices for organization
export const getDevices = async (req, res) => {
  const { org_id, status } = req.query;
  const organizationId = org_id || req.organizationId;
  
  try {
    let query = `
      SELECT d.*, 
             a.first_name as added_by_name, 
             a.last_name as added_by_last,
             (SELECT ssid FROM wifi_credentials w WHERE w.device_id = d.id ORDER BY w.created_at DESC LIMIT 1) as current_ssid
      FROM devices d
      LEFT JOIN admins a ON d.added_by = a.id
      WHERE d.organization_id = ?
    `;
    const params = [organizationId];
    
    if (status) {
      query += ' AND d.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY d.added_at DESC';
    
    const [devices] = await pool.execute(query, params);
    
    // Calculate online status based on last_seen for each device
    const devicesWithOnlineStatus = devices.map(device => {
      let isOnline = 0;
      if (device.last_seen) {
        const lastSeenDate = new Date(device.last_seen);
        const now = new Date();
        const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
        isOnline = diffMinutes <= 5 ? 1 : 0;
      }
      
      return {
        ...device,
        is_online: isOnline
      };
    });
    
    res.json({ success: true, data: devicesWithOnlineStatus });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ success: false, error: 'Failed to get devices' });
  }
};

// Get single device with full details
export const getDeviceById = async (req, res) => {
  const { deviceId } = req.params;
  
  try {
    // Get device basic info
    const [devices] = await pool.execute(
      `SELECT d.*, 
              a.first_name as added_by_name, 
              a.last_name as added_by_last
       FROM devices d
       LEFT JOIN admins a ON d.added_by = a.id
       WHERE d.id = ? AND d.organization_id = ?`,
      [deviceId, req.organizationId]
    );
    
    if (devices.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    const device = devices[0];
    
    // Calculate online status
    let isOnline = 0;
    if (device.last_seen) {
      const lastSeenDate = new Date(device.last_seen);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
      isOnline = diffMinutes <= 5 ? 1 : 0;
    }
    
    // Get device status history
    const [statusHistory] = await pool.execute(
      `SELECT * FROM device_status_history 
       WHERE device_id = ? 
       ORDER BY changed_at DESC LIMIT 20`,
      [deviceId]
    );
    
    // Get recent locations
    const [locations] = await pool.execute(
      `SELECT * FROM device_locations 
       WHERE device_id = ? 
       ORDER BY recorded_at DESC LIMIT 10`,
      [deviceId]
    );
    
    // Get WiFi credentials
    const [wifiCredentials] = await pool.execute(
      `SELECT ssid, api, updated_at FROM wifi_credentials WHERE device_id = ? ORDER BY created_at DESC LIMIT 1`,
      [deviceId]
    );
    
    // Get attendance statistics for this device
    const [attendanceStats] = await pool.execute(
      `SELECT 
        COUNT(*) as total,
        MAX(timestamp) as last_attendance
       FROM attendance 
       WHERE device_id = ?`,
      [deviceId]
    );
    
    res.json({ 
      success: true, 
      data: { 
        ...device,
        is_online: isOnline,
        statusHistory,
        locations,
        wifiCredentials: wifiCredentials[0] || null,
        attendance_stats: attendanceStats[0] || { total: 0, last_attendance: null }
      }
    });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ success: false, error: 'Failed to get device' });
  }
};

// Add new device
export const addDevice = async (req, res) => {
  const { device_name, unique_device_id, device_type, device_image, location } = req.body;
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Check if device ID already exists
    const [existing] = await connection.execute(
      'SELECT id FROM devices WHERE unique_device_id = ?',
      [unique_device_id]
    );
    
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Device ID already registered' });
    }
    
    // Add device
    const [result] = await connection.execute(
      `INSERT INTO devices (
        organization_id, device_name, unique_device_id, device_type, 
        device_image, added_by, status, added_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [req.organizationId, device_name, unique_device_id, device_type, 
       device_image || null, req.adminId]
    );
    
    // Add initial device status history
    await connection.execute(
      `INSERT INTO device_status_history (device_id, status, is_online, changed_at, duration) 
       VALUES (?, 1, 1, NOW(), 0)`,
      [result.insertId]
    );
    
    // Add initial location if provided
    if (location && location.latitude && location.longitude) {
      await connection.execute(
        `INSERT INTO device_locations (device_id, latitude, longitude, recorded_at) 
         VALUES (?, ?, ?, NOW())`,
        [result.insertId, location.latitude, location.longitude]
      );
    }
    
    await connection.commit();
    
    res.json({ 
      success: true, 
      data: { id: result.insertId },
      message: 'Device added successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Add device error:', error);
    res.status(500).json({ success: false, error: 'Failed to add device' });
  } finally {
    connection.release();
  }
};

// Update device
export const updateDevice = async (req, res) => {
  const { deviceId } = req.params;
  const { device_name, device_image, status } = req.body;
  
  try {
    const [result] = await pool.execute(
      `UPDATE devices 
       SET device_name = ?, device_image = ?, status = ?, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [device_name, device_image || null, status, deviceId, req.organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    // Add status change to history
    const statusValue = status === 'active' ? 1 : 0;
    await pool.execute(
      `INSERT INTO device_status_history (device_id, status, is_online, changed_at, duration) 
       VALUES (?, ?, ?, NOW(), 0)`,
      [deviceId, statusValue, status === 'active' ? 1 : 0]
    );
    
    res.json({ success: true, message: 'Device updated successfully' });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ success: false, error: 'Failed to update device' });
  }
};

// Delete device
export const deleteDevice = async (req, res) => {
  const { deviceId } = req.params;
  
  try {
    // Check if device has attendance records
    const [attendance] = await pool.execute(
      'SELECT id FROM attendance WHERE device_id = ? LIMIT 1',
      [deviceId]
    );
    
    if (attendance.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete device with existing attendance records. Consider marking as inactive instead.' 
      });
    }
    
    const [result] = await pool.execute(
      'DELETE FROM devices WHERE id = ? AND organization_id = ?',
      [deviceId, req.organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete device' });
  }
};

// Update device status (heartbeat from ESP32)
export const updateDeviceStatus = async (req, res) => {
  const { deviceId } = req.params;
  const { status, is_online, latitude, longitude } = req.body;
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get previous status to calculate duration
    const [prevStatus] = await connection.execute(
      `SELECT status, changed_at FROM device_status_history 
       WHERE device_id = ? ORDER BY changed_at DESC LIMIT 1`,
      [deviceId]
    );
    
    let duration = 0;
    if (prevStatus.length > 0) {
      const prevTime = new Date(prevStatus[0].changed_at);
      const now = new Date();
      duration = Math.floor((now.getTime() - prevTime.getTime()) / 1000);
    }
    
    // Insert new device status history
    await connection.execute(
      `INSERT INTO device_status_history (device_id, status, is_online, changed_at, duration) 
       VALUES (?, ?, ?, NOW(), ?)`,
      [deviceId, status, is_online, duration]
    );
    
    // Update last_seen in devices table
    await connection.execute(
      'UPDATE devices SET last_seen = NOW(), updated_at = NOW() WHERE id = ?',
      [deviceId]
    );
    
    // Update location if provided
    if (latitude && longitude) {
      await connection.execute(
        `INSERT INTO device_locations (device_id, latitude, longitude, recorded_at) 
         VALUES (?, ?, ?, NOW())`,
        [deviceId, latitude, longitude]
      );
    }
    
    await connection.commit();
    
    res.json({ success: true, message: 'Device status updated' });
  } catch (error) {
    await connection.rollback();
    console.error('Update device status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update device status' });
  } finally {
    connection.release();
  }
};

// Get device status history
export const getDeviceStatusHistory = async (req, res) => {
  const { deviceId } = req.params;
  const { limit = 50 } = req.query;
  
  try {
    const [history] = await pool.execute(
      `SELECT * FROM device_status_history 
       WHERE device_id = ? 
       ORDER BY changed_at DESC 
       LIMIT ?`,
      [deviceId, parseInt(limit)]
    );
    
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Get device status history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get status history' });
  }
};

// Get device location history
export const getDeviceLocations = async (req, res) => {
  const { deviceId } = req.params;
  const { limit = 50 } = req.query;
  
  try {
    const [locations] = await pool.execute(
      `SELECT * FROM device_locations 
       WHERE device_id = ? 
       ORDER BY recorded_at DESC 
       LIMIT ?`,
      [deviceId, parseInt(limit)]
    );
    
    res.json({ success: true, data: locations });
  } catch (error) {
    console.error('Get device locations error:', error);
    res.status(500).json({ success: false, error: 'Failed to get locations' });
  }
};

// Record device location
export const recordDeviceLocation = async (req, res) => {
  const { deviceId } = req.params;
  const { latitude, longitude } = req.body;
  
  try {
    await pool.execute(
      `INSERT INTO device_locations (device_id, latitude, longitude, recorded_at) 
       VALUES (?, ?, ?, NOW())`,
      [deviceId, latitude, longitude]
    );
    
    res.json({ success: true, message: 'Location recorded' });
  } catch (error) {
    console.error('Record location error:', error);
    res.status(500).json({ success: false, error: 'Failed to record location' });
  }
};

// Update WiFi credentials
export const updateWifiCredentials = async (req, res) => {
  const { deviceId } = req.params;
  const { ssid, password, api } = req.body;
  
  if (!ssid || !password) {
    return res.status(400).json({ success: false, error: 'SSID and password required' });
  }
  
  try {
    // Get device name
    const [device] = await pool.execute(
      'SELECT device_name FROM devices WHERE id = ? AND organization_id = ?',
      [deviceId, req.organizationId]
    );
    
    if (device.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    // Check if credentials already exist
    const [existing] = await pool.execute(
      'SELECT id FROM wifi_credentials WHERE device_id = ?',
      [deviceId]
    );
    
    if (existing.length > 0) {
      await pool.execute(
        `UPDATE wifi_credentials 
         SET ssid = ?, password = ?, api = ?, updated_at = NOW()
         WHERE device_id = ?`,
        [ssid, password, api || null, deviceId]
      );
    } else {
      await pool.execute(
        `INSERT INTO wifi_credentials (admin_id, device_id, organization_id, device_name, ssid, password, api, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [req.adminId, deviceId, req.organizationId, device[0].device_name, ssid, password, api || null]
      );
    }
    
    res.json({ success: true, message: 'WiFi credentials updated successfully' });
  } catch (error) {
    console.error('Update WiFi error:', error);
    res.status(500).json({ success: false, error: 'Failed to update WiFi credentials' });
  }
};

// Get WiFi credentials for a device
export const getWifiCredentials = async (req, res) => {
  const { deviceId } = req.params;
  
  try {
    const [credentials] = await pool.execute(
      `SELECT ssid, api, updated_at FROM wifi_credentials WHERE device_id = ? AND organization_id = ? ORDER BY created_at DESC LIMIT 1`,
      [deviceId, req.organizationId]
    );
    
    res.json({ success: true, data: credentials[0] || null });
  } catch (error) {
    console.error('Get WiFi credentials error:', error);
    res.status(500).json({ success: false, error: 'Failed to get WiFi credentials' });
  }
};

// Get device statistics
export const getDeviceStats = async (req, res) => {
  const organizationId = req.organizationId;
  
  try {
    // Get basic stats
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost
       FROM devices d
       WHERE d.organization_id = ?`,
      [organizationId]
    );
    
    // Calculate online count based on last_seen (within 5 minutes)
    const [onlineCount] = await pool.execute(
      `SELECT COUNT(*) as online
       FROM devices 
       WHERE organization_id = ? 
       AND last_seen IS NOT NULL 
       AND last_seen > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
      [organizationId]
    );
    
    // Get device types distribution
    const [typeDistribution] = await pool.execute(
      `SELECT device_type, COUNT(*) as count 
       FROM devices 
       WHERE organization_id = ? 
       GROUP BY device_type`,
      [organizationId]
    );
    
    res.json({ 
      success: true, 
      data: {
        total: stats[0]?.total || 0,
        active: stats[0]?.active || 0,
        inactive: stats[0]?.inactive || 0,
        lost: stats[0]?.lost || 0,
        online: onlineCount[0]?.online || 0,
        typeDistribution: typeDistribution || []
      }
    });
  } catch (error) {
    console.error('Get device stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get device statistics' });
  }
};