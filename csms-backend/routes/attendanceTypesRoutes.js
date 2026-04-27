import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all attendance types for org
router.get('/', authenticateToken, async (req, res) => {
  try {
    const orgId = req.query.org_id || req.user.organizationId;
    const [rows] = await db.execute(
      'SELECT * FROM attendance_types WHERE organization_id = ? AND is_active = 1 ORDER BY sort_order, name',
      [orgId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch attendance types' });
  }
});

// Create
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { organizationId, name, description, requires_check_out, color, icon,
            affects_attendance_percentage, is_paid, sort_order } = req.body;
    const [result] = await db.execute(
      `INSERT INTO attendance_types (organization_id, name, description, requires_check_out,
        color, icon, affects_attendance_percentage, is_paid, sort_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [organizationId, name, description || null, requires_check_out ? 1 : 0,
       color || '#3b82f6', icon || null, affects_attendance_percentage !== false ? 1 : 0,
       is_paid !== false ? 1 : 0, sort_order || 0, req.user.userId]
    );
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create attendance type' });
  }
});

// Update
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, requires_check_out, color, icon,
            affects_attendance_percentage, is_paid, sort_order, is_active } = req.body;
    await db.execute(
      `UPDATE attendance_types SET name=?, description=?, requires_check_out=?,
        color=?, icon=?, affects_attendance_percentage=?, is_paid=?, sort_order=?, is_active=?
       WHERE id=?`,
      [name, description || null, requires_check_out ? 1 : 0, color || '#3b82f6',
       icon || null, affects_attendance_percentage !== false ? 1 : 0,
       is_paid !== false ? 1 : 0, sort_order || 0, is_active !== false ? 1 : 0,
       req.params.id]
    );
    res.json({ success: true, data: { id: +req.params.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update attendance type' });
  }
});

// Delete
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute('DELETE FROM attendance_types WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete attendance type' });
  }
});

export default router;
