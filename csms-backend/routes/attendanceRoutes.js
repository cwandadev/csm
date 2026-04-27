// csms-backend/routes/attendanceRoutes.js
import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireOrganization } from '../middleware/auth.js';

const router = express.Router();

// ============ ATTENDANCE RECORDS ============

// Get all attendance records with filters
router.get('/records', authenticateToken, requireOrganization, async (req, res) => {
  const { 
    search, 
    status, 
    method, 
    startDate, 
    endDate,
    schedule_id,
    page = 1,
    limit = 50
  } = req.query;
  
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT 
      a.id,
      CONCAT(u.first_name, ' ', u.last_name) as user_name,
      u.image as user_image,
      u.role as user_role,
      a.method,
      a.status,
      a.timestamp,
      d.device_name as device,
      at.name as attendance_type,
      a.notes,
      s.name as schedule_name,
      e.department_id,
      dep.name as department_name,
      pos.name as position_name,
      sec.name as section_name,
      cls.name as class_name
    FROM attendance a
    INNER JOIN users u ON a.user_id = u.id
    LEFT JOIN devices d ON a.device_id = d.id
    LEFT JOIN attendance_types at ON a.attendance_type_id = at.id
    LEFT JOIN schedules s ON a.schedule_id = s.id
    LEFT JOIN employees e ON u.id = e.user_id
    LEFT JOIN departments dep ON e.department_id = dep.id
    LEFT JOIN positions pos ON e.position_id = pos.id
    LEFT JOIN students st ON u.id = st.user_id
    LEFT JOIN sections sec ON st.section_id = sec.id
    LEFT JOIN classes cls ON st.class_id = cls.id
    WHERE a.organization_id = ?
  `;
  
  const params = [req.organizationId];
  
  if (search) {
    query += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  
  if (status && status !== 'all') {
    query += ` AND a.status = ?`;
    params.push(status);
  }
  
  if (method && method !== 'all') {
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
  
  if (schedule_id && schedule_id !== 'all') {
    query += ` AND a.schedule_id = ?`;
    params.push(schedule_id);
  }
  
  query += ` ORDER BY a.timestamp DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);
  
  try {
    const [records] = await pool.execute(query, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM attendance a
      INNER JOIN users u ON a.user_id = u.id
      WHERE a.organization_id = ?
    `;
    const countParams = [req.organizationId];
    
    if (search) {
      countQuery += ` AND (u.first_name LIKE ? OR u.last_name LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    if (status && status !== 'all') {
      countQuery += ` AND a.status = ?`;
      countParams.push(status);
    }
    
    if (method && method !== 'all') {
      countQuery += ` AND a.method = ?`;
      countParams.push(method);
    }
    
    if (schedule_id && schedule_id !== 'all') {
      countQuery += ` AND a.schedule_id = ?`;
      countParams.push(schedule_id);
    }
    
    const [countResult] = await pool.execute(countQuery, countParams);
    
    res.json({
      success: true,
      data: records,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get attendance records error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance records' });
  }
});

// Get today's statistics
router.get('/stats/today', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const [totalRecords] = await pool.execute(
      `SELECT COUNT(*) as total FROM attendance 
       WHERE organization_id = ? AND DATE(timestamp) = ?`,
      [req.organizationId, today]
    );
    
    const [checkIns] = await pool.execute(
      `SELECT COUNT(DISTINCT user_id) as total FROM attendance 
       WHERE organization_id = ? AND DATE(timestamp) = ? 
       AND status IN ('check_in', 'present')`,
      [req.organizationId, today]
    );
    
    const [absents] = await pool.execute(
      `SELECT COUNT(*) as total FROM users 
       WHERE organization_id = ? AND is_active = 1 
       AND id NOT IN (
         SELECT DISTINCT user_id FROM attendance 
         WHERE organization_id = ? AND DATE(timestamp) = ?
       )`,
      [req.organizationId, req.organizationId, today]
    );
    
    const [lates] = await pool.execute(
      `SELECT COUNT(*) as total FROM attendance 
       WHERE organization_id = ? AND DATE(timestamp) = ? 
       AND status = 'late'`,
      [req.organizationId, today]
    );
    
    res.json({
      success: true,
      data: {
        total_records: totalRecords[0].total,
        check_ins: checkIns[0].total,
        absents: absents[0].total,
        lates: lates[0].total
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

// ============ ORGANIZATION STRUCTURE ============

// Get organization structure (sections/classes for schools, departments/positions for both)
router.get('/structure', authenticateToken, requireOrganization, async (req, res) => {
  const { organizationId } = req;

  try {
    let response = {
      success: true,
      data: {}
    };

    // Get sections and their classes
    const [sections] = await pool.execute(
      `SELECT id, name, description FROM sections WHERE organization_id = ? AND is_active = 1 ORDER BY name`,
      [organizationId]
    );
    
    for (const section of sections) {
      const [classes] = await pool.execute(
        `SELECT id, name, grade_level, capacity FROM classes 
         WHERE section_id = ? AND organization_id = ? AND is_active = 1 
         ORDER BY name`,
        [section.id, organizationId]
      );
      section.classes = classes;
    }
    
    response.data.sections = sections;
    
    // Get departments and their positions
    const [departments] = await pool.execute(
      `SELECT id, name, description FROM departments 
       WHERE organization_id = ? AND is_active = 1 
       ORDER BY name`,
      [organizationId]
    );
    
    for (const dept of departments) {
      const [positions] = await pool.execute(
        `SELECT id, name, salary_range FROM positions 
         WHERE department_id = ? AND organization_id = ? AND is_active = 1 
         ORDER BY name`,
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
});

// Get target users based on selection
router.get('/target-users', authenticateToken, requireOrganization, async (req, res) => {
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
      // Get all active users
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
});

// Get schedules for a specific user (for manual attendance)
router.get('/user-schedules', authenticateToken, requireOrganization, async (req, res) => {
  const { organizationId } = req;
  const { user_id } = req.query;
  
  if (!user_id) {
    return res.status(400).json({ success: false, error: 'user_id required' });
  }
  
  try {
    // Get user info
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
    
    scheduleQuery += ` OR (s.target_type = 'specific_users' AND JSON_CONTAINS(s.target_ids, ?))`;
    params.push(JSON.stringify(parseInt(user_id)));
    
    scheduleQuery += ` ) ORDER BY s.created_at DESC`;
    
    const [schedules] = await pool.execute(scheduleQuery, params);
    
    const parsedSchedules = schedules.map(s => ({
      ...s,
      days_of_week: JSON.parse(s.days_of_week || '[]'),
      target_ids: s.target_ids ? JSON.parse(s.target_ids) : null
    }));
    
    res.json({ success: true, data: parsedSchedules });
  } catch (error) {
    console.error('Get user schedules error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============ SCHEDULES CRUD ============

// Get attendance schedules
router.get('/schedules', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const [schedules] = await pool.execute(
      `SELECT * FROM schedules 
       WHERE organization_id = ? 
       ORDER BY created_at DESC`,
      [req.organizationId]
    );
    
    // Parse JSON fields
    const parsedSchedules = schedules.map(schedule => ({
      ...schedule,
      days_of_week: schedule.days_of_week ? JSON.parse(schedule.days_of_week) : [],
      target_ids: schedule.target_ids ? JSON.parse(schedule.target_ids) : null
    }));
    
    res.json({ success: true, data: parsedSchedules });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch schedules' });
  }
});

// Create new schedule
router.post('/schedules', authenticateToken, requireOrganization, async (req, res) => {
  const {
    name,
    description,
    type,
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
  
  if (!name || !start_time || !end_time || !days_of_week || days_of_week.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  
  try {
    const [result] = await pool.execute(
      `INSERT INTO schedules (
        organization_id, name, description, type, start_time, end_time,
        days_of_week, grace_minutes, late_threshold_minutes,
        early_leave_threshold_minutes, is_active, device_ids,
        target_type, target_ids, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        req.organizationId, name, description || null, type,
        start_time, end_time, JSON.stringify(days_of_week),
        grace_minutes, late_threshold_minutes, early_leave_threshold_minutes,
        is_active ? 1 : 0, device_ids ? JSON.stringify(device_ids) : null,
        target_type, target_ids ? JSON.stringify(target_ids) : null,
        req.adminId
      ]
    );
    
    res.json({
      success: true,
      message: 'Schedule created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ success: false, error: 'Failed to create schedule' });
  }
});

// Update schedule
router.put('/schedules/:id', authenticateToken, requireOrganization, async (req, res) => {
  const { id } = req.params;
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
      [id, req.organizationId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }
    
    await pool.execute(
      `UPDATE schedules SET
        name = ?, description = ?, type = ?, start_time = ?, end_time = ?,
        days_of_week = ?, grace_minutes = ?, late_threshold_minutes = ?,
        early_leave_threshold_minutes = ?, is_active = ?, device_ids = ?,
        target_type = ?, target_ids = ?, updated_at = NOW()
      WHERE id = ? AND organization_id = ?`,
      [
        name, description || null, type, start_time, end_time,
        JSON.stringify(days_of_week), grace_minutes, late_threshold_minutes,
        early_leave_threshold_minutes, is_active ? 1 : 0,
        device_ids ? JSON.stringify(device_ids) : null,
        target_type, target_ids ? JSON.stringify(target_ids) : null,
        id, req.organizationId
      ]
    );
    
    res.json({ success: true, message: 'Schedule updated successfully' });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ success: false, error: 'Failed to update schedule' });
  }
});

// Delete schedule
router.delete('/schedules/:id', authenticateToken, requireOrganization, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if schedule is in use
    const [inUse] = await pool.execute(
      'SELECT id FROM attendance WHERE schedule_id = ?',
      [id]
    );
    
    if (inUse.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete schedule that has attendance records' 
      });
    }
    
    const [result] = await pool.execute(
      'DELETE FROM schedules WHERE id = ? AND organization_id = ?',
      [id, req.organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }
    
    res.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete schedule' });
  }
});
































// ============ MANUAL ATTENDANCE ============

// Record manual attendance
router.post('/manual', authenticateToken, requireOrganization, async (req, res) => {
  const { user_id, status, notes, schedule_id } = req.body;
  
  if (!user_id || !status) {
    return res.status(400).json({ success: false, error: 'User ID and status are required' });
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Verify user belongs to organization
    const [users] = await connection.execute(
      'SELECT id, first_name, last_name FROM users WHERE id = ? AND organization_id = ? AND is_active = 1',
      [user_id, req.organizationId]
    );
    
    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'User not found or inactive' });
    }
    
    const user = users[0];
    
    // Get a default device
    const [devices] = await connection.execute(
      'SELECT id FROM devices WHERE organization_id = ? AND status = "active" LIMIT 1',
      [req.organizationId]
    );
    
    const deviceId = devices.length > 0 ? devices[0].id : null;
    
    // Determine final status and late minutes based on schedule
    let finalStatus = status;
    let lateMinutes = 0;
    let finalScheduleId = schedule_id || null;
    
    if (status === 'check_in') {
      // If schedule_id is provided, use it
      if (schedule_id) {
        const [schedules] = await connection.execute(
          'SELECT * FROM schedules WHERE id = ? AND organization_id = ? AND is_active = 1',
          [schedule_id, req.organizationId]
        );
        
        if (schedules.length > 0) {
          const schedule = schedules[0];
          finalScheduleId = schedule.id;
          
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
        const [schedules] = await connection.execute(
          `SELECT s.* FROM schedules s
           WHERE s.organization_id = ? AND s.is_active = 1
           AND (
             s.target_type = 'all'
             OR (s.target_type = 'specific_users' AND JSON_CONTAINS(s.target_ids, ?))
             OR (s.target_type = 'departments' AND EXISTS (
               SELECT 1 FROM employees e WHERE e.user_id = ? AND e.department_id IN (SELECT CAST(value AS UNSIGNED) FROM JSON_TABLE(s.target_ids, '$[*]' COLUMNS(value INT PATH '$')) AS jt)
             ))
             OR (s.target_type = 'positions' AND EXISTS (
               SELECT 1 FROM employees e WHERE e.user_id = ? AND e.position_id IN (SELECT CAST(value AS UNSIGNED) FROM JSON_TABLE(s.target_ids, '$[*]' COLUMNS(value INT PATH '$')) AS jt)
             ))
           )
           ORDER BY s.created_at DESC LIMIT 1`,
          [req.organizationId, JSON.stringify(user_id), user_id, user_id]
        );
        
        if (schedules.length > 0) {
          finalScheduleId = schedules[0].id;
          
          const now = new Date();
          const currentTime = now.toTimeString().slice(0, 8);
          const scheduleStart = schedules[0].start_time;
          
          if (currentTime > scheduleStart) {
            const graceEnd = new Date(`2000-01-01T${scheduleStart}`);
            graceEnd.setMinutes(graceEnd.getMinutes() + (schedules[0].grace_minutes || 0));
            const currentTimeMs = new Date(`2000-01-01T${currentTime}`).getTime();
            
            if (currentTimeMs > graceEnd.getTime()) {
              lateMinutes = Math.floor((currentTimeMs - graceEnd.getTime()) / 60000);
              if (lateMinutes >= (schedules[0].late_threshold_minutes || 15)) {
                finalStatus = 'late';
              }
            }
          }
        }
      }
    }
    
    const recordTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    // Record attendance with schedule_id
    const [result] = await connection.execute(
      `INSERT INTO attendance (
        organization_id, user_id, device_id, schedule_id, name, timestamp,
        method, status, notes, verified_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, NOW(), NOW())`,
      [
        req.organizationId, 
        user_id, 
        deviceId, 
        finalScheduleId,  // Save the schedule_id
        `${user.first_name} ${user.last_name}`,
        recordTimestamp,
        finalStatus,
        notes || (lateMinutes > 0 ? `Late by ${lateMinutes} minutes` : null),
        req.adminId
      ]
    );
    
    // Update daily summary
    await updateDailySummaryHelper(connection, req.organizationId, user_id, recordTimestamp);
    
    // Log activity
    await connection.execute(
      `INSERT INTO activity_logs (
        organization_id, admin_id, action, entity_type, entity_id,
        new_values, created_at
      ) VALUES (?, ?, 'manual_attendance', 'attendance', ?, ?, NOW())`,
      [
        req.organizationId, req.adminId, result.insertId,
        JSON.stringify({ user_id, status, notes, schedule_id: finalScheduleId })
      ]
    );
    
    await connection.commit();
    
    res.json({ 
      success: true, 
      message: `Manual ${finalStatus === 'late' ? 'late ' : ''}${finalStatus.replace('_', ' ')} recorded successfully`,
      data: { schedule_id: finalScheduleId }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Manual attendance error:', error);
    res.status(500).json({ success: false, error: 'Failed to record attendance' });
  } finally {
    connection.release();
  }
});



// Get users for manual attendance dropdown
router.get('/users', authenticateToken, requireOrganization, async (req, res) => {
  const { search } = req.query;
  
  let query = `
    SELECT id, first_name, last_name, email, role, is_active
    FROM users
    WHERE organization_id = ?
  `;
  const params = [req.organizationId];
  
  if (search) {
    query += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  
  query += ` ORDER BY first_name, last_name LIMIT 100`;
  
  try {
    const [users] = await pool.execute(query, params);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});









































// Helper function for daily summary
async function updateDailySummaryHelper(connection, organizationId, userId, timestamp) {
  const date = timestamp.slice(0, 10);
  
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
  
  let firstCheckIn = null;
  let lastCheckOut = null;
  let checkInCount = 0;
  let checkOutCount = 0;
  let isLate = false;
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let totalWorkMinutes = 0;
  
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
  }
  
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
  
  if (firstCheckIn && lastCheckOut) {
    totalWorkMinutes = Math.floor((new Date(lastCheckOut) - new Date(firstCheckIn)) / 60000);
  }
  
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
    [organizationId, userId, date, firstCheckIn, lastCheckOut, totalWorkMinutes,
     status, checkInCount, checkOutCount, isLate ? 1 : 0, lateMinutes, earlyLeaveMinutes, 0]
  );
}

// Export attendance to CSV
router.get('/export', authenticateToken, requireOrganization, async (req, res) => {
  const { startDate, endDate, status, method, schedule_id } = req.query;
  
  let query = `
    SELECT 
      CONCAT(u.first_name, ' ', u.last_name) as 'User Name',
      u.role as 'Role',
      u.email as 'Email',
      a.method as 'Method',
      a.status as 'Status',
      a.timestamp as 'Timestamp',
      DATE(a.timestamp) as 'Date',
      TIME(a.timestamp) as 'Time',
      d.device_name as 'Device',
      s.name as 'Schedule',
      at.name as 'Attendance Type',
      a.notes as 'Notes'
    FROM attendance a
    INNER JOIN users u ON a.user_id = u.id
    LEFT JOIN devices d ON a.device_id = d.id
    LEFT JOIN attendance_types at ON a.attendance_type_id = at.id
    LEFT JOIN schedules s ON a.schedule_id = s.id
    WHERE a.organization_id = ?
  `;
  
  const params = [req.organizationId];
  
  if (startDate) {
    query += ` AND DATE(a.timestamp) >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    query += ` AND DATE(a.timestamp) <= ?`;
    params.push(endDate);
  }
  
  if (status && status !== 'all') {
    query += ` AND a.status = ?`;
    params.push(status);
  }
  
  if (method && method !== 'all') {
    query += ` AND a.method = ?`;
    params.push(method);
  }
  
  if (schedule_id && schedule_id !== 'all') {
    query += ` AND a.schedule_id = ?`;
    params.push(schedule_id);
  }
  
  query += ` ORDER BY a.timestamp DESC`;
  
  try {
    const [records] = await pool.execute(query, params);
    res.json({ success: true, data: records });
  } catch (error) {
    console.error('Export attendance error:', error);
    res.status(500).json({ success: false, error: 'Failed to export attendance' });
  }
});

export default router;