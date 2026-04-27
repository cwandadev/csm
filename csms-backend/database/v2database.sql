-- =====================================================
-- CSMS DATABASE - Complete Schema with Foreign Keys
-- =====================================================

CREATE DATABASE IF NOT EXISTS csm;
USE csm;

-- =====================================================
-- 1. ORGANIZATIONS (Root level)
-- =====================================================

CREATE TABLE `organizations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `org_name` varchar(255) NOT NULL,
  `logo` varchar(255) DEFAULT 'logo_default.png',
  `province` varchar(255) DEFAULT NULL,
  `district` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `type` enum('school','company') NOT NULL,
  `contact_email` varchar(255) DEFAULT NULL,
  `contact_phone` varchar(50) DEFAULT NULL,
  `api_page` text NOT NULL,
  `subscription_status` enum('active','inactive','suspended','trial') DEFAULT 'trial',
  `subscription_started_at` timestamp NULL DEFAULT NULL,
  `subscription_expires_at` timestamp NULL DEFAULT NULL,
  `trial_ends_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_org_status` (`subscription_status`),
  INDEX `idx_org_type` (`type`),
  INDEX `idx_org_expiry` (`subscription_expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. SUBSCRIPTION PLANS
-- =====================================================

CREATE TABLE `subscription_plans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL COMMENT 'free, basic, professional, enterprise',
  `display_name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `price_monthly` decimal(10,2) NOT NULL DEFAULT 0.00,
  `price_yearly` decimal(10,2) NOT NULL DEFAULT 0.00,
  `currency` varchar(3) DEFAULT 'USD',
  `max_users` int(11) DEFAULT NULL COMMENT 'NULL = unlimited',
  `max_devices` int(11) DEFAULT NULL COMMENT 'NULL = unlimited',
  `max_admins` int(11) DEFAULT 1,
  `analytics_level` enum('none','basic','advanced','premium') DEFAULT 'basic',
  `dashboard_level` enum('basic','advanced','premium') DEFAULT 'basic',
  `api_access` tinyint(1) DEFAULT 0,
  `api_rate_limit` int(11) DEFAULT 100 COMMENT 'requests per minute',
  `custom_reports` tinyint(1) DEFAULT 0,
  `custom_branding` tinyint(1) DEFAULT 0,
  `support_level` enum('none','email','priority','24/7') DEFAULT 'email',
  `live_view_enabled` tinyint(1) DEFAULT 0,
  `live_view_duration` int(11) DEFAULT 60 COMMENT 'minutes',
  `export_data` tinyint(1) DEFAULT 0,
  `webhooks` tinyint(1) DEFAULT 0,
  `features` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_plan_active` (`is_active`),
  INDEX `idx_plan_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. SUBSCRIPTIONS (Organization subscriptions)
-- =====================================================

