// csmsb/controllers/organizeController.js
import pool from '../config/database.js';

// ============ SECTIONS (Schools) ============

export const getSections = async (req, res) => {
  const organizationId = req.organizationId;
  
  try {
    const [sections] = await pool.execute(
      `SELECT s.*, 
        COUNT(DISTINCT c.id) as classes_count,
        COUNT(DISTINCT st.user_id) as students_count
       FROM sections s
       LEFT JOIN classes c ON c.section_id = s.id AND c.organization_id = s.organization_id
       LEFT JOIN students st ON st.section_id = s.id
       WHERE s.organization_id = ? AND s.is_active = 1
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      [organizationId]
    );
    
    res.json({ success: true, data: sections });
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({ success: false, error: 'Failed to get sections' });
  }
};

export const getSection = async (req, res) => {
  const { id } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [sections] = await pool.execute(
      `SELECT * FROM sections WHERE id = ? AND organization_id = ?`,
      [id, organizationId]
    );
    
    if (sections.length === 0) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }
    
    res.json({ success: true, data: sections[0] });
  } catch (error) {
    console.error('Get section error:', error);
    res.status(500).json({ success: false, error: 'Failed to get section' });
  }
};

export const createSection = async (req, res) => {
  const { name, description } = req.body;
  const organizationId = req.organizationId;
  const adminId = req.adminId;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Section name is required' });
  }
  
  try {
    const [result] = await pool.execute(
      `INSERT INTO sections (organization_id, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [organizationId, name.trim(), description || null, adminId]
    );
    
    res.json({ success: true, data: { id: result.insertId }, message: 'Section created successfully' });
  } catch (error) {
    console.error('Create section error:', error);
    res.status(500).json({ success: false, error: 'Failed to create section' });
  }
};

export const updateSection = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const organizationId = req.organizationId;
  
  try {
    const [result] = await pool.execute(
      `UPDATE sections SET name = ?, description = ?, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [name, description || null, id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }
    
    res.json({ success: true, message: 'Section updated successfully' });
  } catch (error) {
    console.error('Update section error:', error);
    res.status(500).json({ success: false, error: 'Failed to update section' });
  }
};

export const deleteSection = async (req, res) => {
  const { id } = req.params;
  const organizationId = req.organizationId;
  
  try {
    // Check if section has classes
    const [classes] = await pool.execute(
      'SELECT COUNT(*) as count FROM classes WHERE section_id = ?',
      [id]
    );
    
    if (classes[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete section with existing classes. Delete or move classes first.' 
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
    res.status(500).json({ success: false, error: 'Failed to delete section' });
  }
};

// ============ CLASSES (Schools) ============

export const getClasses = async (req, res) => {
  const { sectionId } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [classes] = await pool.execute(
      `SELECT c.*, s.name as section_name,
        COUNT(DISTINCT st.user_id) as students_count
       FROM classes c
       LEFT JOIN sections s ON c.section_id = s.id
       LEFT JOIN students st ON st.class_id = c.id
       WHERE c.organization_id = ? AND c.section_id = ? AND c.is_active = 1
       GROUP BY c.id
       ORDER BY c.name ASC`,
      [organizationId, sectionId]
    );
    
    res.json({ success: true, data: classes });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ success: false, error: 'Failed to get classes' });
  }
};

export const getClass = async (req, res) => {
  const { id } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [classes] = await pool.execute(
      `SELECT c.*, s.name as section_name
       FROM classes c
       JOIN sections s ON c.section_id = s.id
       WHERE c.id = ? AND c.organization_id = ?`,
      [id, organizationId]
    );
    
    if (classes.length === 0) {
      return res.status(404).json({ success: false, error: 'Class not found' });
    }
    
    res.json({ success: true, data: classes[0] });
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({ success: false, error: 'Failed to get class' });
  }
};

export const createClass = async (req, res) => {
  const { name, section_id, grade_level, capacity } = req.body;
  const organizationId = req.organizationId;
  const adminId = req.adminId;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Class name is required' });
  }
  
  if (!section_id) {
    return res.status(400).json({ success: false, error: 'Section ID is required' });
  }
  
  try {
    const [result] = await pool.execute(
      `INSERT INTO classes (organization_id, section_id, name, grade_level, capacity, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [organizationId, section_id, name.trim(), grade_level || null, capacity || null, adminId]
    );
    
    res.json({ success: true, data: { id: result.insertId }, message: 'Class created successfully' });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ success: false, error: 'Failed to create class' });
  }
};

export const updateClass = async (req, res) => {
  const { id } = req.params;
  const { name, grade_level, capacity } = req.body;
  const organizationId = req.organizationId;
  
  try {
    const [result] = await pool.execute(
      `UPDATE classes SET name = ?, grade_level = ?, capacity = ?, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [name, grade_level || null, capacity || null, id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Class not found' });
    }
    
    res.json({ success: true, message: 'Class updated successfully' });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ success: false, error: 'Failed to update class' });
  }
};

export const deleteClass = async (req, res) => {
  const { id } = req.params;
  const organizationId = req.organizationId;
  
  try {
    // Check if class has students
    const [students] = await pool.execute(
      'SELECT COUNT(*) as count FROM students WHERE class_id = ?',
      [id]
    );
    
    if (students[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete class with existing students. Reassign or remove students first.' 
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
    res.status(500).json({ success: false, error: 'Failed to delete class' });
  }
};

// ============ DEPARTMENTS ============

export const getDepartments = async (req, res) => {
  const organizationId = req.organizationId;
  
  try {
    const [departments] = await pool.execute(
      `SELECT d.*, 
        COUNT(DISTINCT p.id) as positions_count,
        COUNT(DISTINCT e.user_id) as employees_count
       FROM departments d
       LEFT JOIN positions p ON p.department_id = d.id AND p.organization_id = d.organization_id
       LEFT JOIN employees e ON e.department_id = d.id
       WHERE d.organization_id = ? AND d.is_active = 1
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
      [organizationId]
    );
    
    res.json({ success: true, data: departments });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ success: false, error: 'Failed to get departments' });
  }
};

