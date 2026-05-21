// csms-backend/controllers/authController.js
import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { generateOTP, generateToken } from '../utils/generateCode.js';
import emailService from '../services/emailService.js';
import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';

dotenv.config();

// Initialize Google OAuth client
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

// Helper function to format dates for MySQL - use UTC
const formatDate = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// the register function
export const register = async (req, res) => {
  const { 
    firstName, lastName, email, username, password,
    gender, roleId, profileImage,
    orgName, orgType, orgAddress, orgEmail, orgPhone, orgLogo,
    province, district, apiSlug,
    planId, billingCycle, planDetails
  } = req.body;

  console.log('[REGISTER] Received request with planId:', planId);
  console.log('[REGISTER] Profile image URL:', profileImage);
  console.log('[REGISTER] Logo URL (orgLogo):', orgLogo);
  console.log('[REGISTER] Logo URL (logo field):', req.body.logo);

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Helper function to extract filename from URL
    const extractFilename = (url, defaultName) => {
      if (!url || url === '') return defaultName;
      if (!url.includes('/')) return url;
      const parts = url.split('/');
      const filename = parts[parts.length - 1];
      return filename || defaultName;
    };

    // Validate required fields
    if (!firstName || !lastName || !email || !username || !password) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: First name, last name, email, username, and password are required.' 
      });
    }
    
    if (!orgName || !orgType) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        error: 'Missing organization information: organization name and type are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }

    // Validate password strength
    if (password.length < 6) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters long' 
      });
    }

    // Check if admin already exists
    const [existingAdmin] = await connection.execute(
      'SELECT id FROM admins WHERE email = ? OR username = ?',
      [email, username]
    );
    
    if (existingAdmin.length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        error: 'Admin already exists with this email or username' 
      });
    }

    // Extract filenames from URLs - Store only filename in database
    const profileFilename = extractFilename(profileImage, 'admin_default.jpg');
    const logoUrl = orgLogo || req.body.logo || '';
    const logoFilename = extractFilename(logoUrl, 'logo_default.png');
    
    console.log('[REGISTER] Extracted profile filename:', profileFilename);
    console.log('[REGISTER] Extracted logo filename:', logoFilename);
    console.log('[REGISTER] Original logo URL:', logoUrl);

    // Create organization live view slug
    const apiPageValue = apiSlug ? `${apiSlug}` : `${orgName.toLowerCase().replace(/\s+/g, '-')}`;
    
    // Create organization - Store logo filename only
    const [orgResult] = await connection.execute(
      `INSERT INTO organizations (
        org_name, logo, province, district, address, type, 
        contact_email, contact_phone, page_slug, subscription_status, 
        trial_ends_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'trial', DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW())`,
      [
        orgName, 
        logoFilename,
        province || null, 
        district || null, 
        orgAddress || null, 
        orgType, 
        orgEmail || email, 
        orgPhone || null, 
        apiPageValue
      ]
    ); 
    
    const organizationId = orgResult.insertId;
    console.log('[REGISTER] Organization created with ID:', organizationId);

    // Map frontend plan IDs to backend plan names
    let planName = 'free';
    if (planId === 'basic') planName = 'basic';
    else if (planId === 'professional') planName = 'professional';
    else if (planId === 'enterprise') planName = 'enterprise';
    else if (planId === 'free_trial') planName = 'free';
    
    console.log('[REGISTER] Using plan name:', planName, 'from planId:', planId);
    
    // Get or create subscription plan
    let planIdValue = null;
    let planPrice = 0;
    let planMaxUsers = planDetails?.maxUsers || (planId === 'free_trial' ? 200 : 1000);
    let planMaxDevices = planDetails?.maxDevices || (planId === 'free_trial' ? 1 : 2);
    let planMaxAdmins = planDetails?.maxAdmins || 1;
    let planAnalyticsLevel = planDetails?.analyticsLevel || 'basic';
    let planSupportLevel = planDetails?.supportLevel || 'email';
    
    // Check if plan exists in database
    const [existingPlan] = await connection.execute(
      'SELECT id, price_monthly, price_yearly, max_users, max_devices, max_admins, analytics_level, support_level FROM subscription_plans WHERE name = ?',
      [planName]
    );
    
    if (existingPlan.length > 0) {
      planIdValue = existingPlan[0].id;
      planPrice = billingCycle === 'monthly' ? existingPlan[0].price_monthly : existingPlan[0].price_yearly;
      planMaxUsers = existingPlan[0].max_users !== null ? existingPlan[0].max_users : planMaxUsers;
      planMaxDevices = existingPlan[0].max_devices !== null ? existingPlan[0].max_devices : planMaxDevices;
      planMaxAdmins = existingPlan[0].max_admins;
      planAnalyticsLevel = existingPlan[0].analytics_level;
      planSupportLevel = existingPlan[0].support_level;
      console.log('[REGISTER] Using existing plan ID:', planIdValue);
    } else {
      const priceMonthly = planId === 'free_trial' ? 0 : (planId === 'basic' ? 19 : (planId === 'professional' ? 49 : 199));
      const priceYearly = planId === 'free_trial' ? 0 : (planId === 'basic' ? 190 : (planId === 'professional' ? 490 : 1990));
      
      const [newPlan] = await connection.execute(
        `INSERT INTO subscription_plans (
          name, display_name, description, price_monthly, price_yearly,
          max_users, max_devices, max_admins, analytics_level, dashboard_level,
          api_access, custom_reports, custom_branding, support_level,
          live_view_enabled, live_view_duration, export_data, webhooks,
          is_active, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
        [
          planName,
          planDetails?.displayName || (planId === 'free_trial' ? 'Free Trial' : (planId === 'basic' ? 'Basic Plan' : (planId === 'professional' ? 'Professional Plan' : 'Enterprise Plan'))),
          planDetails?.desc || (planId === 'free_trial' ? '30-day free trial' : 'Subscription plan'),
          priceMonthly,
          priceYearly,
          planMaxUsers === null ? null : planMaxUsers,
          planMaxDevices === null ? null : planMaxDevices,
          planMaxAdmins,
          planAnalyticsLevel,
          'basic',
          1,
          0,
          0,
          planSupportLevel,
          1,
          planDetails?.liveViewDuration || 60,
          0,
          1
        ]
      );
      planIdValue = newPlan.insertId;
      console.log('[REGISTER] Created new plan with ID:', planIdValue);
    }
    

    // INSTEAD, only set subscriptionId = NULL for paid plans, create for free trial only:
let subscriptionId = null;

if (planId === 'free_trial') {
  const [subscriptionResult] = await connection.execute(
    `INSERT INTO subscriptions (
      organization_id, plan_id, billing_cycle, status, amount_paid,
      currency, start_date, end_date, trial_ends_at, auto_renew,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'trial', 0, 'USD', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY), 1, NOW(), NOW())`,
    [organizationId, planIdValue, billingCycle || 'monthly']
  );
  subscriptionId = subscriptionResult.insertId;
}

    // Update organization with subscription info
    await connection.execute(
  `UPDATE organizations SET 
    subscription_status = 'trial',
    subscription_started_at = NOW(),
    subscription_expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY),
    updated_at = NOW()
   WHERE id = ?`,
  [organizationId]
);
    
    // Get admin role
    let adminRoleId = null;
    let roleName = 'basic_admin';
    
    const [existingRole] = await connection.execute(
      'SELECT id FROM admin_roles WHERE name = ?',
      [roleName]
    );
    
    if (existingRole.length > 0) {
      adminRoleId = existingRole[0].id;
    } else {
      const permissions = {
        dashboard: true,
        users: true,
        devices: true,
        analytics: true,
        reports: true,
        api_access: true
      };
      
      const [newRole] = await connection.execute(
        `INSERT INTO admin_roles (name, description, permissions, role_level, created_at, updated_at) 
         VALUES (?, ?, ?, 3, NOW(), NOW())`,
        ['basic_admin', 'Basic administrator with standard permissions', JSON.stringify(permissions)]
      );
      adminRoleId = newRole.insertId;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate verification code
    const verificationCode = generateOTP();
    console.log('[REGISTER] Verification code for', email, ':', verificationCode);
    
    // Create admin user - Store profile filename only
    const [adminResult] = await connection.execute(
      `INSERT INTO admins (
        organization_id, role_id, subscription_id, first_name, last_name, 
        username, email, password_hash, profile, gender,
        verification_code, code_expiry_time, is_verified, 
        is_primary, is_active, is_public, auth_provider, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?, ?, 1, 0, 'email', NOW(), NOW())`,
      [
        organizationId, 
        adminRoleId, 
        subscriptionId,
        firstName, 
        lastName, 
        username, 
        email, 
        hashedPassword,
        profileFilename,
        gender || null,
        verificationCode, 
        0,
        1
      ]
    );
    
    const adminId = adminResult.insertId;
    console.log('[REGISTER] Admin created with ID:', adminId);
    
    // Create activity log
    await connection.execute(
      `INSERT INTO activity_logs (
        organization_id, admin_id, action, entity_type, entity_id,
        new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, 'organization_created', 'organization', ?, ?, ?, ?, NOW())`,
      [
        organizationId, 
        adminId, 
        organizationId, 
        JSON.stringify({ 
          org_name: orgName, 
          type: orgType, 
          plan: planId,
          billing_cycle: billingCycle,
          subscription_id: subscriptionId,
          logo: logoFilename
        }),
        req.ip || null, 
        req.headers['user-agent'] || null
      ]
    );
    
    await connection.commit();
    
    // Send verification email
    try {
      await emailService.sendVerificationCode(email, firstName, verificationCode);
      console.log('[REGISTER] Verification email sent to:', email);
    } catch (emailError) {
      console.error('[REGISTER] Failed to send verification email:', emailError);
    }
    
    // Generate JWT
    const token = jwt.sign(
      { 
        adminId, 
        organizationId, 
        email,
        role: 'admin',
        subscriptionId,
        plan: planId,
        roleId: adminRoleId
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    // Get the formatted end date for response
    const [subInfo] = await connection.execute(
      'SELECT end_date FROM subscriptions WHERE id = ?',
      [subscriptionId]
    );
    const subscriptionStatus = subscriptionId ? 'trial' : 'pending';

    // Return response with full URLs for frontend
res.json({
  success: true,
  message: 'Registration successful. Please check your email for verification code.',
  data: {
    token,
    admin: {
      id: adminId,
      firstName,
      lastName,
      email,
      username,
      profile: `/uploads/profiles/${profileFilename}`,
      gender: gender || null,
      organizationId,
      organizationName: orgName,
      organizationType: orgType,
      isVerified: false,
      plan: planId,
      planName: planId === 'free_trial' ? 'Free Trial' : (planId === 'basic' ? 'Basic Plan' : (planId === 'professional' ? 'Professional Plan' : 'Enterprise Plan')),
      subscriptionId,
      subscriptionStatus,  // Now defined!
      trialEndsAt: subInfo[0]?.end_date,
      subscriptionEndsAt: subInfo[0]?.end_date,
      maxUsers: planMaxUsers,
      maxDevices: planMaxDevices,
      maxAdmins: planMaxAdmins,
      analyticsLevel: planAnalyticsLevel,
      supportLevel: planSupportLevel,
      role: roleName,
      roleId: adminRoleId,
      authProvider: 'email'
    }
  }
});
    
  } catch (error) {
    await connection.rollback();
    console.error('[REGISTER] Error:', error);
    
    let errorMessage = 'Registration failed';
    let statusCode = 500;
    
    if (error.code === 'ER_DUP_ENTRY') {
      errorMessage = 'Duplicate entry detected. Please check your information.';
      statusCode = 400;
    } else if (error.code === 'ER_NO_REFERENCED_ROW') {
      errorMessage = 'Invalid reference. Please check your data.';
      statusCode = 400;
    } else if (error.code === 'ER_BAD_NULL_ERROR') {
      errorMessage = 'Missing required field. Please fill all required fields.';
      statusCode = 400;
    }
    
    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
};

// Verify email with OTP
export const verifyEmail = async (req, res) => {
  const { code, email } = req.body;
  
  if (!code || !email) {
    return res.status(400).json({ success: false, error: 'Code and email are required' });
  }
  
  try {
    const [admins] = await pool.execute(
      `SELECT id, first_name, verification_code, code_expiry_time, is_verified 
       FROM admins 
       WHERE email = ?`,
      [email]
    );
    
    if (admins.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const admin = admins[0];
    
    if (admin.is_verified === 1) {
      return res.status(400).json({ success: false, error: 'Email already verified' });
    }
    
    // Check if code matches
    if (String(admin.verification_code).trim() !== String(code).trim()) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }
    
    // Check if code is expired
    const [checkExpiry] = await pool.execute(
      'SELECT code_expiry_time > NOW() as is_valid FROM admins WHERE id = ?',
      [admin.id]
    );
    
    if (!checkExpiry[0] || !checkExpiry[0].is_valid) {
      return res.status(400).json({ success: false, error: 'Verification code has expired' });
    }
    
    // Verify the admin
    await pool.execute(
      `UPDATE admins 
       SET is_verified = 1, verification_code = NULL, code_expiry_time = NULL, updated_at = NOW()
       WHERE id = ?`,
      [admin.id]
    );
    
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
};

// Resend verification code
export const resendCode = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }
  
  try {
    const [admins] = await pool.execute(
      'SELECT id, first_name, is_verified FROM admins WHERE email = ?',
      [email]
    );
    
    if (admins.length === 0) {
      return res.status(404).json({ success: false, error: 'Admin not found' });
    }
    
    const admin = admins[0];
    
    if (admin.is_verified === 1) {
      return res.status(400).json({ success: false, error: 'Email already verified' });
    }
    
    // Generate new code
    const newCode = generateOTP();
    
    // Update with new code and expiry
    await pool.execute(
      `UPDATE admins 
       SET verification_code = ?, code_expiry_time = DATE_ADD(NOW(), INTERVAL 10 MINUTE), updated_at = NOW()
       WHERE id = ?`,
      [newCode, admin.id]
    );
    
    console.log(`New verification code for ${email}: ${newCode}`);
    
    // Send new code
    try {
      await emailService.sendVerificationCode(email, admin.first_name, newCode);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }
    
    res.json({ success: true, message: 'Verification code resent successfully' });
  } catch (error) {
    console.error('Resend code error:', error);
    res.status(500).json({ success: false, error: 'Failed to resend code' });
  }
};

// Login
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [admins] = await pool.execute(
      `SELECT a.*, o.org_name, o.type as org_type, o.subscription_status as plan,
              o.logo as organization_logo,  -- This is the key field
              s.plan_id, s.status as subscription_status, s.end_date as subscription_end_date
       FROM admins a 
       LEFT JOIN organizations o ON a.organization_id = o.id
       LEFT JOIN subscriptions s ON a.subscription_id = s.id
       WHERE a.email = ? OR a.username = ?`,
      [email, email]
    );

    if (admins.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const admin = admins[0];

    // Check if account is locked
    if (
      admin.account_locked_until &&
      new Date(admin.account_locked_until) > new Date()
    ) {
      return res.status(401).json({
        success: false,
        error: 'Account locked. Try again later.'
      });
    }

    // Check email verification
    if (admin.is_verified === 0) {
      return res.status(401).json({
        success: false,
        error: 'Please verify your email first'
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, admin.password_hash);

    if (!isValid) {
      const attempts = (admin.failed_login_attempts || 0) + 1;

      let lockTime = null;

      if (attempts >= 5) {
        lockTime = new Date(Date.now() + 15 * 60 * 1000);
      }

      await pool.execute(
        `UPDATE admins 
         SET failed_login_attempts = ?, account_locked_until = ? 
         WHERE id = ?`,
        [attempts, lockTime, admin.id]
      );

      return res.status(401).json({
        success: false,
        error: attempts >= 5
          ? 'Account locked due to too many failed attempts. Try again later.'
          : 'Invalid credentials'
      });
    }

    // Reset attempts + update login
    await pool.execute(
      `UPDATE admins 
       SET failed_login_attempts = 0, 
           account_locked_until = NULL,
           last_login = NOW() 
       WHERE id = ?`,
      [admin.id]
    );

    // Generate JWT
    const token = jwt.sign(
      {
        adminId: admin.id,
        organizationId: admin.organization_id,
        subscriptionId: admin.subscription_id,
        email: admin.email,
        role: 'admin'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    // Store session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const formattedExpiresAt = formatDate(expiresAt);

    await pool.execute(
      `INSERT INTO admin_sessions 
       (admin_id, session_token, ip_address, user_agent, expires_at, login_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        admin.id,
        token,
        req.ip || null,
        req.headers['user-agent'] || null,
        formattedExpiresAt
      ]
    );
    
     return res.json({
      success: true,
      data: {
        token,
        admin: {
          id: admin.id,
          firstName: admin.first_name,
          lastName: admin.last_name,
          email: admin.email,
          username: admin.username,
          profile: admin.profile,
          gender: admin.gender,
          organizationId: admin.organization_id,
          organizationName: admin.org_name,
          organizationType: admin.org_type,
          organizationLogo: admin.organization_logo,  // Include this
          isVerified: admin.is_verified === 1,
          plan: admin.plan || 'free_trial',
          subscriptionId: admin.subscription_id,
          subscriptionStatus: admin.subscription_status,
          subscriptionEndDate: admin.subscription_end_date
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
};

// Forgot password - send reset link
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  
  console.log('[FORGOT PASSWORD] Request for email:', email);
  
  if (!email) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email address is required' 
    });
  }
  
  try {
    // CHECK IF EMAIL EXISTS FIRST
    const [admins] = await pool.execute(
      'SELECT id, first_name, email, is_active FROM admins WHERE email = ?',
      [email]
    );
    
    // If email doesn't exist, return specific error
    if (admins.length === 0) {
      console.log('[FORGOT PASSWORD] Email not found:', email);
      return res.status(404).json({ 
        success: false, 
        error: 'No account found with this email address' 
      });
    }
    
    const admin = admins[0];
    
    // Check if account is active
    if (admin.is_active === 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'This account is deactivated. Please contact support.' 
      });
    }
    
    console.log('[FORGOT PASSWORD] Admin found:', admin.id, admin.email);
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    console.log('[FORGOT PASSWORD] Generated token:', resetToken);
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    const formattedExpiresAt = expiresAt.toISOString().slice(0, 19).replace('T', ' ');
    
    // Mark old tokens as used
    await pool.execute(
      'UPDATE password_reset_tokens SET used = 1 WHERE admin_user_id = ? AND used = 0',
      [admin.id]
    );
    
    // Store reset token
    await pool.execute(
      `INSERT INTO password_reset_tokens (admin_user_id, token, expires_at, used, created_at) 
       VALUES (?, ?, ?, 0, UTC_TIMESTAMP())`,
      [admin.id, resetToken, formattedExpiresAt]
    );
    
    // Create reset link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
    
    // Send email
    try {
      await emailService.sendPasswordResetLink(email, admin.first_name, resetLink);
      console.log('[FORGOT PASSWORD] Email sent successfully');
    } catch (emailError) {
      console.error('[FORGOT PASSWORD] Email error:', emailError);
    }
    
    res.json({ 
      success: true, 
      message: 'Password reset link sent to your email' 
    });
  } catch (error) {
    console.error('[FORGOT PASSWORD] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send reset link. Please try again.' 
    });
  }
};


