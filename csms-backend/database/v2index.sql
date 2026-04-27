-- =====================================================
-- HELPER FUNCTIONS AND STORED PROCEDURES
-- =====================================================

DELIMITER //

-- Check if organization has reached user limit
CREATE PROCEDURE check_user_limit(IN p_organization_id INT)
BEGIN
    DECLARE v_max_users INT;
    DECLARE v_current_users INT;
    
    SELECT sp.max_users INTO v_max_users
    FROM organizations o
    JOIN subscriptions s ON o.id = s.organization_id
    JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE o.id = p_organization_id AND s.status = 'active';
    
    IF v_max_users IS NOT NULL THEN
        SELECT COUNT(*) INTO v_current_users
        FROM users
        WHERE organization_id = p_organization_id;
        
        IF v_current_users >= v_max_users THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User limit reached for this organization';
        END IF;
    END IF;
END//

-- Check if organization has reached device limit
CREATE PROCEDURE check_device_limit(IN p_organization_id INT)
BEGIN
    DECLARE v_max_devices INT;
    DECLARE v_current_devices INT;
    
    SELECT sp.max_devices INTO v_max_devices
    FROM organizations o
    JOIN subscriptions s ON o.id = s.organization_id
    JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE o.id = p_organization_id AND s.status = 'active';
    
    IF v_max_devices IS NOT NULL THEN
        SELECT COUNT(*) INTO v_current_devices
        FROM devices
        WHERE organization_id = p_organization_id;
        
        IF v_current_devices >= v_max_devices THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Device limit reached for this organization';
        END IF;
    END IF;
END//

-- Auto-expire subscriptions
CREATE EVENT expire_subscriptions
ON SCHEDULE EVERY 1 DAY
DO
BEGIN
    UPDATE subscriptions 
    SET status = 'expired'
    WHERE end_date < NOW() AND status = 'active';
    
    UPDATE organizations o
    JOIN subscriptions s ON o.id = s.organization_id
    SET o.subscription_status = 'inactive'
    WHERE s.status = 'expired' AND o.subscription_status = 'active';
END//

DELIMITER ;

-- =====================================================
-- INDEXES SUMMARY (Performance optimization)
-- =====================================================

-- Additional indexes for better query performance
CREATE INDEX idx_users_org_role ON users(organization_id, role);
CREATE INDEX idx_users_org_active ON users(organization_id, is_active);
CREATE INDEX idx_attendance_date_status ON attendance(timestamp, status);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, timestamp);
CREATE INDEX idx_devices_org_status ON devices(organization_id, status);
CREATE INDEX idx_subscriptions_org_status ON subscriptions(organization_id, status);
CREATE INDEX idx_invoices_org_status ON invoices(organization_id, status);
CREATE INDEX idx_activity_log_org_date ON activity_logs(organization_id, created_at);

-- Composite indexes for common queries
CREATE INDEX idx_users_search ON users(organization_id, first_name, last_name, email);
CREATE INDEX idx_attendance_search ON attendance(organization_id, user_id, timestamp);
CREATE INDEX idx_devices_search ON devices(organization_id, device_name, unique_device_id);

-- Full-text indexes for search functionality
ALTER TABLE `admins` MODIFY COLUMN `gender` ENUM('male','female','other') DEFAULT NULL;
ALTER TABLE `attendance` ADD FOREIGN KEY (`attendance_type_id`) REFERENCES `attendance_schedules`(`id`) ON DELETE SET NULL;
ALTER TABLE users ADD FULLTEXT INDEX ft_users_name_email (first_name, last_name, email);
ALTER TABLE organizations ADD FULLTEXT INDEX ft_org_name (org_name);


-- Add target columns to attendance_schedules if not exists
ALTER TABLE `attendance_schedules` 
ADD COLUMN IF NOT EXISTS `target_type` ENUM('all', 'departments', 'sections') DEFAULT 'all',
ADD COLUMN IF NOT EXISTS `target_departments` JSON NULL,
ADD COLUMN IF NOT EXISTS `target_positions` JSON NULL,
ADD COLUMN IF NOT EXISTS `target_sections` JSON NULL,
ADD COLUMN IF NOT EXISTS `target_classes` JSON NULL;

-- Check if columns exist
SHOW COLUMNS FROM attendance_schedules;

-- Add missing columns if needed
ALTER TABLE `attendance_schedules` 
ADD COLUMN IF NOT EXISTS `target_type` ENUM('all', 'departments', 'sections') DEFAULT 'all',
ADD COLUMN IF NOT EXISTS `target_departments` JSON NULL,
ADD COLUMN IF NOT EXISTS `target_positions` JSON NULL,
ADD COLUMN IF NOT EXISTS `target_sections` JSON NULL,
ADD COLUMN IF NOT EXISTS `target_classes` JSON NULL;

