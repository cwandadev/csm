// csms-backend/routes/auditRoutes.js
import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireOrganization } from '../middleware/auth.js';

const router = express.Router();

// Get audit logs for organization
router.get('/audit-logs', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action, 
      entity_type, 
      admin_id,
      date_from,
      date_to 
    } = req.query;
    
    let query = `
      SELECT 
        al.id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.admin_id,
        CONCAT(a.first_name, ' ', a.last_name) as admin_name,
        a.email as admin_email,
        al.old_values,
        al.new_values,
        al.ip_address,
        al.user_agent,
        al.created_at
      FROM activity_logs al
      JOIN admins a ON al.admin_id = a.id
      WHERE al.organization_id = ?
    `;
    
    const params = [req.organizationId];
    
    if (action && action !== 'all') {
      query += ' AND al.action = ?';
      params.push(action);
    }
    
    if (entity_type && entity_type !== 'all') {
      query += ' AND al.entity_type = ?';
      params.push(entity_type);
    }
    
    if (admin_id && admin_id !== 'all') {
      query += ' AND al.admin_id = ?';
      params.push(admin_id);
    }
    
    if (date_from) {
      query += ' AND DATE(al.created_at) >= ?';
      params.push(date_from);
    }
    
    if (date_to) {
      query += ' AND DATE(al.created_at) <= ?';
      params.push(date_to);
    }
    
    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    const [logs] = await pool.execute(query, params);
    
    // Get total count for pagination
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM activity_logs WHERE organization_id = ?',
      [req.organizationId]
    );
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

// Get audit log by ID
router.get('/audit-logs/:id', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const [logs] = await pool.execute(
      `SELECT al.*, CONCAT(a.first_name, ' ', a.last_name) as admin_name, a.email as admin_email
       FROM activity_logs al
       JOIN admins a ON al.admin_id = a.id
       WHERE al.id = ? AND al.organization_id = ?`,
      [req.params.id, req.organizationId]
    );
    
    if (logs.length === 0) {
      return res.status(404).json({ success: false, error: 'Log not found' });
    }
    
    res.json({ success: true, data: logs[0] });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit log' });
  }
});

// Get audit log statistics
router.get('/audit-logs/stats/summary', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT admin_id) as unique_admins,
        COUNT(DISTINCT DATE(created_at)) as active_days,
        SUM(CASE WHEN action LIKE '%add%' OR action LIKE '%create%' THEN 1 ELSE 0 END) as created_actions,
        SUM(CASE WHEN action LIKE '%delete%' OR action LIKE '%remove%' THEN 1 ELSE 0 END) as deleted_actions,
        SUM(CASE WHEN action LIKE '%update%' OR action LIKE '%edit%' THEN 1 ELSE 0 END) as updated_actions
       FROM activity_logs
       WHERE organization_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [req.organizationId]
    );
    
    res.json({ success: true, data: stats[0] });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

export default router;