// Reset password
export const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  
  console.log('[RESET PASSWORD] Received token:', token?.substring(0, 20) + '...');
  
  if (!token) {
    return res.status(400).json({ 
      success: false, 
      error: 'Reset token is required' 
    });
  }
  
  if (!password || password.length < 6) {
    return res.status(400).json({ 
      success: false, 
      error: 'Password must be at least 6 characters' 
    });
  }
  
  try {
    // Find valid token
    const [tokens] = await pool.execute(
      `SELECT * FROM password_reset_tokens 
       WHERE token = ? AND used = 0 AND expires_at > UTC_TIMESTAMP()`,
      [token]
    );
    
    if (tokens.length === 0) {
      // Check if token is expired
      const [expiredTokens] = await pool.execute(
        `SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at <= UTC_TIMESTAMP()`,
        [token]
      );
      
      if (expiredTokens.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Reset link has expired. Please request a new one.' 
        });
      }
      
      // Check if token already used
      const [usedTokens] = await pool.execute(
        `SELECT * FROM password_reset_tokens WHERE token = ? AND used = 1`,
        [token]
      );
      
      if (usedTokens.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'This reset link has already been used. Please request a new one.' 
        });
      }
      
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid reset Link. Please request a new Link.' 
      });
    }
    
    const resetTokenRecord = tokens[0];
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update admin password
    await pool.execute(
      'UPDATE admins SET password_hash = ?, last_password_change = NOW() WHERE id = ?',
      [hashedPassword, resetTokenRecord.admin_user_id]
    );
    
    // Mark token as used
    await pool.execute(
      'UPDATE password_reset_tokens SET used = 1 WHERE id = ?',
      [resetTokenRecord.id]
    );
    
    console.log('[RESET PASSWORD] Password updated successfully for admin:', resetTokenRecord.admin_user_id);
    
    // Send confirmation email
    const [admins] = await pool.execute(
      'SELECT first_name, email FROM admins WHERE id = ?',
      [resetTokenRecord.admin_user_id]
    );
    
    if (admins.length > 0) {
      try {
        await emailService.sendPasswordChangeConfirmation(admins[0].email, admins[0].first_name);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Password reset successful! You can now login with your new password.' 
    });
  } catch (error) {
    console.error('[RESET PASSWORD] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reset password. Please try again.' 
    });
  }
};

