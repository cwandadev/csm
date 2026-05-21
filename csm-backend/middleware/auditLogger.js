// csms-backend/middleware/auditLogger.js
import pool from '../config/database.js';

export const logActivity = (action, entityType = null) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Only log successful operations
      if (data && data.success !== false) {
        const entityId = req.params.id || req.params.userId || req.params.deviceId || null;
        
        // Extract what changed
        let oldValues = null;
        let newValues = null;
        
        if (req.method === 'PUT' || req.method === 'PATCH') {
          newValues = req.body;
          if (req.oldData) {
            oldValues = req.oldData;
          }
        } else if (req.method === 'POST') {
          newValues = req.body;
        }
        
        pool.execute(
          `INSERT INTO activity_logs 
           (organization_id, admin_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            req.organizationId || null,
            req.adminId || null,
            action,
            entityType || req.baseUrl.split('/').pop(),
            entityId,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            req.headers['user-agent'] || null
          ]
        ).catch(err => console.error('Activity log error:', err));
      }
      
      originalJson.call(this, data);
    };
    
    next();
  };
};