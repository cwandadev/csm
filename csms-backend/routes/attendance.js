// backend/routes/attendance.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// =====================================================
// SCHEDULE ROUTES
// =====================================================

// Get all schedules for organization
router.get('/schedules', authenticate, async (req, res) => {
  try {
    const organizationId = req.admin.organization_id;
    
    const [schedules] = await db.query(
      `SELECT * FROM attendance_schedules 
       WHERE organization_id = ? 
       ORDER BY created_at DESC`,
      [organizationId]
    );
    
    // Parse JSON fields
    const parsedSchedules = schedules.map(schedule => ({
      ...schedule,
      days_of_week: JSON.parse(schedule.days_of_week || '[]'),
      device_ids: JSON.parse(schedule.device_ids || '[]'),
      target_departments: JSON.parse(schedule.target_departments || '[]'),
      target_positions: JSON.parse(schedule.target_positions || '[]'),
      target_sections: JSON.parse(schedule.target_sections || '[]'),
      target_classes: JSON.parse(schedule.target_classes || '[]'),
    }));
    
    res.json({ success: true, data: parsedSchedules });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch schedules' });
  }
});

// Create schedule
router.post('/schedules', authenticate, async (req, res) => {
  const {
    name,
    description,
    type,
    start_time,
    end_time,
    days_of_week,
    is_active,
    device_ids,
    target_type,
    target_departments,
    target_positions,
    target_sections,
    target_classes,
  } = req.body;
  
  const organizationId = req.admin.organization_id;
  const createdBy = req.admin.id;
  
  try {
    const [result] = await db.query(
      `INSERT INTO attendance_schedules 
       (organization_id, name, description, type, start_time, end_time, 
        days_of_week, is_active, device_ids, target_type, 
        target_departments, target_positions, target_sections, target_classes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        organizationId, name, description, type, start_time, end_time,
        JSON.stringify(days_of_week), is_active ? 1 : 0, JSON.stringify(device_ids || []),
        target_type, JSON.stringify(target_departments || []), JSON.stringify(target_positions || []),
        JSON.stringify(target_sections || []), JSON.stringify(target_classes || []), createdBy
      ]
    );
    
    res.json({ success: true, data: { id: result.insertId }, message: 'Schedule created successfully' });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to create schedule' });
  }
});

// Update schedule
router.put('/schedules/:id', authenticate, async (req, res) => {
  const scheduleId = req.params.id;
  const updates = req.body;
  const organizationId = req.admin.organization_id;
  
  try {
    // Verify schedule belongs to organization
    const [existing] = await db.query(
      'SELECT id FROM attendance_schedules WHERE id = ? AND organization_id = ?',
      [scheduleId, organizationId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }
    
    const updateFields = [];
    const updateValues = [];
    
    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(updates.description);
    }
    if (updates.type !== undefined) {
      updateFields.push('type = ?');
      updateValues.push(updates.type);
    }
    if (updates.start_time !== undefined) {
      updateFields.push('start_time = ?');
      updateValues.push(updates.start_time);
    }
    if (updates.end_time !== undefined) {
      updateFields.push('end_time = ?');
      updateValues.push(updates.end_time);
    }
    if (updates.days_of_week !== undefined) {
      updateFields.push('days_of_week = ?');
      updateValues.push(JSON.stringify(updates.days_of_week));
    }
    if (updates.is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(updates.is_active ? 1 : 0);
    }
    if (updates.device_ids !== undefined) {
      updateFields.push('device_ids = ?');
      updateValues.push(JSON.stringify(updates.device_ids));
    }
    if (updates.target_type !== undefined) {
      updateFields.push('target_type = ?');
      updateValues.push(updates.target_type);
    }
    if (updates.target_departments !== undefined) {
      updateFields.push('target_departments = ?');
      updateValues.push(JSON.stringify(updates.target_departments));
    }
    if (updates.target_positions !== undefined) {
      updateFields.push('target_positions = ?');
      updateValues.push(JSON.stringify(updates.target_positions));
    }
    if (updates.target_sections !== undefined) {
      updateFields.push('target_sections = ?');
      updateValues.push(JSON.stringify(updates.target_sections));
    }
    if (updates.target_classes !== undefined) {
      updateFields.push('target_classes = ?');
      updateValues.push(JSON.stringify(updates.target_classes));
    }
    
    updateFields.push('updated_at = NOW()');
    
    if (updateFields.length > 0) {
      updateValues.push(scheduleId);
      await db.query(
        `UPDATE attendance_schedules SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }
    
    res.json({ success: true, message: 'Schedule updated successfully' });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to update schedule' });
  }
});