// In getProfile function
export const getProfile = async (req, res) => {
  try {
    const [admins] = await pool.execute(
      `SELECT a.*, o.org_name, o.type as org_type, o.subscription_status as plan,
              o.logo as organization_logo,  -- Include this
              s.plan_id, s.status as subscription_status, s.end_date as subscription_end_date,
              sp.display_name as plan_name, sp.max_users, sp.max_devices, sp.max_admins
       FROM admins a 
       LEFT JOIN organizations o ON a.organization_id = o.id
       LEFT JOIN subscriptions s ON a.subscription_id = s.id
       LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE a.id = ?`,
      [req.adminId]
    );
    
    const admin = admins[0];
    res.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          firstName: admin.first_name,
          lastName: admin.last_name,
          email: admin.email,
          username: admin.username,
          profile: admin.profile,
          gender: admin.gender,
          organizationId: admin.organization_id,
          organizationName: admin.org_name,
          organizationType: admin.org_type,
          organizationLogo: admin.organization_logo,
          isVerified: admin.is_verified === 1,
          plan: admin.plan || 'free_trial',
          planName: admin.plan_name,
          subscriptionId: admin.subscription_id,
          subscriptionStatus: admin.subscription_status,
          subscriptionEndDate: admin.subscription_end_date,
          maxUsers: admin.max_users,
          maxDevices: admin.max_devices,
          maxAdmins: admin.max_admins,
          bio: admin.bio,
          location: admin.location,
          website: admin.website,
          twitter: admin.twitter,
          facebook: admin.facebook,
          instagram: admin.instagram,
          linkedin: admin.linkedin,
          isPublic: admin.is_public === 1,
          authProvider: admin.auth_provider
        }
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
};

