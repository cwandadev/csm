// csms-backend/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Add to server.js imports
import authRoutes from './routes/authRoutes.js';
import stripeRoutes from './routes/stripeRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import userRoutes from './routes/userRoutes.js';
import pool from './config/database.js';
import reportRoutes from './routes/reportRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import organizeRoutes from './routes/organizeRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import { authenticateToken, requireOrganization } from './middleware/auth.js';
import { startDeviceStatusScheduler } from './jobs/deviceStatusUpdater.js';
import hardwareRoutes from './routes/hardwareRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

import paymentRoutes from './routes/paymentRoutes.js';


import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';


dotenv.config();


const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Configure multer for file uploads (this is around line 600-650)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public/uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'admin-' + uniqueSuffix + ext);
  }
});

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Middleware
// app.use(cors({
//   origin: [`${frontendUrl}`,'http://localhost:8080', 'http://localhost:5173', 'http://127.0.0.1:8080', 'http://localhost:3000'],
//   credentials: true
// }));
app.use(cors({
  origin: ['https://csm.cwanda.site', 'https://api.cwanda.site'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const db = pool;
app.post('/webhook/stripe', webhookRoutes);


// Test database connection
pool.getConnection()
  .then(connection => {
    console.log('✅ Database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
  });

// ============ ROUTES ============
// Add after other route declarations
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/hardware', hardwareRoutes);
app.use('/api/organize', organizeRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/webhook', webhookRoutes);
app.use('/api/notifications', notificationRoutes);

app.use('/api/payment', paymentRoutes);


// app.use('/api/subscription', subscriptionRoutes);

// ============ USER ENDPOINTS ============
app.get('/api/users', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT id, first_name, last_name, email, phone, role, image, is_active, created_at FROM users WHERE organization_id = ?',
      [req.organizationId]
    );
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('[Webhook] Received webhook request');
  
  try {
    // Import and call your webhook handler
    const { handleStripeWebhook } = await import('./controllers/paymentController.js');
    await handleStripeWebhook(req, res);
  } catch (error) {
    console.error('[Webhook] Error:', error);
    res.status(500).json({ received: true, error: error.message });
  }
});

app.post('/api/users', authenticateToken, requireOrganization, async (req, res) => {
  const { firstName, lastName, email, phone, role, addedBy } = req.body;
  
  try {
    const [result] = await db.execute(
      `INSERT INTO users (first_name, last_name, email, phone, role, organization_id, added_by, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [firstName, lastName, email || null, phone || null, role, req.organizationId, addedBy || req.adminId]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.put('/api/users/:userId', authenticateToken, requireOrganization, async (req, res) => {
  const { userId } = req.params;
  const { firstName, lastName, email, phone, is_active } = req.body;
  
  try {
    await db.execute(
      'UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, is_active = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?',
      [firstName, lastName, email || null, phone || null, is_active ? 1 : 0, userId, req.organizationId]
    );
    
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.delete('/api/users/:userId', authenticateToken, requireOrganization, async (req, res) => {
  const { userId } = req.params;
  
  try {
    await db.execute('DELETE FROM users WHERE id = ? AND organization_id = ?', [userId, req.organizationId]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Backend endpoint - removes organization filter
app.get('/api/admins/public', authenticateToken, async (req, res) => {
  try {
    const [admins] = await db.execute(
      `SELECT a.id, a.first_name, a.last_name, a.email, a.username, a.profile, 
              a.is_public, a.bio, a.location, a.website, a.twitter, a.facebook, 
              a.instagram, a.linkedin, a.created_at, a.organization_id,
              o.org_name as organization_name, o.type as organization_type
       FROM admins a
       LEFT JOIN organizations o ON a.organization_id = o.id
       WHERE a.is_public = 1 AND a.is_active = 1
       ORDER BY a.created_at DESC`,
      []
    );
    res.json({ success: true, data: admins });
  } catch (error) {
    console.error('Get public admins error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});



// ============ DEVICE ENDPOINTS ============
app.get('/api/devices', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const [devices] = await db.execute(
      'SELECT * FROM devices WHERE organization_id = ? ORDER BY added_at DESC',
      [req.organizationId]
    );
    res.json({ success: true, data: devices });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/devices', authenticateToken, requireOrganization, async (req, res) => {
  const { device_name, unique_device_id, device_type, added_by } = req.body;
  
  try {
    const [existing] = await db.execute('SELECT id FROM devices WHERE unique_device_id = ?', [unique_device_id]);
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Device already registered' });
    }
    
    const now = new Date();
    const formattedNow = now.toISOString().slice(0, 19).replace('T', ' ');
    
    const [result] = await db.execute(
      `INSERT INTO devices (device_name, unique_device_id, device_type, organization_id, added_by, status, added_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      [device_name, unique_device_id, device_type, req.organizationId, added_by || req.adminId, formattedNow, formattedNow]
    );
    
    await db.execute('INSERT INTO device_status_history (device_id, status, is_online, changed_at) VALUES (?, 1, 1, NOW())', [result.insertId]);
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('Add device error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============ DASHBOARD STATS ENDPOINT (PUBLIC - NO AUTH REQUIRED) ============
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    console.log('📊 Dashboard stats endpoint called');
    
    // Get total organizations (active, not suspended)
    const [orgResult] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM organizations 
       WHERE subscription_status != 'suspended'`
    );
    
    // Get total active users across all organizations
    const [userResult] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM users 
       WHERE is_active = 1`
    );
    
    // Calculate system uptime from device status history (last 30 days)
    const [uptimeResult] = await db.execute(
      `SELECT 
        ROUND(
          (SUM(CASE WHEN is_online = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 
          1
        ) as uptime_percentage
       FROM device_status_history
       WHERE changed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    
    const uptime = uptimeResult[0]?.uptime_percentage || 99.9;
    
    const responseData = {
      success: true,
      data: {
        organizations: parseInt(orgResult[0]?.total) || 0,
        users: parseInt(userResult[0]?.total) || 0,
        uptime: `${uptime}%`
      }
    };
    
    console.log('📊 Stats data:', responseData.data);
    
    res.json(responseData);
  } catch (error) {
    console.error('❌ Get dashboard stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error: ' + error.message 
    });
  }
});

// Update device location
app.post('/api/devices/:deviceId/location', authenticateToken, requireOrganization, async (req, res) => {
  const { deviceId } = req.params;
  const { latitude, longitude } = req.body;
  
  if (!latitude || !longitude) {
    return res.status(400).json({ success: false, error: 'Latitude and longitude required' });
  }
  
  try {
    // Verify device belongs to organization
    const [devices] = await db.execute(
      'SELECT id FROM devices WHERE id = ? AND organization_id = ?',
      [deviceId, req.organizationId]
    );
    
    if (devices.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    // Insert location record
    await db.execute(
      `INSERT INTO device_locations (device_id, latitude, longitude, recorded_at) 
       VALUES (?, ?, ?, NOW())`,
      [deviceId, latitude, longitude]
    );
    
    res.json({ success: true, message: 'Location saved successfully' });
  } catch (error) {
    console.error('Save location error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});



// ============ DEVICE VERIFICATION & ATTENDANCE ENDPOINTS ============
app.get('/v1/verify', async (req, res) => {
  const { card_id, device_id } = req.query;
  
  // console.log(`[VERIFY] Card scan received: ${card_id}, Device: ${device_id || 'unknown'}`);
  
  if (!card_id) {
    // console.log('[VERIFY] No card_id provided');
    return res.status(400).json({ success: false, error: 'card_id required' });
  }
  
  if (!device_id) {
    // console.log('[VERIFY] No device_id provided');
    return res.status(400).json({ success: false, error: 'device_id required' });
  }
  
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // First, verify the device exists and get its organization
    const [devices] = await connection.execute(
      `SELECT id, organization_id, status FROM devices WHERE unique_device_id = ?`,
      [device_id]
    );
    
    if (devices.length === 0) {
      // console.log(`[VERIFY] Device ${device_id} not found in system`);
      await connection.rollback();
      return res.status(403).json({ 
        success: false, 
        error: 'Device not registered',
        code: 'DEVICE_NOT_FOUND'
      });
    }
    
    const device = devices[0];
    
    // Check if device is active
    if (device.status !== 'active') {
      // console.log(`[VERIFY] Device ${device_id} is not active (status: ${device.status})`);
      await connection.rollback();
      return res.status(403).json({ 
        success: false, 
        error: 'Device is not active',
        code: 'DEVICE_INACTIVE'
      });
    }
    
    // console.log(`[VERIFY] Device found - Org ID: ${device.organization_id}`);
    
    // Update device last_seen
    await connection.execute(
      `UPDATE devices SET last_seen = NOW(), is_online = 1, updated_at = NOW() 
       WHERE id = ?`,
      [device.id]
    );
    
    // Find user by card UID - MUST belong to SAME organization as device
    const [users] = await connection.execute(
      `SELECT u.id, u.first_name, u.last_name, u.role, u.is_active, u.image, u.gender,
              o.id as organization_id, o.org_name
       FROM users u
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.card_uid = ? AND u.is_active = 1 AND u.organization_id = ?`,
      [card_id, device.organization_id]
    );
    
    // Handle unregistered card - but check if card exists ANYWHERE first
    if (users.length === 0) {
      // console.log(`[VERIFY] Card ${card_id} not found in organization ${device.organization_id}`);
      
      // Check if this card is registered with ANY organization
      const [cardExistsAnywhere] = await connection.execute(
        `SELECT u.id, u.first_name, u.last_name, o.org_name, u.organization_id
         FROM users u
         JOIN organizations o ON u.organization_id = o.id
         WHERE u.card_uid = ? AND u.is_active = 1`,
        [card_id]
      );
      
      // ONLY log if card is COMPLETELY unregistered (not associated with ANY organization)
      if (cardExistsAnywhere.length === 0) {
        // console.log(`[VERIFY] Card ${card_id} is COMPLETELY unregistered - logging for notification`);
        
        try {
          await connection.execute(
            `INSERT INTO unregistered_card_scans (organization_id, card_id, device_id, scanned_at, is_notified) 
             VALUES (?, ?, ?, NOW(), 0)`,
            [device.organization_id, card_id, device_id]
          );
          // console.log(`[VERIFY] Unregistered card ${card_id} logged for organization ${device.organization_id}`);
        } catch (logError) {
          // console.error('[VERIFY] Failed to log unregistered scan:', logError);
        }
        
        await connection.commit();
        
        return res.status(404).json({ 
          success: false, 
          error: 'Card not recognized for this organization',
          code: 'CARD_NOT_FOUND',
          card_id: card_id,
          device_id: device_id
        });
      } else {
        // Card exists but in DIFFERENT organization
        // console.log(`[VERIFY] Card ${card_id} belongs to ${cardExistsAnywhere[0].org_name} (different organization) - NOT logging`);
        
        await connection.commit();
        
        return res.status(403).json({ 
          success: false, 
          error: `Card belongs to ${cardExistsAnywhere[0].org_name}. Cannot use in this organization.`,
          code: 'CARD_BELONGS_TO_OTHER_ORG',
          card_id: card_id,
          belongs_to: cardExistsAnywhere[0].org_name
        });
      }
    }
    
    const user = users[0];
    // console.log(`[VERIFY] User found: ${user.first_name} ${user.last_name} (ID: ${user.id}) - Same organization as device ✓`);
    
    // Determine check-in/check-out status
    const [lastAttendance] = await connection.execute(
      `SELECT status, timestamp FROM attendance 
       WHERE user_id = ? AND DATE(timestamp) = CURDATE() 
       ORDER BY timestamp DESC LIMIT 1`,
      [user.id]
    );
    
    let actionType = 'check_in';
    if (lastAttendance.length > 0 && (lastAttendance[0].status === 'check_in' || lastAttendance[0].status === 'present' || lastAttendance[0].status === 'late')) {
      actionType = 'check_out';
    }
    // console.log(`[VERIFY] Action type: ${actionType}`);
    
    // Get user details for schedule detection
    const [userDetails] = await connection.execute(
      `SELECT u.id, u.role, 
              st.section_id, c.id as class_id,
              e.department_id, e.position_id
       FROM users u
       LEFT JOIN students st ON u.id = st.user_id
       LEFT JOIN classes c ON st.class_id = c.id
       LEFT JOIN employees e ON u.id = e.user_id
       WHERE u.id = ?`,
      [user.id]
    );
    
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentTime = new Date().toTimeString().slice(0, 5);
    
    // console.log(`[VERIFY] Detecting schedule for ${currentDay} at ${currentTime}, Action: ${actionType}`);
    
    // Find applicable schedules
    let scheduleQuery = `
      SELECT s.* 
      FROM schedules s
      WHERE s.organization_id = ? AND s.is_active = 1
    `;
    const params = [user.organization_id];
    
    if (actionType === 'check_in') {
      scheduleQuery += ` AND (s.type = 'both' OR s.type = 'check_in')`;
    } else {
      scheduleQuery += ` AND (s.type = 'both' OR s.type = 'check_out')`;
    }
    
    const targetConditions = ["s.target_type = 'all'"];
    targetConditions.push(`(s.target_type = 'specific_users' AND JSON_CONTAINS(s.target_ids, ?))`);
    params.push(JSON.stringify(user.id));
    
    if (userDetails[0]?.role === 'student') {
      if (userDetails[0]?.class_id) {
        targetConditions.push(`(s.target_type = 'classes' AND JSON_CONTAINS(s.target_ids, ?))`);
        params.push(JSON.stringify(userDetails[0].class_id));
      }
      if (userDetails[0]?.section_id) {
        targetConditions.push(`(s.target_type = 'sections' AND JSON_CONTAINS(s.target_ids, ?))`);
        params.push(JSON.stringify(userDetails[0].section_id));
      }
    } else {
      if (userDetails[0]?.position_id) {
        targetConditions.push(`(s.target_type = 'positions' AND JSON_CONTAINS(s.target_ids, ?))`);
        params.push(JSON.stringify(userDetails[0].position_id));
      }
      if (userDetails[0]?.department_id) {
        targetConditions.push(`(s.target_type = 'departments' AND JSON_CONTAINS(s.target_ids, ?))`);
        params.push(JSON.stringify(userDetails[0].department_id));
      }
    }
    
    scheduleQuery += ` AND (${targetConditions.join(' OR ')})`;
    
    const [schedules] = await connection.execute(scheduleQuery, params);
    // console.log(`[VERIFY] Found ${schedules.length} applicable schedules for ${actionType}`);
    
    // Find active schedule
    let finalScheduleId = null;
    let finalStatus = actionType;
    let lateMinutes = 0;
    
    for (const schedule of schedules) {
      let daysOfWeek = schedule.days_of_week;
      if (typeof daysOfWeek === 'string') {
        try {
          daysOfWeek = JSON.parse(daysOfWeek);
        } catch (e) {
          daysOfWeek = [];
        }
      }
      
      const dayMatch = daysOfWeek.includes(currentDay);
      const timeMatch = currentTime >= schedule.start_time && currentTime <= schedule.end_time;
      
      if (dayMatch && timeMatch) {
        finalScheduleId = schedule.id;
        // console.log(`[VERIFY] Active schedule found: ${schedule.name} (ID: ${schedule.id}) for ${actionType}`);
        
        if (actionType === 'check_in' && currentTime > schedule.start_time) {
          const [scheduleHour, scheduleMinute] = schedule.start_time.split(':').map(Number);
          const [currentHour, currentMinute] = currentTime.split(':').map(Number);
          let scheduleTotal = scheduleHour * 60 + scheduleMinute;
          const currentTotal = currentHour * 60 + currentMinute;
          scheduleTotal += (schedule.grace_minutes || 0);
          
          if (currentTotal > scheduleTotal) {
            lateMinutes = currentTotal - scheduleTotal;
            if (lateMinutes >= (schedule.late_threshold_minutes || 15)) {
              finalStatus = 'late';
              // console.log(`[VERIFY] User is late by ${lateMinutes} minutes`);
            }
          }
        }
        break;
      }
    }
    
    if (!finalScheduleId) {
      // console.log(`[VERIFY] No active schedule found for ${actionType}`);
    }
    
    // Record attendance
    const [result] = await connection.execute(
      `INSERT INTO attendance (
        organization_id, user_id, device_id, schedule_id, name, timestamp,
        method, status, latitude, longitude, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(), 'card', ?, ?, ?, ?, NOW(), NOW())`,
      [
        user.organization_id,
        user.id,
        device.id,
        finalScheduleId,
        `${user.first_name} ${user.last_name}`,
        finalStatus,
        null,
        null,
        lateMinutes > 0 ? `Late by ${lateMinutes} minutes` : null
      ]
    );
    
    // console.log(`[VERIFY] Attendance recorded (ID: ${result.insertId}, status: ${finalStatus}, schedule_id: ${finalScheduleId})`);
    
    // Log activity
    await connection.execute(
      `INSERT INTO activity_logs (
        organization_id, user_id, action, entity_type, entity_id,
        new_values, created_at
      ) VALUES (?, ?, 'card_attendance', 'attendance', ?, ?, NOW())`,
      [
        user.organization_id,
        user.id,
        result.insertId,
        JSON.stringify({ card_id, status: finalStatus, schedule_id: finalScheduleId, device_id, action_type: actionType })
      ]
    );
    
    await connection.commit();
    
    // Build response message
    let message = '';
    if (finalStatus === 'check_in') {
      message = `Welcome ${user.first_name}!`;
      if (lateMinutes > 0) message += ` (Late by ${lateMinutes} min)`;
    } else if (finalStatus === 'check_out') {
      message = `Goodbye ${user.first_name}!`;
    } else if (finalStatus === 'late') {
      message = `Welcome ${user.first_name}! You are late by ${lateMinutes} minutes`;
    }
    
    res.json({
      success: true,
      data: {
        user_id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role,
        status: finalStatus,
        late_minutes: lateMinutes,
        schedule_id: finalScheduleId,
        schedule_name: finalScheduleId ? schedules.find(s => s.id === finalScheduleId)?.name : null,
        action_type: actionType,
        message: message
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[VERIFY] Error:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
});

// Organization logo upload endpoint
app.post('/api/organizations/:orgId/logo', authenticateToken, upload.single('logo'), async (req, res) => {
  try {
    const { orgId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const filename = req.file.filename;
    
    // Update organization logo - store only filename
    await db.execute(
      'UPDATE organizations SET logo = ?, updated_at = NOW() WHERE id = ?',
      [filename, orgId]
    );
    
    // Return the full URL for convenience
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json({ 
      success: true, 
      data: { 
        filename: filename, 
        url: `/uploads/logos/${filename}` 
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload logo' });
  }
});


// Upload profile image endpoint
app.post('/api/auth/upload-profile', authenticateToken, upload.single('profile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const filename = req.file.filename;
    
    // Update admin profile with filename
    await db.execute(
      'UPDATE admins SET profile = ?, updated_at = NOW() WHERE id = ?',
      [filename, req.adminId]
    );
    
    res.json({ 
      success: true, 
      data: { filename: filename, url: `/uploads/${filename}` }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload image' });
  }
});

// Upload profile image endpoint
app.post('/api/auth/upload-profile', authenticateToken, upload.single('profile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const filename = req.file.filename;
    
    // Update admin profile with filename
    await db.execute(
      'UPDATE admins SET profile = ?, updated_at = NOW() WHERE id = ?',
      [filename, req.adminId]
    );
    
    res.json({ 
      success: true, 
      data: { filename: filename, url: `/uploads/${filename}` }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload image' });
  }
});

// ============ ADD ORGANIZATION LOGO ENDPOINT HERE ============
// Organization logo upload endpoint
app.post('/api/organizations/:orgId/logo', authenticateToken, upload.single('logo'), async (req, res) => {
  try {
    const { orgId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const filename = req.file.filename;
    
    // Update organization logo
    await db.execute(
      'UPDATE organizations SET logo = ?, updated_at = NOW() WHERE id = ?',
      [filename, orgId]
    );
    
    res.json({ 
      success: true, 
      data: { filename: filename, url: `/uploads/${filename}` }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload logo' });
  }
});


// Make sure your backend endpoint returns the scan ID
app.get('/api/recent-unregistered-scans', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const [scans] = await db.execute(
      `SELECT id, card_id, device_id, scanned_at 
       FROM unregistered_card_scans 
       WHERE organization_id = ? AND is_notified = 0 AND scanned_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
       ORDER BY scanned_at DESC`,
      [req.organizationId]
    );
    
    // Mark as notified
    if (scans.length > 0) {
      const ids = scans.map(s => s.id);
      await db.execute(
        `UPDATE unregistered_card_scans SET is_notified = 1 WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
    }
    
    res.json({ success: true, data: scans });
  } catch (error) {
    // console.error('Error fetching unregistered scans:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Get live view by organization slug (public - no auth required)
app.get('/api/live/by-slug/:slug', async (req, res) => {
  const { slug } = req.params;
  
  console.log('[SLUG] Request for slug:', slug);
  
  try {
    const [orgs] = await db.execute(
      'SELECT id, org_name, type, page_slug FROM organizations WHERE page_slug = ?',
      [slug]
    );
    
    if (orgs.length === 0) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }
    
    const org = orgs[0];
    console.log('[SLUG] Found organization:', org.id, org.org_name);
    
    // Check if there's an active session for this organization
    const [existingSessions] = await db.execute(
      `SELECT session_token, expires_at FROM live_view_sessions 
       WHERE organization_id = ? AND is_active = 1 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [org.id]
    );
    
    let sessionToken;
    let expiresAt;
    
    if (existingSessions.length > 0) {
      // Reuse existing active session
      sessionToken = existingSessions[0].session_token;
      expiresAt = existingSessions[0].expires_at;
      console.log('[SLUG] Reusing existing session:', sessionToken);
    } else {
      // Create new session
      sessionToken = crypto.randomBytes(16).toString('hex');
      expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      
      // Get the organization's primary admin
      const [adminRows] = await db.execute(
        'SELECT id FROM admins WHERE organization_id = ? AND is_primary = 1 LIMIT 1',
        [org.id]
      );
      
      const adminId = adminRows.length > 0 ? adminRows[0].id : 1;
      
      await db.execute(
        `INSERT INTO live_view_sessions 
         (organization_id, created_by, session_token, duration_minutes, expires_at, viewer_count, is_active) 
         VALUES (?, ?, ?, 60, ?, 0, 1)`,
        [org.id, adminId, sessionToken, expiresAt]
      );
      console.log('[SLUG] Created new session:', sessionToken);
    }
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const viewUrl = `${frontendUrl}/live/s/${sessionToken}`;
    
    console.log('[SLUG] Returning view URL:', viewUrl);
    
    res.json({
      success: true,
      data: {
        session_id: sessionToken,
        organization: {
          id: org.id,
          name: org.org_name,
          type: org.type,
          slug: org.page_slug
        },
        expires_at: expiresAt,
        view_url: viewUrl
      }
    });
  } catch (error) {
    console.error('[SLUG] Error:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});



// Direct slug view endpoint (redirects to session)
app.get('/live/:slug', async (req, res) => {
  const { slug } = req.params;
  
  // Check if it's a session token (32 chars hex) or organization slug
  const isSessionToken = /^[a-f0-9]{32}$/.test(slug);
  
  if (isSessionToken) {
    // It's a session token, serve the live view page
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  } else {
    // It's an organization slug, redirect to API to get session
    try {
      const [orgs] = await db.execute(
        'SELECT id FROM organizations WHERE page_slug = ?',
        [slug]
      );
      
      if (orgs.length === 0) {
        return res.status(404).send('Organization not found');
      }
      
      // Create or get session and redirect
      const [existingSessions] = await db.execute(
        `SELECT session_token FROM live_view_sessions 
         WHERE organization_id = ? AND is_active = 1 AND expires_at > NOW()
         LIMIT 1`,
        [orgs[0].id]
      );
      
      let sessionToken;
      if (existingSessions.length > 0) {
        sessionToken = existingSessions[0].session_token;
      } else {
        sessionToken = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await db.execute(
          `INSERT INTO live_view_sessions 
           (organization_id, created_by, session_token, duration_minutes, expires_at, viewer_count, is_active) 
           VALUES (?, 1, ?, 60, ?, 0, 1)`,
          [orgs[0].id, sessionToken, expiresAt]
        );
      }
      
      res.redirect(`/live/${sessionToken}`);
    } catch (error) {
      console.error('Slug redirect error:', error);
      res.status(500).send('Server error');
    }
  }
});

app.put('/api/devices/wifi', authenticateToken, requireOrganization, async (req, res) => {
  const { deviceId, ssid, password, api } = req.body;
  
  try {
    const [result] = await db.execute(
      `UPDATE wifi_credentials SET ssid = ?, password = ?, api = ?, updated_at = NOW() WHERE device_id = ?`,
      [ssid, password, api, deviceId]
    );
    
    if (result.affectedRows === 0) {
      await db.execute(
        `INSERT INTO wifi_credentials (device_id, ssid, password, api, admin_id, organization_id, created_at, updated_at) 
         SELECT ?, ?, ?, ?, added_by, organization_id, NOW(), NOW() FROM devices WHERE id = ?`,
        [deviceId, ssid, password, api, deviceId]
      );
    }
    
    res.json({ success: true, message: 'WiFi credentials updated successfully' });
  } catch (error) {
    console.error('Update WiFi error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============ ORGANIZATION ENDPOINTS ============
app.get('/api/organizations/:orgId', authenticateToken, async (req, res) => {
  const { orgId } = req.params;
  
  try {
    const [orgs] = await db.execute(
      `SELECT o.*, 
        s.id as subscription_id, s.plan_id, s.status as subscription_status, s.end_date as subscription_expires_at, s.billing_cycle,
        sp.name as plan_name, sp.display_name as plan_display_name, sp.max_users, sp.max_devices, sp.max_admins, sp.analytics_level, sp.support_level, sp.price_monthly, sp.price_yearly
       FROM organizations o
       LEFT JOIN subscriptions s ON o.id = s.organization_id AND s.status IN ('active', 'trial')
       LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE o.id = ?`,
      [orgId]
    );
    
    if (orgs.length === 0) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }
    
    const org = orgs[0];
    if (org.plan_id) {
      org.subscription_plan = {
        id: org.plan_id,
        name: org.plan_name,
        display_name: org.plan_display_name,
        max_users: org.max_users,
        max_devices: org.max_devices,
        max_admins: org.max_admins,
        analytics_level: org.analytics_level,
        support_level: org.support_level,
        price_monthly: org.price_monthly,
        price_yearly: org.price_yearly
      };
    }
    
    res.json({ success: true, data: org });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.put('/api/organizations/:orgId', authenticateToken, async (req, res) => {
  const { orgId } = req.params;
  const { org_name, address, contact_email, contact_phone } = req.body;
  
  try {
    await db.execute(
      'UPDATE organizations SET org_name = ?, address = ?, contact_email = ?, contact_phone = ?, updated_at = NOW() WHERE id = ?',
      [org_name, address, contact_email, contact_phone, orgId]
    );
    
    res.json({ success: true, message: 'Organization updated successfully' });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============ SUBSCRIPTION PLANS ENDPOINT ============
app.get('/api/subscription-plans', authenticateToken, async (req, res) => {
  try {
    const [plans] = await db.execute(
      'SELECT id, name, display_name, description, price_monthly, price_yearly, max_users, max_devices, max_admins, analytics_level, dashboard_level, api_access, custom_reports, custom_branding, support_level, live_view_enabled, live_view_duration, export_data, webhooks, is_active FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order, price_monthly'
    );
    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============ BILLING ENDPOINTS ============
app.get('/api/billing/:orgId', authenticateToken, async (req, res) => {
  const { orgId } = req.params;
  
  try {
    const [org] = await db.execute(
      `SELECT o.*, s.plan_id, s.status as subscription_status, s.end_date as subscription_expires_at,
              sp.name as plan_name, sp.display_name, sp.max_users, sp.max_devices, sp.price_monthly, sp.price_yearly
       FROM organizations o
       LEFT JOIN subscriptions s ON o.id = s.organization_id AND s.status IN ('active', 'trial')
       LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE o.id = ?`,
      [orgId]
    );
    
    if (org.length === 0) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }
    
    res.json({ success: true, data: org[0] });
  } catch (error) {
    console.error('Get billing info error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.put('/api/billing/:orgId', authenticateToken, async (req, res) => {
  const { orgId } = req.params;
  const { subscription_status, subscription_expires_at, plan_id, billing_cycle } = req.body;
  
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const [existing] = await connection.execute(
      'SELECT id FROM subscriptions WHERE organization_id = ? AND status IN ("active", "trial")',
      [orgId]
    );
    
    if (existing.length > 0) {
      await connection.execute(
        `UPDATE subscriptions 
         SET plan_id = ?, status = ?, end_date = ?, billing_cycle = ?, updated_at = NOW()
         WHERE organization_id = ? AND status IN ("active", "trial")`,
        [plan_id, subscription_status, subscription_expires_at, billing_cycle || 'monthly', orgId]
      );
    } else {
      await connection.execute(
        `INSERT INTO subscriptions 
         (organization_id, plan_id, billing_cycle, status, amount_paid, currency, start_date, end_date, created_at, updated_at) 
         VALUES (?, ?, ?, ?, 0, 'USD', NOW(), ?, NOW(), NOW())`,
        [orgId, plan_id, billing_cycle || 'monthly', subscription_status, subscription_expires_at]
      );
    }
    
    await connection.execute(
      `UPDATE organizations 
       SET subscription_status = ?, subscription_expires_at = ?, updated_at = NOW()
       WHERE id = ?`,
      [subscription_status, subscription_expires_at, orgId]
    );
    
    await connection.commit();
    res.json({ success: true, message: 'Subscription updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Update subscription error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    connection.release();
  }
});


// ============ LIVE VIEW ENDPOINTS ============

// Create a new live session (authenticated)
app.post('/api/live/sessions', authenticateToken, async (req, res) => {
  const { organization_id, duration_minutes = 60 } = req.body;
  
  console.log('[LIVE] POST /api/live/sessions');
  
  const targetOrgId = organization_id || req.organizationId;
  
  if (!targetOrgId) {
    return res.status(400).json({ success: false, error: 'organization_id required' });
  }
  
  try {
    await db.execute(
      `UPDATE live_view_sessions SET is_active = 0 WHERE organization_id = ?`,
      [targetOrgId]
    );
    
    const sessionToken = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + duration_minutes * 60 * 1000);
    
    await db.execute(
      `INSERT INTO live_view_sessions 
       (organization_id, created_by, session_token, duration_minutes, expires_at, viewer_count, is_active) 
       VALUES (?, ?, ?, ?, ?, 0, 1)`,
      [targetOrgId, req.adminId, sessionToken, duration_minutes, expiresAt]
    );
    
    const [org] = await db.execute(
      'SELECT org_name, type FROM organizations WHERE id = ?',
      [targetOrgId]
    );
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    
    res.json({ 
      success: true, 
      data: { 
        shareable_link: `${frontendUrl}/live/s/${sessionToken}`,
        expires_at: expiresAt,
        session_id: sessionToken,
        organization_name: org[0]?.org_name || 'Organization',
        organization_type: org[0]?.type || 'school'
      }
    });
  } catch (error) {
    console.error('[LIVE] Create error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Validate a session (public)
app.get('/api/live/sessions/:sessionId/validate', async (req, res) => {
  const { sessionId } = req.params;
  
  console.log('[LIVE] Validate session:', sessionId);
  
  try {
    const [sessions] = await db.execute(
      `SELECT ls.*, o.org_name, o.type as organization_type,
              CONCAT(a.first_name, ' ', a.last_name) as created_by_name
       FROM live_view_sessions ls
       JOIN organizations o ON ls.organization_id = o.id
       JOIN admins a ON ls.created_by = a.id
       WHERE ls.session_token = ? AND ls.is_active = 1`,
      [sessionId]
    );
    
    if (sessions.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    const session = sessions[0];
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    if (now > expiresAt) {
      return res.status(404).json({ success: false, error: 'Session has expired' });
    }
    
    res.json({ 
      success: true, 
      data: {
        session_id: session.session_token,
        organization_id: session.organization_id,
        organization_name: session.org_name,
        organization_type: session.organization_type,
        created_by: session.created_by,
        created_by_name: session.created_by_name,
        expires_at: session.expires_at,
        is_active: session.is_active === 1
      }
    });
  } catch (error) {
    console.error('[LIVE] Validate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get public attendance data
app.get('/api/live/sessions/:sessionId/attendance', async (req, res) => {
  const { sessionId } = req.params;
  const { limit = 50 } = req.query;
  
  try {
    const [sessions] = await db.execute(
      `SELECT organization_id FROM live_view_sessions 
       WHERE session_token = ? AND is_active = 1 AND expires_at > NOW()`,
      [sessionId]
    );
    
    if (sessions.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found or expired' });
    }
    
    const organizationId = sessions[0].organization_id;
    
    const [recent] = await db.execute(
      `SELECT a.id, a.user_id, a.status, a.timestamp, a.method,
              CONCAT(u.first_name, ' ', u.last_name) as user_name,
              u.role as user_role, u.image as user_image
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       WHERE u.organization_id = ?
       ORDER BY a.timestamp DESC
       LIMIT ?`,
      [organizationId, parseInt(limit)]
    );
    
    const [stats] = await db.execute(
      `SELECT 
        COUNT(*) as today_count,
        SUM(CASE WHEN status IN ('check_in', 'present', 'late') THEN 1 ELSE 0 END) as check_ins
       FROM attendance 
       WHERE organization_id = ? AND DATE(timestamp) = CURDATE()`,
      [organizationId]
    );
    
    res.json({ 
      success: true, 
      data: {
        recent: recent,
        today_count: stats[0]?.today_count || 0,
        check_ins: stats[0]?.check_ins || 0,
        currently_inside: 0
      }
    });
  } catch (error) {
    console.error('[LIVE] Attendance error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get or create session by organization slug (ONLY ONE - uses page_slug)
app.get('/api/live/by-slug/:slug', async (req, res) => {
  const { slug } = req.params;
  
  console.log('[SLUG] Request for slug:', slug);
  
  try {
    const decodedSlug = decodeURIComponent(slug);
    
    const [orgs] = await db.execute(
      'SELECT id, org_name, type, page_slug FROM organizations WHERE page_slug = ?',
      [decodedSlug]
    );
    
    if (orgs.length === 0) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }
    
    const org = orgs[0];
    console.log('[SLUG] Found organization:', org.id, org.org_name);
    
    const [existing] = await db.execute(
      `SELECT session_token FROM live_view_sessions 
       WHERE organization_id = ? AND is_active = 1 AND expires_at > NOW()
       LIMIT 1`,
      [org.id]
    );
    
    let sessionToken;
    if (existing.length > 0) {
      sessionToken = existing[0].session_token;
      console.log('[SLUG] Reusing existing session:', sessionToken);
    } else {
      sessionToken = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      
      const [admin] = await db.execute(
        'SELECT id FROM admins WHERE organization_id = ? AND is_primary = 1 LIMIT 1',
        [org.id]
      );
      const adminId = admin.length > 0 ? admin[0].id : 1;
      
      await db.execute(
        `INSERT INTO live_view_sessions 
         (organization_id, created_by, session_token, duration_minutes, expires_at, viewer_count, is_active) 
         VALUES (?, ?, ?, 60, ?, 0, 1)`,
        [org.id, adminId, sessionToken, expiresAt]
      );
      console.log('[SLUG] Created new session:', sessionToken);
    }
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const viewUrl = `${frontendUrl}/live/s/${sessionToken}`;
    
    res.json({
      success: true,
      data: {
        session_id: sessionToken,
        view_url: viewUrl,
        organization: {
          id: org.id,
          name: org.org_name,
          type: org.type,
          slug: org.page_slug
        }
      }
    });
  } catch (error) {
    console.error('[SLUG] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SSE Stream
app.get('/api/live/sessions/:sessionId/stream', async (req, res) => {
  const { sessionId } = req.params;
  
  console.log('[SSE] Client connected:', sessionId);
  
  let organizationId;
  try {
    const [sessions] = await db.execute(
      `SELECT organization_id FROM live_view_sessions 
       WHERE session_token = ? AND is_active = 1 AND expires_at > NOW()`,
      [sessionId]
    );
    
    if (sessions.length === 0) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }
    organizationId = sessions[0].organization_id;
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);
  
  let lastId = 0;
  
  const [lastRecord] = await db.execute(
    'SELECT MAX(id) as max_id FROM attendance WHERE organization_id = ?',
    [organizationId]
  );
  lastId = lastRecord[0]?.max_id || 0;
  
  const interval = setInterval(async () => {
    try {
      const [newRecords] = await db.execute(
        `SELECT a.id, a.user_id, a.status, a.timestamp, a.method,
                CONCAT(u.first_name, ' ', u.last_name) as user_name,
                u.role as user_role, u.image as user_image
         FROM attendance a
         JOIN users u ON a.user_id = u.id
         WHERE a.id > ? AND a.organization_id = ?
         ORDER BY a.id ASC`,
        [lastId, organizationId]
      );
      
      if (newRecords.length > 0) {
        lastId = newRecords[newRecords.length - 1].id;
        
        for (const record of newRecords) {
          res.write(`data: ${JSON.stringify({
            type: 'new_attendance',
            id: record.id,
            user_id: record.user_id,
            user_name: record.user_name,
            user_role: record.user_role,
            user_image: record.user_image,
            status: record.status,
            timestamp: record.timestamp,
            method: record.method
          })}\n\n`);
        }
      }
    } catch (error) {
      console.error('[SSE] Error:', error);
    }
  }, 3000);
  
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

// ============ IMAGE UPLOAD ENDPOINTS (MATCHING FRONTEND) ============
// Configure multer for profile and logo uploads
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadDir;
    if (file.fieldname === 'profile') {
      uploadDir = path.join(__dirname, 'public/uploads/profiles');
    } else if (file.fieldname === 'logo') {
      uploadDir = path.join(__dirname, 'public/uploads/logos');
    } else {
      uploadDir = path.join(__dirname, 'public/uploads');
    }
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const prefix = file.fieldname === 'profile' ? 'profile' : (file.fieldname === 'logo' ? 'logo' : 'upload');
    cb(null, prefix + '-' + uniqueSuffix + ext);
  }
});


const imageUpload = multer({ 
  storage: imageStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});


// Add these endpoints BEFORE your existing server.js code
app.post('/api/uploads/profiles', imageUpload.single('profile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const fileUrl = `/uploads/profiles/${req.file.filename}`;
    console.log('[UPLOAD] Profile uploaded:', fileUrl);
    
    res.json({ 
      success: true, 
      data: { url: fileUrl, filename: req.file.filename } 
    });
  } catch (error) {
    console.error('Profile upload error:', error);
    res.status(500).json({ success: false, error: 'Upload failed: ' + error.message });
  }
});

// Logo image upload endpoint (matching frontend)
app.post('/api/uploads/logos', imageUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const fileUrl = `/uploads/logos/${req.file.filename}`;
    console.log('[UPLOAD] Logo uploaded:', fileUrl);
    
    res.json({ 
      success: true, 
      data: { url: fileUrl, filename: req.file.filename } 
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ success: false, error: 'Upload failed: ' + error.message });
  }
});

// ============ USER IMAGE UPLOAD ENDPOINTS ============
// Configure multer for user images
const userImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public/uploads/users');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const userId = req.params.userId || req.body.userId || Date.now();
    const uniqueSuffix = Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `user-${userId}-${uniqueSuffix}${ext}`);
  }
});

const userImageUpload = multer({ 
  storage: userImageStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed'));
    }
  }
});

// Upload temp user image (before user is created)
app.post('/api/users/upload-temp-image', authenticateToken, requireOrganization, userImageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const filename = req.file.filename;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/uploads/users/${filename}`;
    
    res.json({ 
      success: true, 
      data: { 
        temp_filename: filename,
        filename: filename,
        url: imageUrl 
      },
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Temp user image upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload image' });
  }
});

// Upload user image for existing user
app.post('/api/users/:userId/image', authenticateToken, requireOrganization, userImageUpload.single('image'), async (req, res) => {
  const { userId } = req.params;
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const filename = req.file.filename;
    
    await db.execute(
      'UPDATE users SET image = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?',
      [filename, userId, req.organizationId]
    );
    
    const [users] = await db.execute(
      'SELECT id, first_name, last_name, image FROM users WHERE id = ?',
      [userId]
    );
    
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/uploads/users/${filename}`;
    
    res.json({ 
      success: true, 
      data: { 
        filename: filename, 
        url: imageUrl,
        user: users[0]
      },
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('User image upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload image: ' + error.message });
  }
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));


// ============ START SERVER ============
app.listen(PORT, () => {
  console.log(`---> CSMS Backend running on http://localhost:${PORT}`);
  console.log(`---> Accessible at http://localhost:${PORT}`);
  console.log(`---> Network access: https://csm.cwanda.site/${PORT}`);
  console.log(`---> JWT auth enabled`);
});