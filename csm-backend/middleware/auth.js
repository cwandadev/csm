// csms-backend/middleware/auth.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import pool from '../config/database.js';

dotenv.config();

// Main authentication middleware
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.adminId = decoded.adminId;
    req.organizationId = decoded.organizationId;
    req.email = decoded.email;
    req.role = decoded.role;
    
    // Optional: Check if token is about to expire (within 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp - currentTime < 300) {
      res.setHeader('X-Token-Expiring', 'true');
    }
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    console.error('Token verification error:', error);
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.adminId = decoded.adminId;
    req.organizationId = decoded.organizationId;
    req.email = decoded.email;
    req.role = decoded.role;
    next();
  } catch (error) {
    // Just continue without auth
    next();
  }
};

// Require organization context
export const requireOrganization = async (req, res, next) => {
  if (!req.organizationId) {
    return res.status(400).json({ success: false, error: 'Organization context required' });
  }
  
  // Optional: Check if organization is active
  try {
    const [orgs] = await pool.execute(
      'SELECT id, subscription_status FROM organizations WHERE id = ?',
      [req.organizationId]
    );
    
    if (orgs.length === 0) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }
    
    const org = orgs[0];
    
    // Check subscription status
    if (org.subscription_status === 'suspended') {
      return res.status(403).json({ 
        success: false, 
        error: 'Organization account is suspended. Please contact support.' 
      });
    }
    
    if (org.subscription_status === 'inactive') {
      return res.status(403).json({ 
        success: false, 
        error: 'Organization subscription is inactive. Please renew to continue.' 
      });
    }
    
    next();
  } catch (error) {
    console.error('Organization check error:', error);
    next();
  }
};

// Role-based authorization middleware
export const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.adminId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    try {
      // Get admin role from database
      const [admins] = await pool.execute(
        `SELECT a.*, ar.name as role_name, ar.permissions 
         FROM admins a
         JOIN admin_roles ar ON a.role_id = ar.id
         WHERE a.id = ?`,
        [req.adminId]
      );
      
      if (admins.length === 0) {
        return res.status(403).json({ success: false, error: 'Admin not found' });
      }
      
      const admin = admins[0];
      
      // Check if role is allowed
      if (allowedRoles.length > 0 && !allowedRoles.includes(admin.role_name)) {
        return res.status(403).json({ 
          success: false, 
          error: 'Insufficient permissions. Required role: ' + allowedRoles.join(', ') 
        });
      }
      
      req.adminRole = admin.role_name;
      req.adminPermissions = admin.permissions;
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({ success: false, error: 'Authorization check failed' });
    }
  };
};

// Permission-based authorization middleware
export const hasPermission = (permission) => {
  return async (req, res, next) => {
    if (!req.adminId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    try {
      const [admins] = await pool.execute(
        `SELECT a.*, ar.permissions 
         FROM admins a
         JOIN admin_roles ar ON a.role_id = ar.id
         WHERE a.id = ?`,
        [req.adminId]
      );
      
      if (admins.length === 0) {
        return res.status(403).json({ success: false, error: 'Admin not found' });
      }
      
      const admin = admins[0];
      const permissions = typeof admin.permissions === 'string' 
        ? JSON.parse(admin.permissions) 
        : admin.permissions;
      
      // Check for wildcard permission
      if (permissions['*'] === true) {
        return next();
      }
      
      // Check specific permission
      if (!permissions[permission]) {
        return res.status(403).json({ 
          success: false, 
          error: `Missing required permission: ${permission}` 
        });
      }
      
      req.adminPermissions = permissions;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ success: false, error: 'Permission check failed' });
    }
  };
};

// Rate limiting middleware
export const rateLimit = (maxRequests = 100, windowMs = 60000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.adminId || req.ip;
    const now = Date.now();
    
    if (!requests.has(key)) {
      requests.set(key, []);
    }
    
    const timestamps = requests.get(key).filter(time => now - time < windowMs);
    
    if (timestamps.length >= maxRequests) {
      return res.status(429).json({ 
        success: false, 
        error: `Too many requests. Please try again later.` 
      });
    }
    
    timestamps.push(now);
    requests.set(key, timestamps);
    next();
  };
};

// Verify organization access (user must belong to the organization)
export const verifyOrganizationAccess = async (req, res, next) => {
  const targetOrgId = req.params.orgId || req.body.organization_id || req.query.org_id;
  const userOrgId = req.organizationId;
  
  if (!targetOrgId) {
    return next();
  }
  
  if (parseInt(targetOrgId) !== parseInt(userOrgId)) {
    // Check if admin is super admin (bypass)
    const [admins] = await pool.execute(
      `SELECT ar.name as role_name 
       FROM admins a
       JOIN admin_roles ar ON a.role_id = ar.id
       WHERE a.id = ?`,
      [req.adminId]
    );
    
    if (admins.length > 0 && admins[0].role_name === 'super_admin') {
      return next();
    }
    
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied. You do not have permission to access this organization.' 
    });
  }
  
  next();
};

// Log activity middleware
export const logActivity = (action, entityType = null) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Only log successful operations
      if (data && data.success !== false) {
        const entityId = req.params.id || req.params.userId || req.params.deviceId || null;
        
        pool.execute(
          `INSERT INTO activity_logs 
           (organization_id, admin_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            req.organizationId || null,
            req.adminId || null,
            action,
            entityType || req.baseUrl.split('/').pop(),
            entityId,
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

export const canManageUsers = async (req, res, next) => {
  try {
    const [result] = await pool.execute(
      `SELECT 
        COUNT(*) as current_users,
        COALESCE(sp.max_users, 999999) as max_users,
        sp.name as plan_name
       FROM users u
       CROSS JOIN (
         SELECT sp2.max_users, sp2.name 
         FROM subscriptions s
         JOIN subscription_plans sp2 ON s.plan_id = sp2.id
         WHERE s.organization_id = ? AND s.status IN ('active', 'trial')
         LIMIT 1
       ) sp
       WHERE u.organization_id = ?`,
      [req.organizationId, req.organizationId]
    );
    
    const currentUsers = result[0]?.current_users || 0;
    const maxUsers = result[0]?.max_users || 0;
    const planName = result[0]?.plan_name || 0;
    
    req.userLimitInfo = {
      currentUsers,
      maxUsers: maxUsers === 999999 ? 'Unlimited' : maxUsers,
      planName,
      remainingSlots: maxUsers === 999999 ? 'Unlimited' : Math.max(0, maxUsers - currentUsers),
      isUnlimited: maxUsers === 999999,
      canAddMore: maxUsers === 999999 || currentUsers < maxUsers,
      percentageUsed: maxUsers === 999999 ? 0 : (currentUsers / maxUsers) * 100
    };
    
    next();
  } catch (error) {
    console.error('Error checking user limit:', error);
    req.userLimitInfo = {
      currentUsers: 0,
      maxUsers: 'Unlimited',
      planName: 'Unknown',
      remainingSlots: 'Unlimited',
      isUnlimited: true,
      canAddMore: true,
      percentageUsed: 0
    };
    next();
  }
};

// Export all middleware
export default {
  authenticateToken,
  optionalAuth,
  requireOrganization,
  authorize,
  hasPermission,
  canManageUsers,
  rateLimit,
  verifyOrganizationAccess,
  logActivity
};