// Update profile
export const updateProfile = async (req, res) => {
  const { 
    firstName, lastName, username, profile, gender, 
    bio, location, website, twitter, facebook, instagram, linkedin, isPublic 
  } = req.body;
  
  try {
    const updates = [];
    const values = [];
    
    if (firstName !== undefined) {
      updates.push('first_name = ?');
      values.push(firstName || null);
    }
    if (lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(lastName || null);
    }
    if (username !== undefined) {
      updates.push('username = ?');
      values.push(username || null);
    }
    if (profile !== undefined) {
      updates.push('profile = ?');
      values.push(profile || 'admin_default.jpg');
    }
    if (gender !== undefined) {
      updates.push('gender = ?');
      values.push(gender || null);
    }
    if (bio !== undefined) {
      updates.push('bio = ?');
      values.push(bio || null);
    }
    if (location !== undefined) {
      updates.push('location = ?');
      values.push(location || null);
    }
    if (website !== undefined) {
      updates.push('website = ?');
      values.push(website || null);
    }
    if (twitter !== undefined) {
      updates.push('twitter = ?');
      values.push(twitter || null);
    }
    if (facebook !== undefined) {
      updates.push('facebook = ?');
      values.push(facebook || null);
    }
    if (instagram !== undefined) {
      updates.push('instagram = ?');
      values.push(instagram || null);
    }
    if (linkedin !== undefined) {
      updates.push('linkedin = ?');
      values.push(linkedin || null);
    }
    if (isPublic !== undefined) {
      updates.push('is_public = ?');
      values.push(isPublic ? 1 : 0);
    }
    
    updates.push('updated_at = NOW()');
    values.push(req.adminId);
    
    if (updates.length === 1) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    
    await pool.execute(
      `UPDATE admins SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    if (req.adminId && req.organizationId) {
      try {
        await pool.execute(
          `INSERT INTO activity_logs (organization_id, admin_id, action, entity_type, entity_id, new_values, created_at) 
           VALUES (?, ?, 'profile_update', 'admin', ?, ?, NOW())`,
          [req.organizationId, req.adminId, req.adminId, JSON.stringify(req.body)]
        );
      } catch (logError) {
        console.error('Failed to log activity:', logError.message);
      }
    }
    
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile: ' + error.message });
  }
};

// Logout
export const logout = async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    try {
      await pool.execute(
        'UPDATE admin_sessions SET logout_at = NOW() WHERE session_token = ? AND logout_at IS NULL',
        [token]
      );
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  res.json({ success: true });
};

// Google Signup
export const googleSignup = async (req, res) => {
  const { token, registrationData } = req.body;
  
  console.log('[Google Signup] Request received');
  console.log('[Google Signup] Registration data:', JSON.stringify(registrationData, null, 2));
  
  if (!token) {
    return res.status(400).json({ success: false, error: 'Google token required' });
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    console.log('[Google Signup] Token verified for:', payload.email);
    console.log('[Google Signup] Google payload picture:', payload.picture);
    
    const { 
      email, 
      given_name, 
      family_name, 
      picture,
      sub: googleId 
    } = payload;
    
    const [existingAdmin] = await connection.execute(
      'SELECT id, email FROM admins WHERE email = ?',
      [email]
    );
    
    if (existingAdmin.length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        error: 'User already exists with this email. Please login instead.' 
      });
    }
    
    const {
      firstName = given_name || '',
      lastName = family_name || '',
      username = email.split('@')[0],
      gender = '',
      roleId = '4',
      profileImage = picture || '',
      orgName,
      orgType = 'school',
      orgAddress = '',
      orgEmail = email,
      orgPhone = '',
      orgLogo = '',
      province = '',
      district = '',
      apiSlug = '',
      planId = 'free_trial',
      billingCycle = 'monthly',
      planDetails = {}
    } = registrationData || {};
    
    if (!orgName) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        error: 'Organization name is required' 
      });
    }
    
    const extractFilename = (url, defaultName) => {
      if (!url || url === '') return defaultName;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      if (!url.includes('/')) return url;
      const parts = url.split('/');
      const filename = parts[parts.length - 1];
      return filename || defaultName;
    };
    
    const logoFilename = extractFilename(orgLogo, 'logo_default.png');
    
    let profileValue = 'admin_default.jpg';
    const googlePictureUrl = picture || profileImage;
    
    if (googlePictureUrl) {
      if (googlePictureUrl.startsWith('http://') || googlePictureUrl.startsWith('https://')) {
        let cleanedUrl = googlePictureUrl;
        if (cleanedUrl.includes('=s') && cleanedUrl.includes('-c')) {
          cleanedUrl = cleanedUrl.split('=')[0];
        }
        if (cleanedUrl.includes('?sz=')) {
          cleanedUrl = cleanedUrl.split('?')[0];
        }
        profileValue = cleanedUrl;
        console.log('[Google Signup] Cleaned Google profile picture URL:', profileValue);
      } else if (googlePictureUrl.includes('/')) {
        const parts = googlePictureUrl.split('/');
        profileValue = parts[parts.length - 1] || 'admin_default.jpg';
      } else {
        profileValue = googlePictureUrl;
      }
    }
    
    const apiPageValue = apiSlug ? `${apiSlug}` : `${orgName.toLowerCase().replace(/\s+/g, '-')}`;
    
    const [orgResult] = await connection.execute(
      `INSERT INTO organizations (
        org_name, logo, province, district, address, type, 
        contact_email, contact_phone, page_slug, subscription_status, 
        trial_ends_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'trial', DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW())`,
      [
        orgName, 
        logoFilename,
        province || null, 
        district || null, 
        orgAddress || null, 
        orgType, 
        orgEmail || email, 
        orgPhone || null, 
        apiPageValue
      ]
    );
    
    const organizationId = orgResult.insertId;
    console.log('[Google Signup] Organization created:', organizationId);
    
    const defaultPlans = {
      free_trial: {
        name: 'free',
        display_name: 'Free Trial',
        description: '30-day free trial with basic features',
        price_monthly: 0,
        price_yearly: 0,
        max_users: planDetails?.maxUsers || 200,
        max_devices: planDetails?.maxDevices || 1,
        max_admins: planDetails?.maxAdmins || 1,
        analytics_level: 'basic',
        support_level: 'email'
      },
      basic: {
        name: 'basic',
        display_name: 'Basic Plan',
        description: 'Basic plan for small organizations',
        price_monthly: 19,
        price_yearly: 190,
        max_users: planDetails?.maxUsers || 100,
        max_devices: planDetails?.maxDevices || 2,
        max_admins: planDetails?.maxAdmins || 2,
        analytics_level: 'basic',
        support_level: 'email'
      },
      professional: {
        name: 'professional',
        display_name: 'Professional Plan',
        description: 'Professional plan for growing organizations',
        price_monthly: 49,
        price_yearly: 490,
        max_users: planDetails?.maxUsers || 500,
        max_devices: planDetails?.maxDevices || 5,
        max_admins: planDetails?.maxAdmins || 3,
        analytics_level: 'advanced',
        support_level: 'priority'
      },
      enterprise: {
        name: 'enterprise',
        display_name: 'Enterprise Plan',
        description: 'Enterprise plan for large organizations',
        price_monthly: 199,
        price_yearly: 1990,
        max_users: planDetails?.maxUsers || 999999,
        max_devices: planDetails?.maxDevices || 15,
        max_admins: planDetails?.maxAdmins || 5,
        analytics_level: 'premium',
        support_level: '24/7'
      }
    };
    
    let selectedPlan = defaultPlans[planId] || defaultPlans.free_trial;
    let planIdValue = null;
    let planMaxUsers = selectedPlan.max_users;
    let planMaxDevices = selectedPlan.max_devices;
    let planMaxAdmins = selectedPlan.max_admins;
    let planAnalyticsLevel = selectedPlan.analytics_level;
    let planSupportLevel = selectedPlan.support_level;
    
    const [existingPlan] = await connection.execute(
      'SELECT id, price_monthly, price_yearly, max_users, max_devices, max_admins, analytics_level, support_level FROM subscription_plans WHERE name = ?',
      [selectedPlan.name]
    );
    
    if (existingPlan.length > 0) {
      planIdValue = existingPlan[0].id;
      planMaxUsers = existingPlan[0].max_users !== null ? existingPlan[0].max_users : planMaxUsers;
      planMaxDevices = existingPlan[0].max_devices !== null ? existingPlan[0].max_devices : planMaxDevices;
      planMaxAdmins = existingPlan[0].max_admins;
      planAnalyticsLevel = existingPlan[0].analytics_level;
      planSupportLevel = existingPlan[0].support_level;
    } else {
      const [newPlan] = await connection.execute(
        `INSERT INTO subscription_plans (
          name, display_name, description, price_monthly, price_yearly,
          max_users, max_devices, max_admins, analytics_level, dashboard_level,
          api_access, custom_reports, custom_branding, support_level,
          live_view_enabled, live_view_duration, export_data, webhooks,
          is_active, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          selectedPlan.name, 
          selectedPlan.display_name, 
          selectedPlan.description,
          selectedPlan.price_monthly, 
          selectedPlan.price_yearly,
          selectedPlan.max_users || 200, 
          selectedPlan.max_devices || 1, 
          selectedPlan.max_admins || 1,
          selectedPlan.analytics_level, 
          'basic', 
          1, 
          0, 
          0, 
          selectedPlan.support_level,
          1, 
          60, 
          0, 
          1, 
          1, 
          0
        ]
      );
      planIdValue = newPlan.insertId;
    }
    
    let endDateClause;
    if (planId === 'free_trial') {
      endDateClause = 'DATE_ADD(NOW(), INTERVAL 30 DAY)';
    } else if (billingCycle === 'monthly') {
      endDateClause = 'DATE_ADD(NOW(), INTERVAL 1 MONTH)';
    } else {
      endDateClause = 'DATE_ADD(NOW(), INTERVAL 1 YEAR)';
    }
    
    const [subscriptionResult] = await connection.execute(
      `INSERT INTO subscriptions (
        organization_id, plan_id, billing_cycle, status, amount_paid,
        currency, start_date, end_date, trial_ends_at, auto_renew,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'trial', 0, 'USD', NOW(), ${endDateClause}, ${planId === 'free_trial' ? 'DATE_ADD(NOW(), INTERVAL 30 DAY)' : 'NULL'}, 1, NOW(), NOW())`,
      [organizationId, planIdValue, billingCycle]
    );
    
    const subscriptionId = subscriptionResult.insertId;
    
    await connection.execute(
      `UPDATE organizations SET 
        subscription_status = 'trial', 
        subscription_started_at = NOW(),
        subscription_expires_at = ${endDateClause}
       WHERE id = ?`,
      [organizationId]
    );
    
    let adminRoleId = null;
    const [existingRole] = await connection.execute(
      'SELECT id FROM admin_roles WHERE name = ?',
      ['super_admin']
    );
    
    if (existingRole.length > 0) {
      adminRoleId = existingRole[0].id;
    } else {
      const [newRole] = await connection.execute(
        `INSERT INTO admin_roles (name, description, permissions, role_level, created_at, updated_at) 
         VALUES ('super_admin', 'Super Administrator', '{"*":true}', 1, NOW(), NOW())`,
        []
      );
      adminRoleId = newRole.insertId;
    }
    
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const [adminResult] = await connection.execute(
      `INSERT INTO admins (
        organization_id, role_id, subscription_id, first_name, last_name, 
        username, email, password_hash, profile, gender, google_id, auth_provider,
        verification_code, code_expiry_time, is_verified, 
        is_primary, is_active, is_public, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google', ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 1, ?, 1, 0, NOW(), NOW())`,
      [
        organizationId,
        adminRoleId,
        subscriptionId,
        firstName,
        lastName,
        username,
        email,
        '',
        profileValue,
        gender || null,
        googleId,
        verificationCode,
        1,
      ]
    );
    
    const adminId = adminResult.insertId;
    
    await connection.execute(
      `INSERT INTO activity_logs (
        organization_id, admin_id, action, entity_type, entity_id,
        new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, 'google_signup', 'admin', ?, ?, ?, ?, NOW())`,
      [
        organizationId, 
        adminId, 
        adminId, 
        JSON.stringify({ 
          org_name: orgName, 
          type: orgType, 
          plan: planId,
          auth_provider: 'google',
          logo: logoFilename,
          profile: profileValue
        }),
        req.ip || null, 
        req.headers['user-agent'] || null
      ]
    );
    
    await connection.commit();
    
    const jwtToken = jwt.sign(
      { 
        adminId, 
        organizationId, 
        email,
        role: 'admin',
        subscriptionId,
        plan: planId,
        roleId: adminRoleId,
        authProvider: 'google'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    let profileUrl = profileValue;
    if (profileValue && !profileValue.startsWith('http://') && !profileValue.startsWith('https://') && !profileValue.includes('/')) {
      profileUrl = `/uploads/profiles/${profileValue}`;
    }
    
    const logoUrl = `/uploads/logos/${logoFilename}`;
    
    res.json({
      success: true,
      message: 'Account created successfully with Google!',
      data: {
        token: jwtToken,
        admin: {
          id: adminId,
          firstName,
          lastName,
          email,
          username,
          profile: profileUrl,
          gender: gender || null,
          organizationId,
          organizationName: orgName,
          organizationType: orgType,
          isVerified: true,
          plan: planId,
          planName: selectedPlan.display_name,
          subscriptionId,
          subscriptionStatus: 'trial',
          authProvider: 'google',
          maxUsers: planMaxUsers,
          maxDevices: planMaxDevices,
          maxAdmins: planMaxAdmins,
          analyticsLevel: planAnalyticsLevel,
          supportLevel: planSupportLevel
        }
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Google Signup] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Google signup failed: ' + error.message 
    });
  } finally {
    connection.release();
  }
};

export const verifyGoogleUser = async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ success: false, error: 'Google token required' });
  }
  
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    
    res.json({
      success: true,
      data: {
        email: payload.email,
        given_name: payload.given_name,
        family_name: payload.family_name,
        picture: payload.picture,
        email_verified: payload.email_verified
      }
    });
  } catch (error) {
    console.error('[Google Verify] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Google verification failed: ' + error.message 
    });
  }
};

