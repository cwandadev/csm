import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all schedules for org
router.get('/', authenticateToken, async (req, res) => {
  try {
    const orgId = req.query.org_id || req.user.organizationId;
    const [rows] = await db.execute(
      'SELECT * FROM schedules WHERE organization_id = ? ORDER BY created_at DESC',
      [orgId]
    );
    // Parse JSON fields
    const schedules = rows.map(r => ({
      ...r,
      days_of_week: typeof r.days_of_week === 'string' ? JSON.parse(r.days_of_week) : r.days_of_week,
      device_ids: r.device_ids ? (typeof r.device_ids === 'string' ? JSON.parse(r.device_ids) : r.device_ids) : [],
      target_ids: r.target_ids ? (typeof r.target_ids === 'string' ? JSON.parse(r.target_ids) : r.target_ids) : [],
    }));
    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch schedules' });
  }
});

// Get single schedule
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM schedules WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Schedule not found' });
    const r = rows[0];
    r.days_of_week = typeof r.days_of_week === 'string' ? JSON.parse(r.days_of_week) : r.days_of_week;
    res.json({ success: true, data: r });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch schedule' });
  }
});

// Create schedule
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { organizationId, name, description, type, start_time, end_time, days_of_week,
            grace_minutes, late_threshold_minutes, early_leave_threshold_minutes,
            target_type, target_ids, device_ids, is_active } = req.body;

    const [result] = await db.execute(
      `INSERT INTO schedules (organization_id, name, description, type, start_time, end_time,
        days_of_week, grace_minutes, late_threshold_minutes, early_leave_threshold_minutes,
        target_type, target_ids, device_ids, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        organizationId, name, description || null, type || 'both',
        start_time, end_time, JSON.stringify(days_of_week || []),
        grace_minutes || 0, late_threshold_minutes || 15, early_leave_threshold_minutes || 15,
        target_type || 'all', JSON.stringify(target_ids || []),
        JSON.stringify(device_ids || []), is_active !== false ? 1 : 0,
        req.user.userId
      ]
    );
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ success: false, error: 'Failed to create schedule' });
  }
});

// Update schedule
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, type, start_time, end_time, days_of_week,
            grace_minutes, late_threshold_minutes, early_leave_threshold_minutes,
            target_type, target_ids, device_ids, is_active } = req.body;

    await db.execute(
      `UPDATE schedules SET name=?, description=?, type=?, start_time=?, end_time=?,
        days_of_week=?, grace_minutes=?, late_threshold_minutes=?, early_leave_threshold_minutes=?,
        target_type=?, target_ids=?, device_ids=?, is_active=?
       WHERE id=?`,
      [
        name, description || null, type || 'both', start_time, end_time,
        JSON.stringify(days_of_week || []), grace_minutes || 0,
        late_threshold_minutes || 15, early_leave_threshold_minutes || 15,
        target_type || 'all', JSON.stringify(target_ids || []),
        JSON.stringify(device_ids || []), is_active !== false ? 1 : 0,
        req.params.id
      ]
    );
    res.json({ success: true, data: { id: +req.params.id } });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ success: false, error: 'Failed to update schedule' });
  }
});

// Delete schedule
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute('DELETE FROM schedules WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete schedule' });
  }
});

export default router;
