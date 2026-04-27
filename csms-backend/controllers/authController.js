// csms-backend/controllers/authController.js - Full VERSION

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

// Full: Helper function to format dates for MySQL - use UTC
const formatDate = (date) => {
  // Use UTC to avoid timezone issues
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// Register new admin with full subscription support
export const register = async (req, res) => {
  const { 
    firstName, lastName, email, username, password,
    gender, roleId, profileImage,
    orgName, orgType, orgAddress, orgEmail, orgPhone, orgLogo,
    province, district, apiSlug,
    planId, billingCycle, planDetails
  } = req.body;

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Validate required fields
    if (!firstName && !lastName || !email || !username || !password) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: At least a name, email, username, and password.' 
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

    // Calculate dates using MySQL functions for consistency
    const now = new Date();
    
    // Create organization - let MySQL handle timestamps
    // const apiPageValue = apiSlug ? `/api/live/${apiSlug}` : `/api/live/${orgName.toLowerCase().replace(/\s+/g, '-')}`;
    // const apiPageValue = apiSlug ? `http://localhost:8080/live/${apiSlug}` : `http://localhost:8080/live/${orgName.toLowerCase().replace(/\s+/g, '-')}`;
    // const apiPageValue = apiSlug ? `https://csm.cwanda.site/live/${apiSlug}` : `https://csm.cwanda.site/live/${orgName.toLowerCase().replace(/\s+/g, '-')}`;
    const apiPageValue = apiSlug ? `/${apiSlug}` : `/${orgName.toLowerCase().replace(/\s+/g, '-')}`;
    
    const [orgResult] = await connection.execute(
      `INSERT INTO organizations (
        org_name, logo, province, district, address, type, 
        contact_email, contact_phone, api_page, subscription_status, 
        trial_ends_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'trial', DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW())`,
      [
        orgName, 
        orgLogo || 'logo_default.png', 
        province || null, 
        district || null, 
        orgAddress || null, 
        orgType, 
        orgEmail || null, 
        orgPhone || null, 
        apiPageValue
      ]
    );
    
    const organizationId = orgResult.insertId;
    console.log('Organization created with ID:', organizationId);

    // Define default plans (same as before)
    const defaultPlans = {
      free_trial: {
        name: 'free',
        display_name: 'Free Trial',
        description: '30-day free trial with basic features',
        price_monthly: 0,
        price_yearly: 0,
        max_users: 50,
        max_devices: 2,
        max_admins: 1,
        analytics_level: 'basic',
        dashboard_level: 'basic',
        api_access: 0,
        custom_reports: 0,
        custom_branding: 0,
        support_level: 'email',
        live_view_enabled: 1,
        live_view_duration: 60,
        export_data: 0,
        webhooks: 0,
        sort_order: 0
      },
      basic: {
        name: 'basic',
        display_name: 'Basic Plan',
        description: 'For small businesses and schools',
        price_monthly: 19.00,
        price_yearly: 190.00,
        max_users: 200,
        max_devices: 5,
        max_admins: 2,
        analytics_level: 'basic',
        dashboard_level: 'basic',
        api_access: 0,
        custom_reports: 0,
        custom_branding: 0,
        support_level: 'email',
        live_view_enabled: 1,
        live_view_duration: 120,
        export_data: 1,
        webhooks: 0,
        sort_order: 1
      },
      professional: {
        name: 'professional',
        display_name: 'Professional Plan',
        description: 'For growing organizations',
        price_monthly: 49.00,
        price_yearly: 490.00,
        max_users: null,
        max_devices: 20,
        max_admins: 5,
        analytics_level: 'advanced',
        dashboard_level: 'advanced',
        api_access: 1,
        custom_reports: 1,
        custom_branding: 0,
        support_level: 'priority',
        live_view_enabled: 1,
        live_view_duration: 240,
        export_data: 1,
        webhooks: 1,
        sort_order: 2
      },
      enterprise: {
        name: 'enterprise',
        display_name: 'Enterprise Plan',
        description: 'For large organizations',
        price_monthly: 199.00,
        price_yearly: 1990.00,
        max_users: null,
        max_devices: null,
        max_admins: 20,
        analytics_level: 'premium',
        dashboard_level: 'premium',
        api_access: 1,
        custom_reports: 1,
        custom_branding: 1,
        support_level: '24/7',
        live_view_enabled: 1,
        live_view_duration: 480,
        export_data: 1,
        webhooks: 1,
        sort_order: 3
      }
    };
    
    // Determine which plan to use
    let selectedPlan = defaultPlans[planId] || defaultPlans.free_trial;
    
    // Override with planDetails if provided
    if (planDetails && planId !== 'free_trial') {
      selectedPlan = {
        ...selectedPlan,
        name: planId,
        display_name: planDetails.displayName || planId,
        description: planDetails.desc || selectedPlan.description,
        price_monthly: planDetails.priceMonthly || selectedPlan.price_monthly,
        price_yearly: planDetails.priceYearly || selectedPlan.price_yearly,
        max_users: planDetails.maxUsers !== undefined ? planDetails.maxUsers : selectedPlan.max_users,
        max_devices: planDetails.maxDevices !== undefined ? planDetails.maxDevices : selectedPlan.max_devices,
        max_admins: planDetails.maxAdmins || selectedPlan.max_admins,
        analytics_level: planDetails.analyticsLevel || selectedPlan.analytics_level,
        api_access: planDetails.apiAccess ? 1 : 0,
        custom_reports: planDetails.customReports ? 1 : 0,
        custom_branding: planDetails.customBranding ? 1 : 0,
        support_level: planDetails.supportLevel || selectedPlan.support_level,
        live_view_enabled: planDetails.liveViewEnabled ? 1 : 0,
        live_view_duration: planDetails.liveViewDuration || selectedPlan.live_view_duration,
        export_data: planDetails.exportData ? 1 : 0,
        webhooks: planDetails.webhooks ? 1 : 0
      };
    }
    
    // Get or create subscription plan
    let planIdValue = null;
    let planPrice = 0;
    let planMaxUsers = null;
    let planMaxDevices = null;
    let planMaxAdmins = 1;
    let planAnalyticsLevel = 'basic';
    let planSupportLevel = 'email';
    
    // Check if plan exists in database
    const [existingPlan] = await connection.execute(
      'SELECT id, price_monthly, price_yearly, max_users, max_devices, max_admins, analytics_level, support_level FROM subscription_plans WHERE name = ?',
      [selectedPlan.name]
    );
    
    if (existingPlan.length > 0) {
      planIdValue = existingPlan[0].id;
      planPrice = billingCycle === 'monthly' ? existingPlan[0].price_monthly : existingPlan[0].price_yearly;
      planMaxUsers = existingPlan[0].max_users;
      planMaxDevices = existingPlan[0].max_devices;
      planMaxAdmins = existingPlan[0].max_admins;
      planAnalyticsLevel = existingPlan[0].analytics_level;
      planSupportLevel = existingPlan[0].support_level;
    } else {
      // Insert new plan
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
          selectedPlan.max_users,
          selectedPlan.max_devices,
          selectedPlan.max_admins,
          selectedPlan.analytics_level,
          selectedPlan.dashboard_level,
          selectedPlan.api_access,
          selectedPlan.custom_reports,
          selectedPlan.custom_branding,
          selectedPlan.support_level,
          selectedPlan.live_view_enabled,
          selectedPlan.live_view_duration,
          selectedPlan.export_data,
          selectedPlan.webhooks,
          1,
          selectedPlan.sort_order
        ]
      );
      planIdValue = newPlan.insertId;
      planPrice = billingCycle === 'monthly' ? selectedPlan.price_monthly : selectedPlan.price_yearly;
      planMaxUsers = selectedPlan.max_users;
      planMaxDevices = selectedPlan.max_devices;
      planMaxAdmins = selectedPlan.max_admins;
      planAnalyticsLevel = selectedPlan.analytics_level;
      planSupportLevel = selectedPlan.support_level;
    }
    
    console.log('Plan selected:', { planId: planIdValue, price: planPrice });
    
    // Create subscription - let MySQL handle dates
    let subscriptionStatus = 'trial';
    let endDateClause = '';
    
    if (planId === 'free_trial') {
      endDateClause = 'DATE_ADD(NOW(), INTERVAL 30 DAY)';
      subscriptionStatus = 'trial';
    } else {
      if (billingCycle === 'monthly') {
        endDateClause = 'DATE_ADD(NOW(), INTERVAL 1 MONTH)';
      } else {
        endDateClause = 'DATE_ADD(NOW(), INTERVAL 1 YEAR)';
      }
      subscriptionStatus = 'active';
    }
    
    const [subscriptionResult] = await connection.execute(
      `INSERT INTO subscriptions (
        organization_id, plan_id, billing_cycle, status, amount_paid,
        currency, start_date, end_date, trial_ends_at, auto_renew,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ${endDateClause}, ?, ?, NOW(), NOW())`,
      [
        organizationId, 
        planIdValue, 
        billingCycle || 'monthly', 
        subscriptionStatus,
        planPrice, 
        'USD',
        planId === 'free_trial' ? 'DATE_ADD(NOW(), INTERVAL 30 DAY)' : null,
        1
      ]
    );
    
    const subscriptionId = subscriptionResult.insertId;
    console.log('Subscription created with ID:', subscriptionId);
    
    // Update organization with subscription info
    await connection.execute(
      `UPDATE organizations SET 
        subscription_status = ?, 
        subscription_started_at = NOW(),
        subscription_expires_at = ${endDateClause},
        updated_at = NOW()
       WHERE id = ?`,
      [subscriptionStatus, organizationId]
    );
    
    // Get or create admin roles
    let adminRoleId = null;
    
    let roleName = 'basic_admin';
    if (planId === 'free_trial') roleName = 'free_admin';
    if (planId === 'basic') roleName = 'basic_admin';
    if (planId === 'professional') roleName = 'pro_admin';
    if (planId === 'enterprise') roleName = 'enterprise_admin';
    
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
        analytics: planAnalyticsLevel !== 'none',
        reports: planMaxAdmins > 1,
        api_access: selectedPlan.api_access === 1
      };
      
      const [newRole] = await connection.execute(
        `INSERT INTO admin_roles (name, description, permissions, plan_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [roleName, `${roleName.replace('_', ' ')} with appropriate permissions`, JSON.stringify(permissions), planIdValue]
      );
      adminRoleId = newRole.insertId;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate verification code
    const verificationCode = generateOTP();
    
    // Create admin user - let MySQL handle code_expiry_time with DATE_ADD
const [adminResult] = await connection.execute(
  `INSERT INTO admins (
    organization_id, role_id, subscription_id, first_name, last_name, 
    username, email, password_hash, profile, gender,
    verification_code, code_expiry_time, is_verified, 
    is_primary, is_active, is_public, bio, location, website, twitter, facebook, instagram, linkedin,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?, ?, ?, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW())`,
  [
    organizationId, 
    adminRoleId, 
    subscriptionId,
    firstName, 
    lastName, 
    username, 
    email, 
    hashedPassword,
    profileImage || 'admin_default.jpg',
    gender,
    verificationCode, 
    0,
    1,
    1
  ]
);
    
    const adminId = adminResult.insertId;
    console.log('Admin created with ID:', adminId);
    console.log(`Verification code for ${email}: ${verificationCode}`);
    console.log(`Code expires in 10 minutes from now`);
    
    // Create activity log
    await connection.execute(
      `INSERT INTO activity_logs (
        organization_id, admin_id, action, entity_type, entity_id,
        new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        organizationId, 
        adminId, 
        'organization_created', 
        'organization',
        organizationId, 
        JSON.stringify({ 
          org_name: orgName, 
          type: orgType, 
          plan: planId,
          billing_cycle: billingCycle,
          subscription_id: subscriptionId
        }),
        req.ip || null, 
        req.headers['user-agent'] || null
      ]
    );
    
    await connection.commit();
    
    // Send verification email
    try {
      await emailService.sendVerificationCode(email, firstName, verificationCode);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
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
          profile: profileImage || 'admin_default.jpg',
          gender: gender || null,
          organizationId,
          organizationName: orgName,
          organizationType: orgType,
          isVerified: false,
          plan: planId,
          planName: selectedPlan.display_name,
          subscriptionId,
          subscriptionStatus,
          trialEndsAt: subInfo[0]?.end_date,
          subscriptionEndsAt: subInfo[0]?.end_date,
          maxUsers: planMaxUsers,
          maxDevices: planMaxDevices,
          maxAdmins: planMaxAdmins,
          analyticsLevel: planAnalyticsLevel,
          supportLevel: planSupportLevel,
          role: roleName,
          roleId: adminRoleId
        }
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Register error:', error);
    
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