// Google Auth
export const googleAuth = async (req, res) => {
  const { token } = req.body;
  
  console.log('[Google Auth] Received request');
  
  if (!token) {
    return res.status(400).json({ success: false, error: 'Google token required' });
  }
  
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    console.log('[Google Auth] Token verified for:', payload.email);
    
    const { 
      email, 
      given_name, 
      family_name, 
      picture,
      sub: googleId,
    } = payload;
    
    const [admins] = await pool.execute(
      `SELECT a.*, o.org_name, o.type as org_type, o.subscription_status as plan,
              o.logo as organization_logo,
              s.plan_id, s.status as subscription_status, s.end_date as subscription_end_date
       FROM admins a 
       LEFT JOIN organizations o ON a.organization_id = o.id
       LEFT JOIN subscriptions s ON a.subscription_id = s.id
       WHERE a.email = ?`,
      [email]
    );
    
    if (admins.length === 0) {
      console.log('[Google Auth] User not found:', email);
      return res.status(404).json({ 
        success: false, 
        error: 'No account found with this email. Please sign up first.',
        email: email,
        name: `${given_name || ''} ${family_name || ''}`.trim(),
        picture: picture,
        requiresRegistration: true
      });
    }
    
    const admin = admins[0];
    
    // CRITICAL: Check if user has Google auth enabled
    const authProvider = admin.auth_provider || 'email';
    
    if (authProvider !== 'google' && authProvider !== 'both') {
      console.log('[Google Auth] Google login not enabled for user:', email, 'Auth provider:', authProvider);
      return res.status(403).json({ 
        success: false, 
        error: 'Google login is not enabled for this account. Please login with email/password, then enable Google authentication in settings.',
        code: 'GOOGLE_NOT_ENABLED'
      });
    }
    
    // Update Google ID if not already set
    if (!admin.google_id && googleId) {
      await pool.execute(
        'UPDATE admins SET google_id = ?, auth_provider = ?, google_connected_at = NOW(), updated_at = NOW() WHERE id = ?',
        [googleId, authProvider === 'both' ? 'both' : 'google', admin.id]
      );
    }
    
    if (admin.is_verified === 0) {
      await pool.execute(
        'UPDATE admins SET is_verified = 1, updated_at = NOW() WHERE id = ?',
        [admin.id]
      );
    }
    
    await pool.execute(
      'UPDATE admins SET last_login = NOW(), updated_at = NOW() WHERE id = ?',
      [admin.id]
    );
    
    const jwtToken = jwt.sign(
      {
        adminId: admin.id,
        organizationId: admin.organization_id,
        subscriptionId: admin.subscription_id,
        email: admin.email,
        role: 'admin',
        authProvider: admin.auth_provider
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token: jwtToken,
        admin: {
          id: admin.id,
          firstName: admin.first_name,
          lastName: admin.last_name,
          email: admin.email,
          username: admin.username,
          profile: admin.profile,
          gender: admin.gender,
          organizationId: admin.organization_id,
          organizationName: admin.org_name,
          organizationType: admin.org_type,
          organizationLogo: admin.organization_logo,
          isVerified: admin.is_verified === 1,
          plan: admin.plan || 'free_trial',
          subscriptionId: admin.subscription_id,
          subscriptionStatus: admin.subscription_status,
          subscriptionEndDate: admin.subscription_end_date,
          authProvider: admin.auth_provider || 'email'
        }
      }
    });
    
  } catch (error) {
    console.error('[Google Auth] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Google authentication failed: ' + error.message 
    });
  }
};




