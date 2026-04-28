// csmsb/routes/userRoutes.js
import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { authenticateToken, requireOrganization, canManageUsers } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireOrganization);

// Get user limit info
router.get('/limit-info', canManageUsers, async (req, res) => {
  res.json({ success: true, data: req.userLimitInfo });
});

// Get enhanced users with category info
router.get('/enhanced', async (req, res) => {
  const { type } = req.query;
  
  try {
    let query = `
      SELECT 
        u.*,
        CASE 
          WHEN u.role = 'student' THEN s.name
          WHEN u.role = 'employee' THEN d.name
        END as custom_category_name,
        CASE 
          WHEN u.role = 'student' THEN s.id
          WHEN u.role = 'employee' THEN d.id
        END as custom_category_id,
        CASE 
          WHEN u.role = 'student' AND c.name IS NOT NULL THEN c.name
          WHEN u.role = 'employee' AND p.name IS NOT NULL THEN p.name
        END as custom_value
      FROM users u
      LEFT JOIN students st ON u.id = st.user_id AND u.role = 'student'
      LEFT JOIN sections s ON st.section_id = s.id
      LEFT JOIN classes c ON st.class_id = c.id
      LEFT JOIN employees e ON u.id = e.user_id AND u.role = 'employee'
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      WHERE u.organization_id = ?
    `;
    
    const params = [req.organizationId];
    
    if (type && type !== 'all') {
      query += ' AND u.role = ?';
      params.push(type);
    }
    
    query += ' ORDER BY u.created_at DESC';
    
    const [users] = await pool.execute(query, params);
    
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get enhanced users error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// Get single enhanced user
router.get('/enhanced/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const [users] = await pool.execute(
      `SELECT u.*, 
        st.section_id, st.class_id, st.roll_number, st.parent_name, st.parent_phone, st.parent_email,
        e.department_id, e.position_id, e.employee_id, e.hire_date, e.salary
       FROM users u
       LEFT JOIN students st ON u.id = st.user_id AND u.role = 'student'
       LEFT JOIN employees e ON u.id = e.user_id AND u.role = 'employee'
       WHERE u.id = ? AND u.organization_id = ?`,
      [userId, req.organizationId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ success: true, data: users[0] });
  } catch (error) {
    console.error('Get enhanced user error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

// Create enhanced user
router.post('/enhanced', canManageUsers, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Check user limit
    if (!req.userLimitInfo.canAddMore && req.userLimitInfo.maxUsers !== Infinity) {
      await connection.rollback();
      return res.status(403).json({ 
        success: false, 
        error: `Maximum user limit reached (${req.userLimitInfo.maxUsers}). Please upgrade your plan.` 
      });
    }
    
    const {
      firstName, lastName, email, phone, role, gender, country, province, city,
      card_uid, backup_code, is_active = true, image,
      section_id, class_id, roll_number, parent_name, parent_phone, parent_email, admission_date,
      department_id, position_id, employee_id, hire_date, salary, emergency_contact, emergency_phone
    } = req.body;
    
    if (!firstName || !lastName || !role) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'First name, last name, and role are required' });
    }
    
    // Check if card UID is unique
    if (card_uid) {
      const [existingCard] = await connection.execute(
        'SELECT id FROM users WHERE card_uid = ? AND organization_id = ?',
        [card_uid, req.organizationId]
      );
      if (existingCard.length > 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'Card UID already assigned to another user' });
      }
    }
    
    // Generate random password for new user
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    // Create user
    const [userResult] = await connection.execute(
      `INSERT INTO users 
       (organization_id, first_name, last_name, image, email, phone, gender, country, province, city, 
        role, card_uid, backup_code, is_active, added_by, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [req.organizationId, firstName, lastName, image || null, email || null, phone || null, 
       gender || null, country || null, province || null, city || null, role, 
       card_uid || null, backup_code || null, is_active ? 1 : 0, req.adminId]
    );
    
    const userId = userResult.insertId;
    
    // Create role-specific record
    if (role === 'student') {
      if (!section_id) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'Section ID required for students' });
      }
      
      await connection.execute(
        `INSERT INTO students 
         (user_id, section_id, class_id, roll_number, parent_name, parent_phone, parent_email, admission_date, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, section_id, class_id || null, roll_number || null, parent_name || null, 
         parent_phone || null, parent_email || null, admission_date || null]
      );
    } else if (role === 'employee') {
      if (!department_id) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'Department ID required for employees' });
      }
      
      await connection.execute(
        `INSERT INTO employees 
         (user_id, department_id, position_id, employee_id, hire_date, salary, emergency_contact, emergency_phone, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, department_id, position_id || null, employee_id || null, hire_date || null, 
         salary || null, emergency_contact || null, emergency_phone || null]
      );
    }
    
    await connection.commit();
    
    res.json({ 
      success: true, 
      data: { id: userId, tempPassword: tempPassword },
      message: 'User created successfully'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Create enhanced user error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  } finally {
    connection.release();
  }
});

// Update enhanced user
router.put('/enhanced/:userId', async (req, res) => {
  const connection = await pool.getConnection();
  const { userId } = req.params;
  
  try {
    await connection.beginTransaction();
    
    const {
      first_name, last_name, email, phone, gender, country, province, city,
      card_uid, backup_code, is_active, image,
      section_id, class_id, roll_number, parent_name, parent_phone, parent_email, admission_date,
      department_id, position_id, employee_id, hire_date, salary, emergency_contact, emergency_phone
    } = req.body;
    
    // Check if user exists
    const [users] = await connection.execute(
      'SELECT id, role FROM users WHERE id = ? AND organization_id = ?',
      [userId, req.organizationId]
    );
    
    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const userRole = users[0].role;
    
    // Update user
    await connection.execute(
      `UPDATE users SET 
        first_name = ?, last_name = ?, email = ?, phone = ?, gender = ?, 
        country = ?, province = ?, city = ?, card_uid = ?, backup_code = ?, 
        is_active = ?, image = ?, updated_at = NOW() 
       WHERE id = ? AND organization_id = ?`,
      [first_name, last_name, email || null, phone || null, gender || null,
       country || null, province || null, city || null, card_uid || null, backup_code || null,
       is_active ? 1 : 0, image || null, userId, req.organizationId]
    );
    
    // Update role-specific record
    if (userRole === 'student') {
      await connection.execute(
        `UPDATE students SET 
          section_id = ?, class_id = ?, roll_number = ?, parent_name = ?, 
          parent_phone = ?, parent_email = ?, admission_date = ?, updated_at = NOW() 
         WHERE user_id = ?`,
        [section_id || null, class_id || null, roll_number || null, parent_name || null,
         parent_phone || null, parent_email || null, admission_date || null, userId]
      );
    } else if (userRole === 'employee') {
      await connection.execute(
        `UPDATE employees SET 
          department_id = ?, position_id = ?, employee_id = ?, hire_date = ?, 
          salary = ?, emergency_contact = ?, emergency_phone = ?, updated_at = NOW() 
         WHERE user_id = ?`,
        [department_id || null, position_id || null, employee_id || null, hire_date || null,
         salary || null, emergency_contact || null, emergency_phone || null, userId]
      );
    }
    
    await connection.commit();
    
    res.json({ success: true, message: 'User updated successfully' });
    
  } catch (error) {
    await connection.rollback();
    console.error('Update enhanced user error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  } finally {
    connection.release();
  }
});

// Search users
router.get('/search', async (req, res) => {
  const { query, role, section_id, class_id, department_id, position_id, status } = req.query;
  
  try {
    let sql = `
      SELECT u.*,
        CASE 
          WHEN u.role = 'student' THEN s.name
          WHEN u.role = 'employee' THEN d.name
        END as custom_category_name,
        CASE 
          WHEN u.role = 'student' AND c.name IS NOT NULL THEN c.name
          WHEN u.role = 'employee' AND p.name IS NOT NULL THEN p.name
        END as custom_value
      FROM users u
      LEFT JOIN students st ON u.id = st.user_id AND u.role = 'student'
      LEFT JOIN sections s ON st.section_id = s.id
      LEFT JOIN classes c ON st.class_id = c.id
      LEFT JOIN employees e ON u.id = e.user_id AND u.role = 'employee'
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      WHERE u.organization_id = ?
    `;
    
    const params = [req.organizationId];
    
    if (query) {
      sql += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
      const searchParam = `%${query}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    if (role && role !== 'all') {
      sql += ' AND u.role = ?';
      params.push(role);
    }
    
    if (section_id) {
      sql += ' AND st.section_id = ?';
      params.push(section_id);
    }
    
    if (class_id) {
      sql += ' AND st.class_id = ?';
      params.push(class_id);
    }
    
    if (department_id) {
      sql += ' AND e.department_id = ?';
      params.push(department_id);
    }
    
    if (position_id) {
      sql += ' AND e.position_id = ?';
      params.push(position_id);
    }
    
    if (status === 'active') {
      sql += ' AND u.is_active = 1';
    } else if (status === 'inactive') {
      sql += ' AND u.is_active = 0';
    }
    
    sql += ' ORDER BY u.created_at DESC';
    
    const [users] = await pool.execute(sql, params);
    
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ success: false, error: 'Failed to search users' });
  }
});

