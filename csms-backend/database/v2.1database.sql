-- =====================================================
-- CSM DATABASE - Complete Schema with Foreign Keys
-- =====================================================

CREATE DATABASE IF NOT EXISTS csmi;
USE csmi;

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
  `is_online` tinyint(1) DEFAULT 0,
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
-- 22. ATTENDANCE RECORDS (Working version - no FK constraints)
-- =====================================================

CREATE TABLE `attendance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `device_id` int(11) NOT NULL,
  `schedule_id` int(11) DEFAULT NULL,
  `attendance_type_id` int(11) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date` date GENERATED ALWAYS AS (DATE(`timestamp`)) STORED,
  `hour` tinyint(4) GENERATED ALWAYS AS (HOUR(`timestamp`)) STORED,
  `method` enum('card','backup_code','fingerprint','manual','face_recognition') NOT NULL DEFAULT 'card',
  `status` enum('check_in','check_out','present','absent','late','early_leave','holiday','weekend') DEFAULT 'present',
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `verified_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`verified_by`) REFERENCES `admins`(`id`) ON DELETE SET NULL,
  -- FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL,
  -- FOREIGN KEY (`attendance_type_id`) REFERENCES `attendance_types`(`id`) ON DELETE SET NULL,
  
  -- Indexes only (no foreign keys)
  INDEX `idx_attendance_org` (`organization_id`),
  INDEX `idx_attendance_user` (`user_id`),
  INDEX `idx_attendance_device` (`device_id`),
  INDEX `idx_attendance_schedule` (`schedule_id`),
  INDEX `idx_attendance_type` (`attendance_type_id`),
  INDEX `idx_attendance_status` (`status`),
  INDEX `idx_attendance_method` (`method`),
  INDEX `idx_attendance_timestamp` (`timestamp`),
  INDEX `idx_attendance_date` (`date`),
  INDEX `idx_attendance_hour` (`hour`),
  INDEX `idx_attendance_org_user_date` (`organization_id`, `user_id`, `date`),
  INDEX `idx_attendance_org_date_status` (`organization_id`, `date`, `status`),
  INDEX `idx_attendance_user_date_status` (`user_id`, `date`, `status`),
  INDEX `idx_attendance_org_user_timestamp` (`organization_id`, `user_id`, `timestamp`),
  INDEX `idx_attendance_date_status` (`date`, `status`),
  INDEX `idx_attendance_org_method_date` (`organization_id`, `method`, `date`),
  INDEX `idx_attendance_verified` (`verified_by`, `created_at`),
  INDEX `idx_attendance_user_device_timestamp` (`user_id`, `device_id`, `timestamp`),
  INDEX `idx_attendance_org_date_range` (`organization_id`, `date`, `user_id`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 23. ATTENDANCE DAILY SUMMARY (For faster reporting)
-- =====================================================

CREATE TABLE `attendance_daily_summary` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `first_check_in` timestamp NULL DEFAULT NULL,
  `last_check_out` timestamp NULL DEFAULT NULL,
  `total_work_minutes` int(11) DEFAULT 0,
  `status` enum('present','absent','late','half_day','holiday','weekend') DEFAULT 'present',
  `check_in_count` int(11) DEFAULT 0,
  `check_out_count` int(11) DEFAULT 0,
  `is_late` tinyint(1) DEFAULT 0,
  `late_minutes` int(11) DEFAULT 0,
  `early_leave_minutes` int(11) DEFAULT 0,
  `overtime_minutes` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  
  UNIQUE KEY `uk_daily_summary` (`organization_id`, `user_id`, `date`),
  INDEX `idx_ads_org_date` (`organization_id`, `date`),
  INDEX `idx_ads_user_date` (`user_id`, `date`),
  INDEX `idx_ads_org_user_date` (`organization_id`, `user_id`, `date`),
  INDEX `idx_ads_date_status` (`date`, `status`),
  INDEX `idx_ads_org_status_date` (`organization_id`, `status`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 24. ATTENDANCE MONTHLY SUMMARY (For faster reporting)
-- =====================================================

CREATE TABLE `attendance_monthly_summary` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `year` smallint(4) NOT NULL,
  `month` tinyint(2) NOT NULL,
  `total_present_days` int(11) DEFAULT 0,
  `total_absent_days` int(11) DEFAULT 0,
  `total_late_days` int(11) DEFAULT 0,
  `total_half_days` int(11) DEFAULT 0,
  `total_holidays` int(11) DEFAULT 0,
  `total_weekend_days` int(11) DEFAULT 0,
  `total_work_minutes` int(11) DEFAULT 0,
  `total_overtime_minutes` int(11) DEFAULT 0,
  `attendance_percentage` decimal(5,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  
  UNIQUE KEY `uk_monthly_summary` (`organization_id`, `user_id`, `year`, `month`),
  INDEX `idx_ams_org_year_month` (`organization_id`, `year`, `month`),
  INDEX `idx_ams_user_year_month` (`user_id`, `year`, `month`),
  INDEX `idx_ams_year_month` (`year`, `month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 25. ATTENDANCE TYPES (Custom attendance categories) - IMPROVED
