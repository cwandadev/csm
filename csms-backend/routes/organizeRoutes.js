// csms-backend/routes/organizeRoutes.js
import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ============ SECTIONS (For Schools) ============

// Get all sections with user count
router.get('/sections', authenticateToken, async (req, res) => {
  const organizationId = req.organizationId;
  
  try {
    const [sections] = await pool.execute(
      `SELECT s.*, 
        COUNT(DISTINCT st.user_id) as user_count,
        COUNT(DISTINCT c.id) as class_count
       FROM sections s
       LEFT JOIN students st ON s.id = st.section_id
       LEFT JOIN classes c ON s.id = c.section_id
       WHERE s.organization_id = ? AND s.is_active = 1
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      [organizationId]
    );
    res.json({ success: true, data: sections });
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create section
router.post('/sections', authenticateToken, async (req, res) => {
  const { name, description } = req.body;
  const organizationId = req.organizationId;
  const adminId = req.adminId;
  
  try {
    const [result] = await pool.execute(
      `INSERT INTO sections (organization_id, name, description, created_by, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
      [organizationId, name, description || null, adminId]
    );
    res.json({ success: true, data: { id: result.insertId, name } });
  } catch (error) {
    console.error('Create section error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update section
router.put('/sections/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const organizationId = req.organizationId;
  
  try {
    const [result] = await pool.execute(
      'UPDATE sections SET name = ?, description = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?',
      [name, description || null, id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }
    res.json({ success: true, message: 'Section updated successfully' });
  } catch (error) {
    console.error('Update section error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Delete section
router.delete('/sections/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [students] = await pool.execute(
      'SELECT COUNT(*) as count FROM students WHERE section_id = ?',
      [id]
    );
    
    if (students[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete section with assigned students. Reassign students first.' 
      });
    }
    
    const [result] = await pool.execute(
      'DELETE FROM sections WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }
    res.json({ success: true, message: 'Section deleted successfully' });
  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============ CLASSES (For Schools) ============

// Get all classes for a section
router.get('/sections/:sectionId/classes', authenticateToken, async (req, res) => {
  const { sectionId } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [classes] = await pool.execute(
      `SELECT c.*, 
        COUNT(DISTINCT s.user_id) as user_count
       FROM classes c
       LEFT JOIN students s ON c.id = s.class_id
       WHERE c.organization_id = ? AND c.section_id = ? AND c.is_active = 1
       GROUP BY c.id
       ORDER BY c.name`,
      [organizationId, sectionId]
    );
    res.json({ success: true, data: classes });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create class
router.post('/classes', authenticateToken, async (req, res) => {
  const { name, section_id, grade_level, capacity } = req.body;
  const organizationId = req.organizationId;
  const adminId = req.adminId;
  
  try {
    const [result] = await pool.execute(
      `INSERT INTO classes (organization_id, section_id, name, grade_level, capacity, created_by, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [organizationId, section_id, name, grade_level || null, capacity || null, adminId]
    );
    res.json({ success: true, data: { id: result.insertId, name } });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update class
router.put('/classes/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, grade_level, capacity } = req.body;
  const organizationId = req.organizationId;
  
  try {
    const [result] = await pool.execute(
      'UPDATE classes SET name = ?, grade_level = ?, capacity = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?',
      [name, grade_level || null, capacity || null, id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Class not found' });
    }
    res.json({ success: true, message: 'Class updated successfully' });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Delete class
router.delete('/classes/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [students] = await pool.execute(
      'SELECT COUNT(*) as count FROM students WHERE class_id = ?',
      [id]
    );
    
    if (students[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete class with assigned students. Reassign students first.' 
      });
    }
    
    const [result] = await pool.execute(
      'DELETE FROM classes WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Class not found' });
    }
    res.json({ success: true, message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============ DEPARTMENTS (For Companies) ============

// Get all departments with user count
router.get('/departments', authenticateToken, async (req, res) => {
  const organizationId = req.organizationId;
  
  try {
    const [departments] = await pool.execute(
      `SELECT d.*, 
        COUNT(DISTINCT e.user_id) as user_count,
        COUNT(DISTINCT p.id) as position_count
       FROM departments d
       LEFT JOIN employees e ON d.id = e.department_id
       LEFT JOIN positions p ON d.id = p.department_id
       WHERE d.organization_id = ? AND d.is_active = 1
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
      [organizationId]
    );
    res.json({ success: true, data: departments });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create department
router.post('/departments', authenticateToken, async (req, res) => {
  const { name, description } = req.body;
  const organizationId = req.organizationId;
  const adminId = req.adminId;
  
  try {
    const [result] = await pool.execute(
      `INSERT INTO departments (organization_id, name, description, created_by, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
      [organizationId, name, description || null, adminId]
    );
    res.json({ success: true, data: { id: result.insertId, name } });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update department
router.put('/departments/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const organizationId = req.organizationId;
  
  try {
    const [result] = await pool.execute(
      'UPDATE departments SET name = ?, description = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?',
      [name, description || null, id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }
    res.json({ success: true, message: 'Department updated successfully' });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Delete department
router.delete('/departments/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [employees] = await pool.execute(
      'SELECT COUNT(*) as count FROM employees WHERE department_id = ?',
      [id]
    );
    
    if (employees[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete department with assigned employees. Reassign employees first.' 
      });
    }
    
    const [result] = await pool.execute(
      'DELETE FROM departments WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }
    res.json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============ POSITIONS (For Companies) ============

// Get all positions for a department
router.get('/departments/:departmentId/positions', authenticateToken, async (req, res) => {
  const { departmentId } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [positions] = await pool.execute(
      `SELECT p.*, 
        COUNT(DISTINCT e.user_id) as user_count
       FROM positions p
       LEFT JOIN employees e ON p.id = e.position_id
       WHERE p.organization_id = ? AND p.department_id = ? AND p.is_active = 1
       GROUP BY p.id
       ORDER BY p.name`,
      [organizationId, departmentId]
    );
    res.json({ success: true, data: positions });
  } catch (error) {
    console.error('Get positions error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create position
router.post('/positions', authenticateToken, async (req, res) => {
  const { name, department_id, salary_range } = req.body;
  const organizationId = req.organizationId;
  const adminId = req.adminId;
  
  try {
    const [result] = await pool.execute(
      `INSERT INTO positions (organization_id, department_id, name, salary_range, created_by, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [organizationId, department_id, name, salary_range || null, adminId]
    );
    res.json({ success: true, data: { id: result.insertId, name } });
  } catch (error) {
    console.error('Create position error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update position
router.put('/positions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, salary_range } = req.body;
  const organizationId = req.organizationId;
  
  try {
    const [result] = await pool.execute(
      'UPDATE positions SET name = ?, salary_range = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?',
      [name, salary_range || null, id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Position not found' });
    }
    res.json({ success: true, message: 'Position updated successfully' });
  } catch (error) {
    console.error('Update position error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Delete position
router.delete('/positions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [employees] = await pool.execute(
      'SELECT COUNT(*) as count FROM employees WHERE position_id = ?',
      [id]
    );
    
    if (employees[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete position with assigned employees. Reassign employees first.' 
      });
    }
    
    const [result] = await pool.execute(
      'DELETE FROM positions WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Position not found' });
    }
    res.json({ success: true, message: 'Position deleted successfully' });
  } catch (error) {
    console.error('Delete position error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;