// csms-backend/scripts/seedDatabase.js
// Run this once when deploying the system

import pool from '../config/database.js';
import bcrypt from 'bcrypt';

export const seedInitialData = async () => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('[SEED] Starting database seeding...');
    
    // 1. Insert currencies
    const currencies = [
      { code: 'USD', name: 'US Dollar', symbol: '$', rate_to_usd: 1.000000, is_base: 1 },
      { code: 'EUR', name: 'Euro', symbol: '€', rate_to_usd: 0.920000, is_base: 0 },
      { code: 'GBP', name: 'British Pound', symbol: '£', rate_to_usd: 0.790000, is_base: 0 },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥', rate_to_usd: 148.500000, is_base: 0 },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', rate_to_usd: 1.350000, is_base: 0 },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', rate_to_usd: 1.520000, is_base: 0 },
      { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', rate_to_usd: 0.890000, is_base: 0 },
      { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', rate_to_usd: 7.200000, is_base: 0 },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹', rate_to_usd: 83.500000, is_base: 0 },
      { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw', rate_to_usd: 1280.000000, is_base: 0 },
      { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', rate_to_usd: 128.500000, is_base: 0 },
      { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', rate_to_usd: 2550.000000, is_base: 0 },
      { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', rate_to_usd: 3800.000000, is_base: 0 },
      { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', rate_to_usd: 1480.000000, is_base: 0 },
      { code: 'ZAR', name: 'South African Rand', symbol: 'R', rate_to_usd: 18.900000, is_base: 0 }
    ];
    
    for (const currency of currencies) {
      await connection.execute(
        `INSERT INTO currencies (code, name, symbol, rate_to_usd, is_base_currency, auto_update_enabled, created_at) 
         VALUES (?, ?, ?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE 
         name = VALUES(name), symbol = VALUES(symbol), rate_to_usd = VALUES(rate_to_usd), updated_at = NOW()`,
        [currency.code, currency.name, currency.symbol, currency.rate_to_usd, currency.is_base]
      );
    }
    console.log(`[SEED] Added ${currencies.length} currencies`);
    
    // 2. Insert subscription plans
    const plans = [
      {
        name: 'free', display_name: 'Free', description: 'Basic features for small organizations',
        price_monthly: 0, price_yearly: 0, max_users: 50, max_devices: 2, max_admins: 1,
        analytics_level: 'basic', dashboard_level: 'basic', api_access: 0, api_rate_limit: 100,
        custom_reports: 0, custom_branding: 0, support_level: 'email', live_view_enabled: 0,
        live_view_duration: 30, export_data: 0, webhooks: 0, sort_order: 1
      },
      {
        name: 'basic', display_name: 'Basic', description: 'Essential features for growing organizations',
        price_monthly: 29, price_yearly: 290, max_users: 200, max_devices: 10, max_admins: 3,
        analytics_level: 'basic', dashboard_level: 'basic', api_access: 0, api_rate_limit: 200,
        custom_reports: 0, custom_branding: 0, support_level: 'email', live_view_enabled: 0,
        live_view_duration: 60, export_data: 1, webhooks: 0, sort_order: 2
      },
      {
        name: 'professional', display_name: 'Professional', description: 'Advanced features for larger organizations',
        price_monthly: 79, price_yearly: 790, max_users: 500, max_devices: 25, max_admins: 10,
        analytics_level: 'advanced', dashboard_level: 'advanced', api_access: 1, api_rate_limit: 500,
        custom_reports: 1, custom_branding: 0, support_level: 'priority', live_view_enabled: 1,
        live_view_duration: 120, export_data: 1, webhooks: 1, sort_order: 3
      },
      {
        name: 'enterprise', display_name: 'Enterprise', description: 'Full features for large organizations',
        price_monthly: 199, price_yearly: 1990, max_users: null, max_devices: null, max_admins: null,
        analytics_level: 'premium', dashboard_level: 'premium', api_access: 1, api_rate_limit: 1000,
        custom_reports: 1, custom_branding: 1, support_level: '24/7', live_view_enabled: 1,
        live_view_duration: 240, export_data: 1, webhooks: 1, sort_order: 4
      }
    ];
    
    for (const plan of plans) {
      await connection.execute(
        `INSERT INTO subscription_plans 
         (name, display_name, description, price_monthly, price_yearly, max_users, max_devices, max_admins,
          analytics_level, dashboard_level, api_access, api_rate_limit, custom_reports, custom_branding,
          support_level, live_view_enabled, live_view_duration, export_data, webhooks, is_active, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW())
         ON DUPLICATE KEY UPDATE 
         display_name = VALUES(display_name), price_monthly = VALUES(price_monthly), price_yearly = VALUES(price_yearly),
         updated_at = NOW()`,
        [plan.name, plan.display_name, plan.description, plan.price_monthly, plan.price_yearly,
         plan.max_users, plan.max_devices, plan.max_admins, plan.analytics_level, plan.dashboard_level,
         plan.api_access, plan.api_rate_limit, plan.custom_reports, plan.custom_branding, plan.support_level,
         plan.live_view_enabled, plan.live_view_duration, plan.export_data, plan.webhooks, plan.sort_order]
      );
    }
    console.log(`[SEED] Added ${plans.length} subscription plans`);
    
    // 3. Insert admin roles
    const roles = [
      { name: 'super_admin', role_level: 1, description: 'Full system access across all organizations' },
      { name: 'owner_admin', role_level: 2, description: 'Full access to their organization only' },
      { name: 'basic_admin', role_level: 3, description: 'Limited access based on permissions' }
    ];
    
    for (const role of roles) {
      const permissions = role.name === 'super_admin' ? 
        '{"all": true}' :
        (role.name === 'owner_admin' ? 
          '{"manage_organization": true, "manage_users": true, "manage_devices": true, "manage_subscription": true, "view_reports": true}' :
          '{"view_users": true, "view_attendance": true, "generate_reports": true}');
      
      await connection.execute(
        `INSERT INTO admin_roles (name, role_level, description, permissions, created_at)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE 
         role_level = VALUES(role_level), description = VALUES(description), permissions = VALUES(permissions), updated_at = NOW()`,
        [role.name, role.role_level, role.description, permissions]
      );
    }
    console.log(`[SEED] Added ${roles.length} admin roles`);
    
    // 4. Create default super admin (only if not exists)
    const [existingSuperAdmin] = await connection.execute(
      `SELECT id FROM admins WHERE username = 'superadmin'`
    );
    
    if (existingSuperAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash('SuperAdmin@2024', 10);
      
      // Get super_admin role id
      const [superRole] = await connection.execute(
        `SELECT id FROM admin_roles WHERE name = 'super_admin'`
      );
      
      if (superRole.length > 0) {
        await connection.execute(
          `INSERT INTO admins 
           (organization_id, role_id, role_level, first_name, last_name, username, email, 
            password_hash, is_verified, is_active, is_public, created_at)
           VALUES (NULL, ?, 1, 'Super', 'Admin', 'superadmin', 'admin@csms.com', 
                   ?, 1, 1, 0, NOW())`,
          [superRole[0].id, hashedPassword]
        );
        console.log(`[SEED] Created super admin account (username: superadmin, password: SuperAdmin@2024)`);
      }
    }
    
    await connection.commit();
    
    console.log('[SEED] Database seeding completed successfully!');
    return { success: true };
    
  } catch (error) {
    await connection.rollback();
    console.error('[SEED] Error:', error);
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
};

// Run seeder
if (import.meta.url === `file://${process.argv[1]}`) {
  seedInitialData().then(result => {
    if (result.success) {
      console.log('✅ Seeding completed');
      process.exit(0);
    } else {
      console.error('❌ Seeding failed:', result.error);
      process.exit(1);
    }
  });
}