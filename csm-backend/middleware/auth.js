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
    
    // Get complete admin data with role information from database
    const [admins] = await pool.execute(
      `SELECT a.*, ar.name as role_name, ar.role_level, ar.permissions 
       FROM admins a
       JOIN admin_roles ar ON a.role_id = ar.id
       WHERE a.id = ? AND a.is_active = 1`,
      [decoded.adminId]
    );
    
    if (admins.length > 0) {
      const admin = admins[0];
      req.roleLevel = admin.role_level;
      req.permissions = typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : admin.permissions;
      req.dbRole = admin.role_name;
    }
    
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
    
    // Get role info from database
    const [admins] = await pool.execute(
      `SELECT a.*, ar.name as role_name, ar.role_level, ar.permissions 
       FROM admins a
       JOIN admin_roles ar ON a.role_id = ar.id
       WHERE a.id = ? AND a.is_active = 1`,
      [decoded.adminId]
    );
    
    if (admins.length > 0) {
      const admin = admins[0];
      req.roleLevel = admin.role_level;
      req.permissions = typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : admin.permissions;
    }
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
      // Get admin role from database if not already set
      let roleName = req.dbRole || req.role;
      
      if (!roleName) {
        const [admins] = await pool.execute(
          `SELECT ar.name as role_name 
           FROM admins a
           JOIN admin_roles ar ON a.role_id = ar.id
           WHERE a.id = ?`,
          [req.adminId]
        );
        
        if (admins.length === 0) {
          return res.status(403).json({ success: false, error: 'Admin not found' });
        }
        
        roleName = admins[0].role_name;
      }
      
      // Check if role is allowed
      if (allowedRoles.length > 0 && !allowedRoles.includes(roleName)) {
        return res.status(403).json({ 
          success: false, 
          error: 'Insufficient permissions. Required role: ' + allowedRoles.join(', ') 
        });
      }
      
      req.adminRole = roleName;
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({ success: false, error: 'Authorization check failed' });
    }
  };
};