// Delete schedule
router.delete('/schedules/:id', authenticate, async (req, res) => {
  const scheduleId = req.params.id;
  const organizationId = req.admin.organization_id;
  
  try {
    // First, set null for attendance records using this schedule
    await db.query(
      'UPDATE attendance SET schedule_id = NULL WHERE schedule_id = ?',
      [scheduleId]
    );
    
    // Delete the schedule
    const [result] = await db.query(
      'DELETE FROM attendance_schedules WHERE id = ? AND organization_id = ?',
      [scheduleId, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }
    
    res.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to delete schedule' });
  }
});

// =====================================================
// ATTENDANCE RECORDS ROUTES
// =====================================================

// Get attendance records with filters
router.get('/records', authenticate, async (req, res) => {
  const organizationId = req.admin.organization_id;
  const { start_date, end_date, user_id, device_id, status, page = 1, limit = 50 } = req.query;
  
  try {
    let query = `
      SELECT 
        a.*,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.image as user_image,
        u.role as user_role,
        d.device_name,
        s.name as schedule_name,
        CONCAT(adm.first_name, ' ', adm.last_name) as verified_by_name
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN devices d ON a.device_id = d.id
      LEFT JOIN attendance_schedules s ON a.schedule_id = s.id
      LEFT JOIN admins adm ON a.verified_by = adm.id
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
    if (device_id) {
      query += ` AND a.device_id = ?`;
      params.push(device_id);
    }
    if (status) {
      query += ` AND a.status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY a.timestamp DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    const [records] = await db.query(query, params);
    
    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM attendance a WHERE a.organization_id = ?`;
    const countParams = [organizationId];
    if (start_date) {
      countQuery += ` AND DATE(a.timestamp) >= ?`;
      countParams.push(start_date);
    }
    if (end_date) {
      countQuery += ` AND DATE(a.timestamp) <= ?`;
      countParams.push(end_date);
    }
    if (user_id) {
      countQuery += ` AND a.user_id = ?`;
      countParams.push(user_id);
    }
    if (status) {
      countQuery += ` AND a.status = ?`;
      countParams.push(status);
    }
    
    const [countResult] = await db.query(countQuery, countParams);
    
    res.json({
      success: true,
      data: records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance records' });
  }
});

// Get user attendance
router.get('/users/:userId/records', authenticate, async (req, res) => {
  const organizationId = req.admin.organization_id;
  const userId = req.params.userId;
  const { start_date, end_date } = req.query;
  
  try {
    let query = `
      SELECT 
        a.*,
        d.device_name,
        s.name as schedule_name
      FROM attendance a
      LEFT JOIN devices d ON a.device_id = d.id
      LEFT JOIN attendance_schedules s ON a.schedule_id = s.id
      WHERE a.organization_id = ? AND a.user_id = ?
    `;
    
    const params = [organizationId, userId];
    
    if (start_date) {
      query += ` AND DATE(a.timestamp) >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND DATE(a.timestamp) <= ?`;
      params.push(end_date);
    }
    
    query += ` ORDER BY a.timestamp DESC`;
    
    const [records] = await db.query(query, params);
    
    res.json({ success: true, data: records });
  } catch (error) {
    console.error('Error fetching user attendance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user attendance' });
  }
});

// Create manual attendance
router.post('/manual', authenticate, async (req, res) => {
  const {
    user_id,
    status,
    timestamp,
    notes,
  } = req.body;
  
  const organizationId = req.admin.organization_id;
  const verifiedBy = req.admin.id;
  
  try {
    // Verify user belongs to organization
    const [userCheck] = await db.query(
      'SELECT id FROM users WHERE id = ? AND organization_id = ?',
      [user_id, organizationId]
    );
    
    if (userCheck.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const [result] = await db.query(
      `INSERT INTO attendance 
       (organization_id, user_id, device_id, timestamp, method, status, notes, verified_by)
       VALUES (?, ?, NULL, ?, 'manual', ?, ?, ?)`,
      [organizationId, user_id, timestamp, status, notes || null, verifiedBy]
    );
    
    // Log activity
    await db.query(
      `INSERT INTO activity_logs 
       (organization_id, admin_id, action, entity_type, entity_id, new_values)
       VALUES (?, ?, 'manual_attendance', 'attendance', ?, ?)`,
      [organizationId, verifiedBy, result.insertId, JSON.stringify({ user_id, status, timestamp })]
    );
    
    res.json({ success: true, data: { id: result.insertId }, message: 'Manual attendance recorded successfully' });
  } catch (error) {
    console.error('Error creating manual attendance:', error);
    res.status(500).json({ success: false, error: 'Failed to record manual attendance' });
  }
});

// Update attendance record
router.put('/records/:id', authenticate, async (req, res) => {
  const recordId = req.params.id;
  const { status, notes } = req.body;
  const organizationId = req.admin.organization_id;
  
  try {
    // Verify record belongs to organization
    const [existing] = await db.query(
      'SELECT id FROM attendance WHERE id = ? AND organization_id = ?',
      [recordId, organizationId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Attendance record not found' });
    }
    
    const updates = [];
    const values = [];
    
    if (status) {
      updates.push('status = ?');
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }
    
    updates.push('updated_at = NOW()');
    values.push(recordId);
    
    await db.query(`UPDATE attendance SET ${updates.join(', ')} WHERE id = ?`, values);
    
    res.json({ success: true, message: 'Attendance record updated successfully' });
  } catch (error) {
    console.error('Error updating attendance record:', error);
    res.status(500).json({ success: false, error: 'Failed to update attendance record' });
  }
});

// Delete attendance record
router.delete('/records/:id', authenticate, async (req, res) => {
  const recordId = req.params.id;
  const organizationId = req.admin.organization_id;
  
  try {
    const [result] = await db.query(
      'DELETE FROM attendance WHERE id = ? AND organization_id = ?',
      [recordId, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Attendance record not found' });
    }
    
    res.json({ success: true, message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Error deleting attendance record:', error);
    res.status(500).json({ success: false, error: 'Failed to delete attendance record' });
  }
});

// =====================================================
// STATISTICS ROUTES
// =====================================================

// Get attendance statistics
router.get('/stats', authenticate, async (req, res) => {
  const organizationId = req.admin.organization_id;
  const { start_date, end_date } = req.query;
  
  try {
    let query = `
      SELECT 
        COUNT(*) as total_records,
        SUM(CASE WHEN status = 'check_in' THEN 1 ELSE 0 END) as check_ins,
        SUM(CASE WHEN status = 'check_out' THEN 1 ELSE 0 END) as check_outs,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_arrivals,
        SUM(CASE WHEN status = 'early_leave' THEN 1 ELSE 0 END) as early_departures,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT DATE(timestamp)) as unique_days
      FROM attendance
      WHERE organization_id = ?
    `;
    
    const params = [organizationId];
    
    if (start_date) {
      query += ` AND DATE(timestamp) >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND DATE(timestamp) <= ?`;
      params.push(end_date);
    }
    
    const [stats] = await db.query(query, params);
    
    res.json({ success: true, data: stats[0] });
  } catch (error) {
    console.error('Error fetching attendance stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

// Get daily summary
router.get('/summary/daily/:date', authenticate, async (req, res) => {
  const organizationId = req.admin.organization_id;
  const date = req.params.date;
  
  try {
    // Get total users
    const [totalUsers] = await db.query(
      'SELECT COUNT(*) as total FROM users WHERE organization_id = ? AND is_active = 1',
      [organizationId]
    );
    
    // Get present users
    const [presentUsers] = await db.query(
      `SELECT COUNT(DISTINCT user_id) as present 
       FROM attendance 
       WHERE organization_id = ? AND DATE(timestamp) = ?`,
      [organizationId, date]
    );
    
    // Get late arrivals
    const [lateArrivals] = await db.query(
      `SELECT COUNT(DISTINCT user_id) as late 
       FROM attendance 
       WHERE organization_id = ? AND DATE(timestamp) = ? AND status = 'late'`,
      [organizationId, date]
    );
    
    // Get attendance by role
    const [byRole] = await db.query(
      `SELECT u.role, COUNT(DISTINCT a.user_id) as count
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       WHERE a.organization_id = ? AND DATE(a.timestamp) = ?
       GROUP BY u.role`,
      [organizationId, date]
    );
    
    res.json({
      success: true,
      data: {
        date,
        total_users: totalUsers[0].total,
        present: presentUsers[0].present,
        late: lateArrivals[0].late,
        absent: totalUsers[0].total - presentUsers[0].present,
        attendance_rate: totalUsers[0].total > 0 
          ? ((presentUsers[0].present / totalUsers[0].total) * 100).toFixed(2) 
          : 0,
        by_role: byRole
      }
    });
  } catch (error) {
    console.error('Error fetching daily summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch daily summary' });
  }
});

// Get devices for attendance
router.get('/devices', authenticate, async (req, res) => {
  const organizationId = req.admin.organization_id;
  
  try {
    const [devices] = await db.query(
      'SELECT id, device_name, unique_device_id, status FROM devices WHERE organization_id = ?',
      [organizationId]
    );
    
    res.json({ success: true, data: devices });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch devices' });
  }
});

// Verify card UID
router.post('/verify-card', authenticate, async (req, res) => {
  const { card_uid } = req.body;
  const organizationId = req.admin.organization_id;
  
  try {
    const [user] = await db.query(
      `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) as name, u.role
       FROM users u
       WHERE u.card_uid = ? AND u.organization_id = ? AND u.is_active = 1`,
      [card_uid, organizationId]
    );
    
    if (user.length > 0) {
      res.json({ success: true, data: user[0], message: 'Card verified' });
    } else {
      res.json({ success: false, error: 'Card not recognized' });
    }
  } catch (error) {
    console.error('Error verifying card:', error);
    res.status(500).json({ success: false, error: 'Failed to verify card' });
  }
});

module.exports = router;