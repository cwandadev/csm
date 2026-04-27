// csmsb/controllers/enhancedUserController.js
import pool from '../config/database.js';

// Get all users with enhanced data (sections/classes for students, departments/positions for employees)
export const getEnhancedUsers = async (req, res) => {
  const { org_id, type } = req.query;
  const organizationId = org_id || req.organizationId;
  
  try {
    let query = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.phone, u.role, 
        u.card_uid, u.backup_code, u.fingerprint_template, u.is_active, u.image, u.gender,
        u.country, u.province, u.city, u.created_at,
        CASE 
          WHEN u.role = 'student' THEN st.class_id
          WHEN u.role = 'employee' THEN e.position_id
          ELSE NULL
        END as custom_value_id,
        CASE 
          WHEN u.role = 'student' THEN c.name
          WHEN u.role = 'employee' THEN p.name
          ELSE NULL
        END as custom_value,
        CASE 
          WHEN u.role = 'student' THEN sec.name
          WHEN u.role = 'employee' THEN d.name
          ELSE NULL
        END as custom_category_name,
        CASE 
          WHEN u.role = 'student' THEN sec.id
          WHEN u.role = 'employee' THEN d.id
          ELSE NULL
        END as custom_category_id
      FROM users u
      LEFT JOIN students st ON u.id = st.user_id AND u.role = 'student'
      LEFT JOIN classes c ON st.class_id = c.id
      LEFT JOIN sections sec ON st.section_id = sec.id
      LEFT JOIN employees e ON u.id = e.user_id AND u.role = 'employee'
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE u.organization_id = ?
    `;
    const params = [organizationId];
    
    if (type && type !== 'all') {
      query += ' AND u.role = ?';
      params.push(type);
    }
    
    query += ' ORDER BY u.created_at DESC';
    
    const [users] = await pool.execute(query, params);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get enhanced users error:', error);
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
};

// Get single enhanced user
export const getEnhancedUser = async (req, res) => {
  const { userId } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [users] = await pool.execute(`
      SELECT 
        u.*,
        st.section_id, st.class_id, st.roll_number, st.parent_name, st.parent_phone, st.parent_email, st.admission_date,
        sec.name as section_name, c.name as class_name,
        e.department_id, e.position_id, e.employee_id, e.hire_date, e.salary, e.emergency_contact, e.emergency_phone,
        d.name as department_name, p.name as position_name
      FROM users u
      LEFT JOIN students st ON u.id = st.user_id AND u.role = 'student'
      LEFT JOIN sections sec ON st.section_id = sec.id
      LEFT JOIN classes c ON st.class_id = c.id
      LEFT JOIN employees e ON u.id = e.user_id AND u.role = 'employee'
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      WHERE u.id = ? AND u.organization_id = ?
    `, [userId, organizationId]);
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ success: true, data: users[0] });
  } catch (error) {
    console.error('Get enhanced user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
};

// Create enhanced user (handles both students and employees)
export const createEnhancedUser = async (req, res) => {
  const {
    firstName, lastName, email, phone, role, gender, country, province, city,
    card_uid, backup_code, fingerprint_template, is_active, image,
    // Student specific
    section_id, class_id, roll_number, parent_name, parent_phone, parent_email, admission_date,
    // Employee specific
    department_id, position_id, employee_id, hire_date, salary, emergency_contact, emergency_phone
  } = req.body;
  
  const organizationId = req.organizationId;
  const adminId = req.adminId;
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Check if user already exists
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE card_uid = ? OR (email = ? AND email IS NOT NULL)',
      [card_uid || null, email || null]
    );
    
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'User with this card or email already exists' });
    }
    
    // Create user
    const [userResult] = await connection.execute(
      `INSERT INTO users (
        organization_id, first_name, last_name, email, phone, role,
        gender, country, province, city, card_uid, backup_code,
        fingerprint_template, is_active, image, added_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        organizationId, firstName, lastName, email || null, phone || null, role,
        gender || null, country || null, province || null, city || null,
        card_uid || null, backup_code || null, fingerprint_template || null,
        is_active !== undefined ? (is_active ? 1 : 0) : 1, image || null, adminId
      ]
    );
    
    const userId = userResult.insertId;
    
    // Create role-specific record
    if (role === 'student') {
      await connection.execute(
        `INSERT INTO students (
          user_id, section_id, class_id, roll_number,
          parent_name, parent_phone, parent_email, admission_date,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          userId, section_id || null, class_id || null, roll_number || null,
          parent_name || null, parent_phone || null, parent_email || null, admission_date || null
        ]
      );
    } else if (role === 'employee') {
      await connection.execute(
        `INSERT INTO employees (
          user_id, department_id, position_id, employee_id, hire_date,
          salary, emergency_contact, emergency_phone, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          userId, department_id || null, position_id || null, employee_id || null,
          hire_date || null, salary || null, emergency_contact || null, emergency_phone || null
        ]
      );
    }
    
    await connection.commit();
    
    res.json({ success: true, data: { id: userId }, message: 'User created successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Create enhanced user error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user', details: error.message });
  } finally {
    connection.release();
  }
};