// Role-based authorization by level (1=Super Admin, 2=Owner, 3=Manager)
export const authorizeByLevel = (minRoleLevel) => {
  return async (req, res, next) => {
    if (!req.adminId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    try {
      let roleLevel = req.roleLevel;
      
      if (!roleLevel) {
        const [admins] = await pool.execute(
          `SELECT ar.role_level 
           FROM admins a
           JOIN admin_roles ar ON a.role_id = ar.id
           WHERE a.id = ?`,
          [req.adminId]
        );
        
        if (admins.length === 0) {
          return res.status(403).json({ success: false, error: 'Admin not found' });
        }
        
        roleLevel = admins[0].role_level;
      }
      
      // Lower number = higher privilege
      if (roleLevel > minRoleLevel) {
        return res.status(403).json({ 
          success: false, 
          error: `Insufficient permissions. Required role level: ${minRoleLevel}` 
        });
      }
      
      next();
    } catch (error) {
      console.error('Authorization by level error:', error);
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
      let permissions = req.permissions;
      
      if (!permissions) {
        const [admins] = await pool.execute(
          `SELECT ar.permissions 
           FROM admins a
           JOIN admin_roles ar ON a.role_id = ar.id
           WHERE a.id = ?`,
          [req.adminId]
        );
        
        if (admins.length === 0) {
          return res.status(403).json({ success: false, error: 'Admin not found' });
        }
        
        permissions = typeof admins[0].permissions === 'string' 
          ? JSON.parse(admins[0].permissions) 
          : admins[0].permissions;
      }
      
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
    let roleName = req.dbRole || req.role;
    
    if (!roleName) {
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
    } else if (roleName === 'super_admin') {
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

// Check user limit based on subscription
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
    const planName = result[0]?.plan_name || 'Free';
    
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

// Check if admin can manage other admins
export const canManageAdmins = async (req, res, next) => {
  if (!req.adminId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  try {
    let roleName = req.dbRole || req.role;
    
    if (!roleName) {
      const [admins] = await pool.execute(
        `SELECT ar.name as role_name 
         FROM admins a
         JOIN admin_roles ar ON a.role_id = ar.id
         WHERE a.id = ?`,
        [req.adminId]
      );
      
      if (admins.length === 0) {
        return res.status(403).json({ success: false, error: 'Admin not found' });
      }
      
      roleName = admins[0].role_name;
    }
    
    // Super admin can always manage admins
    if (roleName === 'super_admin') {
      return next();
    }
    
    // Check if this admin is the primary owner of the organization
    const [admins] = await pool.execute(
      'SELECT is_primary FROM admins WHERE id = ? AND organization_id = ?',
      [req.adminId, req.organizationId]
    );
    
    if (admins.length > 0 && admins[0].is_primary === 1) {
      return next();
    }
    
    return res.status(403).json({ 
      success: false, 
      error: 'Only organization owner or super admin can manage admins' 
    });
  } catch (error) {
    console.error('canManageAdmins error:', error);
    return res.status(500).json({ success: false, error: 'Authorization check failed' });
  }
};

// Check if user can transfer ownership
export const canTransferOwnership = async (req, res, next) => {
  if (!req.adminId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  try {
    let roleName = req.dbRole || req.role;
    
    if (!roleName) {
      const [admins] = await pool.execute(
        `SELECT ar.name as role_name 
         FROM admins a
         JOIN admin_roles ar ON a.role_id = ar.id
         WHERE a.id = ?`,
        [req.adminId]
      );
      
      if (admins.length === 0) {
        return res.status(403).json({ success: false, error: 'Admin not found' });
      }
      
      roleName = admins[0].role_name;
    }
    
    // Super admin can transfer ownership
    if (roleName === 'super_admin') {
      return next();
    }
    
    // Check if this admin is the primary owner
    const [admins] = await pool.execute(
      'SELECT is_primary FROM admins WHERE id = ? AND organization_id = ?',
      [req.adminId, req.organizationId]
    );
    
    if (admins.length > 0 && admins[0].is_primary === 1) {
      return next();
    }
    
    return res.status(403).json({ 
      success: false, 
      error: 'Only the organization owner can transfer ownership' 
    });
  } catch (error) {
    console.error('canTransferOwnership error:', error);
    return res.status(500).json({ success: false, error: 'Authorization check failed' });
  }
};

// Check if admin can access a specific user
export const canAccessUser = async (req, res, next) => {
  const targetUserId = req.params.userId || req.body.user_id;
  
  if (!targetUserId) {
    return next();
  }
  
  try {
    const [users] = await pool.execute(
      'SELECT organization_id FROM users WHERE id = ?',
      [targetUserId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const userOrgId = users[0].organization_id;
    
    // Check if admin is super admin
    let roleName = req.dbRole || req.role;
    
    if (!roleName) {
      const [admins] = await pool.execute(
        `SELECT ar.name as role_name 
         FROM admins a
         JOIN admin_roles ar ON a.role_id = ar.id
         WHERE a.id = ?`,
        [req.adminId]
      );
      
      if (admins.length > 0) {
        roleName = admins[0].role_name;
      }
    }
    
    // Super admin can access any user
    if (roleName === 'super_admin') {
      return next();
    }
    
    // Check if user belongs to admin's organization
    if (userOrgId !== req.organizationId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. User does not belong to your organization.' 
      });
    }
    
    next();
  } catch (error) {
    console.error('User access check error:', error);
    return res.status(500).json({ success: false, error: 'Access check failed' });
  }
};

// Export all middleware
export default {
  authenticateToken,
  optionalAuth,
  requireOrganization,
  authorize,
  authorizeByLevel,
  hasPermission,
  rateLimit,
  verifyOrganizationAccess,
  logActivity,
  canManageUsers,
  canManageAdmins,
  canTransferOwnership,
  canAccessUser
};