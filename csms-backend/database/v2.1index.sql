-- =====================================================
-- CSMSI DATABASE - ALL CONSTRAINTS, FOREIGN KEYS & INDEXES
-- Run this AFTER creating all tables
-- =====================================================

USE csmi;

-- =====================================================
-- 1. ORGANIZATIONS (Indexes only - no foreign keys)
-- =====================================================
-- Already created with table

-- =====================================================
-- 2. SUBSCRIPTION PLANS (Indexes only)
-- =====================================================
-- Already created with table

-- =====================================================
-- 3. SUBSCRIPTIONS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `subscriptions` 
  ADD CONSTRAINT `fk_subscriptions_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_subscriptions_plan` 
    FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE RESTRICT;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 4. INVOICES (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `invoices` 
  ADD CONSTRAINT `fk_invoices_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_invoices_subscription` 
    FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 5. PAYMENT METHODS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `payment_methods` 
  ADD CONSTRAINT `fk_payment_methods_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 6. ADMIN ROLES (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `admin_roles` 
  ADD CONSTRAINT `fk_admin_roles_plan` 
    FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE SET NULL;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 7. ADMINS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `admins` 
  ADD CONSTRAINT `fk_admins_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_admins_role` 
    FOREIGN KEY (`role_id`) REFERENCES `admin_roles`(`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_admins_subscription` 
    FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 8. ADMIN SESSIONS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `admin_sessions` 
  ADD CONSTRAINT `fk_admin_sessions_admin` 
    FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 9. PASSWORD RESET TOKENS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `password_reset_tokens` 
  ADD CONSTRAINT `fk_password_reset_tokens_admin` 
    FOREIGN KEY (`admin_user_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 10. DEVICES (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `devices` 
  ADD CONSTRAINT `fk_devices_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_devices_added_by` 
    FOREIGN KEY (`added_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 11. WIFI CREDENTIALS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `wifi_credentials` 
  ADD CONSTRAINT `fk_wifi_credentials_admin` 
    FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_wifi_credentials_device` 
    FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_wifi_credentials_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 12. DEVICE LOCATIONS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `device_locations` 
  ADD CONSTRAINT `fk_device_locations_device` 
    FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 13. DEVICE STATUS HISTORY (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `device_status_history` 
  ADD CONSTRAINT `fk_device_status_history_device` 
    FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 14. USERS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `users` 
  ADD CONSTRAINT `fk_users_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_users_added_by` 
    FOREIGN KEY (`added_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 15. SECTIONS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `sections` 
  ADD CONSTRAINT `fk_sections_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_sections_created_by` 
    FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 16. CLASSES (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `classes` 
  ADD CONSTRAINT `fk_classes_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_classes_section` 
    FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_classes_created_by` 
    FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 17. STUDENTS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `students` 
  ADD CONSTRAINT `fk_students_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_students_section` 
    FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_students_class` 
    FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE SET NULL;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 18. DEPARTMENTS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `departments` 
  ADD CONSTRAINT `fk_departments_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_departments_created_by` 
    FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 19. POSITIONS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `positions` 
  ADD CONSTRAINT `fk_positions_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_positions_department` 
    FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_positions_created_by` 
    FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 20. EMPLOYEES (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `employees` 
  ADD CONSTRAINT `fk_employees_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_employees_department` 
    FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_employees_position` 
    FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE SET NULL;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 21. CARD ACTIONS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `card_actions` 
  ADD CONSTRAINT `fk_card_actions_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_card_actions_device` 
    FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 22. ATTENDANCE (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `attendance` 
  ADD CONSTRAINT `fk_attendance_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_attendance_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_attendance_device` 
    FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_attendance_schedule` 
    FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_attendance_verified_by` 
    FOREIGN KEY (`verified_by`) REFERENCES `admins`(`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_attendance_type` 
    FOREIGN KEY (`attendance_type_id`) REFERENCES `attendance_types`(`id`) ON DELETE SET NULL;








ALTER TABLE `attendance` 
ADD FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL,
ADD FOREIGN KEY (`attendance_type_id`) REFERENCES `attendance_types`(`id`) ON DELETE SET NULL;

ALTER TABLE `payment_methods`
ADD FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE;

ALTER TABLE `subscriptions`
MODIFY COLUMN `end_date` timestamp NULL DEFAULT NULL;

-- Add composite index for common queries
CREATE INDEX idx_attendance_org_user_date_status 
ON attendance(organization_id, user_id, date, status);

-- Add index for the schedules target queries
CREATE INDEX idx_schedules_target 
ON schedules(organization_id, target_type, is_active);












-- Add missing foreign keys
ALTER TABLE `attendance` 
ADD CONSTRAINT `fk_attendance_schedule` 
FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL,
ADD CONSTRAINT `fk_attendance_type` 
FOREIGN KEY (`attendance_type_id`) REFERENCES `attendance_types`(`id`) ON DELETE SET NULL;

ALTER TABLE `payment_methods`
ADD CONSTRAINT `fk_payment_methods_admin` 
FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE;

-- Fix default value for subscriptions end_date
ALTER TABLE `subscriptions`
MODIFY COLUMN `end_date` timestamp NULL DEFAULT NULL;

-- Add missing indexes for performance
CREATE INDEX idx_attendance_org_user_date_status 
ON attendance(organization_id, user_id, date, status);

CREATE INDEX idx_attendance_org_date_method 
ON attendance(organization_id, date, method);

CREATE INDEX idx_schedules_org_active 
ON schedules(organization_id, is_active);

CREATE INDEX idx_attendance_types_org_active 
ON attendance_types(organization_id, is_active);

-- Add trigger to update daily summary
DELIMITER $$
CREATE TRIGGER after_attendance_insert
AFTER INSERT ON attendance
FOR EACH ROW
BEGIN
    -- Update or insert daily summary
    INSERT INTO attendance_daily_summary 
        (organization_id, user_id, date, first_check_in, last_check_out, total_work_minutes, 
         check_in_count, check_out_count, is_late, late_minutes, early_leave_minutes, overtime_minutes)
    VALUES 
        (NEW.organization_id, NEW.user_id, NEW.date, 
         CASE WHEN NEW.status = 'check_in' THEN NEW.timestamp ELSE NULL END,
         CASE WHEN NEW.status = 'check_out' THEN NEW.timestamp ELSE NULL END,
         0,
         CASE WHEN NEW.status = 'check_in' THEN 1 ELSE 0 END,
         CASE WHEN NEW.status = 'check_out' THEN 1 ELSE 0 END,
         CASE WHEN NEW.status = 'late' THEN 1 ELSE 0 END,
         CASE WHEN NEW.status = 'late' THEN 1 ELSE 0 END,
         0, 0)
    ON DUPLICATE KEY UPDATE
        check_in_count = check_in_count + (CASE WHEN NEW.status = 'check_in' THEN 1 ELSE 0 END),
        check_out_count = check_out_count + (CASE WHEN NEW.status = 'check_out' THEN 1 ELSE 0 END),
        is_late = is_late OR (CASE WHEN NEW.status = 'late' THEN 1 ELSE 0 END),
        late_minutes = late_minutes + (CASE WHEN NEW.status = 'late' THEN 1 ELSE 0 END);
END$$
DELIMITER ;























-- Additional Indexes for attendance (not in CREATE TABLE)
CREATE INDEX `idx_attendance_user_device_timestamp` ON `attendance` (`user_id`, `device_id`, `timestamp`);
CREATE INDEX `idx_attendance_org_date_range` ON `attendance` (`organization_id`, `date`, `user_id`);

-- =====================================================
-- 23. ATTENDANCE DAILY SUMMARY (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `attendance_daily_summary` 
  ADD CONSTRAINT `fk_ads_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ads_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 24. ATTENDANCE MONTHLY SUMMARY (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `attendance_monthly_summary` 
  ADD CONSTRAINT `fk_ams_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ams_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 25. ATTENDANCE TYPES (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `attendance_types` 
  ADD CONSTRAINT `fk_att_types_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_att_types_created_by` 
    FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 26. SCHEDULES (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `schedules` 
  ADD CONSTRAINT `fk_schedules_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_schedules_created_by` 
    FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT;
-- Indexes already in CREATE TABLE

-- Additional Index for schedules
CREATE INDEX `idx_schedule_time` ON `schedules` (`start_time`, `end_time`);

-- =====================================================
-- 27. USER ATTENDANCE ASSIGNMENTS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `user_attendance_assignments` 
  ADD CONSTRAINT `fk_uaa_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_uaa_attendance_type` 
    FOREIGN KEY (`attendance_type_id`) REFERENCES `attendance_types`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_uaa_schedule` 
    FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_uaa_created_by` 
    FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 28. SCHEDULE TARGET USERS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `schedule_target_users` 
  ADD CONSTRAINT `fk_stu_schedule` 
    FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_stu_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 29. SCHEDULE EXCEPTIONS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `schedule_exceptions` 
  ADD CONSTRAINT `fk_schex_schedule` 
    FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_schex_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_schex_created_by` 
    FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 30. LIVE VIEW SESSIONS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `live_view_sessions` 
  ADD CONSTRAINT `fk_live_view_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_live_view_created_by` 
    FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE CASCADE;
-- Indexes already in CREATE TABLE

-- =====================================================
-- 31. ACTIVITY LOGS (Foreign Keys & Indexes)
-- =====================================================
ALTER TABLE `activity_logs` 
  ADD CONSTRAINT `fk_activity_logs_organization` 
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_activity_logs_admin` 
    FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_activity_logs_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL;
-- Indexes already in CREATE TABLE

-- =====================================================
-- VERIFY ALL CONSTRAINTS
-- =====================================================
SELECT 
  CONSTRAINT_NAME,
  TABLE_NAME,
  CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS 
WHERE CONSTRAINT_SCHEMA = 'csmi'
ORDER BY TABLE_NAME, CONSTRAINT_TYPE;