export const getDepartment = async (req, res) => {
  const { id } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [departments] = await pool.execute(
      `SELECT * FROM departments WHERE id = ? AND organization_id = ?`,
      [id, organizationId]
    );
    
    if (departments.length === 0) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }
    
    res.json({ success: true, data: departments[0] });
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({ success: false, error: 'Failed to get department' });
  }
};

export const createDepartment = async (req, res) => {
  const { name, description } = req.body;
  const organizationId = req.organizationId;
  const adminId = req.adminId;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Department name is required' });
  }
  
  try {
    const [result] = await pool.execute(
      `INSERT INTO departments (organization_id, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [organizationId, name.trim(), description || null, adminId]
    );
    
    res.json({ success: true, data: { id: result.insertId }, message: 'Department created successfully' });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ success: false, error: 'Failed to create department' });
  }
};

export const updateDepartment = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const organizationId = req.organizationId;
  
  try {
    const [result] = await pool.execute(
      `UPDATE departments SET name = ?, description = ?, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [name, description || null, id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }
    
    res.json({ success: true, message: 'Department updated successfully' });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ success: false, error: 'Failed to update department' });
  }
};

export const deleteDepartment = async (req, res) => {
  const { id } = req.params;
  const organizationId = req.organizationId;
  
  try {
    // Check if department has positions
    const [positions] = await pool.execute(
      'SELECT COUNT(*) as count FROM positions WHERE department_id = ?',
      [id]
    );
    
    if (positions[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete department with existing positions. Delete or move positions first.' 
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
    res.status(500).json({ success: false, error: 'Failed to delete department' });
  }
};

// ============ POSITIONS ============

export const getPositions = async (req, res) => {
  const { departmentId } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [positions] = await pool.execute(
      `SELECT p.*, d.name as department_name,
        COUNT(DISTINCT e.user_id) as employees_count
       FROM positions p
       LEFT JOIN departments d ON p.department_id = d.id
       LEFT JOIN employees e ON e.position_id = p.id
       WHERE p.organization_id = ? AND p.department_id = ? AND p.is_active = 1
       GROUP BY p.id
       ORDER BY p.name ASC`,
      [organizationId, departmentId]
    );
    
    res.json({ success: true, data: positions });
  } catch (error) {
    console.error('Get positions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get positions' });
  }
};

export const getPosition = async (req, res) => {
  const { id } = req.params;
  const organizationId = req.organizationId;
  
  try {
    const [positions] = await pool.execute(
      `SELECT p.*, d.name as department_name
       FROM positions p
       JOIN departments d ON p.department_id = d.id
       WHERE p.id = ? AND p.organization_id = ?`,
      [id, organizationId]
    );
    
    if (positions.length === 0) {
      return res.status(404).json({ success: false, error: 'Position not found' });
    }
    
    res.json({ success: true, data: positions[0] });
  } catch (error) {
    console.error('Get position error:', error);
    res.status(500).json({ success: false, error: 'Failed to get position' });
  }
};

export const createPosition = async (req, res) => {
  const { name, department_id, salary_range } = req.body;
  const organizationId = req.organizationId;
  const adminId = req.adminId;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Position name is required' });
  }
  
  if (!department_id) {
    return res.status(400).json({ success: false, error: 'Department ID is required' });
  }
  
  try {
    const [result] = await pool.execute(
      `INSERT INTO positions (organization_id, department_id, name, salary_range, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [organizationId, department_id, name.trim(), salary_range || null, adminId]
    );
    
    res.json({ success: true, data: { id: result.insertId }, message: 'Position created successfully' });
  } catch (error) {
    console.error('Create position error:', error);
    res.status(500).json({ success: false, error: 'Failed to create position' });
  }
};

export const updatePosition = async (req, res) => {
  const { id } = req.params;
  const { name, salary_range } = req.body;
  const organizationId = req.organizationId;
  
  try {
    const [result] = await pool.execute(
      `UPDATE positions SET name = ?, salary_range = ?, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [name, salary_range || null, id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Position not found' });
    }
    
    res.json({ success: true, message: 'Position updated successfully' });
  } catch (error) {
    console.error('Update position error:', error);
    res.status(500).json({ success: false, error: 'Failed to update position' });
  }
};

export const deletePosition = async (req, res) => {
  const { id } = req.params;
  const organizationId = req.organizationId;
  
  try {
    // Check if position has employees
    const [employees] = await pool.execute(
      'SELECT COUNT(*) as count FROM employees WHERE position_id = ?',
      [id]
    );
    
    if (employees[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete position with existing employees. Reassign or remove employees first.' 
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
    res.status(500).json({ success: false, error: 'Failed to delete position' });
  }
};