// Update enhanced user
export const updateEnhancedUser = async (req, res) => {
  const { userId } = req.params;
  const updates = req.body;
  const organizationId = req.organizationId;
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get current user role
    const [users] = await connection.execute(
      'SELECT role FROM users WHERE id = ? AND organization_id = ?',
      [userId, organizationId]
    );
    
    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const currentRole = users[0].role;
    
    // Update user table
    const userFields = [];
    const userValues = [];
    const allowedUserFields = ['first_name', 'last_name', 'email', 'phone', 'gender', 'country', 'province', 'city', 'card_uid', 'backup_code', 'fingerprint_template', 'is_active', 'image'];
    
    for (const field of allowedUserFields) {
      if (updates[field] !== undefined) {
        userFields.push(`${field} = ?`);
        userValues.push(updates[field]);
      }
    }
    
    if (userFields.length > 0) {
      userValues.push(userId);
      await connection.execute(
        `UPDATE users SET ${userFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        userValues
      );
    }
    
    // Update role-specific table based on role
    if (currentRole === 'student') {
      const studentFields = [];
      const studentValues = [];
      const allowedStudentFields = ['section_id', 'class_id', 'roll_number', 'parent_name', 'parent_phone', 'parent_email', 'admission_date'];
      
      for (const field of allowedStudentFields) {
        if (updates[field] !== undefined) {
          studentFields.push(`${field} = ?`);
          studentValues.push(updates[field]);
        }
      }
      
      if (studentFields.length > 0) {
        studentValues.push(userId);
        await connection.execute(
          `UPDATE students SET ${studentFields.join(', ')}, updated_at = NOW() WHERE user_id = ?`,
          studentValues
        );
      }
    } else if (currentRole === 'employee') {
      const employeeFields = [];
      const employeeValues = [];
      const allowedEmployeeFields = ['department_id', 'position_id', 'employee_id', 'hire_date', 'salary', 'emergency_contact', 'emergency_phone'];
      
      for (const field of allowedEmployeeFields) {
        if (updates[field] !== undefined) {
          employeeFields.push(`${field} = ?`);
          employeeValues.push(updates[field]);
        }
      }
      
      if (employeeFields.length > 0) {
        employeeValues.push(userId);
        await connection.execute(
          `UPDATE employees SET ${employeeFields.join(', ')}, updated_at = NOW() WHERE user_id = ?`,
          employeeValues
        );
      }
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
};

// Delete enhanced user
export const deleteEnhancedUser = async (req, res) => {
  const { userId } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [result] = await pool.execute(
      'DELETE FROM users WHERE id = ? AND organization_id = ?',
      [userId, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete enhanced user error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
};