// For Account Setting Page
// Connect Google account to existing user (from Settings page)
export const googleConnect = async (req, res) => {
  const { token } = req.body;
  const adminId = req.adminId;
  
  console.log('[Google Connect] Request for admin:', adminId);
  
  if (!token) {
    return res.status(400).json({ success: false, error: 'Google token required' });
  }
  
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { email, sub: googleId } = payload;
    
    // Verify the email matches the logged-in admin
    const [admins] = await pool.execute(
      'SELECT id, email, auth_provider FROM admins WHERE id = ?',
      [adminId]
    );
    
    if (admins.length === 0) {
      return res.status(404).json({ success: false, error: 'Admin not found' });
    }
    
    const admin = admins[0];
    
    if (admin.email !== email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Google account email does not match your account email' 
      });
    }
    
    // Check if Google ID is already linked to another account
    const [existingGoogle] = await pool.execute(
      'SELECT id FROM admins WHERE google_id = ? AND id != ?',
      [googleId, adminId]
    );
    
    if (existingGoogle.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'This Google account is already linked to another user' 
      });
    }
    
    // Update auth_provider to 'both'
    const newAuthProvider = admin.auth_provider === 'google' ? 'google' : 'both';
    
    await pool.execute(
      `UPDATE admins SET 
        google_id = ?, 
        auth_provider = ?,
        google_connected_at = NOW(),
        updated_at = NOW() 
       WHERE id = ?`,
      [googleId, newAuthProvider, adminId]
    );
    
    console.log('[Google Connect] Successfully connected Google account for admin:', adminId);
    
    // Return updated admin info
    const [updatedAdmin] = await pool.execute(
      `SELECT a.*, o.org_name, o.type as org_type 
       FROM admins a 
       LEFT JOIN organizations o ON a.organization_id = o.id
       WHERE a.id = ?`,
      [adminId]
    );
    
    res.json({
      success: true,
      message: 'Google account connected successfully',
      data: {
        admin: {
          id: updatedAdmin[0].id,
          firstName: updatedAdmin[0].first_name,
          lastName: updatedAdmin[0].last_name,
          email: updatedAdmin[0].email,
          username: updatedAdmin[0].username,
          profile: updatedAdmin[0].profile,
          organizationId: updatedAdmin[0].organization_id,
          organizationName: updatedAdmin[0].org_name,
          organizationType: updatedAdmin[0].org_type,
          isVerified: updatedAdmin[0].is_verified === 1,
          authProvider: updatedAdmin[0].auth_provider || 'email'
        }
      }
    });
    
  } catch (error) {
    console.error('[Google Connect] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to connect Google account: ' + error.message 
    });
  }
};

