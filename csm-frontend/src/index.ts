// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'csm',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use(cors());
app.use(express.json());

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify admin token
const verifyToken = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const [admins] = await pool.execute(
      'SELECT * FROM admins WHERE id = ? AND is_verified = 1',
      [decoded.id]
    );
    
    if ((admins as any[]).length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    
    req.admin = (admins as any[])[0];
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

// ==================== AUTH ENDPOINTS ====================

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const [admins] = await pool.execute(
      `SELECT a.*, o.org_name as organization_name, o.type as organization_type 
       FROM admins a 
       JOIN organizations o ON a.organization_id = o.id 
       WHERE a.email = ?`,
      [email]
    );
    
    const admin = (admins as any[])[0];
    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      // Increment failed login attempts
      await pool.execute(
        'UPDATE admins SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?',
        [admin.id]
      );
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Reset failed attempts and update last login
    await pool.execute(
      'UPDATE admins SET failed_login_attempts = 0, last_login = NOW() WHERE id = ?',
      [admin.id]
    );
    
    const token = jwt.sign(
      { id: admin.id, email: admin.email, organizationId: admin.organization_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Create session
    const sessionToken = uuidv4();
    await pool.execute(
      'INSERT INTO admin_sessions (admin_id, session_token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
      [admin.id, sessionToken, req.ip, req.headers['user-agent']]
    );
    
    res.json({
      success: true,
      data: {
        token,
        admin: {
          id: admin.id,
          firstName: admin.first_name,
          lastName: admin.last_name,
          email: admin.email,
          username: admin.username,
          profile: admin.profile,
          organizationId: admin.organization_id,
          organizationName: admin.organization_name,
          organizationType: admin.organization_type,
          isVerified: admin.is_verified === 1,
          plan: admin.plan || 'free_trial'
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { firstName, lastName, email, username, password, orgName, orgType, orgAddress, orgEmail, orgPhone, plan } = req.body;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Check if email exists
    const [existing] = await connection.execute(
      'SELECT id FROM admins WHERE email = ?',
      [email]
    );
    
    if ((existing as any[]).length > 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }
    
    // Create organization
    const [orgResult] = await connection.execute(
      `INSERT INTO organizations (org_name, type, address, contact_email, contact_phone, api_page, subscription_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orgName, orgType, orgAddress, orgEmail, orgPhone, uuidv4(), 'inactive']
    );
    
    const organizationId = (orgResult as any).insertId;
    
    // Create admin
    const passwordHash = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const [adminResult] = await connection.execute(
      `INSERT INTO admins (organization_id, first_name, last_name, email, username, password_hash, verification_code, is_verified, code_expiry_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
      [organizationId, firstName, lastName, email, username, passwordHash, verificationCode, 0]
    );
    
    await connection.commit();
    
    // In production, send verification email here
    console.log(`Verification code for ${email}: ${verificationCode}`);
    
    res.json({
      success: true,
      data: {
        admin: {
          id: (adminResult as any).insertId,
          firstName,
          lastName,
          email,
          username,
          organizationId,
          organizationName: orgName,
          organizationType: orgType,
          isVerified: false,
          plan: 'free_trial'
        }
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    connection.release();
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  const { code, email } = req.body;
  
  try {
    const [admins] = await pool.execute(
      'SELECT * FROM admins WHERE email = ? AND verification_code = ? AND code_expiry_time > NOW()',
      [email, code]
    );
    
    if ((admins as any[]).length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code' });
    }
    
    await pool.execute(
      'UPDATE admins SET is_verified = 1, verification_code = NULL, code_expiry_time = NULL WHERE email = ?',
      [email]
    );
    
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/auth/resend-code', async (req, res) => {
  const { email } = req.body;
  
  try {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    await pool.execute(
      'UPDATE admins SET verification_code = ?, code_expiry_time = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE email = ?',
      [newCode, email]
    );
    
    console.log(`New verification code for ${email}: ${newCode}`);
    res.json({ success: true, message: 'New code sent' });
  } catch (error) {
    console.error('Resend code error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  try {
    const resetToken = uuidv4();
    await pool.execute(
      `UPDATE admins SET password_reset_token = ?, password_reset_expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR) 
       WHERE email = ?`,
      [resetToken, email]
    );
    
    console.log(`Password reset token for ${email}: ${resetToken}`);
    res.json({ success: true, message: 'Password reset link sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  
  try {
    const [admins] = await pool.execute(
      'SELECT * FROM admins WHERE password_reset_token = ? AND password_reset_expires_at > NOW()',
      [token]
    );
    
    if ((admins as any[]).length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired token' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.execute(
      'UPDATE admins SET password_hash = ?, password_reset_token = NULL, password_reset_expires_at = NULL WHERE id = ?',
      [passwordHash, (admins as any[])[0].id]
    );
    
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/api/auth/profile', verifyToken, async (req, res) => {
  try {
    const admin = req.admin;
    const [orgs] = await pool.execute(
      'SELECT org_name, type FROM organizations WHERE id = ?',
      [admin.organization_id]
    );
    
    const organization = (orgs as any[])[0];
    
    res.json({
      success: true,
      data: {
        id: admin.id,
        firstName: admin.first_name,
        lastName: admin.last_name,
        email: admin.email,
        username: admin.username,
        profile: admin.profile,
        organizationId: admin.organization_id,
        organizationName: organization.org_name,
        organizationType: organization.type,
        isVerified: admin.is_verified === 1
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.put('/api/auth/profile', verifyToken, async (req, res) => {
  const { firstName, lastName, username, email, currentPassword, newPassword } = req.body;
  
  try {
    if (currentPassword && newPassword) {
      const [admins] = await pool.execute(
        'SELECT password_hash FROM admins WHERE id = ?',
        [req.admin.id]
      );
      
      const validPassword = await bcrypt.compare(currentPassword, (admins as any[])[0].password_hash);
      if (!validPassword) {
        return res.status(400).json({ success: false, error: 'Current password is incorrect' });
      }
      
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await pool.execute(
        'UPDATE admins SET password_hash = ? WHERE id = ?',
        [newPasswordHash, req.admin.id]
      );
    }
    
    let updateFields = [];
    let values = [];
    
    if (firstName) {
      updateFields.push('first_name = ?');
      values.push(firstName);
    }
    if (lastName) {
      updateFields.push('last_name = ?');
      values.push(lastName);
    }
    if (username) {
      updateFields.push('username = ?');
      values.push(username);
    }
    if (email && email !== req.admin.email) {
      updateFields.push('new_email = ?');
      values.push(email);
    }
    
    if (updateFields.length > 0) {
      values.push(req.admin.id);
      await pool.execute(
        `UPDATE admins SET ${updateFields.join(', ')} WHERE id = ?`,
        values
      );
    }
    
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/auth/logout', verifyToken, async (req, res) => {
  try {
    await pool.execute(
      'UPDATE admin_sessions SET logout_at = NOW() WHERE admin_id = ? AND logout_at IS NULL',
      [req.admin.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ==================== USERS ENDPOINTS ====================

app.get('/api/users', verifyToken, async (req, res) => {
  const { org_id } = req.query;
  
  try {
    const [users] = await pool.execute(
      `SELECT u.*, 
        s.sections_id as section_id, s.class as student_class,
        d.name as department_name, e.position as employee_position
       FROM users u
       LEFT JOIN student s ON u.id = s.user_id
       LEFT JOIN employee e ON u.id = e.user_id
       LEFT JOIN departments d ON e.departments_id = d.id
       WHERE u.organization_id = ? AND u.is_active = 1`,
      [org_id]
    );
    
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/users', verifyToken, async (req, res) => {
  const { first_name, last_name, email, phone, role, section_id, class_name, department_id, position, gender, country, province, city } = req.body;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Generate unique card UID
    const cardUid = Math.random().toString(36).substring(2, 10).toUpperCase();
    const backupCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const [userResult] = await connection.execute(
      `INSERT INTO users (organization_id, first_name, last_name, email, phone, role, card_uid, backup_code, added_by, gender, country, province, city)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.admin.organization_id, first_name, last_name, email, phone, role, cardUid, backupCode, req.admin.id, gender, country, province, city]
    );
    
    const userId = (userResult as any).insertId;
    
    if (role === 'student' && section_id) {
      await connection.execute(
        'INSERT INTO student (user_id, sections_id, class) VALUES (?, ?, ?)',
        [userId, section_id, class_name]
      );
    } else if (role === 'employee' && department_id) {
      await connection.execute(
        'INSERT INTO employee (user_id, departments_id, position) VALUES (?, ?, ?)',
        [userId, department_id, position]
      );
    }
    
    await connection.commit();
    
    res.json({ success: true, data: { id: userId, cardUid, backupCode } });
  } catch (error) {
    await connection.rollback();
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    connection.release();
  }
});

app.put('/api/users/:userId', verifyToken, async (req, res) => {
  const { userId } = req.params;
  const updates = req.body;
  
  try {
    const fields = [];
    const values = [];
    
    const allowedFields = ['first_name', 'last_name', 'email', 'phone', 'is_active', 'gender', 'country', 'province', 'city'];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }
    
    if (fields.length > 0) {
      values.push(userId);
      await pool.execute(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`,
        [...values, req.admin.organization_id]
      );
    }
    
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.delete('/api/users/:userId', verifyToken, async (req, res) => {
  const { userId } = req.params;
  
  try {
    await pool.execute(
      'UPDATE users SET is_active = 0 WHERE id = ? AND organization_id = ?',
      [userId, req.admin.organization_id]
    );
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ==================== DEVICES ENDPOINTS ====================

app.get('/api/devices', verifyToken, async (req, res) => {
  const { org_id } = req.query;
  
  try {
    const [devices] = await pool.execute(
      `SELECT d.*, 
        ds.is_online, ds.last_seen as last_online
       FROM devices d
       LEFT JOIN device_status ds ON d.id = ds.device_id
       WHERE d.organization_id = ? AND d.status = 'active'`,
      [org_id]
    );
    
    res.json({ success: true, data: devices });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/devices', verifyToken, async (req, res) => {
  const { device_name, unique_device_id, device_type } = req.body;
  
  try {
    const [result] = await pool.execute(
      `INSERT INTO devices (organization_id, device_name, unique_device_id, device_type, added_by)
       VALUES (?, ?, ?, ?, ?)`,
      [req.admin.organization_id, device_name, unique_device_id, device_type, req.admin.id]
    );
    
    // Initialize device status
    await pool.execute(
      `INSERT INTO device_status (device_id, status, is_online) VALUES (?, 1, 1)`,
      [(result as any).insertId]
    );
    
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error) {
    console.error('Add device error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.put('/api/devices/:deviceId', verifyToken, async (req, res) => {
  const { deviceId } = req.params;
  const { device_name, status } = req.body;
  
  try {
    if (device_name) {
      await pool.execute(
        'UPDATE devices SET device_name = ? WHERE id = ? AND organization_id = ?',
        [device_name, deviceId, req.admin.organization_id]
      );
    }
    
    if (status) {
      await pool.execute(
        'UPDATE devices SET status = ? WHERE id = ? AND organization_id = ?',
        [status, deviceId, req.admin.organization_id]
      );
    }
    
    res.json({ success: true, message: 'Device updated successfully' });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.delete('/api/devices/:deviceId', verifyToken, async (req, res) => {
  const { deviceId } = req.params;
  
  try {
    await pool.execute(
      'UPDATE devices SET status = "inactive" WHERE id = ? AND organization_id = ?',
      [deviceId, req.admin.organization_id]
    );
    
    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/devices/wifi', verifyToken, async (req, res) => {
  const { deviceId, ssid, password, api } = req.body;
  
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM wifi_credentials WHERE device_id = ?',
      [deviceId]
    );
    
    if ((existing as any[]).length > 0) {
      await pool.execute(
        'UPDATE wifi_credentials SET ssid = ?, password = ?, api = ? WHERE device_id = ?',
        [ssid, password, api, deviceId]
      );
    } else {
      await pool.execute(
        `INSERT INTO wifi_credentials (admin_id, device_id, organization_id, device_name, ssid, password, api)
         SELECT ?, ?, organization_id, device_name, ?, ?, ? FROM devices WHERE id = ?`,
        [req.admin.id, deviceId, ssid, password, api, deviceId]
      );
    }
    
    res.json({ success: true, message: 'WiFi credentials updated' });
  } catch (error) {
    console.error('Update WiFi error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ==================== ATTENDANCE ENDPOINTS ====================

app.post('/api/attendance/record', async (req, res) => {
  const { card_uid, device_id, method, name } = req.body;
  
  try {
    const [users] = await pool.execute(
      'SELECT id, first_name, last_name FROM users WHERE card_uid = ? AND is_active = 1',
      [card_uid]
    );
    
    if ((users as any[]).length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = (users as any[])[0];
    
    // Check if already checked in today
    const today = new Date().toISOString().split('T')[0];
    const [existing] = await pool.execute(
      `SELECT * FROM attendance 
       WHERE user_id = ? AND DATE(timestamp) = ? AND status = 'check_in'`,
      [user.id, today]
    );
    
    let status = 'check_in';
    if ((existing as any[]).length > 0) {
      status = 'check_out';
    }
    
    await pool.execute(
      `INSERT INTO attendance (name, user_id, device_id, method, status)
       VALUES (?, ?, ?, ?, ?)`,
      [name || 'Default', user.id, device_id, method, status]
    );
    
    // Record card action
    await pool.execute(
      'INSERT INTO card_action (users_id, tapped_at, device_id) VALUES (?, UNIX_TIMESTAMP(), ?)',
      [user.id, device_id]
    );
    
    res.json({
      success: true,
      data: {
        user: `${user.first_name} ${user.last_name}`,
        status,
        time: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Record attendance error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/api/attendance/:orgId', verifyToken, async (req, res) => {
  const { orgId } = req.params;
  const { start_date, end_date, user_id } = req.query;
  
  try {
    let query = `
      SELECT a.*, u.first_name, u.last_name, u.email, u.role
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE u.organization_id = ?
    `;
    const params: any[] = [orgId];
    
    if (start_date) {
      query += ' AND DATE(a.timestamp) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND DATE(a.timestamp) <= ?';
      params.push(end_date);
    }
    if (user_id) {
      query += ' AND a.user_id = ?';
      params.push(user_id);
    }
    
    query += ' ORDER BY a.timestamp DESC';
    
    const [attendance] = await pool.execute(query, params);
    res.json({ success: true, data: attendance });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ==================== SECTIONS ENDPOINTS ====================

app.get('/api/sections', verifyToken, async (req, res) => {
  try {
    const [sections] = await pool.execute(
      'SELECT * FROM sections WHERE student_id = ?',
      [req.admin.organization_id]
    );
    res.json({ success: true, data: sections });
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/sections', verifyToken, async (req, res) => {
  const { name } = req.body;
  
  try {
    const [result] = await pool.execute(
      'INSERT INTO sections (student_id, name) VALUES (?, ?)',
      [req.admin.organization_id, name]
    );
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error) {
    console.error('Create section error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.put('/api/sections/:sectionId', verifyToken, async (req, res) => {
  const { sectionId } = req.params;
  const { name } = req.body;
  
  try {
    await pool.execute(
      'UPDATE sections SET name = ? WHERE id = ? AND student_id = ?',
      [name, sectionId, req.admin.organization_id]
    );
    res.json({ success: true, message: 'Section updated' });
  } catch (error) {
    console.error('Update section error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.delete('/api/sections/:sectionId', verifyToken, async (req, res) => {
  const { sectionId } = req.params;
  
  try {
    await pool.execute(
      'DELETE FROM sections WHERE id = ? AND student_id = ?',
      [sectionId, req.admin.organization_id]
    );
    res.json({ success: true, message: 'Section deleted' });
  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ==================== DEPARTMENTS ENDPOINTS ====================

app.get('/api/departments', verifyToken, async (req, res) => {
  try {
    const [departments] = await pool.execute(
      'SELECT * FROM departments WHERE employee_id = ?',
      [req.admin.organization_id]
    );
    res.json({ success: true, data: departments });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/departments', verifyToken, async (req, res) => {
  const { name } = req.body;
  
  try {
    const [result] = await pool.execute(
      'INSERT INTO departments (employee_id, name) VALUES (?, ?)',
      [req.admin.organization_id, name]
    );
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.put('/api/departments/:departmentId', verifyToken, async (req, res) => {
  const { departmentId } = req.params;
  const { name } = req.body;
  
  try {
    await pool.execute(
      'UPDATE departments SET name = ? WHERE id = ? AND employee_id = ?',
      [name, departmentId, req.admin.organization_id]
    );
    res.json({ success: true, message: 'Department updated' });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.delete('/api/departments/:departmentId', verifyToken, async (req, res) => {
  const { departmentId } = req.params;
  
  try {
    await pool.execute(
      'DELETE FROM departments WHERE id = ? AND employee_id = ?',
      [departmentId, req.admin.organization_id]
    );
    res.json({ success: true, message: 'Department deleted' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ==================== LIVE VIEW ENDPOINTS ====================

// Store live view tokens
const liveViewTokens = new Map();

app.post('/api/live-view/create', verifyToken, async (req, res) => {
  const { expires_in_hours } = req.body;
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (expires_in_hours || 1));
  
  liveViewTokens.set(token, {
    organizationId: req.admin.organization_id,
    expiresAt,
    createdAt: new Date()
  });
  
  // Schedule cleanup
  setTimeout(() => {
    liveViewTokens.delete(token);
  }, expires_in_hours * 60 * 60 * 1000);
  
  const shareUrl = `${req.protocol}://${req.get('host')}/live/${token}`;
  res.json({ success: true, data: { shareUrl, expiresAt } });
});

app.get('/api/live-view/:token', async (req, res) => {
  const { token } = req.params;
  const viewData = liveViewTokens.get(token);
  
  if (!viewData || new Date() > viewData.expiresAt) {
    return res.status(404).send(`
      <html>
        <head><title>Link Expired</title></head>
        <body style="font-family: system-ui; text-align: center; padding: 50px;">
          <h1>🔗 Link Expired</h1>
          <p>This live view link has expired. Please request a new link from your administrator.</p>
        </body>
      </html>
    `);
  }
  
  // Fetch real-time attendance data
  const [attendance] = await pool.execute(
    `SELECT a.*, u.first_name, u.last_name, u.role
     FROM attendance a
     JOIN users u ON a.user_id = u.id
     WHERE u.organization_id = ?
     ORDER BY a.timestamp DESC
     LIMIT 50`,
    [viewData.organizationId]
  );
  
  // Return HTML for live view
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Live Attendance View</title>
      <meta http-equiv="refresh" content="5">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .header {
          background: white;
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }
        .stat-card {
          background: white;
          border-radius: 15px;
          padding: 15px;
          text-align: center;
          box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .stat-number {
          font-size: 32px;
          font-weight: bold;
          color: #667eea;
        }
        .stat-label {
          color: #666;
          font-size: 14px;
          margin-top: 5px;
        }
        .attendance-table {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 15px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }
        th {
          background: #f8f9fa;
          font-weight: 600;
          color: #333;
        }
        .status-check_in {
          color: #10b981;
          font-weight: 500;
        }
        .status-check_out {
          color: #f59e0b;
          font-weight: 500;
        }
        .refresh-badge {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
        }
        @media (max-width: 768px) {
          th, td { padding: 10px; font-size: 12px; }
          .stat-number { font-size: 24px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Live Attendance View</h1>
          <p>Real-time check-ins and check-outs</p>
        </div>
        
        <div class="stats">
          <div class="stat-card">
            <div class="stat-number" id="totalCount">${(attendance as any[]).length}</div>
            <div class="stat-label">Recent Records</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" id="checkInCount">${(attendance as any[]).filter((a: any) => a.status === 'check_in').length}</div>
            <div class="stat-label">Check-ins</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" id="checkOutCount">${(attendance as any[]).filter((a: any) => a.status === 'check_out').length}</div>
            <div class="stat-label">Check-outs</div>
          </div>
        </div>
        
        <div class="attendance-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Time</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              ${(attendance as any[]).map((record: any) => `
                <tr>
                  <td><strong>${record.first_name} ${record.last_name}</strong></td>
                  <td><span style="background: #f0f0f0; padding: 4px 8px; border-radius: 8px; font-size: 12px;">${record.role}</span></td>
                  <td class="status-${record.status}">${record.status === 'check_in' ? '✅ Check In' : '📤 Check Out'}</td>
                  <td>${new Date(record.timestamp).toLocaleTimeString()}</td>
                  <td>${record.method}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="refresh-badge">
          🔄 Auto-refreshes every 5 seconds
        </div>
      </div>
      
      <script>
        // Auto-refresh the page every 5 seconds
        setTimeout(() => {
          location.reload();
        }, 5000);
      </script>
    </body>
    </html>
  `);
});

// ==================== BILLING ENDPOINTS ====================

app.get('/api/billing/info', verifyToken, async (req, res) => {
  try {
    const [org] = await pool.execute(
      'SELECT * FROM organizations WHERE id = ?',
      [req.admin.organization_id]
    );
    
    const organization = (org as any[])[0];
    
    // Get usage stats
    const [[userCount]] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND is_active = 1',
      [req.admin.organization_id]
    );
    
    const [[deviceCount]] = await pool.execute(
      'SELECT COUNT(*) as count FROM devices WHERE organization_id = ? AND status = "active"',
      [req.admin.organization_id]
    );
    
    res.json({
      success: true,
      data: {
        plan: organization.subscription_status,
        expiresAt: organization.subscription_expires_at,
        usersCount: (userCount as any).count,
        devicesCount: (deviceCount as any).count,
        maxUsers: organization.subscription_status === 'active' ? 1000 : 100,
        maxDevices: organization.subscription_status === 'active' ? 50 : 10
      }
    });
  } catch (error) {
    console.error('Get billing info error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/billing/upgrade', verifyToken, async (req, res) => {
  const { plan } = req.body;
  
  try {
    // In production, integrate with payment gateway here
    await pool.execute(
      `UPDATE organizations 
       SET subscription_status = ?, subscription_expires_at = DATE_ADD(NOW(), INTERVAL 1 MONTH)
       WHERE id = ?`,
      [plan, req.admin.organization_id]
    );
    
    res.json({ success: true, message: 'Plan upgraded successfully' });
  } catch (error) {
    console.error('Upgrade plan error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ==================== ORGANIZATION ENDPOINTS ====================

app.get('/api/organizations/:orgId', verifyToken, async (req, res) => {
  const { orgId } = req.params;
  
  try {
    const [org] = await pool.execute(
      'SELECT * FROM organizations WHERE id = ?',
      [orgId]
    );
    
    res.json({ success: true, data: (org as any[])[0] });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.put('/api/organizations/:orgId', verifyToken, async (req, res) => {
  const { orgId } = req.params;
  const { org_name, address, contact_email, contact_phone } = req.body;
  
  try {
    await pool.execute(
      'UPDATE organizations SET org_name = ?, address = ?, contact_email = ?, contact_phone = ? WHERE id = ?',
      [org_name, address, contact_email, contact_phone, orgId]
    );
    
    res.json({ success: true, message: 'Organization updated' });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});