-- =====================================================

CREATE TABLE `attendance_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) GENERATED ALWAYS AS (LOWER(REPLACE(name, ' ', '_'))) STORED,
  `description` text DEFAULT NULL,
  `requires_check_out` tinyint(1) DEFAULT 0,
  `color` varchar(7) DEFAULT '#3b82f6',
  `icon` varchar(50) DEFAULT NULL,
  `affects_attendance_percentage` tinyint(1) DEFAULT 1 COMMENT 'Whether this type counts in attendance percentage',
  `is_paid` tinyint(1) DEFAULT 1 COMMENT 'Whether this type is paid',
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  
  INDEX `idx_att_type_org` (`organization_id`),
  INDEX `idx_att_type_active` (`is_active`),
  INDEX `idx_att_type_slug` (`slug`),
  INDEX `idx_att_type_org_active` (`organization_id`, `is_active`),
  INDEX `idx_att_type_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 26. ATTENDANCE SCHEDULES (Optimized with better indexing)
-- =====================================================

CREATE TABLE `schedules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `type` enum('check_in','check_out','both') NOT NULL DEFAULT 'both',
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `days_of_week` json NOT NULL COMMENT 'Array of days: ["monday","tuesday",...]',
  `grace_minutes` int(11) DEFAULT 0 COMMENT 'Minutes after start_time considered on time',
  `late_threshold_minutes` int(11) DEFAULT 15 COMMENT 'Minutes after grace period considered late',
  `early_leave_threshold_minutes` int(11) DEFAULT 15 COMMENT 'Minutes before end_time considered early leave',
  `is_active` tinyint(1) DEFAULT 1,
  `device_ids` json DEFAULT NULL COMMENT 'Array of device IDs',
  
  -- Simplified targeting structure
  `target_type` enum('all','departments','positions','sections','classes','specific_users') NOT NULL DEFAULT 'all',
  `target_ids` json DEFAULT NULL COMMENT 'Array of target IDs based on target_type',
  
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  
  -- Basic indexes
  INDEX `idx_schedule_org` (`organization_id`),
  INDEX `idx_schedule_active` (`is_active`),
  INDEX `idx_schedule_type` (`type`),
  INDEX `idx_schedule_target_type` (`target_type`),
  
  -- Composite indexes for common queries
  INDEX `idx_schedule_org_active` (`organization_id`, `is_active`),
  INDEX `idx_schedule_org_type` (`organization_id`, `type`),
  INDEX `idx_schedule_created` (`created_by`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 27. USER ATTENDANCE TYPE ASSIGNMENTS (For recurring assignments)
-- =====================================================

CREATE TABLE `user_attendance_assignments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `attendance_type_id` int(11) NOT NULL,
  `schedule_id` int(11) DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `days_of_week` json DEFAULT NULL COMMENT 'Override schedule days',
  `is_active` tinyint(1) DEFAULT 1,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`attendance_type_id`) REFERENCES `attendance_types`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  
  INDEX `idx_uaa_user` (`user_id`),
  INDEX `idx_uaa_type` (`attendance_type_id`),
  INDEX `idx_uaa_schedule` (`schedule_id`),
  INDEX `idx_uaa_dates` (`start_date`, `end_date`),
  INDEX `idx_uaa_user_active` (`user_id`, `is_active`),
  INDEX `idx_uaa_type_dates` (`attendance_type_id`, `start_date`, `end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 28. SCHEDULE TARGET USERS (For specific user assignments)
-- =====================================================

CREATE TABLE `schedule_target_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `schedule_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  
  UNIQUE KEY `uk_schedule_user` (`schedule_id`, `user_id`),
  INDEX `idx_stu_schedule` (`schedule_id`),
  INDEX `idx_stu_user` (`user_id`),
  INDEX `idx_stu_user_schedule` (`user_id`, `schedule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 29. SCHEDULE EXCEPTIONS (Holidays, special days, overrides)
-- =====================================================

CREATE TABLE `schedule_exceptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `schedule_id` int(11) NOT NULL,
  `organization_id` int(11) NOT NULL,
  `exception_date` date NOT NULL,
  `exception_type` enum('holiday','special_schedule','cancelled','modified_time') NOT NULL,
  `override_start_time` time DEFAULT NULL,
  `override_end_time` time DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  
  INDEX `idx_schex_schedule` (`schedule_id`),
  INDEX `idx_schex_org` (`organization_id`),
  INDEX `idx_schex_date` (`exception_date`),
  INDEX `idx_schex_type` (`exception_type`),
  INDEX `idx_schex_schedule_date` (`schedule_id`, `exception_date`),
  INDEX `idx_schex_org_date` (`organization_id`, `exception_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================
-- 30. LIVE VIEW SESSIONS
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
-- 31. ACTIVITY LOGS (Audit trail)
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

-- 32

CREATE TABLE IF NOT EXISTS unregistered_card_scans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  card_id VARCHAR(50) NOT NULL,
  device_id VARCHAR(100),
  scanned_at DATETIME NOT NULL,
  is_notified BOOLEAN DEFAULT FALSE,
  INDEX idx_org_notified (organization_id, is_notified),
  INDEX idx_scanned_at (scanned_at),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);