// Disconnect Google account
export const googleDisconnect = async (req, res) => {
  const adminId = req.adminId;
  
  console.log('[Google Disconnect] Request for admin:', adminId);
  
  try {
    const [admins] = await pool.execute(
      'SELECT id, auth_provider FROM admins WHERE id = ?',
      [adminId]
    );
    
    if (admins.length === 0) {
      return res.status(404).json({ success: false, error: 'Admin not found' });
    }
    
    const admin = admins[0];
    
    // If user only had Google auth, they must set a password first
    if (admin.auth_provider === 'google') {
      // Check if they have a password set
      const [passwordCheck] = await pool.execute(
        'SELECT password_hash FROM admins WHERE id = ? AND password_hash IS NOT NULL AND password_hash != ""',
        [adminId]
      );
      
      if (passwordCheck.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'You must set a password before disconnecting Google. Please use "Forgot Password" to set a password first.',
          requiresPasswordSetup: true
        });
      }
    }
    
    // Update auth_provider to 'email'
    const newAuthProvider = admin.auth_provider === 'both' ? 'email' : 'email';
    
    await pool.execute(
      `UPDATE admins SET 
        google_id = NULL, 
        auth_provider = ?,
        google_connected_at = NULL,
        updated_at = NOW() 
       WHERE id = ?`,
      [newAuthProvider, adminId]
    );
    
    console.log('[Google Disconnect] Successfully disconnected Google account for admin:', adminId);
    
    res.json({
      success: true,
      message: 'Google account disconnected successfully'
    });
    
  } catch (error) {
    console.error('[Google Disconnect] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to disconnect Google account: ' + error.message 
    });
  }
};


// Get Google connection status
export const getGoogleStatus = async (req, res) => {
  const adminId = req.adminId;
  
  try {
    const [admins] = await pool.execute(
      'SELECT google_id, auth_provider, google_connected_at FROM admins WHERE id = ?',
      [adminId]
    );
    
    if (admins.length === 0) {
      return res.status(404).json({ success: false, error: 'Admin not found' });
    }
    
    const admin = admins[0];
    
    res.json({
      success: true,
      data: {
        connected: !!(admin.google_id),
        authProvider: admin.auth_provider || 'email',
        connectedAt: admin.google_connected_at
      }
    });
    
  } catch (error) {
    console.error('[Google Status] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to get Google status' });
  }
};