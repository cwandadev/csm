// csms-backend/controllers/attendanceController.js (for both attendance and schedules ect..)
import pool from '../config/database.js';
import { parseISO, format, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';

// =====================================================
// ATTENDANCE RECORDS MANAGEMENT
// =====================================================

// Get attendance records with filters and pagination
export const getAttendanceRecords = async (req, res) => {
  const { organizationId } = req;
  const {
    page = 1,
    limit = 50,
    start_date,
    end_date,
    user_id,
    status,
    method,
    search,
    device_id,
    attendance_type_id,
    schedule_id
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = `
      SELECT a.*, 
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.role as user_role,
        u.image as user_image,
        d.device_name as device,
        at.name as attendance_type_name,
        CONCAT(adm.first_name, ' ', adm.last_name) as verified_by_name,
        s.name as schedule_name,
        dep.name as department_name,
        pos.name as position_name,
        sec.name as section_name,
        cls.name as class_name
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN devices d ON a.device_id = d.id
      LEFT JOIN attendance_types at ON a.attendance_type_id = at.id
      LEFT JOIN admins adm ON a.verified_by = adm.id
      LEFT JOIN schedules s ON a.schedule_id = s.id
      LEFT JOIN employees e ON u.id = e.user_id
      LEFT JOIN departments dep ON e.department_id = dep.id
      LEFT JOIN positions pos ON e.position_id = pos.id
      LEFT JOIN students st ON u.id = st.user_id
      LEFT JOIN sections sec ON st.section_id = sec.id
      LEFT JOIN classes cls ON st.class_id = cls.id
      WHERE a.organization_id = ?
    `;

    const params = [organizationId];

    if (start_date) {
      query += ` AND DATE(a.timestamp) >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND DATE(a.timestamp) <= ?`;
      params.push(end_date);
    }
    if (user_id) {
      query += ` AND a.user_id = ?`;
      params.push(user_id);
    }
    if (status && status !== 'all') {
      query += ` AND a.status = ?`;
      params.push(status);
    }
    if (method && method !== 'all') {
      query += ` AND a.method = ?`;
      params.push(method);
    }
    if (device_id) {
      query += ` AND a.device_id = ?`;
      params.push(device_id);
    }
    if (attendance_type_id) {
      query += ` AND a.attendance_type_id = ?`;
      params.push(attendance_type_id);
    }
    if (schedule_id && schedule_id !== 'all') {
      query += ` AND a.schedule_id = ?`;
      params.push(schedule_id);
    }
    if (search) {
      query += ` AND (CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR u.card_uid LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // Count total
    const countQuery = query.replace(
      /SELECT a\..*? FROM/,
      'SELECT COUNT(*) as total FROM'
    );
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0]?.total || 0;

    // Get paginated results
    query += ` ORDER BY a.timestamp DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [records] = await pool.execute(query, params);

    res.json({
      success: true,
      data: records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        total_pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get attendance records error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Get single attendance record
export const getAttendanceRecord = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req;

  try {
    const [records] = await pool.execute(
      `SELECT a.*, 
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        d.device_name,
        at.name as attendance_type_name,
        CONCAT(adm.first_name, ' ', adm.last_name) as verified_by_name
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN devices d ON a.device_id = d.id
      LEFT JOIN attendance_types at ON a.attendance_type_id = at.id
      LEFT JOIN admins adm ON a.verified_by = adm.id
      WHERE a.id = ? AND a.organization_id = ?`,
      [id, organizationId]
    );

    if (records.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    res.json({ success: true, data: records[0] });
  } catch (error) {
    console.error('Get attendance record error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Get departments with positions for company/school employees
export const getOrganizationStructure = async (req, res) => {
  const { organizationId } = req;

  try {
    let response = {
      success: true,
      data: {}
    };

    // Get sections and their classes (for schools)
    const [sections] = await pool.execute(
      `SELECT id, name, description FROM sections WHERE organization_id = ? AND is_active = 1 ORDER BY name`,
      [organizationId]
    );
    
    for (const section of sections) {
      const [classes] = await pool.execute(
        `SELECT id, name, grade_level FROM classes WHERE section_id = ? AND organization_id = ? AND is_active = 1 ORDER BY name`,
        [section.id, organizationId]
      );
      section.classes = classes;
    }
    
    response.data.sections = sections;
    
    // Get departments and their positions
    const [departments] = await pool.execute(
      `SELECT id, name, description FROM departments WHERE organization_id = ? AND is_active = 1 ORDER BY name`,
      [organizationId]
    );
    
    for (const dept of departments) {
      const [positions] = await pool.execute(
        `SELECT id, name, salary_range FROM positions WHERE department_id = ? AND organization_id = ? AND is_active = 1 ORDER BY name`,
        [dept.id, organizationId]
      );
      dept.positions = positions;
    }
    
    response.data.departments = departments;
    
    res.json(response);
  } catch (error) {
    console.error('Get organization structure error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Get target users based on schedule targeting
export const getTargetUsers = async (req, res) => {
  const { organizationId } = req;
  const { target_type, target_ids } = req.query;
  
  if (!target_type) {
    return res.status(400).json({ success: false, error: 'target_type required' });
  }
  
  try {
    let query = `
      SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.image,
             u.card_uid, u.is_active
      FROM users u
      WHERE u.organization_id = ? AND u.is_active = 1
    `;
    const params = [organizationId];
    
    if (target_type === 'all') {
      // Get all users
    } else if (target_type === 'departments' && target_ids) {
      const ids = JSON.parse(target_ids);
      const placeholders = ids.map(() => '?').join(',');
      query += ` AND u.id IN (
        SELECT user_id FROM employees WHERE department_id IN (${placeholders})
      )`;
      params.push(...ids);
    } else if (target_type === 'positions' && target_ids) {
      const ids = JSON.parse(target_ids);
      const placeholders = ids.map(() => '?').join(',');
      query += ` AND u.id IN (
        SELECT user_id FROM employees WHERE position_id IN (${placeholders})
      )`;
      params.push(...ids);
    } else if (target_type === 'sections' && target_ids) {
      const ids = JSON.parse(target_ids);
      const placeholders = ids.map(() => '?').join(',');
      query += ` AND u.id IN (
        SELECT user_id FROM students WHERE section_id IN (${placeholders})
      )`;
      params.push(...ids);
    } else if (target_type === 'classes' && target_ids) {
      const ids = JSON.parse(target_ids);
      const placeholders = ids.map(() => '?').join(',');
      query += ` AND u.id IN (
        SELECT user_id FROM students WHERE class_id IN (${placeholders})
      )`;
      params.push(...ids);
    } else if (target_type === 'specific_users' && target_ids) {
      const ids = JSON.parse(target_ids);
      const placeholders = ids.map(() => '?').join(',');
      query += ` AND u.id IN (${placeholders})`;
      params.push(...ids);
    }
    
    query += ` ORDER BY u.first_name, u.last_name`;
    
    const [users] = await pool.execute(query, params);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get target users error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};



























// Get user-specific schedules (for manual attendance)
export const getUserSchedules = async (req, res) => {
  const { organizationId } = req;
  const { user_id } = req.query;
  
  if (!user_id) {
    return res.status(400).json({ success: false, error: 'user_id required' });
  }
  
  try {
    // Get user info to determine their role and assignments
    const [users] = await pool.execute(
      `SELECT u.id, u.role, 
              st.section_id, c.id as class_id,
              e.department_id, e.position_id
       FROM users u
       LEFT JOIN students st ON u.id = st.user_id
       LEFT JOIN classes c ON st.class_id = c.id
       LEFT JOIN employees e ON u.id = e.user_id
       WHERE u.id = ? AND u.organization_id = ?`,
      [user_id, organizationId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = users[0];
    
    // Build schedule query
    let scheduleQuery = `
      SELECT DISTINCT s.* 
      FROM schedules s
      WHERE s.organization_id = ? AND s.is_active = 1
      AND (
        s.target_type = 'all'
    `;
    const params = [organizationId];
    
    if (user.role === 'student') {
      if (user.class_id) {
        scheduleQuery += ` OR (s.target_type = 'classes' AND JSON_CONTAINS(s.target_ids, ?))`;
        params.push(JSON.stringify(user.class_id));
      }
      if (user.section_id) {
        scheduleQuery += ` OR (s.target_type = 'sections' AND JSON_CONTAINS(s.target_ids, ?))`;
        params.push(JSON.stringify(user.section_id));
      }
    } else {
      if (user.position_id) {
        scheduleQuery += ` OR (s.target_type = 'positions' AND JSON_CONTAINS(s.target_ids, ?))`;
        params.push(JSON.stringify(user.position_id));
      }
      if (user.department_id) {
        scheduleQuery += ` OR (s.target_type = 'departments' AND JSON_CONTAINS(s.target_ids, ?))`;
        params.push(JSON.stringify(user.department_id));
      }
    }
    
    // Also check for specific user targeting
    scheduleQuery += ` OR (s.target_type = 'specific_users' AND JSON_CONTAINS(s.target_ids, ?))`;
    params.push(JSON.stringify(parseInt(user_id)));
    
    scheduleQuery += ` ) ORDER BY s.created_at DESC`;
    
    const [schedules] = await pool.execute(scheduleQuery, params);
    
    // Parse JSON fields
    const parsedSchedules = schedules.map(s => ({
      ...s,
      days_of_week: JSON.parse(s.days_of_week || '[]'),
      target_ids: s.target_ids ? JSON.parse(s.target_ids) : null,
      is_active: s.is_active === 1 || s.is_active === true
    }));
    
    res.json({ success: true, data: parsedSchedules });
  } catch (error) {
    console.error('Get user schedules error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};























// Create attendance record (from device or manual)
// Create attendance record (from device or manual)
export const createAttendanceRecord = async (req, res) => {
  const { organizationId, adminId } = req;
  const {
    user_id,
    device_id,
    method = 'manual',
    status = 'present',
    latitude,
    longitude,
    notes,
    attendance_type_id,
    schedule_id,
    timestamp
  } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Verify user exists and is active
    const [users] = await connection.execute(
      'SELECT id, first_name, last_name, card_uid FROM users WHERE id = ? AND organization_id = ? AND is_active = 1',
      [user_id, organizationId]
    );

    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'User not found or inactive' });
    }

    const user = users[0];

    // Check if device exists (if provided)
    if (device_id) {
      const [devices] = await connection.execute(
        'SELECT id FROM devices WHERE id = ? AND organization_id = ?',
        [device_id, organizationId]
      );
      if (devices.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, error: 'Device not found' });
      }
    }

    // Determine schedule and status
    let finalScheduleId = schedule_id || null;
    let finalStatus = status;
    let lateMinutes = 0;
    
    // If status is check_in, try to detect schedule
    if (status === 'check_in') {
      if (finalScheduleId) {
        // Use provided schedule to determine late status
        const [schedules] = await connection.execute(
          'SELECT * FROM schedules WHERE id = ? AND organization_id = ? AND is_active = 1',
          [finalScheduleId, organizationId]
        );
        
        if (schedules.length > 0) {
          const schedule = schedules[0];
          const now = new Date();
          const currentTime = now.toTimeString().slice(0, 8);
          const scheduleStart = schedule.start_time;
          
          if (currentTime > scheduleStart) {
            const graceEnd = new Date(`2000-01-01T${scheduleStart}`);
            graceEnd.setMinutes(graceEnd.getMinutes() + (schedule.grace_minutes || 0));
            const currentTimeMs = new Date(`2000-01-01T${currentTime}`).getTime();
            
            if (currentTimeMs > graceEnd.getTime()) {
              lateMinutes = Math.floor((currentTimeMs - graceEnd.getTime()) / 60000);
              if (lateMinutes >= (schedule.late_threshold_minutes || 15)) {
                finalStatus = 'late';
              }
            }
          }
        }
      } else {
        // Auto-detect schedule for this user
        const scheduleInfo = await detectUserSchedule(connection, organizationId, user_id, 'check_in');
        if (scheduleInfo) {
          finalScheduleId = scheduleInfo.schedule_id;
          finalStatus = scheduleInfo.status;
          lateMinutes = scheduleInfo.late_minutes;
        }
      }
    }

    const recordTimestamp = timestamp || new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Insert attendance record
    const [result] = await connection.execute(
      `INSERT INTO attendance 
        (organization_id, user_id, device_id, attendance_type_id, schedule_id, name, timestamp, method, status, 
         latitude, longitude, notes, verified_by, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        organizationId,
        user_id,
        device_id || null,
        attendance_type_id || null,
        finalScheduleId,
        `${user.first_name} ${user.last_name}`,
        recordTimestamp,
        method,
        finalStatus,
        latitude || null,
        longitude || null,
        notes || (lateMinutes > 0 ? `Late by ${lateMinutes} minutes` : null),
        adminId || null
      ]
    );

    // Update daily summary
    await updateDailySummary(connection, organizationId, user_id, recordTimestamp);

    await connection.commit();

    res.json({
      success: true,
      data: { id: result.insertId, schedule_id: finalScheduleId },
      message: 'Attendance recorded successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create attendance record error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    connection.release();
  }
};

// =====================================================
// ATTENDANCE STATISTICS
// =====================================================

// Get attendance statistics
export const getAttendanceStats = async (req, res) => {
  const { organizationId } = req;
  const { date, start_date, end_date, user_id } = req.query;

  try {
    let query = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(CASE WHEN status IN ('present', 'check_in') THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN status = 'early_leave' THEN 1 ELSE 0 END) as early_leave_count,
        SUM(CASE WHEN method = 'card' THEN 1 ELSE 0 END) as card_count,
        SUM(CASE WHEN method = 'fingerprint' THEN 1 ELSE 0 END) as fingerprint_count,
        SUM(CASE WHEN method = 'face_recognition' THEN 1 ELSE 0 END) as face_count,
        SUM(CASE WHEN method = 'manual' THEN 1 ELSE 0 END) as manual_count
      FROM attendance
      WHERE organization_id = ?
    `;

    const params = [organizationId];

    if (date) {
      query += ` AND DATE(timestamp) = ?`;
      params.push(date);
    }
    if (start_date && end_date) {
      query += ` AND DATE(timestamp) BETWEEN ? AND ?`;
      params.push(start_date, end_date);
    }
    if (user_id) {
      query += ` AND user_id = ?`;
      params.push(user_id);
    }

    const [stats] = await pool.execute(query, params);

    // Get today's stats if date is today or not specified
    let todayStats = null;
    if (!date || date === new Date().toISOString().slice(0, 10)) {
      const [today] = await pool.execute(
        `SELECT 
          COUNT(*) as total_today,
          SUM(CASE WHEN status IN ('present', 'check_in') THEN 1 ELSE 0 END) as present_today,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_today,
          SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_today,
          SUM(CASE WHEN status = 'early_leave' THEN 1 ELSE 0 END) as early_leave_today,
          SUM(CASE WHEN method IN ('check_in', 'present') AND status NOT IN ('absent', 'holiday', 'weekend') THEN 1 ELSE 0 END) as check_ins_today,
          SUM(CASE WHEN method = 'check_out' THEN 1 ELSE 0 END) as check_outs_today
        FROM attendance
        WHERE organization_id = ? AND DATE(timestamp) = CURDATE()`,
        [organizationId]
      );
      todayStats = today[0];
    }

    const result = {
      ...stats[0],
      ...todayStats,
      attendance_percentage: stats[0]?.total_records > 0
        ? Math.round((stats[0].present_count / stats[0].total_records) * 100)
        : 0
    };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Get daily summary for a user or all users
export const getDailySummary = async (req, res) => {
  const { organizationId } = req;
  const { date, user_id } = req.query;

  try {
    let query = `
      SELECT 
        ads.*,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.role,
        u.image
      FROM attendance_daily_summary ads
      JOIN users u ON ads.user_id = u.id
      WHERE ads.organization_id = ?
    `;

    const params = [organizationId];

    if (date) {
      query += ` AND ads.date = ?`;
      params.push(date);
    }
    if (user_id) {
      query += ` AND ads.user_id = ?`;
      params.push(user_id);
    }

    query += ` ORDER BY ads.date DESC, u.first_name ASC`;

    const [summaries] = await pool.execute(query, params);

    res.json({ success: true, data: summaries });
  } catch (error) {
    console.error('Get daily summary error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Get monthly summary
export const getMonthlySummary = async (req, res) => {
  const { organizationId } = req;
  const { year, month, user_id } = req.query;

  try {
    let query = `
      SELECT 
        ams.*,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.role
      FROM attendance_monthly_summary ams
      JOIN users u ON ams.user_id = u.id
      WHERE ams.organization_id = ?
    `;

    const params = [organizationId];

    if (year) {
      query += ` AND ams.year = ?`;
      params.push(year);
    }
    if (month) {
      query += ` AND ams.month = ?`;
      params.push(month);
    }
    if (user_id) {
      query += ` AND ams.user_id = ?`;
      params.push(user_id);
    }

    query += ` ORDER BY ams.year DESC, ams.month DESC, u.first_name ASC`;

    const [summaries] = await pool.execute(query, params);

    res.json({ success: true, data: summaries });
  } catch (error) {
    console.error('Get monthly summary error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// =====================================================
// ATTENDANCE TYPES MANAGEMENT
// =====================================================

// Get all attendance types
export const getAttendanceTypes = async (req, res) => {
  const { organizationId } = req;
  
  if (!organizationId) {
    return res.json({ success: true, data: [] });
  }
  
  try {
    const [types] = await pool.execute(
      `SELECT * FROM attendance_types 
       WHERE organization_id = ? 
       ORDER BY sort_order, created_at`,
      [organizationId]
    );
    
    res.json({ success: true, data: types });
  } catch (error) {
    console.error('Get attendance types error:', error);
    res.json({ success: true, data: [] });
  }
};

// Create attendance type
export const createAttendanceType = async (req, res) => {
  const { organizationId, adminId } = req;
  const {
    name,
    description,
    requires_check_out = false,
    color = '#3b82f6',
    affects_attendance_percentage = true,
    is_paid = true,
    is_active = true,
    sort_order = 0
  } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'Name is required' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO attendance_types 
        (organization_id, name, description, requires_check_out, color, 
         affects_attendance_percentage, is_paid, is_active, sort_order, created_by, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        organizationId,
        name.trim(),
        description || null,
        requires_check_out ? 1 : 0,
        color,
        affects_attendance_percentage ? 1 : 0,
        is_paid ? 1 : 0,
        is_active ? 1 : 0,
        sort_order,
        adminId
      ]
    );

    res.json({
      success: true,
      data: { id: result.insertId },
      message: 'Attendance type created successfully'
    });
  } catch (error) {
    console.error('Create attendance type error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Update attendance type
export const updateAttendanceType = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req;
  const {
    name,
    description,
    requires_check_out,
    color,
    affects_attendance_percentage,
    is_paid,
    is_active,
    sort_order
  } = req.body;

  try {
    const [existing] = await pool.execute(
      'SELECT id FROM attendance_types WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Attendance type not found' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }
    if (requires_check_out !== undefined) {
      updates.push('requires_check_out = ?');
      params.push(requires_check_out ? 1 : 0);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }
    if (affects_attendance_percentage !== undefined) {
      updates.push('affects_attendance_percentage = ?');
      params.push(affects_attendance_percentage ? 1 : 0);
    }
    if (is_paid !== undefined) {
      updates.push('is_paid = ?');
      params.push(is_paid ? 1 : 0);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(sort_order);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await pool.execute(
      `UPDATE attendance_types SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ success: true, message: 'Attendance type updated successfully' });
  } catch (error) {
    console.error('Update attendance type error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Delete attendance type
export const deleteAttendanceType = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req;

  try {
    // Check if type is in use
    const [inUse] = await pool.execute(
      'SELECT id FROM attendance WHERE attendance_type_id = ?',
      [id]
    );

    if (inUse.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete: This attendance type is being used in records'
      });
    }

    const [result] = await pool.execute(
      'DELETE FROM attendance_types WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Attendance type not found' });
    }

    res.json({ success: true, message: 'Attendance type deleted successfully' });
  } catch (error) {
    console.error('Delete attendance type error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// =====================================================
// SCHEDULES MANAGEMENT
// =====================================================

export const getSchedules = async (req, res) => {
  const { organizationId } = req;
  
  if (!organizationId) {
    return res.json({ success: true, data: [] });
  }
  
  try {
    const [schedules] = await pool.execute(
      `SELECT * FROM schedules 
       WHERE organization_id = ? 
       ORDER BY created_at DESC`,
      [organizationId]
    );
    
    // Parse JSON fields
    const parsedSchedules = schedules.map(schedule => ({
      ...schedule,
      days_of_week: schedule.days_of_week ? JSON.parse(schedule.days_of_week) : [],
      device_ids: schedule.device_ids ? JSON.parse(schedule.device_ids) : null,
      target_ids: schedule.target_ids ? JSON.parse(schedule.target_ids) : null
    }));
    
    res.json({ success: true, data: parsedSchedules });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.json({ success: true, data: [] });
  }
};

// Get single schedule
export const getSchedule = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req;

  try {
    const [schedules] = await pool.execute(
      'SELECT * FROM schedules WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );

    if (schedules.length === 0) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    const schedule = {
      ...schedules[0],
      days_of_week: JSON.parse(schedules[0].days_of_week || '[]'),
      device_ids: schedules[0].device_ids ? JSON.parse(schedules[0].device_ids) : null,
      target_ids: schedules[0].target_ids ? JSON.parse(schedules[0].target_ids) : null
    };

    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Create schedule
export const createSchedule = async (req, res) => {
  const { organizationId, adminId } = req;
  const {
    name,
    description,
    type = 'both',
    start_time,
    end_time,
    days_of_week,
    grace_minutes = 0,
    late_threshold_minutes = 15,
    early_leave_threshold_minutes = 15,
    is_active = true,
    device_ids,
    target_type = 'all',
    target_ids
  } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'Name is required' });
  }
  if (!start_time || !end_time) {
    return res.status(400).json({ success: false, error: 'Start time and end time are required' });
  }
  if (!days_of_week || days_of_week.length === 0) {
    return res.status(400).json({ success: false, error: 'At least one day is required' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO schedules 
        (organization_id, name, description, type, start_time, end_time, days_of_week, 
         grace_minutes, late_threshold_minutes, early_leave_threshold_minutes, is_active, 
         device_ids, target_type, target_ids, created_by, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        organizationId,
        name.trim(),
        description || null,
        type,
        start_time,
        end_time,
        JSON.stringify(days_of_week),
        grace_minutes,
        late_threshold_minutes,
        early_leave_threshold_minutes,
        is_active ? 1 : 0,
        device_ids ? JSON.stringify(device_ids) : null,
        target_type,
        target_ids ? JSON.stringify(target_ids) : null,
        adminId
      ]
    );

    res.json({
      success: true,
      data: { id: result.insertId },
      message: 'Schedule created successfully'
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Update schedule
export const updateSchedule = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req;
  const {
    name,
    description,
    type,
    start_time,
    end_time,
    days_of_week,
    grace_minutes,
    late_threshold_minutes,
    early_leave_threshold_minutes,
    is_active,
    device_ids,
    target_type,
    target_ids
  } = req.body;

  try {
    const [existing] = await pool.execute(
      'SELECT id FROM schedules WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      params.push(type);
    }
    if (start_time !== undefined) {
      updates.push('start_time = ?');
      params.push(start_time);
    }
    if (end_time !== undefined) {
      updates.push('end_time = ?');
      params.push(end_time);
    }
    if (days_of_week !== undefined) {
      updates.push('days_of_week = ?');
      params.push(JSON.stringify(days_of_week));
    }
    if (grace_minutes !== undefined) {
      updates.push('grace_minutes = ?');
      params.push(grace_minutes);
    }
    if (late_threshold_minutes !== undefined) {
      updates.push('late_threshold_minutes = ?');
      params.push(late_threshold_minutes);
    }
    if (early_leave_threshold_minutes !== undefined) {
      updates.push('early_leave_threshold_minutes = ?');
      params.push(early_leave_threshold_minutes);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }
    if (device_ids !== undefined) {
      updates.push('device_ids = ?');
      params.push(device_ids ? JSON.stringify(device_ids) : null);
    }
    if (target_type !== undefined) {
      updates.push('target_type = ?');
      params.push(target_type);
    }
    if (target_ids !== undefined) {
      updates.push('target_ids = ?');
      params.push(target_ids ? JSON.stringify(target_ids) : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await pool.execute(
      `UPDATE schedules SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ success: true, message: 'Schedule updated successfully' });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Delete schedule
export const deleteSchedule = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req;

  try {
    // Check if schedule is in use
    const [inUse] = await pool.execute(
      'SELECT id FROM attendance WHERE schedule_id = ?',
      [id]
    );

    if (inUse.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete: This schedule is being used in attendance records'
      });
    }

    const [result] = await pool.execute(
      'DELETE FROM schedules WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    res.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Get schedule exceptions
export const getScheduleExceptions = async (req, res) => {
  const { organizationId } = req;
  const { start_date, end_date } = req.query;

  try {
    let query = `
      SELECT se.*, s.name as schedule_name
      FROM schedule_exceptions se
      JOIN schedules s ON se.schedule_id = s.id
      WHERE se.organization_id = ?
    `;

    const params = [organizationId];

    if (start_date) {
      query += ` AND se.exception_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND se.exception_date <= ?`;
      params.push(end_date);
    }

    query += ` ORDER BY se.exception_date ASC`;

    const [exceptions] = await pool.execute(query, params);

    res.json({ success: true, data: exceptions });
  } catch (error) {
    console.error('Get schedule exceptions error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Create schedule exception
export const createScheduleException = async (req, res) => {
  const { organizationId, adminId } = req;
  const {
    schedule_id,
    exception_date,
    exception_type,
    override_start_time,
    override_end_time,
    reason
  } = req.body;

  if (!schedule_id || !exception_date || !exception_type) {
    return res.status(400).json({ success: false, error: 'Schedule ID, date, and type are required' });
  }

  try {
    const [existing] = await pool.execute(
      'SELECT id FROM schedules WHERE id = ? AND organization_id = ?',
      [schedule_id, organizationId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    const [result] = await pool.execute(
      `INSERT INTO schedule_exceptions 
        (schedule_id, organization_id, exception_date, exception_type, 
         override_start_time, override_end_time, reason, created_by, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        schedule_id,
        organizationId,
        exception_date,
        exception_type,
        override_start_time || null,
        override_end_time || null,
        reason || null,
        adminId
      ]
    );

    res.json({
      success: true,
      data: { id: result.insertId },
      message: 'Schedule exception created successfully'
    });
  } catch (error) {
    console.error('Create schedule exception error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Delete schedule exception
export const deleteScheduleException = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req;

  try {
    const [result] = await pool.execute(
      'DELETE FROM schedule_exceptions WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Schedule exception not found' });
    }

    res.json({ success: true, message: 'Schedule exception deleted successfully' });
  } catch (error) {
    console.error('Delete schedule exception error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// =====================================================
// USER ATTENDANCE ASSIGNMENTS
// =====================================================

// Get user attendance assignments
export const getUserAttendanceAssignments = async (req, res) => {
  const { organizationId } = req;
  const { user_id, date } = req.query;

  try {
    let query = `
      SELECT uaa.*, at.name as attendance_type_name, at.color, at.requires_check_out,
             s.name as schedule_name, s.start_time, s.end_time, s.days_of_week
      FROM user_attendance_assignments uaa
      LEFT JOIN attendance_types at ON uaa.attendance_type_id = at.id
      LEFT JOIN schedules s ON uaa.schedule_id = s.id
      WHERE uaa.is_active = 1
    `;

    const params = [];

    if (user_id) {
      query += ` AND uaa.user_id = ?`;
      params.push(user_id);
    }

    if (date) {
      query += ` AND uaa.start_date <= ? AND (uaa.end_date IS NULL OR uaa.end_date >= ?)`;
      params.push(date, date);
    }

    const [assignments] = await pool.execute(query, params);

    // Parse JSON fields
    const parsedAssignments = assignments.map(assignment => ({
      ...assignment,
      days_of_week: assignment.days_of_week ? JSON.parse(assignment.days_of_week) : null
    }));

    res.json({ success: true, data: parsedAssignments });
  } catch (error) {
    console.error('Get user attendance assignments error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Create user attendance assignment
export const createUserAttendanceAssignment = async (req, res) => {
  const { organizationId, adminId } = req;
  const {
    user_id,
    attendance_type_id,
    schedule_id,
    start_date,
    end_date,
    days_of_week,
    is_active = true
  } = req.body;

  if (!user_id || !attendance_type_id || !start_date) {
    return res.status(400).json({ success: false, error: 'User ID, attendance type, and start date are required' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO user_attendance_assignments 
        (user_id, attendance_type_id, schedule_id, start_date, end_date, 
         days_of_week, is_active, created_by, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        user_id,
        attendance_type_id,
        schedule_id || null,
        start_date,
        end_date || null,
        days_of_week ? JSON.stringify(days_of_week) : null,
        is_active ? 1 : 0,
        adminId
      ]
    );

    res.json({
      success: true,
      data: { id: result.insertId },
      message: 'User attendance assignment created successfully'
    });
  } catch (error) {
    console.error('Create user attendance assignment error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Update user attendance assignment
export const updateUserAttendanceAssignment = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req;
  const {
    attendance_type_id,
    schedule_id,
    start_date,
    end_date,
    days_of_week,
    is_active
  } = req.body;

  try {
    const updates = [];
    const params = [];

    if (attendance_type_id !== undefined) {
      updates.push('attendance_type_id = ?');
      params.push(attendance_type_id);
    }
    if (schedule_id !== undefined) {
      updates.push('schedule_id = ?');
      params.push(schedule_id || null);
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      params.push(start_date);
    }
    if (end_date !== undefined) {
      updates.push('end_date = ?');
      params.push(end_date || null);
    }
    if (days_of_week !== undefined) {
      updates.push('days_of_week = ?');
      params.push(days_of_week ? JSON.stringify(days_of_week) : null);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const [result] = await pool.execute(
      `UPDATE user_attendance_assignments SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    res.json({ success: true, message: 'User attendance assignment updated successfully' });
  } catch (error) {
    console.error('Update user attendance assignment error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Delete user attendance assignment
export const deleteUserAttendanceAssignment = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.execute(
      'DELETE FROM user_attendance_assignments WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    res.json({ success: true, message: 'User attendance assignment deleted successfully' });
  } catch (error) {
    console.error('Delete user attendance assignment error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// =====================================================
// ATTENDANCE REPORTS
// =====================================================

// Generate attendance report
export const generateAttendanceReport = async (req, res) => {
  const { organizationId } = req;
  const { start_date, end_date, user_id, department_id, section_id, class_id, format = 'json' } = req.query;

  try {
    let query = `
      SELECT 
        a.id,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.role,
        u.email,
        u.phone,
        a.timestamp,
        a.date,
        a.status,
        a.method,
        a.notes,
        d.device_name,
        at.name as attendance_type_name,
        s.name as schedule_name
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN devices d ON a.device_id = d.id
      LEFT JOIN attendance_types at ON a.attendance_type_id = at.id
      LEFT JOIN schedules s ON a.schedule_id = s.id
      WHERE a.organization_id = ?
    `;

    const params = [organizationId];

    if (start_date) {
      query += ` AND DATE(a.timestamp) >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND DATE(a.timestamp) <= ?`;
      params.push(end_date);
    }
    if (user_id) {
      query += ` AND a.user_id = ?`;
      params.push(user_id);
    }

    // Add role-specific filters
    if (department_id) {
      query += ` AND u.id IN (SELECT user_id FROM employees WHERE department_id = ?)`;
      params.push(department_id);
    }
    if (section_id) {
      query += ` AND u.id IN (SELECT user_id FROM students WHERE section_id = ?)`;
      params.push(section_id);
    }
    if (class_id) {
      query += ` AND u.id IN (SELECT user_id FROM students WHERE class_id = ?)`;
      params.push(class_id);
    }

    query += ` ORDER BY a.timestamp DESC`;

    const [records] = await pool.execute(query, params);

    if (format === 'csv') {
      const headers = ['User', 'Role', 'Email', 'Phone', 'Date', 'Time', 'Status', 'Method', 'Device', 'Schedule', 'Attendance Type', 'Notes'];
      const rows = records.map(record => [
        record.user_name,
        record.role,
        record.email || '',
        record.phone || '',
        record.date,
        record.timestamp ? new Date(record.timestamp).toLocaleTimeString() : '',
        record.status,
        record.method,
        record.device_name || '',
        record.schedule_name || '',
        record.attendance_type_name || '',
        record.notes || ''
      ]);

      const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${start_date || 'all'}_to_${end_date || 'all'}.csv`);
      return res.send(csvContent);
    }

    res.json({ success: true, data: records, count: records.length });
  } catch (error) {
    console.error('Generate attendance report error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

// Update daily summary for a user
async function updateDailySummary(connection, organizationId, userId, timestamp) {
  const date = timestamp instanceof Date ? timestamp.toISOString().slice(0, 10) : timestamp.slice(0, 10);

  // Get all attendance records for this user on this date
  const [records] = await connection.execute(
    `SELECT * FROM attendance 
     WHERE user_id = ? AND DATE(timestamp) = ? 
     ORDER BY timestamp ASC`,
    [userId, date]
  );

  if (records.length === 0) {
    await connection.execute(
      'DELETE FROM attendance_daily_summary WHERE organization_id = ? AND user_id = ? AND date = ?',
      [organizationId, userId, date]
    );
    return;
  }

  // Calculate summary statistics
  let firstCheckIn = null;
  let lastCheckOut = null;
  let checkInCount = 0;
  let checkOutCount = 0;
  let isLate = false;
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let totalWorkMinutes = 0;

  // Determine status
  let status = 'present';
  const hasCheckIn = records.some(r => r.status === 'check_in' || r.status === 'present');
  const hasCheckOut = records.some(r => r.status === 'check_out');
  const isHoliday = records.some(r => r.status === 'holiday');
  const isWeekend = records.some(r => r.status === 'weekend');

  if (isHoliday) {
    status = 'holiday';
  } else if (isWeekend) {
    status = 'weekend';
  } else if (!hasCheckIn) {
    status = 'absent';
  } else if (records.some(r => r.status === 'late')) {
    status = 'late';
    isLate = true;
    const lateRecord = records.find(r => r.status === 'late');
    if (lateRecord && lateRecord.notes) {
      const match = lateRecord.notes.match(/Late by (\d+)/);
      if (match) lateMinutes = parseInt(match[1]) || 0;
    }
  } else if (records.some(r => r.status === 'early_leave')) {
    status = 'early_leave';
    const earlyRecord = records.find(r => r.status === 'early_leave');
    if (earlyRecord && earlyRecord.notes) {
      const match = earlyRecord.notes.match(/Early by (\d+)/);
      if (match) earlyLeaveMinutes = parseInt(match[1]) || 0;
    }
  }

  // Calculate check-in/out times
  for (const record of records) {
    if (record.status === 'check_in' || record.status === 'present') {
      checkInCount++;
      if (!firstCheckIn || new Date(record.timestamp) < new Date(firstCheckIn)) {
        firstCheckIn = record.timestamp;
      }
    }
    if (record.status === 'check_out') {
      checkOutCount++;
      if (!lastCheckOut || new Date(record.timestamp) > new Date(lastCheckOut)) {
        lastCheckOut = record.timestamp;
      }
    }
  }

  // Calculate total work minutes (if both check-in and check-out exist)
  if (firstCheckIn && lastCheckOut) {
    totalWorkMinutes = differenceInMinutes(new Date(lastCheckOut), new Date(firstCheckIn));
  }

  // Get schedule for this user to determine if it's a half day
  const [schedules] = await connection.execute(
    `SELECT s.* FROM schedules s
     WHERE s.organization_id = ? AND s.is_active = 1
     AND (
       s.target_type = 'all'
       OR (s.target_type = 'specific_users' AND JSON_CONTAINS(s.target_ids, ?))
     )`,
    [organizationId, JSON.stringify(userId)]
  );

  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const hasSchedule = schedules.some(s => {
    const days = JSON.parse(s.days_of_week || '[]');
    return days.includes(dayOfWeek);
  });

  if (hasSchedule && totalWorkMinutes > 0 && totalWorkMinutes < 240) {
    status = 'half_day';
  }

  // Upsert daily summary
  await connection.execute(
    `INSERT INTO attendance_daily_summary 
      (organization_id, user_id, date, first_check_in, last_check_out, total_work_minutes, 
       status, check_in_count, check_out_count, is_late, late_minutes, early_leave_minutes, 
       overtime_minutes, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       first_check_in = VALUES(first_check_in),
       last_check_out = VALUES(last_check_out),
       total_work_minutes = VALUES(total_work_minutes),
       status = VALUES(status),
       check_in_count = VALUES(check_in_count),
       check_out_count = VALUES(check_out_count),
       is_late = VALUES(is_late),
       late_minutes = VALUES(late_minutes),
       early_leave_minutes = VALUES(early_leave_minutes),
       overtime_minutes = VALUES(overtime_minutes),
       updated_at = NOW()`,
    [
      organizationId, userId, date, firstCheckIn, lastCheckOut, totalWorkMinutes,
      status, checkInCount, checkOutCount, isLate ? 1 : 0, lateMinutes, earlyLeaveMinutes, 0
    ]
  );

  // Update monthly summary
  await updateMonthlySummary(connection, organizationId, userId, date);
}

// Update monthly summary
async function updateMonthlySummary(connection, organizationId, userId, date) {
  const year = parseInt(date.slice(0, 4));
  const month = parseInt(date.slice(5, 7));

  const [summaries] = await connection.execute(
    `SELECT 
       SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as total_present,
       SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as total_absent,
       SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as total_late,
       SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END) as total_half,
       SUM(CASE WHEN status = 'holiday' THEN 1 ELSE 0 END) as total_holiday,
       SUM(CASE WHEN status = 'weekend' THEN 1 ELSE 0 END) as total_weekend,
       SUM(total_work_minutes) as total_work_minutes,
       SUM(overtime_minutes) as total_overtime
     FROM attendance_daily_summary
     WHERE organization_id = ? AND user_id = ? AND YEAR(date) = ? AND MONTH(date) = ?`,
    [organizationId, userId, year, month]
  );

  const summary = summaries[0];
  const totalDays = summary.total_present + summary.total_absent + summary.total_late + summary.total_half;
  const attendancePercentage = totalDays > 0 ? (summary.total_present / totalDays) * 100 : 0;

  await connection.execute(
    `INSERT INTO attendance_monthly_summary 
      (organization_id, user_id, year, month, total_present_days, total_absent_days, 
       total_late_days, total_half_days, total_holidays, total_weekend_days, 
       total_work_minutes, total_overtime_minutes, attendance_percentage, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       total_present_days = VALUES(total_present_days),
       total_absent_days = VALUES(total_absent_days),
       total_late_days = VALUES(total_late_days),
       total_half_days = VALUES(total_half_days),
       total_holidays = VALUES(total_holidays),
       total_weekend_days = VALUES(total_weekend_days),
       total_work_minutes = VALUES(total_work_minutes),
       total_overtime_minutes = VALUES(total_overtime_minutes),
       attendance_percentage = VALUES(attendance_percentage),
       updated_at = NOW()`,
    [
      organizationId, userId, year, month,
      summary.total_present || 0,
      summary.total_absent || 0,
      summary.total_late || 0,
      summary.total_half || 0,
      summary.total_holiday || 0,
      summary.total_weekend || 0,
      summary.total_work_minutes || 0,
      summary.total_overtime || 0,
      attendancePercentage
    ]
  );
}





// Device check-in endpoint (for ESP32 devices)
export const deviceCheckIn = async (req, res) => {
  const { card_uid, device_id, timestamp, latitude, longitude } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Find user by card UID
    const [users] = await connection.execute(
      `SELECT u.id, u.first_name, u.last_name, u.organization_id, u.is_active
       FROM users u
       WHERE u.card_uid = ? AND u.is_active = 1`,
      [card_uid]
    );

    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        error: 'Card not recognized or user inactive',
        code: 'CARD_NOT_FOUND'
      });
    }

    const user = users[0];

    // Update device last seen if device_id provided
    if (device_id) {
      await connection.execute(
        'UPDATE devices SET last_seen = NOW() WHERE id = ?',
        [device_id]
      );
    }

    // Determine if this is check-in or check-out based on last record
    const [lastRecord] = await connection.execute(
      `SELECT status FROM attendance 
       WHERE user_id = ? AND DATE(timestamp) = CURDATE() 
       ORDER BY timestamp DESC LIMIT 1`,
      [user.id]
    );

    let actionType = 'check_in';
    if (lastRecord.length > 0 && (lastRecord[0].status === 'check_in' || lastRecord[0].status === 'present' || lastRecord[0].status === 'late')) {
      actionType = 'check_out';
    }

    // Detect schedule for this user
    let finalScheduleId = null;
    let finalStatus = actionType;
    let lateMinutes = 0;
    
    // Only check schedule for check-ins
    if (actionType === 'check_in') {
      const scheduleInfo = await detectUserSchedule(connection, user.organization_id, user.id, 'check_in');
      if (scheduleInfo) {
        finalScheduleId = scheduleInfo.schedule_id;
        finalStatus = scheduleInfo.status;
        lateMinutes = scheduleInfo.late_minutes;
        console.log(`Schedule detected for user ${user.id}: ${finalScheduleId}, status: ${finalStatus}, late: ${lateMinutes}min`);
      } else {
        console.log(`No active schedule found for user ${user.id} at this time`);
      }
    } else {
      // For check-out, try to find any applicable schedule (not time-sensitive)
      const scheduleInfo = await detectUserSchedule(connection, user.organization_id, user.id, 'check_out');
      if (scheduleInfo) {
        finalScheduleId = scheduleInfo.schedule_id;
        console.log(`Check-out schedule detected for user ${user.id}: ${finalScheduleId}`);
      }
    }

    const recordTimestamp = timestamp || new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Insert attendance record
    const [result] = await connection.execute(
      `INSERT INTO attendance 
        (organization_id, user_id, device_id, schedule_id, name, timestamp, method, status, 
         latitude, longitude, notes, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, 'card', ?, ?, ?, ?, NOW(), NOW())`,
      [
        user.organization_id,
        user.id,
        device_id || null,
        finalScheduleId,
        `${user.first_name} ${user.last_name}`,
        recordTimestamp,
        finalStatus,
        latitude || null,
        longitude || null,
        lateMinutes > 0 ? `Late by ${lateMinutes} minutes` : null
      ]
    );

    // Log activity
    await connection.execute(
      `INSERT INTO activity_logs 
        (organization_id, user_id, action, entity_type, entity_id, new_values, created_at) 
       VALUES (?, ?, 'card_attendance', 'attendance', ?, ?, NOW())`,
      [
        user.organization_id,
        user.id,
        result.insertId,
        JSON.stringify({ card_uid, status: finalStatus, schedule_id: finalScheduleId, late_minutes: lateMinutes })
      ]
    );

    // Update daily summary
    await updateDailySummary(connection, user.organization_id, user.id, recordTimestamp);

    await connection.commit();

    // Return success response
    const responseMessage = finalStatus === 'late' 
      ? `${actionType === 'check_in' ? 'Check-in' : 'Check-out'} successful (Late by ${lateMinutes} minutes)`
      : `${actionType === 'check_in' ? 'Check-in' : 'Check-out'} successful`;
    
    if (finalScheduleId) {
      res.json({
        success: true,
        data: {
          user_id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          status: finalStatus,
          late_minutes: lateMinutes,
          schedule_id: finalScheduleId,
          message: responseMessage
        },
        message: responseMessage
      });
    } else {
      res.json({
        success: true,
        data: {
          user_id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          status: finalStatus,
          late_minutes: lateMinutes,
          message: responseMessage + ' (No schedule assigned)'
        },
        message: responseMessage
      });
    }
  } catch (error) {
    await connection.rollback();
    console.error('Device check-in error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    connection.release();
  }
};

// Helper function to detect applicable schedule for a user
async function detectUserSchedule(connection, organizationId, userId, checkType = 'check_in') {
  // First, get user details to know their role and assignments
  const [users] = await connection.execute(
    `SELECT u.id, u.role, 
            st.section_id, c.id as class_id,
            e.department_id, e.position_id
     FROM users u
     LEFT JOIN students st ON u.id = st.user_id
     LEFT JOIN classes c ON st.class_id = c.id
     LEFT JOIN employees e ON u.id = e.user_id
     WHERE u.id = ? AND u.organization_id = ? AND u.is_active = 1`,
    [userId, organizationId]
  );
  
  if (users.length === 0) {
    console.log(`User ${userId} not found or inactive`);
    return null;
  }
  
  const user = users[0];
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  console.log(`Detecting schedule for user ${userId} (${user.role}) on ${currentDay} at ${currentTime}`);
  
  // Build query to find applicable schedules
  let scheduleQuery = `
    SELECT s.* 
    FROM schedules s
    WHERE s.organization_id = ? 
      AND s.is_active = 1
  `;
  
  const params = [organizationId];
  
  // Add target type conditions
  const targetConditions = [];
  
  // Always include 'all' target type
  targetConditions.push("s.target_type = 'all'");
  
  // Check specific user targeting
  targetConditions.push(`(s.target_type = 'specific_users' AND JSON_CONTAINS(s.target_ids, ?))`);
  params.push(JSON.stringify(userId));
  
  if (user.role === 'student') {
    if (user.class_id) {
      targetConditions.push(`(s.target_type = 'classes' AND JSON_CONTAINS(s.target_ids, ?))`);
      params.push(JSON.stringify(user.class_id));
      console.log(`User is in class ${user.class_id}`);
    }
    if (user.section_id) {
      targetConditions.push(`(s.target_type = 'sections' AND JSON_CONTAINS(s.target_ids, ?))`);
      params.push(JSON.stringify(user.section_id));
      console.log(`User is in section ${user.section_id}`);
    }
  } else {
    if (user.position_id) {
      targetConditions.push(`(s.target_type = 'positions' AND JSON_CONTAINS(s.target_ids, ?))`);
      params.push(JSON.stringify(user.position_id));
      console.log(`User has position ${user.position_id}`);
    }
    if (user.department_id) {
      targetConditions.push(`(s.target_type = 'departments' AND JSON_CONTAINS(s.target_ids, ?))`);
      params.push(JSON.stringify(user.department_id));
      console.log(`User is in department ${user.department_id}`);
    }
  }
  
  scheduleQuery += ` AND (${targetConditions.join(' OR ')})`;
  
  // Get all applicable schedules
  const [allSchedules] = await connection.execute(scheduleQuery, params);
  
  console.log(`Found ${allSchedules.length} applicable schedules for user ${userId}`);
  
  if (allSchedules.length === 0) {
    return null;
  }
  
  // Log all schedules for debugging
  for (const s of allSchedules) {
    console.log(`Schedule: ${s.name}, type: ${s.type}, days: ${s.days_of_week}, start: ${s.start_time}, end: ${s.end_time}`);
  }
  
  // Filter schedules by day of week and time
  const applicableSchedules = allSchedules.filter(schedule => {
    // Parse days_of_week (it's stored as JSON string)
    let daysOfWeek = schedule.days_of_week;
    if (typeof daysOfWeek === 'string') {
      try {
        daysOfWeek = JSON.parse(daysOfWeek);
      } catch (e) {
        daysOfWeek = [];
      }
    }
    
    // Check if schedule applies to today
    const dayMatch = daysOfWeek.includes(currentDay);
    if (!dayMatch) {
      console.log(`Schedule ${schedule.name} skipped - day mismatch (needs ${daysOfWeek.join(',')}, today is ${currentDay})`);
      return false;
    }
    
    // For check_in, check if current time is within schedule window
    if (checkType === 'check_in') {
      const isWithinTime = currentTime >= schedule.start_time && currentTime <= schedule.end_time;
      if (!isWithinTime) {
        console.log(`Schedule ${schedule.name} skipped - time mismatch (needs ${schedule.start_time}-${schedule.end_time}, current ${currentTime})`);
        return false;
      }
      console.log(`Schedule ${schedule.name} is active now!`);
    }
    
    return true;
  });
  
  console.log(`Found ${applicableSchedules.length} currently active schedules for user ${userId}`);
  
  if (applicableSchedules.length === 0) {
    return null;
  }
  
  // Select the schedule (prefer one with matching type)
  let selectedSchedule = applicableSchedules[0];
  for (const schedule of applicableSchedules) {
    if (schedule.type === checkType || schedule.type === 'both') {
      selectedSchedule = schedule;
      break;
    }
  }
  
  console.log(`Selected schedule: ${selectedSchedule.name} (${selectedSchedule.id})`);
  
  // Calculate if late for check_in
  let lateMinutes = 0;
  let status = checkType;
  
  if (checkType === 'check_in') {
    if (currentTime > selectedSchedule.start_time) {
      // Parse times for comparison
      const [scheduleHour, scheduleMinute] = selectedSchedule.start_time.split(':').map(Number);
      const [currentHour, currentMinute] = currentTime.split(':').map(Number);
      
      let scheduleTotalMinutes = scheduleHour * 60 + scheduleMinute;
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      
      // Add grace period
      const graceMinutes = selectedSchedule.grace_minutes || 0;
      scheduleTotalMinutes += graceMinutes;
      
      if (currentTotalMinutes > scheduleTotalMinutes) {
        lateMinutes = currentTotalMinutes - scheduleTotalMinutes;
        if (lateMinutes >= (selectedSchedule.late_threshold_minutes || 15)) {
          status = 'late';
          console.log(`User is late by ${lateMinutes} minutes (grace: ${graceMinutes}, threshold: ${selectedSchedule.late_threshold_minutes})`);
        } else {
          console.log(`User is within grace period (late by ${lateMinutes}min, grace: ${graceMinutes}min)`);
        }
      } else {
        console.log(`User is on time`);
      }
    } else {
      console.log(`User checked in before start time`);
    }
  }
  
  return {
    schedule_id: selectedSchedule.id,
    status: status,
    late_minutes: lateMinutes,
    schedule: selectedSchedule
  };
}

// Bulk import attendance records
export const bulkImportAttendance = async (req, res) => {
  const { organizationId } = req;
  const { records } = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, error: 'No records to import' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let imported = 0;
    let failed = 0;

    for (const record of records) {
      try {
        const { user_id, timestamp, status, method, device_id, notes, schedule_id } = record;

        const [users] = await connection.execute(
          'SELECT id, first_name, last_name, organization_id FROM users WHERE id = ? AND organization_id = ?',
          [user_id, organizationId]
        );

        if (users.length === 0) {
          failed++;
          continue;
        }

        const user = users[0];
        const recordTimestamp = timestamp || new Date().toISOString().slice(0, 19).replace('T', ' ');

        await connection.execute(
          `INSERT INTO attendance 
            (organization_id, user_id, device_id, schedule_id, name, timestamp, method, status, notes, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            organizationId,
            user_id,
            device_id || null,
            schedule_id || null,
            `${user.first_name} ${user.last_name}`,
            recordTimestamp,
            method || 'manual',
            status || 'present',
            notes || null
          ]
        );

        await updateDailySummary(connection, organizationId, user_id, recordTimestamp);
        imported++;
      } catch (err) {
        failed++;
        console.error('Bulk import record error:', err);
      }
    }

    await connection.commit();

    res.json({
      success: true,
      data: { imported, failed, total: records.length },
      message: `Imported ${imported} records, failed ${failed}`
    });
  } catch (error) {
    await connection.rollback();
    console.error('Bulk import attendance error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    connection.release();
  }
};