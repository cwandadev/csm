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
          WHEN u.role = 'student' THEN s.class
          WHEN u.role = 'employee' THEN e.position
          ELSE NULL
        END as class_or_position,
        CASE 
          WHEN u.role = 'student' THEN sec.name
          WHEN u.role = 'employee' THEN d.name
          ELSE NULL
        END as section_or_department
      FROM users u
      LEFT JOIN student s ON u.id = s.user_id
      LEFT JOIN sections sec ON s.sections_id = sec.id
      LEFT JOIN employee e ON u.id = e.user_id
      LEFT JOIN departments d ON e.departments_id = d.id
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
  
  try {
    const [users] = await pool.execute(
      `SELECT u.*, 
              s.sections_id, s.class, s.phone_number as student_phone,
              sec.name as section_name,
              e.departments_id, e.position, e.phone_number as employee_phone,
              d.name as department_name
       FROM users u
       LEFT JOIN student s ON u.id = s.user_id
       LEFT JOIN sections sec ON s.sections_id = sec.id
       LEFT JOIN employee e ON u.id = e.user_id
       LEFT JOIN departments d ON e.departments_id = d.id
       WHERE u.id = ? AND u.organization_id = ?`,
      [userId, req.organizationId]
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
    sections_id, class: studentClass,
    // Employee specific fields
    department_id, position
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
    
    // Check if email already exists
    if (email) {
      const [existingEmail] = await connection.execute(
        'SELECT id FROM users WHERE email = ? AND organization_id = ?',
        [email, req.organizationId]
      );
      if (existingEmail.length > 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'Email already in use' });
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
      if (!sections_id) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'Section ID is required for students' });
      }
      
      await connection.execute(
        `INSERT INTO student (user_id, sections_id, class, phone_number, created_at, updated_at) 
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [userId, sections_id, studentClass || null, phone || null]
      );
    } else if (role === 'employee') {
      if (!department_id) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'Department ID is required for employees' });
      }
      
      await connection.execute(
        `INSERT INTO employee (user_id, departments_id, position, phone_number, created_at, updated_at) 
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [userId, department_id, position || null, phone || null]
      );
    }
    
    await connection.commit();
    
    // Send welcome email if email provided
    if (email) {
      await emailService.sendWelcomeEmail(
        email, 
        `${firstName} ${lastName}`, 
        `Card UID: ${card_uid || 'Not assigned yet'}`
      );
    }
    
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
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Check if user belongs to organization
    const [users] = await connection.execute(
      'SELECT id, role FROM users WHERE id = ? AND organization_id = ?',
      [userId, req.organizationId]
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
      
      if (updates.sections_id !== undefined) {
        studentFields.push('sections_id = ?');
        studentValues.push(updates.sections_id);
      }
      if (updates.class !== undefined) {
        studentFields.push('class = ?');
        studentValues.push(updates.class);
      }
      if (updates.phone_number !== undefined) {
        studentFields.push('phone_number = ?');
        studentValues.push(updates.phone_number);
      }
      
      if (studentFields.length > 0) {
        studentValues.push(userId);
        await connection.execute(
          `UPDATE student SET ${studentFields.join(', ')}, updated_at = NOW() WHERE user_id = ?`,
          studentValues
        );
      }
    } else if (user.role === 'employee') {
      const employeeFields = [];
      const employeeValues = [];
      
      if (updates.departments_id !== undefined) {
        employeeFields.push('departments_id = ?');
        employeeValues.push(updates.departments_id);
      }
      if (updates.position !== undefined) {
        employeeFields.push('position = ?');
        employeeValues.push(updates.position);
      }
      if (updates.phone_number !== undefined) {
        employeeFields.push('phone_number = ?');
        employeeValues.push(updates.phone_number);
      }
      
      if (employeeFields.length > 0) {
        employeeValues.push(userId);
        await connection.execute(
          `UPDATE employee SET ${employeeFields.join(', ')}, updated_at = NOW() WHERE user_id = ?`,
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
  
  try {
    const [result] = await pool.execute(
      'DELETE FROM users WHERE id = ? AND organization_id = ?',
      [userId, req.organizationId]
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
          sections_id, class: studentClass,
          departments_id, position
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
        
        if (role === 'student' && sections_id) {
          await connection.execute(
            `INSERT INTO student (user_id, sections_id, class, phone_number, created_at, updated_at) 
             VALUES (?, ?, ?, ?, NOW(), NOW())`,
            [userId, sections_id, studentClass || null, phone || null]
          );
        } else if (role === 'employee' && departments_id) {
          await connection.execute(
            `INSERT INTO employee (user_id, departments_id, position, phone_number, created_at, updated_at) 
             VALUES (?, ?, ?, ?, NOW(), NOW())`,
            [userId, departments_id, position || null, phone || null]
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

// Get user statistics
export const getUserStats = async (req, res) => {
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
      [req.organizationId]
    );
    
    res.json({ success: true, data: stats[0] });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get statistics' });
  }
};