-- Check existing schedules
SELECT id, name, target_type, target_departments, target_sections FROM attendance_schedules;



-- Add missing columns to attendance_schedules table
ALTER TABLE `attendance_schedules` 
ADD COLUMN IF NOT EXISTS `target_type` ENUM('all', 'departments', 'sections') DEFAULT 'all',
ADD COLUMN IF NOT EXISTS `target_departments` JSON NULL,
ADD COLUMN IF NOT EXISTS `target_positions` JSON NULL,
ADD COLUMN IF NOT EXISTS `target_sections` JSON NULL,
ADD COLUMN IF NOT EXISTS `target_classes` JSON NULL;

-- Verify the table structure
DESCRIBE attendance_schedules;

-- Check if there are any schedules in the database
SELECT * FROM attendance_schedules;







-- =====================================================
-- INSERT DEFAULT DATA
-- =====================================================

-- Insert Subscription Plans
INSERT INTO `subscription_plans` (`name`, `display_name`, `description`, `price_monthly`, `price_yearly`, `max_users`, `max_devices`, `max_admins`, `analytics_level`, `dashboard_level`, `api_access`, `custom_reports`, `custom_branding`, `support_level`, `live_view_enabled`, `live_view_duration`, `export_data`, `sort_order`) VALUES
('free', 'Free', 'Perfect to get started with basic features', 0.00, 0.00, 50, 1, 1, 'basic', 'basic', 0, 0, 0, 'none', 1, 30, 0, 1),
('basic', 'Basic', 'For small organizations', 15.00, 117.00, 100, 1, 1, 'basic', 'basic', 1, 0, 0, 'email', 1, 60, 1, 2),
('professional', 'Professional', 'For growing organizations', 69.00, 538.00, 1000, 2, 1, 'advanced', 'advanced', 1, 1, 0, 'priority', 1, 120, 1, 3),
('enterprise', 'Enterprise', 'For large institutions', 199.00, 1552.00, NULL, 5, 3, 'premium', 'premium', 1, 1, 1, '24/7', 1, 240, 1, 4);

-- Insert Admin Roles linked to plans
INSERT INTO `admin_roles` (`plan_id`, `name`, `description`, `permissions`) VALUES
(1, 'free_admin', 'Free plan admin with basic permissions', '{"dashboard": true, "users": {"view": true, "add": true, "edit": true, "delete": false}, "devices": {"view": true, "add": false, "edit": false}, "attendance": {"view": true, "export": false}}'),
(2, 'basic_admin', 'Basic plan admin with standard permissions', '{"dashboard": true, "users": {"view": true, "add": true, "edit": true, "delete": true}, "devices": {"view": true, "add": true, "edit": true, "delete": true}, "attendance": {"view": true, "export": true}, "reports": {"basic": true}}'),
(3, 'pro_admin', 'Professional plan admin with advanced permissions', '{"dashboard": true, "users": {"view": true, "add": true, "edit": true, "delete": true}, "devices": {"view": true, "add": true, "edit": true, "delete": true}, "attendance": {"view": true, "export": true}, "reports": {"advanced": true}, "analytics": true, "api": true}'),
(4, 'enterprise_admin', 'Enterprise plan admin with full permissions', '{"*": true}'),
(NULL, 'super_admin', 'Super admin with all system permissions', '{"*": true}');

-- Insert default organization (for testing)
INSERT INTO `organizations` (`org_name`, `type`, `contact_email`, `api_page`, `subscription_status`, `trial_ends_at`) VALUES
('Demo Organization', 'school', 'admin@demo.com', '/api/default', 'trial', DATE_ADD(NOW(), INTERVAL 30 DAY));

-- Insert default subscription for demo organization
INSERT INTO `subscriptions` (`organization_id`, `plan_id`, `billing_cycle`, `status`, `amount_paid`, `start_date`, `end_date`, `trial_ends_at`) 
SELECT 1, id, 'monthly', 'trial', 0.00, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY)
FROM `subscription_plans` WHERE `name` = 'free';

-- Insert default admin role assignment
INSERT INTO `admins` (`organization_id`, `role_id`, `first_name`, `last_name`, `username`, `email`, `password_hash`, `is_verified`, `is_primary`) VALUES
(1, 5, 'Super', 'Admin', 'superadmin', 'super@csms.com', '$2a$10$YourHashedPasswordHere', 1, 1);