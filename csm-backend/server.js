import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ============ DATABASE CONNECTION ============
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  timezone: 'local'
});

// Test database connection
pool.getConnection()
  .then(connection => {
    console.log('✅ Database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
  });

// ============ MIDDLEWARE ============
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'https://csm-rosy.vercel.app', 'https://csm.cwanda.site', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static files
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// ============ FILE UPLOAD CONFIGURATION ============
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'file-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ============ AUTHENTICATION MIDDLEWARE ============
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.adminId = decoded.id;
    req.organizationId = decoded.organization_id;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
};

const requireOrganization = (req, res, next) => {
  if (!req.organizationId) {
    return res.status(403).json({ success: false, error: 'Organization context required' });
  }
  next();
};

// ============ AUTH ROUTES ============
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const [admins] = await pool.execute(
      `SELECT a.*, o.id as organization_id, o.org_name, o.type as organization_type
       FROM admins a
       LEFT JOIN organizations o ON a.organization_id = o.id
       WHERE a.email = ? AND a.is_active = 1`,
      [email]
    );
    
    if (admins.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const admin = admins[0];
    const validPassword = await bcrypt.compare(password, admin.password);
    
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: admin.id, email: admin.email, organization_id: admin.organization_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    const refreshToken = crypto.randomBytes(40).toString('hex');
    
    await pool.execute(
      'UPDATE admins SET refresh_token = ?, last_login = NOW() WHERE id = ?',
      [refreshToken, admin.id]
    );
    
    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: admin.id,
          first_name: admin.first_name,
          last_name: admin.last_name,
          email: admin.email,
          username: admin.username,
          profile: admin.profile,
          organization_id: admin.organization_id,
          organization_name: admin.org_name,
          organization_type: admin.organization_type
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/auth/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;
  
  try {
    const [admins] = await pool.execute(
      'SELECT * FROM admins WHERE refresh_token = ?',
      [refreshToken]
    );
    
    if (admins.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }
    
    const admin = admins[0];
    const token = jwt.sign(
      { id: admin.id, email: admin.email, organization_id: admin.organization_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    res.json({ success: true, data: { token } });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    await pool.execute('UPDATE admins SET refresh_token = NULL WHERE id = ?', [req.adminId]);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============ DEVICE VERIFICATION ENDPOINT (Critical for Arduino) ============
app.get('/v1/verify', async (req, res) => {
  const { card_id, device_id } = req.query;
  
  if (!card_id || !device_id) {
    return res.status(400).json({ success: false, error: 'card_id and device_id required' });
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Verify device
    const [devices] = await connection.execute(
      `SELECT id, organization_id, status FROM devices WHERE unique_device_id = ?`,
      [device_id]
    );
    
    if (devices.length === 0) {
      await connection.rollback();
      return res.status(403).json({ success: false, error: 'Device not registered' });
    }
    
    const device = devices[0];
    
    if (device.status !== 'active') {
      await connection.rollback();
      return res.status(403).json({ success: false, error: 'Device is not active' });
    }
    
    // Update device last_seen
    await connection.execute(
      `UPDATE devices SET last_seen = NOW(), is_online = 1 WHERE id = ?`,
      [device.id]
    );
    
    // Find user by card
    const [users] = await connection.execute(
      `SELECT u.id, u.first_name, u.last_name, u.role, u.is_active, u.image, u.gender
       FROM users u
       WHERE u.card_uid = ? AND u.is_active = 1 AND u.organization_id = ?`,
      [card_id, device.organization_id]
    );
    
    if (users.length === 0) {
      await connection.commit();
      return res.status(404).json({ success: false, error: 'Card not recognized' });
    }
    
    const user = users[0];
    
    // Determine check-in/check-out
    const [lastAttendance] = await connection.execute(
      `SELECT status FROM attendance 
       WHERE user_id = ? AND DATE(timestamp) = CURDATE() 
       ORDER BY timestamp DESC LIMIT 1`,
      [user.id]
    );
    
    let status = 'check_in';
    if (lastAttendance.length > 0 && lastAttendance[0].status === 'check_in') {
      status = 'check_out';
    }
    
    // Record attendance
    await connection.execute(
      `INSERT INTO attendance (organization_id, user_id, device_id, name, timestamp, method, status) 
       VALUES (?, ?, ?, ?, NOW(), 'card', ?)`,
      [device.organization_id, user.id, device.id, `${user.first_name} ${user.last_name}`, status]
    );
    
    await connection.commit();
    
    res.json({
      success: true,
      data: {
        user_id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role,
        status: status,
        message: `${status === 'check_in' ? 'Welcome' : 'Goodbye'} ${user.first_name}!`
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Verify error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    connection.release();
  }
});

// ============ ATTENDANCE ROUTES ============
app.get('/api/attendance/records', authenticateToken, requireOrganization, async (req, res) => {
  const { search, status, method, startDate, endDate, schedule_id, page = 1, limit = 50 } = req.query;
  
  try {
    let query = `SELECT a.*, u.first_name, u.last_name, u.role, d.device_name 
                 FROM attendance a
                 JOIN users u ON a.user_id = u.id
                 LEFT JOIN devices d ON a.device_id = d.id
                 WHERE a.organization_id = ?`;
    const params = [req.organizationId];
    
    if (search) {
      query += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.card_uid LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      query += ` AND a.status = ?`;
      params.push(status);
    }
    if (method) {
      query += ` AND a.method = ?`;
      params.push(method);
    }
    if (startDate) {
      query += ` AND DATE(a.timestamp) >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND DATE(a.timestamp) <= ?`;
      params.push(endDate);
    }
    if (schedule_id) {
      query += ` AND a.schedule_id = ?`;
      params.push(schedule_id);
    }
    
    query += ` ORDER BY a.timestamp DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    const [records] = await pool.execute(query, params);
    
    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM attendance a WHERE a.organization_id = ?`,
      [req.organizationId]
    );
    
    res.json({ 
      success: true, 
      data: records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get records error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/api/attendance/stats/today', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_attendance,
        SUM(CASE WHEN status IN ('check_in', 'present') THEN 1 ELSE 0 END) as check_ins,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_arrivals,
        SUM(CASE WHEN status = 'check_out' THEN 1 ELSE 0 END) as check_outs
       FROM attendance 
       WHERE organization_id = ? AND DATE(timestamp) = CURDATE()`,
      [req.organizationId]
    );
    
    res.json({ success: true, data: stats[0] });
  } catch (error) {
    console.error('Get today stats error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/api/attendance/schedules', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const [schedules] = await pool.execute(
      `SELECT * FROM schedules WHERE organization_id = ? ORDER BY created_at DESC`,
      [req.organizationId]
    );
    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/attendance/schedules', authenticateToken, requireOrganization, async (req, res) => {
  const { name, description, type, start_time, end_time, days_of_week, grace_minutes, late_threshold_minutes, is_active } = req.body;
  
  try {
    const [result] = await pool.execute(
      `INSERT INTO schedules (organization_id, name, description, type, start_time, end_time, days_of_week, grace_minutes, late_threshold_minutes, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [req.organizationId, name, description, type, start_time, end_time, JSON.stringify(days_of_week), grace_minutes || 0, late_threshold_minutes || 15, is_active !== false, req.adminId]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============ DEVICE ROUTES ============
app.get('/api/devices', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const [devices] = await pool.execute(
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
  const { device_name, unique_device_id, device_type } = req.body;
  
  try {
    const [existing] = await pool.execute('SELECT id FROM devices WHERE unique_device_id = ?', [unique_device_id]);
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Device already registered' });
    }
    
    const [result] = await pool.execute(
      `INSERT INTO devices (device_name, unique_device_id, device_type, organization_id, added_by, status, added_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [device_name, unique_device_id, device_type, req.organizationId, req.adminId]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('Add device error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.put('/api/devices/:deviceId', authenticateToken, requireOrganization, async (req, res) => {
  const { deviceId } = req.params;
  const { device_name, status } = req.body;
  
  try {
    await pool.execute(
      'UPDATE devices SET device_name = ?, status = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?',
      [device_name, status, deviceId, req.organizationId]
    );
    
    res.json({ success: true, message: 'Device updated successfully' });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.delete('/api/devices/:deviceId', authenticateToken, requireOrganization, async (req, res) => {
  const { deviceId } = req.params;
  
  try {
    await pool.execute('DELETE FROM devices WHERE id = ? AND organization_id = ?', [deviceId, req.organizationId]);
    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============ USER ROUTES ============
app.get('/api/users', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.card_uid, u.role, u.is_active, u.image, u.gender, u.created_at,
              s.section_id, s.class_id, e.department_id, e.position_id
       FROM users u
       LEFT JOIN students s ON u.id = s.user_id
       LEFT JOIN employees e ON u.id = e.user_id
       WHERE u.organization_id = ?`,
      [req.organizationId]
    );
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/users', authenticateToken, requireOrganization, async (req, res) => {
  const { firstName, lastName, email, card_uid, role, gender, phone, section_id, class_id, department_id, position_id } = req.body;
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const [result] = await connection.execute(
      `INSERT INTO users (first_name, last_name, email, card_uid, role, gender, phone, organization_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [firstName, lastName, email || null, card_uid, role, gender, phone || null, req.organizationId]
    );
    
    const userId = result.insertId;
    
    if (role === 'student') {
      await connection.execute(
        `INSERT INTO students (user_id, section_id, class_id, enrollment_date) VALUES (?, ?, ?, NOW())`,
        [userId, section_id, class_id]
      );
    } else if (role === 'employee' || role === 'teacher') {
      await connection.execute(
        `INSERT INTO employees (user_id, department_id, position_id, hire_date) VALUES (?, ?, ?, NOW())`,
        [userId, department_id, position_id]
      );
    }
    
    await connection.commit();
    res.json({ success: true, data: { id: userId } });
  } catch (error) {
    await connection.rollback();
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    connection.release();
  }
});

app.put('/api/users/:userId', authenticateToken, requireOrganization, async (req, res) => {
  const { userId } = req.params;
  const { firstName, lastName, email, card_uid, is_active } = req.body;
  
  try {
    await pool.execute(
      'UPDATE users SET first_name = ?, last_name = ?, email = ?, card_uid = ?, is_active = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?',
      [firstName, lastName, email || null, card_uid, is_active ? 1 : 0, userId, req.organizationId]
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
    await pool.execute('DELETE FROM users WHERE id = ? AND organization_id = ?', [userId, req.organizationId]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'CSMS Backend is running', timestamp: new Date().toISOString() });
});

// Catch-all for debugging
app.get('/', (req, res) => {
  res.json({ message: 'CSMS Backend API', endpoints: ['/api/auth/login', '/api/health', '/v1/verify'] });
});

// ============ START SERVER ============
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ CSMS Backend running on port ${PORT}`);
  console.log(`📍 API URL: https://api.csm.cwanda.site:${PORT}`);
  console.log(`🔐 JWT auth enabled`);
});

export default app;