// Get user statistics
router.get('/statistics', async (req, res) => {
  try {
    const [totalUsers] = await pool.execute(
      'SELECT COUNT(*) as total FROM users WHERE organization_id = ?',
      [req.organizationId]
    );
    
    const [activeUsers] = await pool.execute(
      'SELECT COUNT(*) as active FROM users WHERE organization_id = ? AND is_active = 1',
      [req.organizationId]
    );
    
    const [students] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND role = "student"',
      [req.organizationId]
    );
    
    const [employees] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND role = "employee"',
      [req.organizationId]
    );
    
    const [withCards] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND card_uid IS NOT NULL',
      [req.organizationId]
    );
    
    res.json({ 
      success: true, 
      data: {
        total: totalUsers[0].total,
        active: activeUsers[0].active,
        inactive: totalUsers[0].total - activeUsers[0].active,
        students: students[0].count,
        employees: employees[0].count,
        withCards: withCards[0].count
      }
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ success: false, error: 'Failed to get statistics' });
  }
});

// Get students by section
router.get('/by-section/:sectionId', async (req, res) => {
  const { sectionId } = req.params;
  
  try {
    const [students] = await pool.execute(
      `SELECT u.*, st.roll_number, st.parent_name, st.parent_phone
       FROM users u
       JOIN students st ON u.id = st.user_id
       WHERE u.organization_id = ? AND u.role = 'student' AND st.section_id = ?
       ORDER BY u.last_name, u.first_name`,
      [req.organizationId, sectionId]
    );
    
    res.json({ success: true, data: students });
  } catch (error) {
    console.error('Get students by section error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch students' });
  }
});

