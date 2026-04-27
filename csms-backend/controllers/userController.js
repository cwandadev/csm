// csms-backend/controllers/userController.js
import pool from '../config/database.js';
import { generateTempPassword } from '../utils/generateCode.js';
import emailService from '../services/emailService.js';

// Get all users for organization
export const getUsers = async (req, res) => {
  const { org_id, role, is_active, search } = req.query;
  const organizationId = org_id || req.organizationId;
  
  try {
    let query = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.phone, u.role, 
        u.card_uid, u.backup_code, u.is_active, u.image, u.gender,
        u.country, u.province, u.city, u.created_at,
        CASE 
          WHEN u.role = 'student' THEN st.class_id
          WHEN u.role = 'employee' THEN e.position_id
          ELSE NULL
        END as custom_id,
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
      LEFT JOIN students st ON u.id = st.user_id
      LEFT JOIN classes c ON st.class_id = c.id
      LEFT JOIN sections sec ON st.section_id = sec.id
      LEFT JOIN employees e ON u.id = e.user_id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE u.organization_id = ?
    `;
    const params = [organizationId];
    
    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }
    
    if (is_active !== undefined) {
      query += ' AND u.is_active = ?';
      params.push(is_active);
    }
    
    if (search) {
      query += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.card_uid LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY u.created_at DESC';
    
    const [users] = await pool.execute(query, params);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
};

// Get single user by ID
export const getUserById = async (req, res) => {
  const { userId } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [users] = await pool.execute(
      `SELECT u.*, 
              st.section_id, st.class_id, st.roll_number, st.parent_name, st.parent_phone, st.parent_email,
              sec.name as section_name,
              c.name as class_name,
              e.department_id, e.position_id, e.employee_id, e.hire_date, e.salary,
              d.name as department_name,
              p.name as position_name
       FROM users u
       LEFT JOIN students st ON u.id = st.user_id
       LEFT JOIN sections sec ON st.section_id = sec.id
       LEFT JOIN classes c ON st.class_id = c.id
       LEFT JOIN employees e ON u.id = e.user_id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN positions p ON e.position_id = p.id
       WHERE u.id = ? AND u.organization_id = ?`,
      [userId, organizationId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ success: true, data: users[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
};




















// Create user (student or employee)
export const createUser = async (req, res) => {
  const {
    firstName, lastName, email, phone, role,
    card_uid, backup_code, gender, country, province, city,
    // Student specific fields
    section_id, class_id, roll_number, parent_name, parent_phone, parent_email, admission_date,
    // Employee specific fields
    department_id, position_id, employee_id, hire_date, salary, emergency_contact, emergency_phone
  } = req.body;
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Check if card_uid already exists
    if (card_uid) {
      const [existing] = await connection.execute(
        'SELECT id FROM users WHERE card_uid = ?',
        [card_uid]
      );
      if (existing.length > 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'Card UID already in use' });
      }
    }
    
    // Create user
    const [userResult] = await connection.execute(
      `INSERT INTO users (
        organization_id, first_name, last_name, email, phone, 
        role, card_uid, backup_code, gender, country, province, city, 
        added_by, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [
        req.organizationId, firstName, lastName, email || null, phone || null,
        role, card_uid || null, backup_code || null, gender || null, 
        country || null, province || null, city || null, req.adminId
      ]
    );
    
    const userId = userResult.insertId;
    
    // Create role-specific profile
    if (role === 'student') {
      if (!section_id) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'Section ID is required for students' });
      }
      
      await connection.execute(
        `INSERT INTO students (user_id, section_id, class_id, roll_number, parent_name, parent_phone, parent_email, admission_date, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, section_id, class_id || null, roll_number || null, parent_name || null, parent_phone || null, parent_email || null, admission_date || null]
      );
    } else if (role === 'employee') {
      if (!department_id) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'Department ID is required for employees' });
      }
      
      await connection.execute(
        `INSERT INTO employees (user_id, department_id, position_id, employee_id, hire_date, salary, emergency_contact, emergency_phone, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, department_id, position_id || null, employee_id || null, hire_date || null, salary || null, emergency_contact || null, emergency_phone || null]
      );
    }
    
    await connection.commit();
    
    res.json({ 
      success: true, 
      data: { id: userId },
      message: 'User created successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create user',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
};

















// Update user
export const updateUser = async (req, res) => {
  const { userId } = req.params;
  const updates = req.body;
  const organizationId = req.organizationId;
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Check if user belongs to organization
    const [users] = await connection.execute(
      'SELECT id, role FROM users WHERE id = ? AND organization_id = ?',
      [userId, organizationId]
    );
    
    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = users[0];
    
    // Update main user fields
    const userFields = [];
    const userValues = [];
    
    const allowedUserFields = [
      'first_name', 'last_name', 'email', 'phone', 
      'card_uid', 'backup_code', 'is_active', 'gender', 
      'country', 'province', 'city'
    ];
    
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
    
    // Update role-specific profiles
    if (user.role === 'student') {
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
    } else if (user.role === 'employee') {
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
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  } finally {
    connection.release();
  }
};

// Delete user
export const deleteUser = async (req, res) => {
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
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
};

// Get user statistics
export const getUserStats = async (req, res) => {
  const organizationId = req.organizationId;
  
  try {
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) as students,
        SUM(CASE WHEN role = 'employee' THEN 1 ELSE 0 END) as employees,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN card_uid IS NOT NULL THEN 1 ELSE 0 END) as has_card
       FROM users 
       WHERE organization_id = ?`,
      [organizationId]
    );
    
    res.json({ success: true, data: stats[0] });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get statistics' });
  }
};

// Bulk import users
export const bulkImportUsers = async (req, res) => {
  const { users } = req.body;
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const results = {
      success: [],
      failed: []
    };
    
    for (const user of users) {
      try {
        const {
          firstName, lastName, email, phone, role,
          card_uid, backup_code, gender, country, province, city,
          section_id, class_id, department_id, position_id
        } = user;
        
        const [result] = await connection.execute(
          `INSERT INTO users (
            organization_id, first_name, last_name, email, phone, 
            role, card_uid, backup_code, gender, country, province, city, 
            added_by, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
          [
            req.organizationId, firstName, lastName, email || null, phone || null,
            role, card_uid || null, backup_code || null, gender || null,
            country || null, province || null, city || null, req.adminId
          ]
        );
        
        const userId = result.insertId;
        
        if (role === 'student' && section_id) {
          await connection.execute(
            `INSERT INTO students (user_id, section_id, class_id, created_at, updated_at) 
             VALUES (?, ?, ?, NOW(), NOW())`,
            [userId, section_id, class_id || null]
          );
        } else if (role === 'employee' && department_id) {
          await connection.execute(
            `INSERT INTO employees (user_id, department_id, position_id, created_at, updated_at) 
             VALUES (?, ?, ?, NOW(), NOW())`,
            [userId, department_id, position_id || null]
          );
        }
        
        results.success.push({ id: userId, name: `${firstName} ${lastName}` });
      } catch (error) {
        results.failed.push({ 
          name: `${user.firstName} ${user.lastName}`, 
          error: error.message 
        });
      }
    }
    
    await connection.commit();
    
    res.json({ 
      success: true, 
      data: results,
      message: `Imported ${results.success.length} users, ${results.failed.length} failed`
    });
  } catch (error) {
    await connection.rollback();
    console.error('Bulk import error:', error);
    res.status(500).json({ success: false, error: 'Failed to import users' });
  } finally {
    connection.release();
  }
};