// Full: Verify email with OTP
export const verifyEmail = async (req, res) => {
  const { code, email } = req.body;
  
  if (!code || !email) {
    return res.status(400).json({ success: false, error: 'Code and email are required' });
  }
  
  try {
    // Get the admin
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
    
    // Debug logging
    console.log('Verification attempt:', {
      email,
      providedCode: code,
      storedCode: admin.verification_code,
      codeMatch: admin.verification_code === code,
      expiryTime: admin.code_expiry_time,
      currentServerTime: new Date().toISOString(),
      isExpired: new Date(admin.code_expiry_time) < new Date()
    });
    
    if (admin.is_verified === 1) {
      return res.status(400).json({ success: false, error: 'Email already verified' });
    }
    
    // Check if code matches (trim and compare as strings)
    if (String(admin.verification_code).trim() !== String(code).trim()) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }
    
    // Check if code is expired using MySQL's NOW() to avoid timezone issues
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
    
    console.log(`Email verified successfully for: ${email}`);
    
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
};







// Full: Resend verification code
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
    
    // Update with new code and expiry - use MySQL DATE_ADD
    await pool.execute(
      `UPDATE admins 
       SET verification_code = ?, code_expiry_time = DATE_ADD(NOW(), INTERVAL 10 MINUTE), updated_at = NOW()
       WHERE id = ?`,
      [newCode, admin.id]
    );
    
    console.log(`New verification code for ${email}: ${newCode}`);
    console.log(`Code expires in 10 minutes from now`);
    
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

      // Lock after 5 failed attempts (15 minutes)
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
  
  try {
    const [admins] = await pool.execute(
      'SELECT id, first_name, email FROM admins WHERE email = ?',
      [email]
    );
    
    if (admins.length === 0) {
      return res.json({ success: true, message: 'If email exists, reset link will be sent' });
    }
    
    const admin = admins[0];
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const formattedResetExpires = formatDate(resetExpires);
    
    // Store reset token in database
    await pool.execute(
      `INSERT INTO password_reset_tokens (admin_user_id, token, expires_at, created_at) 
       VALUES (?, ?, ?, NOW())`,
      [admin.id, resetToken, formattedResetExpires]
    );
    
    // Create reset link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    // Send email
    try {
      await emailService.sendPasswordResetLink(email, admin.first_name, resetLink);
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
    }
    
    res.json({ success: true, message: 'Password reset link sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Failed to send reset link' });
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  
  try {
    // Find valid token
    const [tokens] = await pool.execute(
      `SELECT * FROM password_reset_tokens 
       WHERE token = ? AND used = 0 AND expires_at > NOW()`,
      [token]
    );
    
    if (tokens.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }
    
    const resetToken = tokens[0];
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update admin password
    await pool.execute(
      'UPDATE admins SET password_hash = ?, last_password_change = NOW() WHERE id = ?',
      [hashedPassword, resetToken.admin_user_id]
    );
    
    // Mark token as used
    await pool.execute(
      'UPDATE password_reset_tokens SET used = 1 WHERE id = ?',
      [resetToken.id]
    );
    
    // Get admin email for confirmation
    const [admins] = await pool.execute(
      'SELECT first_name, email FROM admins WHERE id = ?',
      [resetToken.admin_user_id]
    );
    
    if (admins.length > 0) {
      try {
        await emailService.sendPasswordChangeConfirmation(admins[0].email, admins[0].first_name);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
    }
    
    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
};

// Get profile
// Get profile - Include new social fields
export const getProfile = async (req, res) => {
  try {
    const [admins] = await pool.execute(
      `SELECT a.*, o.org_name, o.type as org_type, o.subscription_status as plan,
              s.plan_id, s.status as subscription_status, s.end_date as subscription_end_date,
              sp.display_name as plan_name, sp.max_users, sp.max_devices, sp.max_admins
       FROM admins a 
       LEFT JOIN organizations o ON a.organization_id = o.id
       LEFT JOIN subscriptions s ON a.subscription_id = s.id
       LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE a.id = ?`,
      [req.adminId]
    );
    
    if (admins.length === 0) {
      return res.status(404).json({ success: false, error: 'Admin not found' });
    }
    
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
          isVerified: admin.is_verified === 1,
          plan: admin.plan || 'free_trial',
          planName: admin.plan_name,
          subscriptionId: admin.subscription_id,
          subscriptionStatus: admin.subscription_status,
          subscriptionEndDate: admin.subscription_end_date,
          maxUsers: admin.max_users,
          maxDevices: admin.max_devices,
          maxAdmins: admin.max_admins,
          // New social fields
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
// Update profile - Add support for social fields (FIXED - removed activity log or fixed admin_id)
export const updateProfile = async (req, res) => {
  const { 
    firstName, lastName, username, profile, gender, 
    bio, location, website, twitter, facebook, instagram, linkedin, isPublic 
  } = req.body;
  
  try {
    // Build dynamic update query
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
    
    // Only add activity log if adminId exists and organizationId exists
    if (req.adminId && req.organizationId) {
      try {
        await pool.execute(
          `INSERT INTO activity_logs (organization_id, admin_id, action, entity_type, entity_id, new_values, created_at) 
           VALUES (?, ?, 'profile_update', 'admin', ?, ?, NOW())`,
          [req.organizationId, req.adminId, req.adminId, JSON.stringify(req.body)]
        );
      } catch (logError) {
        // Just log the error but don't fail the profile update
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








// Google Authentication - FIXED: Only creates account if user doesn't exist
export const googleAuth = async (req, res) => {
  const { token } = req.body;
  
  console.log('[Google Auth] Received request');
  
  if (!token) {
    return res.status(400).json({ success: false, error: 'Google token required' });
  }
  
  try {
    // Verify the Google token
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
    
    // Check if admin exists with this email
    const [admins] = await pool.execute(
      `SELECT a.*, o.org_name, o.type as org_type, o.subscription_status as plan,
              s.plan_id, s.status as subscription_status, s.end_date as subscription_end_date
       FROM admins a 
       LEFT JOIN organizations o ON a.organization_id = o.id
       LEFT JOIN subscriptions s ON a.subscription_id = s.id
       WHERE a.email = ?`,
      [email]
    );
    
    let admin;
    let isNewUser = false;
    
    if (admins.length === 0) {
      // ONLY CREATE NEW ACCOUNT IF USER DOESN'T EXIST
      console.log('[Google Auth] Creating NEW user for:', email);
      isNewUser = true;
      
      // Generate a unique username from email
      const baseUsername = email.split('@')[0];
      let username = baseUsername;
      let counter = 1;
      
      let [existing] = await pool.execute('SELECT id FROM admins WHERE username = ?', [username]);
      while (existing.length > 0) {
        username = `${baseUsername}${counter}`;
        [existing] = await pool.execute('SELECT id FROM admins WHERE username = ?', [username]);
        counter++;
      }
      
      // Create organization
      const [orgResult] = await pool.execute(
        `INSERT INTO organizations (
          org_name, type, subscription_status, trial_ends_at, created_at, updated_at
        ) VALUES (?, 'school', 'trial', DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW())`,
        [`${given_name || email.split('@')[0]}'s Organization`]
      );
      
      const organizationId = orgResult.insertId;
      
      // Get free trial plan
      const [plan] = await pool.execute(
        'SELECT id FROM subscription_plans WHERE name = "free_trial" OR price_monthly = 0 LIMIT 1'
      );
      const planId = plan.length > 0 ? plan[0].id : null;
      
      // Create subscription
      let subscriptionId = null;
      if (planId) {
        const [subResult] = await pool.execute(
          `INSERT INTO subscriptions (
            organization_id, plan_id, billing_cycle, status, amount_paid,
            currency, start_date, end_date, auto_renew, created_at, updated_at
          ) VALUES (?, ?, 'monthly', 'trial', 0, 'USD', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 0, NOW(), NOW())`,
          [organizationId, planId]
        );
        subscriptionId = subResult.insertId;
      }
      
      // Get or create default admin role
      let [role] = await pool.execute(
        'SELECT id FROM admin_roles WHERE name = "basic_admin" LIMIT 1'
      );
      
      let roleId;
      if (role.length > 0) {
        roleId = role[0].id;
      } else {
        const [newRole] = await pool.execute(
          `INSERT INTO admin_roles (name, description, permissions, created_at, updated_at) 
           VALUES ('basic_admin', 'Basic admin with standard permissions', '{"dashboard":true,"users":true,"devices":true}', NOW(), NOW())`,
          []
        );
        roleId = newRole.insertId;
      }
      
      // Create admin with Google data (no password needed)
      const [adminResult] = await pool.execute(
        `INSERT INTO admins (
          organization_id, role_id, subscription_id, first_name, last_name, 
          username, email, profile, gender, auth_provider, google_id,
          is_verified, is_primary, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'google', ?, 1, 1, 1, NOW(), NOW())`,
        [
          organizationId, roleId, subscriptionId,
          given_name || '', family_name || '',
          username, email, picture || 'admin_default.jpg',
          'other', googleId
        ]
      );
      
      const adminId = adminResult.insertId;
      
      // Fetch created admin
      const [newAdmin] = await pool.execute(
        `SELECT a.*, o.org_name, o.type as org_type, o.subscription_status as plan,
                s.plan_id, s.status as subscription_status, s.end_date as subscription_end_date
         FROM admins a 
         LEFT JOIN organizations o ON a.organization_id = o.id
         LEFT JOIN subscriptions s ON a.subscription_id = s.id
         WHERE a.id = ?`,
        [adminId]
      );
      
      admin = newAdmin[0];
    } else {
      // EXISTING USER - Just log them in, DON'T create new account
      console.log('[Google Auth] Existing user found for:', email);
      admin = admins[0];
      
      // If user exists but doesn't have google_id, link it
      if (!admin.google_id && googleId) {
        await pool.execute(
          'UPDATE admins SET google_id = ?, auth_provider = "google", updated_at = NOW() WHERE id = ?',
          [googleId, admin.id]
        );
      }
      
      // Ensure email is verified
      if (admin.is_verified === 0) {
        await pool.execute(
          'UPDATE admins SET is_verified = 1, updated_at = NOW() WHERE id = ?',
          [admin.id]
        );
        admin.is_verified = 1;
      }
    }
    
    // Update last login
    await pool.execute(
      'UPDATE admins SET last_login = NOW(), updated_at = NOW() WHERE id = ?',
      [admin.id]
    );
    
    // Generate JWT
    const jwtToken = jwt.sign(
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
    await pool.execute(
      `INSERT INTO admin_sessions 
       (admin_id, session_token, ip_address, user_agent, expires_at, login_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [admin.id, jwtToken, req.ip || null, req.headers['user-agent'] || null, expiresAt]
    );
    
    console.log('[Google Auth] Success for:', email, isNewUser ? '(NEW USER)' : '(EXISTING USER)');
    
    // For existing users, we need to check if they have completed organization setup
    const hasCompletedOrg = admin.org_name && admin.org_name !== `${admin.first_name || admin.email.split('@')[0]}'s Organization`;
    
    res.json({
      success: true,
      message: isNewUser ? 'Account created successfully with Google' : 'Login successful',
      data: {
        token: jwtToken,
        refreshToken: jwtToken,
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
          isVerified: admin.is_verified === 1,
          plan: admin.plan || 'free_trial',
          subscriptionId: admin.subscription_id,
          subscriptionStatus: admin.subscription_status,
          subscriptionEndDate: admin.subscription_end_date,
          authProvider: 'google',
          needsOrgSetup: isNewUser || !hasCompletedOrg  // Flag for new users or users without org setup
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

// csms-backend/controllers/authController.js
// Add this function after the googleAuth function

// Complete Google signup with organization details
export const completeGoogleSignup = async (req, res) => {
  const {
    orgName, orgType, orgAddress, orgEmail, orgPhone, orgLogo,
    province, district, apiSlug,
    planId, billingCycle
  } = req.body;

  const adminId = req.adminId; // From authenticateToken middleware

  if (!adminId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Get the admin user
    const [admins] = await connection.execute(
      'SELECT id, organization_id, first_name, email FROM admins WHERE id = ?',
      [adminId]
    );

    if (admins.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Admin not found' });
    }

    const admin = admins[0];
    const existingOrgId = admin.organization_id;

    // Check if organization already has details (not the placeholder)
    const [orgs] = await connection.execute(
      'SELECT org_name, address FROM organizations WHERE id = ?',
      [existingOrgId]
    );

    if (orgs.length > 0 && orgs[0].org_name && orgs[0].org_name !== `${admin.first_name || admin.email.split('@')[0]}'s Organization`) {
      // Organization already has real data, just return success
      await connection.commit();
      return res.json({ success: true, message: 'Organization already set up' });
    }

    // Validate required fields
    if (!orgName || !orgType) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        error: 'Organization name and type are required' 
      });
    }

    // Create API slug
    const apiPageValue = apiSlug ? `/${apiSlug}` : `/${orgName.toLowerCase().replace(/\s+/g, '-')}`;

    // Update organization with real data
    await connection.execute(
      `UPDATE organizations SET 
        org_name = ?, 
        logo = ?, 
        province = ?, 
        district = ?, 
        address = ?, 
        type = ?, 
        contact_email = ?, 
        contact_phone = ?, 
        api_page = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        orgName, 
        orgLogo || 'logo_default.png', 
        province || null, 
        district || null, 
        orgAddress || null, 
        orgType, 
        orgEmail || null, 
        orgPhone || null, 
        apiPageValue,
        existingOrgId
      ]
    );

    // Update subscription plan if needed
    if (planId && planId !== 'free_trial') {
      // Get plan details
      const [plans] = await connection.execute(
        'SELECT id, price_monthly, price_yearly FROM subscription_plans WHERE name = ?',
        [planId]
      );

      if (plans.length > 0) {
        const plan = plans[0];
        const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
        
        // Update subscription
        await connection.execute(
          `UPDATE subscriptions 
           SET plan_id = ?, 
               billing_cycle = ?, 
               amount_paid = ?,
               status = 'active',
               updated_at = NOW()
           WHERE organization_id = ?`,
          [plan.id, billingCycle || 'monthly', price, existingOrgId]
        );

        // Update organization subscription status
        await connection.execute(
          `UPDATE organizations 
           SET subscription_status = 'active'
           WHERE id = ?`,
          [existingOrgId]
        );
      }
    }

    await connection.commit();

    // Get updated organization
    const [updatedOrg] = await connection.execute(
      'SELECT * FROM organizations WHERE id = ?',
      [existingOrgId]
    );

    // Get updated admin data
    const [updatedAdmin] = await connection.execute(
      `SELECT a.*, o.org_name, o.type as org_type, o.subscription_status as plan
       FROM admins a 
       LEFT JOIN organizations o ON a.organization_id = o.id
       WHERE a.id = ?`,
      [adminId]
    );

    // Generate new token with updated organization info
    const newToken = jwt.sign(
      {
        adminId: admin.id,
        organizationId: existingOrgId,
        email: admin.email,
        role: 'admin'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Organization setup completed successfully',
      data: {
        token: newToken,
        admin: {
          id: updatedAdmin[0].id,
          firstName: updatedAdmin[0].first_name,
          lastName: updatedAdmin[0].last_name,
          email: updatedAdmin[0].email,
          username: updatedAdmin[0].username,
          profile: updatedAdmin[0].profile,
          gender: updatedAdmin[0].gender,
          organizationId: updatedAdmin[0].organization_id,
          organizationName: updatedOrg[0].org_name,
          organizationType: updatedOrg[0].type,
          isVerified: updatedAdmin[0].is_verified === 1,
          plan: updatedAdmin[0].plan || 'free_trial',
          authProvider: updatedAdmin[0].auth_provider
        },
        organization: updatedOrg[0]
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Complete Google signup error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to complete signup: ' + error.message 
    });
  } finally {
    connection.release();
  }
};