CREATE TABLE `subscriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `billing_cycle` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
  `status` enum('active','inactive','canceled','expired','trial') NOT NULL DEFAULT 'trial',
  `amount_paid` decimal(10,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `start_date` timestamp NOT NULL,
  `end_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `trial_ends_at` timestamp NULL DEFAULT NULL,
  `canceled_at` timestamp NULL DEFAULT NULL,
  `auto_renew` tinyint(1) DEFAULT 1,
  `payment_method` varchar(50) DEFAULT NULL,
  `payment_gateway` varchar(50) DEFAULT NULL,
  `gateway_subscription_id` varchar(255) DEFAULT NULL,
  `last_invoice_id` varchar(255) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE RESTRICT,
  INDEX `idx_sub_org` (`organization_id`),
  INDEX `idx_sub_status` (`status`),
  INDEX `idx_sub_end_date` (`end_date`),
  INDEX `idx_sub_plan` (`plan_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. INVOICES
-- =====================================================

CREATE TABLE `invoices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `subscription_id` int(11) NOT NULL,
  `invoice_number` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'Frw',
  `status` enum('paid','pending','failed','refunded') NOT NULL DEFAULT 'pending',
  `invoice_date` timestamp NOT NULL,
  `due_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` timestamp NULL DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `transaction_id` varchar(255) DEFAULT NULL,
  `invoice_url` text DEFAULT NULL,
  `pdf_url` text DEFAULT NULL,
  `items` json DEFAULT NULL COMMENT 'Line items for the invoice',
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_invoice_number` (`invoice_number`),
  INDEX `idx_inv_org` (`organization_id`),
  INDEX `idx_inv_status` (`status`),
  INDEX `idx_inv_date` (`invoice_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. PAYMENT METHODS
-- =====================================================

CREATE TABLE `payment_methods` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `admin_id` int(11) NOT NULL,
  `payment_gateway` varchar(50) NOT NULL,
  `gateway_customer_id` varchar(255) NOT NULL,
  `payment_method_id` varchar(255) NOT NULL,
  `card_brand` varchar(50) DEFAULT NULL,
  `card_last4` varchar(4) DEFAULT NULL,
  `card_exp_month` int(2) DEFAULT NULL,
  `card_exp_year` int(4) DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  INDEX `idx_pm_org` (`organization_id`),
  INDEX `idx_pm_admin` (`admin_id`),
  INDEX `idx_pm_gateway` (`gateway_customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. ADMIN ROLES (Plan-based roles)
-- =====================================================

CREATE TABLE `admin_roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plan_id` int(11) DEFAULT NULL COMMENT 'Link to subscription plan',
  `name` varchar(50) NOT NULL COMMENT 'free_admin, basic_admin, pro_admin, enterprise_admin, super_admin',
  `description` text DEFAULT NULL,
  `permissions` json NOT NULL COMMENT 'Key-value pairs of allowed features',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE SET NULL,
  INDEX `idx_role_name` (`name`),
  UNIQUE KEY `uk_role_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 7. ADMINS (Users who manage the system)
-- =====================================================

CREATE TABLE `admins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) DEFAULT NULL,
  `role_id` int(11) NOT NULL DEFAULT 1,
  `subscription_id` int(11) DEFAULT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `profile` varchar(255) DEFAULT 'admin_default.jpg',
  `gender` ENUM('male','female','other') DEFAULT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(191) NOT NULL,
  `new_email` varchar(191) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `password_reset_token` varchar(191) DEFAULT NULL,
  `password_reset_expires_at` timestamp NULL DEFAULT NULL,
  `verification_code` varchar(6) DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  `code_expiry_time` datetime DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT 0 COMMENT 'Main admin for the organization',
  `last_password_change` timestamp NULL DEFAULT NULL,
  `failed_login_attempts` int(11) DEFAULT 0,
  `account_locked_until` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`role_id`) REFERENCES `admin_roles`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `uk_admin_email` (`email`),
  UNIQUE KEY `uk_admin_username` (`username`),
  INDEX `idx_admin_org` (`organization_id`),
  INDEX `idx_admin_role` (`role_id`),
  INDEX `idx_admin_email` (`email`),
  INDEX `idx_admin_primary` (`is_primary`),
  INDEX `idx_admin_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 8. ADMIN SESSIONS
-- =====================================================

CREATE TABLE `admin_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) NOT NULL,
  `login_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `logout_at` timestamp NULL DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `session_token` varchar(255) NOT NULL,
  `user_agent` text DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  INDEX `idx_session_admin` (`admin_id`),
  INDEX `idx_session_token` (`session_token`),
  INDEX `idx_session_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 9. PASSWORD RESET TOKENS
-- =====================================================

CREATE TABLE `password_reset_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_user_id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`admin_user_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  INDEX `idx_reset_token` (`token`),
  INDEX `idx_reset_admin` (`admin_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 10. DEVICES
-- =====================================================

CREATE TABLE `devices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `device_name` varchar(255) NOT NULL,
  `device_image` varchar(255) DEFAULT NULL,
  `unique_device_id` varchar(255) NOT NULL,
  `device_type` enum('ESP32','ESP8266') NOT NULL,
  `added_by` int(11) NOT NULL,
  `last_seen` timestamp NULL DEFAULT NULL,
  `status` enum('active','inactive','lost') DEFAULT 'active',
  `added_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`added_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  UNIQUE KEY `uk_device_unique_id` (`unique_device_id`),
  INDEX `idx_device_org` (`organization_id`),
  INDEX `idx_device_status` (`status`),
  INDEX `idx_device_last_seen` (`last_seen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 11. WIFI CREDENTIALS
-- =====================================================

CREATE TABLE `wifi_credentials` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) NOT NULL,
  `device_id` int(11) DEFAULT NULL,
  `organization_id` int(11) NOT NULL,
  `device_name` varchar(255) NOT NULL,
  `ssid` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `api` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  INDEX `idx_wifi_device` (`device_id`),
  INDEX `idx_wifi_org` (`organization_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 12. DEVICE LOCATIONS
-- =====================================================

CREATE TABLE `device_locations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `device_id` int(11) NOT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE,
  INDEX `idx_location_device` (`device_id`),
  INDEX `idx_location_recorded` (`recorded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 13. DEVICE STATUS HISTORY
-- =====================================================

CREATE TABLE `device_status_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `device_id` int(11) NOT NULL,
  `status` tinyint(1) NOT NULL,
  `is_online` tinyint(1) DEFAULT 0,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `duration` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE,
  INDEX `idx_status_device` (`device_id`),
  INDEX `idx_status_changed` (`changed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 14. USERS (Students/Employees)
-- =====================================================

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `image` varchar(255) DEFAULT 'user_default.jpg',
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `country` varchar(250) DEFAULT NULL,
  `province` varchar(250) DEFAULT NULL,
  `city` varchar(250) DEFAULT NULL,
  `role` enum('student','employee') NOT NULL,
  `card_uid` varchar(255) DEFAULT NULL,
  `fingerprint_template` text DEFAULT NULL,
  `backup_code` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `added_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`added_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  UNIQUE KEY `uk_user_card_uid` (`card_uid`),
  INDEX `idx_user_org` (`organization_id`),
  INDEX `idx_user_role` (`role`),
  INDEX `idx_user_active` (`is_active`),
  INDEX `idx_user_card` (`card_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 15. SECTIONS (For Schools)
-- =====================================================

CREATE TABLE `sections` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL COMMENT 'MPC, SOD, Primary, Olevel',
  `description` text DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  INDEX `idx_section_org` (`organization_id`),
  INDEX `idx_section_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 16. CLASSES (For Schools)
-- =====================================================

CREATE TABLE `classes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `section_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL COMMENT 'S4B, L5A, P5C, S1B',
  `grade_level` varchar(50) DEFAULT NULL,
  `capacity` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  INDEX `idx_class_org` (`organization_id`),
  INDEX `idx_class_section` (`section_id`),
  INDEX `idx_class_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 17. STUDENTS (Extended info)
-- =====================================================

CREATE TABLE `students` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `section_id` int(11) NOT NULL,
  `class_id` int(11) DEFAULT NULL,
  `roll_number` varchar(50) DEFAULT NULL,
  `parent_name` varchar(255) DEFAULT NULL,
  `parent_phone` varchar(50) DEFAULT NULL,
  `parent_email` varchar(255) DEFAULT NULL,
  `admission_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `uk_student_user` (`user_id`),
  INDEX `idx_student_user` (`user_id`),
  INDEX `idx_student_section` (`section_id`),
  INDEX `idx_student_class` (`class_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 18. DEPARTMENTS (For Companies)
-- =====================================================

CREATE TABLE `departments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL COMMENT 'Staff, Cleaner, Administration',
  `description` text DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  INDEX `idx_dept_org` (`organization_id`),
  INDEX `idx_dept_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 19. POSITIONS (For Companies)
-- =====================================================

CREATE TABLE `positions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `department_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL COMMENT 'Teacher, Manager, Cleaner',
  `salary_range` varchar(100) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  INDEX `idx_position_org` (`organization_id`),
  INDEX `idx_position_dept` (`department_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 20. EMPLOYEES (Extended info)
-- =====================================================

CREATE TABLE `employees` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `department_id` int(11) NOT NULL,
  `position_id` int(11) DEFAULT NULL,
  `employee_id` varchar(50) DEFAULT NULL COMMENT 'Company employee ID',
  `hire_date` date DEFAULT NULL,
  `salary` decimal(10,2) DEFAULT NULL,
  `emergency_contact` varchar(255) DEFAULT NULL,
  `emergency_phone` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `uk_employee_user` (`user_id`),
  INDEX `idx_employee_user` (`user_id`),
  INDEX `idx_employee_dept` (`department_id`),
  INDEX `idx_employee_position` (`position_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 21. CARD ACTIONS
-- =====================================================

CREATE TABLE `card_actions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `device_id` int(11) NOT NULL,
  `card_uid` varchar(255) NOT NULL,
  -- `action_type` enum('tap','swipe','hold') DEFAULT 'tap',
  `tapped_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE,
  INDEX `idx_card_user` (`user_id`),
  INDEX `idx_card_device` (`device_id`),
  INDEX `idx_card_tapped` (`tapped_at`),
  INDEX `idx_card_uid` (`card_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
































-- =====================================================
-- 22. ATTENDANCE SCHEDULES (with targeting support)
-- =====================================================

CREATE TABLE `schedules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `departments_id` int(11) DEFAULT NULL,
  `positions_id` int(11) DEFAULT NULL,
  `sections_id` int(11) DEFAULT NULL,
  `classes_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `type` enum('check_in','check_out','both') NOT NULL DEFAULT 'both',
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `days_of_week` json NOT NULL COMMENT 'Array of days: ["monday","tuesday",...]',
  `is_active` tinyint(1) DEFAULT 1,
  `device_ids` json DEFAULT NULL COMMENT 'Array of device IDs',
  -- `target_type` enum('all','departments','sections') NOT NULL DEFAULT 'all',
  `company_type` enum('all','departments','sections') NOT NULL DEFAULT 'all',
  `school_type` enum('both','departments','positions','sections','classes') NOT NULL DEFAULT 'both',
   
  `company_departments` json DEFAULT NULL COMMENT 'Array of department IDs',
  `company_positions` json DEFAULT NULL COMMENT 'Array of position IDs',

  `school_departments` json DEFAULT NULL COMMENT 'Array of department IDs',
  `school_positions` json DEFAULT NULL COMMENT 'Array of position IDs',
  `school_sections` json DEFAULT NULL COMMENT 'Array of all section users IDs',
  `school_classes` json DEFAULT NULL COMMENT 'Array of all class users IDs',
  
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`classe_id`) REFERENCES `classes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  
  INDEX `idx_schedule_org` (`organization_id`),
  INDEX `idx_schedule_active` (`is_active`),
  INDEX `idx_schedule_target_type` (`target_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 23. ATTENDANCE RECORDS
-- =====================================================

CREATE TABLE `attendance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `device_id` int(11) NOT NULL,
  `schedule_id` int(11) DEFAULT NULL COMMENT 'Reference to attendance schedules',
  `attendance_type_id` int(11) DEFAULT NULL COMMENT 'For custom attendance types',
  `name` varchar(100) DEFAULT NULL COMMENT 'custom attendance name e.g., Meeting at Library',
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `method` enum('card','backup_code','fingerprint','manual') NOT NULL,
  `status` enum('check_in','check_out','present','absent','late','early_leave') DEFAULT 'present',
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `verified_by` int(11) DEFAULT NULL COMMENT 'Admin who verified manual entry',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`verified_by`) REFERENCES `admins`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`attendance_type_id`) REFERENCES `attendance_schedules`(`id`) ON DELETE SET NULL,
  
  INDEX `idx_attendance_org` (`organization_id`),
  INDEX `idx_attendance_user` (`user_id`),
  INDEX `idx_attendance_device` (`device_id`),
  INDEX `idx_attendance_date` (`timestamp`),
  INDEX `idx_attendance_status` (`status`),
  INDEX `idx_attendance_method` (`method`),
  INDEX `idx_attendance_schedule` (`schedule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 24. ATTENDANCE TYPES (Custom attendance categories)
-- =====================================================

CREATE TABLE `attendance_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `requires_check_out` tinyint(1) DEFAULT 0,
  `color` varchar(7) DEFAULT '#3b82f6',
  `is_active` tinyint(1) DEFAULT 1,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  
  INDEX `idx_att_type_org` (`organization_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


































-- =====================================================
-- 25. LIVE VIEW SESSIONS
-- =====================================================

CREATE TABLE `live_view_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `session_token` varchar(255) NOT NULL,
  `duration_minutes` int(11) DEFAULT 60,
  `expires_at` timestamp NOT NULL,
  `viewer_count` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_session_token` (`session_token`),
  INDEX `idx_live_org` (`organization_id`),
  INDEX `idx_live_token` (`session_token`),
  INDEX `idx_live_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 26. ACTIVITY LOGS (Audit trail)
-- =====================================================

CREATE TABLE `activity_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `admin_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` int(11) DEFAULT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_log_org` (`organization_id`),
  INDEX `idx_log_admin` (`admin_id`),
  INDEX `idx_log_action` (`action`),
  INDEX `idx_log_entity` (`entity_type`, `entity_id`),
  INDEX `idx_log_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