// Get students by class
router.get('/by-class/:classId', async (req, res) => {
  const { classId } = req.params;
  
  try {
    const [students] = await pool.execute(
      `SELECT u.*, st.roll_number, st.parent_name, st.parent_phone
       FROM users u
       JOIN students st ON u.id = st.user_id
       WHERE u.organization_id = ? AND u.role = 'student' AND st.class_id = ?
       ORDER BY u.last_name, u.first_name`,
      [req.organizationId, classId]
    );
    
    res.json({ success: true, data: students });
  } catch (error) {
    console.error('Get students by class error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch students' });
  }
});

// Get employees by department
router.get('/by-department/:departmentId', async (req, res) => {
  const { departmentId } = req.params;
  
  try {
    const [employees] = await pool.execute(
      `SELECT u.*, e.employee_id, e.position_id, p.name as position_name
       FROM users u
       JOIN employees e ON u.id = e.user_id
       LEFT JOIN positions p ON e.position_id = p.id
       WHERE u.organization_id = ? AND u.role = 'employee' AND e.department_id = ?
       ORDER BY u.last_name, u.first_name`,
      [req.organizationId, departmentId]
    );
    
    res.json({ success: true, data: employees });
  } catch (error) {
    console.error('Get employees by department error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employees' });
  }
});

// Get employees by position
router.get('/by-position/:positionId', async (req, res) => {
  const { positionId } = req.params;
  
  try {
    const [employees] = await pool.execute(
      `SELECT u.*, e.employee_id, e.department_id, d.name as department_name
       FROM users u
       JOIN employees e ON u.id = e.user_id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE u.organization_id = ? AND u.role = 'employee' AND e.position_id = ?
       ORDER BY u.last_name, u.first_name`,
      [req.organizationId, positionId]
    );
    
    res.json({ success: true, data: employees });
  } catch (error) {
    console.error('Get employees by position error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employees' });
  }
});

// Basic CRUD operations (for backward compatibility)
router.get('/', async (req, res) => {
  const [users] = await pool.execute(
    'SELECT id, first_name, last_name, email, phone, role, image, is_active FROM users WHERE organization_id = ?',
    [req.organizationId]
  );
  res.json({ success: true, data: users });
});

router.post('/', canManageUsers, async (req, res) => {
  const { firstName, lastName, email, phone, role, addedBy } = req.body;
  
  if (!req.userLimitInfo.canAddMore && req.userLimitInfo.maxUsers !== Infinity) {
    return res.status(403).json({ 
      success: false, 
      error: `Maximum user limit reached (${req.userLimitInfo.maxUsers}). Please upgrade your plan.` 
    });
  }
  
  const [result] = await pool.execute(
    `INSERT INTO users (first_name, last_name, email, phone, role, organization_id, added_by, is_active, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [firstName, lastName, email || null, phone || null, role, req.organizationId, addedBy || req.adminId]
  );
  
  res.json({ success: true, data: { id: result.insertId } });
});

router.put('/:userId', async (req, res) => {
  const { userId } = req.params;
  const { firstName, lastName, email, phone, is_active } = req.body;
  
  await pool.execute(
    'UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, is_active = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?',
    [firstName, lastName, email || null, phone || null, is_active ? 1 : 0, userId, req.organizationId]
  );
  
  res.json({ success: true, message: 'User updated successfully' });
});

router.delete('/:userId', async (req, res) => {
  const { userId } = req.params;
  
  await pool.execute('DELETE FROM users WHERE id = ? AND organization_id = ?', [userId, req.organizationId]);
  res.json({ success: true, message: 'User deleted successfully' });
});

export default router;