ALTER TABLE admins 
ADD COLUMN auth_provider ENUM('email', 'google') DEFAULT 'email',
ADD COLUMN google_id VARCHAR(255) NULL UNIQUE,
ADD INDEX idx_google_id (google_id);


-- =====================================================
-- Add social and profile fields to admins table
-- =====================================================

ALTER TABLE `admins` 
ADD COLUMN `is_public` TINYINT(1) DEFAULT 0 COMMENT 'Whether profile is visible to other admins',
ADD COLUMN `bio` TEXT DEFAULT NULL COMMENT 'Short biography',
ADD COLUMN `location` VARCHAR(255) DEFAULT NULL COMMENT 'User location',
ADD COLUMN `website` VARCHAR(255) DEFAULT NULL COMMENT 'Personal website',
ADD COLUMN `twitter` VARCHAR(100) DEFAULT NULL COMMENT 'Twitter/X username',
ADD COLUMN `facebook` VARCHAR(255) DEFAULT NULL COMMENT 'Facebook profile URL or username',
ADD COLUMN `instagram` VARCHAR(100) DEFAULT NULL COMMENT 'Instagram username',
ADD COLUMN `linkedin` VARCHAR(255) DEFAULT NULL COMMENT 'LinkedIn profile URL',
ADD INDEX `idx_admin_is_public` (`is_public`);

-- Update existing admins to have default values
UPDATE `admins` SET `is_public` = 0 WHERE `is_public` IS NULL;

