-- =====================================================
-- CSM DATABASE - Complete Schema with Foreign Keys
-- =====================================================

-- CREATE DATABASE IF NOT EXISTS csm;
CREATE DATABASE csmt;
USE csmt;

-- =====================================================
-- 1. ORGANIZATIONS (Root level)
-- =====================================================

CREATE TABLE `organizations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `stripe_customer_id` VARCHAR(255) NULL,
  `stripe_subscription_id` VARCHAR(255) NULL,
  `org_name` varchar(255) NOT NULL,
  `logo` varchar(255) DEFAULT 'logo_default.png',
  `province` varchar(255) DEFAULT NULL,
  `district` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `type` enum('school','company') NOT NULL,
  `contact_email` varchar(255) DEFAULT NULL,
  `contact_phone` varchar(50) DEFAULT NULL,
  `auto_renew` BOOLEAN DEFAULT TRUE,
  `extra_devices_count` INT DEFAULT 0,
  `extra_devices_monthly_fee` DECIMAL(10,2) DEFAULT 0.00,
  `page_slug` text NOT NULL,
  `subscription_status` enum('active','inactive','suspended','trial') DEFAULT 'trial',
  `subscription_started_at` timestamp NULL DEFAULT NULL,
  `subscription_expires_at` timestamp NULL DEFAULT NULL,
  `trial_ends_at` timestamp NULL DEFAULT NULL,
  `current_admin_count` int(11) DEFAULT 0 COMMENT 'Current number of active admins',
  `max_admins_allowed` int(11) DEFAULT 5 COMMENT 'Based on subscription plan',
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
-- 3. SUBSCRIPTIONS PLAN PRICES (Multi-currency support)
-- =====================================================

CREATE TABLE subscription_plan_prices (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `plan_id` INT NOT NULL,
  `currency` VARCHAR(3) NOT NULL,
  `price_monthly` DECIMAL(10,2) NOT NULL,
  `price_yearly` DECIMAL(10,2) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY `uk_plan_currency` (`plan_id`, `currency`),
  FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. CURRENCIES (Auto-convert USD → RWF/EUR/GBP, Show local currency dynamically)
-- =====================================================

CREATE TABLE currencies (
  `code` VARCHAR(3) PRIMARY KEY,
  `name` VARCHAR(50),
  `symbol` VARCHAR(10),
  `rate_to_usd` DECIMAL(10,6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. SUBSCRIPTIONS (Organization subscriptions)
-- =====================================================

CREATE TABLE `subscriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `amount_paid` decimal(10,2) NOT NULL,
  `stripe_subscription_id` VARCHAR(255) NULL,
  `gateway_subscription_id` varchar(255) DEFAULT NULL,
  `last_invoice_id` varchar(255) DEFAULT NULL,
  `stripe_price_id` VARCHAR(255) NULL,
  `billing_cycle` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
  `status` enum('active','inactive','canceled','expired','trial') NOT NULL DEFAULT 'trial',
  `currency` varchar(3) DEFAULT 'USD',
  `exchange_rate` decimal(10,6) DEFAULT NULL,
  `base_amount_usd` decimal(10,2) DEFAULT NULL,
  `base_currency` varchar(3) DEFAULT 'USD',
  `start_date` timestamp NOT NULL,
  `end_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `trial_ends_at` timestamp NULL DEFAULT NULL,
  `canceled_at` timestamp NULL DEFAULT NULL,
  `auto_renew` tinyint(1) DEFAULT 1,
  `payment_method` varchar(50) DEFAULT NULL,
  `payment_gateway` varchar(50) DEFAULT NULL,
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
-- 6. INVOICES
-- =====================================================

CREATE TABLE `invoices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `subscription_id` int(11) NOT NULL,
  `invoice_number` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `exchange_rate` decimal(10,6) DEFAULT NULL,
  `base_amount_usd` decimal(10,2) DEFAULT NULL,
  `base_currency` varchar(3) DEFAULT 'USD',
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
-- 7. PAYMENT METHODS
-- =====================================================

CREATE TABLE `payment_methods` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `admin_id` int(11) NOT NULL,
  `payment_gateway` varchar(50) NOT NULL,
  `gateway_payment_method_id` VARCHAR(255) NULL,
  `gateway_customer_id` varchar(255) NOT NULL,
  `gateway_type` VARCHAR(20) COMMENT 'stripe, flutterwave',
  `payment_method_id` varchar(255) NOT NULL,
  `currency` VARCHAR(3) DEFAULT 'USD',
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
  -- FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  INDEX `idx_pm_org` (`organization_id`),
  -- INDEX `idx_pm_admin` (`admin_id`),
  INDEX `idx_pm_gateway` (`gateway_customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================
-- 8. ADMIN ROLES (3-Level Admin System)
-- =====================================================

CREATE TABLE `admin_roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plan_id` int(11) DEFAULT NULL COMMENT 'Link to subscription plan',
  `name` varchar(50) NOT NULL COMMENT 'super_admin, owner_admin, basic_admin',
  `role_level` tinyint(1) NOT NULL DEFAULT 3 COMMENT '1=Super Admin, 2=Owner, 3=Manager',
  `description` text DEFAULT NULL,
  `permissions` json NOT NULL COMMENT 'Key-value pairs of allowed features',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE SET NULL,
  INDEX `idx_role_name` (`name`),
  INDEX `idx_role_level` (`role_level`),
  UNIQUE KEY `uk_role_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 9. ADMINS (Users who manage the system)
-- =====================================================

CREATE TABLE `admins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) DEFAULT NULL,
  `role_id` int(11) NOT NULL DEFAULT 3,
  `role_level` tinyint(1) DEFAULT 3 COMMENT '1=Super Admin, 2=Owner, 3=Manager',
  `subscription_id` int(11) DEFAULT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `profile` varchar(255) DEFAULT 'admin_default.jpg',
  `gender` enum('male','female','other') DEFAULT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(191) NOT NULL,
  `payment_status` ENUM('pending', 'completed', 'none', 'failed') DEFAULT 'none',
  `plan_selected` VARCHAR(50) NULL,
  `billing_cycle` VARCHAR(20) NULL,
  `pending_amount` DECIMAL(10,2) NULL,
  `new_email` varchar(191) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `password_reset_token` varchar(191) DEFAULT NULL,
  `password_reset_expires_at` timestamp NULL DEFAULT NULL,
  `verification_code` varchar(6) DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  `code_expiry_time` datetime DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT 0 COMMENT 'Main admin for the organization',
  `transferred_from_admin_id` int(11) DEFAULT NULL COMMENT 'When ownership is transferred, track previous owner',
  `ownership_transferred_at` timestamp NULL DEFAULT NULL,
  `last_password_change` timestamp NULL DEFAULT NULL,
  `failed_login_attempts` int(11) DEFAULT 0,
  `account_locked_until` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `auth_provider` enum('email','google','both') DEFAULT 'email',
  `google_connected_at` TIMESTAMP NULL,
  `deletion_scheduled_at` TIMESTAMP NULL,
  `google_id` varchar(255) DEFAULT NULL,
  `is_public` tinyint(1) DEFAULT 0 COMMENT 'Whether profile is visible to other admins',
  `bio` text DEFAULT NULL COMMENT 'Short biography',
  `location` varchar(255) DEFAULT NULL COMMENT 'User location',
  `website` varchar(255) DEFAULT NULL COMMENT 'Personal website',
  `twitter` varchar(100) DEFAULT NULL COMMENT 'Twitter/X username',
  `facebook` varchar(255) DEFAULT NULL COMMENT 'Facebook profile URL or username',
  `instagram` varchar(100) DEFAULT NULL COMMENT 'Instagram username',
  `linkedin` varchar(255) DEFAULT NULL COMMENT 'LinkedIn profile URL',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`role_id`) REFERENCES `admin_roles`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`transferred_from_admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `uk_admin_email` (`email`),
  UNIQUE KEY `uk_admin_username` (`username`),
  UNIQUE KEY `uk_google_id` (`google_id`),
  INDEX `idx_admin_org` (`organization_id`),
  INDEX `idx_admin_role` (`role_id`),
  INDEX `idx_admin_role_level` (`role_level`),
  INDEX `idx_admin_email` (`email`),
  INDEX `idx_admin_primary` (`is_primary`),
  INDEX `idx_admin_active` (`is_active`),
  INDEX `idx_admin_google` (`google_id`),
  INDEX `idx_admin_is_public` (`is_public`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 10. ORGANIZATION TRANSFER HISTORY
-- =====================================================

CREATE TABLE `organization_transfer_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `from_admin_id` int(11) NOT NULL,
  `to_admin_id` int(11) NOT NULL,
  `transferred_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `transferred_by` int(11) NOT NULL COMMENT 'Admin who performed the transfer',
  `ip_address` varchar(45) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`from_admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`to_admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`transferred_by`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  INDEX `idx_transfer_org` (`organization_id`),
  INDEX `idx_transfer_from` (`from_admin_id`),
  INDEX `idx_transfer_to` (`to_admin_id`),
  INDEX `idx_transfer_date` (`transferred_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 11. ADMIN SESSIONS
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
-- 12. PASSWORD RESET TOKENS
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
-- 13. DEVICES
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
  `status` enum('active','inactive','lost','maintenance') DEFAULT 'active',
  `is_online` tinyint(1) DEFAULT 0,
  `firmware_version` varchar(50) DEFAULT NULL,
  `battery_level` int(11) DEFAULT NULL COMMENT 'Percentage for battery-powered devices',
  `signal_strength` int(11) DEFAULT NULL COMMENT 'RSSI value',
  `added_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`added_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  UNIQUE KEY `uk_device_unique_id` (`unique_device_id`),
  INDEX `idx_device_org` (`organization_id`),
  INDEX `idx_device_status` (`status`),
  INDEX `idx_device_last_seen` (`last_seen`),
  INDEX `idx_device_online` (`is_online`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 14. DEVICE STORE (Inventory/Store Management)
-- =====================================================

CREATE TABLE `device_store` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `device_id` int(11) DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `product_sku` varchar(100) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `minimum_stock` int(11) DEFAULT 0 COMMENT 'Alert when quantity falls below this',
  `maximum_stock` int(11) DEFAULT NULL,
  `unit_price` decimal(10,2) DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT NULL,
  `supplier` varchar(255) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL COMMENT 'Storage location',
  `status` enum('in_stock','low_stock','out_of_stock','discontinued') DEFAULT 'in_stock',
  `last_restocked_at` timestamp NULL DEFAULT NULL,
  `last_restocked_by` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`last_restocked_by`) REFERENCES `admins`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  UNIQUE KEY `uk_product_sku` (`product_sku`),
  INDEX `idx_store_org` (`organization_id`),
  INDEX `idx_store_device` (`device_id`),
  INDEX `idx_store_status` (`status`),
  INDEX `idx_store_category` (`category`),
  INDEX `idx_store_sku` (`product_sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 15. STOCK TRANSACTIONS
-- =====================================================

CREATE TABLE `stock_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `store_id` int(11) NOT NULL,
  `organization_id` int(11) NOT NULL,
  `admin_id` int(11) NOT NULL,
  `transaction_type` enum('add','remove','adjust','restock','return','damaged') NOT NULL,
  `quantity` int(11) NOT NULL,
  `previous_quantity` int(11) NOT NULL,
  `new_quantity` int(11) NOT NULL,
  `reason` text DEFAULT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`store_id`) REFERENCES `device_store`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  INDEX `idx_transaction_store` (`store_id`),
  INDEX `idx_transaction_org` (`organization_id`),
  INDEX `idx_transaction_admin` (`admin_id`),
  INDEX `idx_transaction_type` (`transaction_type`),
  INDEX `idx_transaction_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 16. WIFI CREDENTIALS
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
-- 17. DEVICE LOCATIONS
-- =====================================================

CREATE TABLE `device_locations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `device_id` int(11) NOT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `address` text DEFAULT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE,
  INDEX `idx_location_device` (`device_id`),
  INDEX `idx_location_recorded` (`recorded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 18. DEVICE STATUS HISTORY
-- =====================================================

CREATE TABLE `device_status_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `device_id` int(11) NOT NULL,
  `status` varchar(50) NOT NULL,
  `is_online` tinyint(1) DEFAULT 0,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `duration` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE,
  INDEX `idx_status_device` (`device_id`),
  INDEX `idx_status_changed` (`changed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 19. USERS (Students/Employees)
-- =====================================================

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `image` varchar(255) DEFAULT 'user_default.jpg',
  `payment_status` ENUM('paid', 'pending', 'not_paid') DEFAULT 'pending',
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
  INDEX `idx_payment_status` (`payment_status`),
  INDEX `idx_user_role` (`role`),
  INDEX `idx_user_active` (`is_active`),
  INDEX `idx_user_card` (`card_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 20. SECTIONS (For Schools)
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
-- 21. CLASSES (For Schools)
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
-- 22. STUDENTS (Extended info)
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
-- 23. DEPARTMENTS (For Companies)
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
-- 24. POSITIONS (For Companies)
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
-- 25. EMPLOYEES (Extended info)
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
-- 26. CARD ACTIONS
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
-- 27. ATTENDANCE RECORDS
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
-- 28. ATTENDANCE DAILY SUMMARY
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
-- 29. ATTENDANCE MONTHLY SUMMARY
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
-- 30. ATTENDANCE TYPES
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
  `affects_attendance_percentage` tinyint(1) DEFAULT 1,
  `is_paid` tinyint(1) DEFAULT 1,
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
-- 31. ATTENDANCE SCHEDULES
-- =====================================================

CREATE TABLE `schedules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `type` enum('check_in','check_out','both') NOT NULL DEFAULT 'both',
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `days_of_week` json NOT NULL,
  `grace_minutes` int(11) DEFAULT 0,
  `late_threshold_minutes` int(11) DEFAULT 15,
  `early_leave_threshold_minutes` int(11) DEFAULT 15,
  `is_active` tinyint(1) DEFAULT 1,
  `device_ids` json DEFAULT NULL,
  `target_type` enum('all','departments','positions','sections','classes','specific_users') NOT NULL DEFAULT 'all',
  `target_ids` json DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  INDEX `idx_schedule_org` (`organization_id`),
  INDEX `idx_schedule_active` (`is_active`),
  INDEX `idx_schedule_type` (`type`),
  INDEX `idx_schedule_target_type` (`target_type`),
  INDEX `idx_schedule_org_active` (`organization_id`, `is_active`),
  INDEX `idx_schedule_org_type` (`organization_id`, `type`),
  INDEX `idx_schedule_created` (`created_by`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 32. NOTIFICATIONS
-- =====================================================

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `admin_id` int(11) DEFAULT NULL COMMENT 'Target admin (NULL for all admins)',
  `user_id` int(11) DEFAULT NULL COMMENT 'Target user',
  `type` enum('system','attendance','device','subscription','report','alert','reminder','custom') NOT NULL,
  `priority` enum('low','normal','high','urgent') DEFAULT 'normal',
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `data` json DEFAULT NULL COMMENT 'Additional notification data',
  `is_read` tinyint(1) DEFAULT 0,
  `is_sent` tinyint(1) DEFAULT 1,
  `sent_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` timestamp NULL DEFAULT NULL,
  `action_url` varchar(500) DEFAULT NULL,
  `action_text` varchar(100) DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  INDEX `idx_notif_org` (`organization_id`),
  INDEX `idx_notif_admin` (`admin_id`),
  INDEX `idx_notif_user` (`user_id`),
  INDEX `idx_notif_type` (`type`),
  INDEX `idx_notif_priority` (`priority`),
  INDEX `idx_notif_read` (`is_read`),
  INDEX `idx_notif_created` (`created_at`),
  INDEX `idx_notif_sent` (`sent_at`),
  INDEX `idx_notif_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 33. NOTIFICATION PREFERENCES (For admin preferences)
-- =====================================================

CREATE TABLE IF NOT EXISTS `notification_preferences` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) NOT NULL,
  `organization_id` int(11) NOT NULL,
  `push_enabled` tinyint(1) DEFAULT 1,
  `email_enabled` tinyint(1) DEFAULT 0,
  `sound_enabled` tinyint(1) DEFAULT 1,
  `types` json DEFAULT NULL COMMENT 'Per-type enable/disable',
  `priorities` json DEFAULT NULL COMMENT 'Per-priority enable/disable',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_prefs` (`admin_id`, `organization_id`),
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  INDEX `idx_prefs_admin` (`admin_id`),
  INDEX `idx_prefs_org` (`organization_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 34. NOTIFICATION DEVICES (Push notifications)
-- =====================================================

CREATE TABLE `notification_devices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) NOT NULL,
  `device_token` varchar(500) NOT NULL,
  `platform` enum('ios','android','web') NOT NULL,
  `device_name` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  INDEX `idx_notif_device_admin` (`admin_id`),
  INDEX `idx_notif_device_token` (`device_token`(191)),
  INDEX `idx_notif_device_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 35. REPORTS
-- =====================================================

CREATE TABLE `reports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `type` enum('attendance','device','user','subscription','financial','custom','analytics') NOT NULL,
  `format` enum('pdf','excel','csv','json') DEFAULT 'pdf',
  `filters` json DEFAULT NULL COMMENT 'Applied filters for the report',
  `data` json DEFAULT NULL COMMENT 'Cached report data',
  `file_path` varchar(500) DEFAULT NULL,
  `file_size` int(11) DEFAULT NULL COMMENT 'File size in bytes',
  `status` enum('pending','processing','completed','failed','expired') DEFAULT 'pending',
  `is_scheduled` tinyint(1) DEFAULT 0,
  `schedule_cron` varchar(100) DEFAULT NULL COMMENT 'Cron expression for scheduled reports',
  `last_generated_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `download_count` int(11) DEFAULT 0,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON DELETE RESTRICT,
  INDEX `idx_report_org` (`organization_id`),
  INDEX `idx_report_created_by` (`created_by`),
  INDEX `idx_report_type` (`type`),
  INDEX `idx_report_status` (`status`),
  INDEX `idx_report_scheduled` (`is_scheduled`),
  INDEX `idx_report_created` (`created_at`),
  INDEX `idx_report_last_generated` (`last_generated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 36. REPORT SHARES
-- =====================================================

CREATE TABLE `report_shares` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `report_id` int(11) NOT NULL,
  `shared_with_admin_id` int(11) NOT NULL,
  `shared_by` int(11) NOT NULL,
  `permission` enum('view','download','manage') DEFAULT 'view',
  `share_token` varchar(255) NOT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`shared_with_admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`shared_by`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_share_token` (`share_token`),
  INDEX `idx_share_report` (`report_id`),
  INDEX `idx_share_admin` (`shared_with_admin_id`),
  INDEX `idx_share_token` (`share_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 37. FEEDBACK
-- =====================================================

CREATE TABLE `feedback` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `admin_id` int(11) DEFAULT NULL COMMENT 'Admin who gave feedback',
  `user_id` int(11) DEFAULT NULL COMMENT 'User who gave feedback',
  `type` enum('bug','feature_request','improvement','general','complaint','praise') NOT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `rating` int(1) DEFAULT NULL COMMENT '1-5 rating',
  `status` enum('pending','reviewed','planned','in_progress','completed','rejected','closed') DEFAULT 'pending',
  `priority` enum('low','medium','high','critical') DEFAULT 'medium',
  `attachments` json DEFAULT NULL COMMENT 'Array of file URLs',
  `page_url` varchar(500) DEFAULT NULL COMMENT 'Page where feedback was given',
  `browser_info` text DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL COMMENT 'Admin assigned to handle this feedback',
  `resolution_notes` text DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `is_public` tinyint(1) DEFAULT 0 COMMENT 'Whether to show in public roadmap',
  `votes` int(11) DEFAULT 0 COMMENT 'Number of upvotes',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assigned_to`) REFERENCES `admins`(`id`) ON DELETE SET NULL,
  INDEX `idx_feedback_org` (`organization_id`),
  INDEX `idx_feedback_admin` (`admin_id`),
  INDEX `idx_feedback_user` (`user_id`),
  INDEX `idx_feedback_type` (`type`),
  INDEX `idx_feedback_status` (`status`),
  INDEX `idx_feedback_priority` (`priority`),
  INDEX `idx_feedback_rating` (`rating`),
  INDEX `idx_feedback_created` (`created_at`),
  INDEX `idx_feedback_assigned` (`assigned_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 38. FEEDBACK COMMENTS
-- =====================================================

CREATE TABLE `feedback_comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `feedback_id` int(11) NOT NULL,
  `admin_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `comment` text NOT NULL,
  `attachments` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`feedback_id`) REFERENCES `feedback`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_feedback_comment_feedback` (`feedback_id`),
  INDEX `idx_feedback_comment_admin` (`admin_id`),
  INDEX `idx_feedback_comment_user` (`user_id`),
  INDEX `idx_feedback_comment_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 39. FEEDBACK_VOTES (For upvoting feedback)
-- =====================================================

CREATE TABLE `feedback_votes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `feedback_id` int(11) NOT NULL,
  `admin_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `vote` tinyint(1) DEFAULT 1 COMMENT '1 for upvote',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`feedback_id`) REFERENCES `feedback`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_feedback_vote` (`feedback_id`, `admin_id`, `user_id`),
  INDEX `idx_feedback_vote_feedback` (`feedback_id`),
  INDEX `idx_feedback_vote_admin` (`admin_id`),
  INDEX `idx_feedback_vote_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 40. LIVE VIEW SESSIONS
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
-- 41. ACTIVITY LOGS (Audit trail)
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

-- =====================================================
-- 42. PAYMENTS
-- =====================================================
CREATE TABLE payments (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `organization_id` INT NOT NULL,
  `subscription_id` INT NULL,
  `invoice_id` INT NULL,
  `gateway` ENUM('stripe','flutterwave') NOT NULL,
  `gateway_transaction_id` VARCHAR(255),
  `amount` DECIMAL(10,2) NOT NULL,
  `payment_intent_id` VARCHAR(255) NULL,
  `refund_id` VARCHAR(255) NULL,
  `failure_code` VARCHAR(100) NULL,
  `failure_message` TEXT NULL,
  `metadata` JSON NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
  `exchange_rate` decimal(10,6) DEFAULT NULL,
  `base_amount_usd` decimal(10,2) DEFAULT NULL,
  `base_currency` varchar(3) DEFAULT 'USD',
  `status` ENUM('pending','success','failed') DEFAULT 'pending',
  `paid_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);


-- =====================================================
-- 43. UNREGISTERED CARD SCANS
-- =====================================================

CREATE TABLE `unregistered_card_scans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `card_id` varchar(50) NOT NULL,
  `device_id` varchar(100) DEFAULT NULL,
  `scanned_at` datetime NOT NULL,
  `is_notified` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  INDEX `idx_org_notified` (`organization_id`, `is_notified`),
  INDEX `idx_scanned_at` (`scanned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================
-- 44. HARDWARE ORDERS
-- =====================================================

CREATE TABLE IF NOT EXISTS `hardware_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_number` varchar(50) NOT NULL,
  `organization_id` int(11) DEFAULT NULL,
  `admin_id` int(11) NOT NULL,
  `payment_intent_id` VARCHAR(255) NULL,
  `status` enum('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
  `subtotal` decimal(10,2) NOT NULL,
  `shipping_cost` decimal(10,2) DEFAULT 0.00,
  `tax` decimal(10,2) DEFAULT 0.00,
  `total` decimal(10,2) NOT NULL,
  `shipping_method` varchar(50) DEFAULT NULL,
  `tracking_number` varchar(100) DEFAULT NULL,
  `customer_name` varchar(255) NOT NULL,
  `customer_email` varchar(255) NOT NULL,
  `customer_phone` varchar(50) NOT NULL,
  `shipping_address` text NOT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `payment_status` enum('pending','completed','failed','refunded') DEFAULT 'pending',
  `plan_selected` VARCHAR(50) NULL,
  `billing_cycle` VARCHAR(20) NULL,
  `pending_amount` DECIMAL(10,2) NULL,
  `payment_gateway` varchar(50) DEFAULT NULL,
  `gateway_transaction_id` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_number` (`order_number`),
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  INDEX `idx_order_status` (`status`),
  INDEX `idx_order_org` (`organization_id`),
  INDEX `idx_order_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 45. HARDWARE ORDERS ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS `hardware_order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `product_id` varchar(100) DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `product_sku` varchar(100) DEFAULT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`order_id`) REFERENCES `hardware_orders`(`id`) ON DELETE CASCADE,
  INDEX `idx_item_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;














ALTER TABLE payment_methods
ADD CONSTRAINT fk_pm_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
ADD INDEX idx_pm_admin (admin_id);


-- Ensure notifications table has proper indexes for performance
ALTER TABLE `notifications`
ADD INDEX `idx_notif_org_admin` (`organization_id`, `admin_id`),
ADD INDEX `idx_notif_org_read` (`organization_id`, `is_read`),
ADD INDEX `idx_notif_org_created` (`organization_id`, `created_at`),
ADD INDEX `idx_notif_org_priority` (`organization_id`, `priority`, `created_at`);




-- Add indexes for Stripe lookups
CREATE INDEX idx_org_stripe_customer ON organizations(stripe_customer_id);
CREATE INDEX idx_sub_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_payments_gateway_transaction ON payments(gateway_transaction_id);
CREATE INDEX idx_payments_intent ON payments(payment_intent_id);
CREATE INDEX idx_payments_status ON payments(status);





-- =====================================================
-- INSERT DEFAULT ADMIN ROLES super_admin, owner_admin, basic_admin
-- =====================================================

INSERT INTO `admin_roles` (`id`, `plan_id`, `name`, `role_level`, `description`, `permissions`) VALUES
(1, NULL, 'super_admin', 1, 'Global system control - Full access to ALL organizations. Only for developers/internal team.', 
'{"level": 1, "permissions": ["full_system_control", "manage_all_orgs", "manage_all_admins", "view_all_data", "edit_everything", "create_orgs", "assign_plans", "delete_orgs"]}'),

(2, NULL, 'owner_admin', 2, 'Organization owner - Full control inside one organization. One per organization.',
'{"level": 2, "permissions": ["full_org_control", "manage_admins", "manage_billing", "manage_subscription", "delete_org", "transfer_ownership", "manage_users", "manage_devices", "manage_attendance", "view_reports"]}'),

(3, NULL, 'basic_admin', 3, 'Manager level - Limited access. Multiple allowed per organization (up to plan limit).',
'{"level": 3, "permissions": ["manage_users", "manage_devices", "manage_attendance", "view_reports"], "restrictions": ["cannot_delete_org", "cannot_manage_subscription", "cannot_create_higher_admins", "cannot_remove_owner"]}');


-- =====================================================
-- INSERT SUBSCRIPTION PLANS DATA
-- =====================================================

INSERT INTO `subscription_plans` (
    `name`, `display_name`, `description`, `price_monthly`, `price_yearly`, 
    `currency`, `max_users`, `max_devices`, `max_admins`, `analytics_level`, 
    `dashboard_level`, `api_access`, `api_rate_limit`, `custom_reports`, 
    `custom_branding`, `support_level`, `live_view_enabled`, `live_view_duration`, 
    `export_data`, `webhooks`, `is_active`, `sort_order`
) VALUES
('free', 'Free Trial', 'Try our basic features for free', 0.00, 0.00, 'USD', 200, 1, 1, 'basic', 'basic', 0, 100, 0, 0, 'email', 1, 60, 0, 1, 1, 0),
('basic', 'Basic Plan', 'Essential features for small schools', 15.00, 135.00, 'USD', 1000, 2, 2, 'basic', 'basic', 1, 500, 0, 1, 'email', 1, 120, 1, 1, 1, 1),
('professional', 'Professional Plan', 'Advanced features for growing schools', 50.00, 450.00, 'USD', 2000, 5, 3, 'advanced', 'advanced', 1, 1000, 1, 1, 'priority', 1, 240, 1, 1, 1, 2),
('enterprise', 'Enterprise Plan', 'Complete solution for large institutions', 199.00, 1791.00, 'USD', NULL, 15, 5, 'premium', 'premium', 1, 5000, 1, 1, '24/7', 1, 480, 1, 1, 1, 3),
('company_free', 'Company Free Trial', 'Try our basic features for free', 0.00, 0.00, 'USD', 50, 1, 1, 'basic', 'basic', 0, 100, 0, 0, 'email', 1, 60, 0, 1, 1, 4),
('company_basic', 'Company Basic Plan', 'Essential features for small businesses', 20.00, 180.00, 'USD', 100, 2, 2, 'basic', 'basic', 1, 500, 0, 1, 'email', 1, 120, 1, 1, 1, 5),
('company_professional', 'Company Professional Plan', 'Advanced features for growing companies', 60.00, 540.00, 'USD', 500, 5, 3, 'advanced', 'advanced', 1, 1000, 1, 1, 'priority', 1, 240, 1, 1, 1, 6),
('company_enterprise', 'Company Enterprise Plan', 'Complete solution for large enterprises', 160.00, 1440.00, 'USD', NULL, 10, 5, 'premium', 'premium', 1, 5000, 1, 1, '24/7', 1, 480, 1, 1, 1, 7);

-- Insert multi-currency prices
INSERT INTO `subscription_plan_prices` (`plan_id`, `currency`, `price_monthly`, `price_yearly`) VALUES
(1, 'USD', 0.00, 0.00), (1, 'RWF', 0.00, 0.00), (1, 'EUR', 0.00, 0.00), (1, 'GBP', 0.00, 0.00),
(2, 'USD', 15.00, 135.00), (2, 'RWF', 19500.00, 175500.00), (2, 'EUR', 13.95, 125.55), (2, 'GBP', 11.85, 106.65),
(3, 'USD', 50.00, 450.00), (3, 'RWF', 65000.00, 585000.00), (3, 'EUR', 46.50, 418.50), (3, 'GBP', 39.50, 355.50),
(4, 'USD', 199.00, 1791.00), (4, 'RWF', 258700.00, 2328300.00), (4, 'EUR', 185.07, 1665.63), (4, 'GBP', 157.21, 1414.89),
(5, 'USD', 0.00, 0.00), (5, 'RWF', 0.00, 0.00), (5, 'EUR', 0.00, 0.00), (5, 'GBP', 0.00, 0.00),
(6, 'USD', 20.00, 180.00), (6, 'RWF', 26000.00, 234000.00), (6, 'EUR', 18.60, 167.40), (6, 'GBP', 15.80, 142.20),
(7, 'USD', 60.00, 540.00), (7, 'RWF', 78000.00, 702000.00), (7, 'EUR', 55.80, 502.20), (7, 'GBP', 47.40, 426.60),
(8, 'USD', 160.00, 1440.00), (8, 'RWF', 208000.00, 1872000.00), (8, 'EUR', 148.80, 1339.20), (8, 'GBP', 126.40, 1137.60);

-- Insert currencies
INSERT INTO `currencies` (`code`, `name`, `symbol`, `rate_to_usd`) VALUES
('USD', 'US Dollar', '$', 1.000000),
('RWF', 'Rwandan Franc', 'FRw', 1300.000000),
('EUR', 'Euro', '€', 0.930000),
('GBP', 'British Pound', '£', 0.790000);



-- Remove the foreign key constraint
ALTER TABLE device_store DROP FOREIGN KEY device_store_ibfk_1;

-- Make organization_id nullable
ALTER TABLE device_store MODIFY organization_id INT NULL;



-- First create a default organization
INSERT INTO `organizations` (
    `org_name`, `type`, `page_slug`, `subscription_status`, 
    `contact_email`, `max_admins_allowed`
) VALUES (
    'Default Organization', 'school', 'default-org', 'active',
    'admin@example.com', 5
);

-- Then create a default admin (assuming organization_id = 1)
INSERT INTO `admins` (
    `organization_id`, `role_id`, `role_level`, `first_name`, `last_name`,
    `username`, `email`, `password_hash`, `is_verified`, `is_active`, `is_primary`
) VALUES (
    1, 1, 1, 'Super', 'Admin', 'superadmin', 'tieflab@csm.com',
    '$2a$15$tiEo7e0nUp1moTeKr6lthuawubD1wtN8R9R0w6VGrnXQ2s/u9urrK', -- "15 hashing password  I,love Daniel"
    1, 1, 1
);

-- Now insert device store items
INSERT INTO `device_store` (
    `organization_id`, `product_name`, `product_sku`, `category`,
    `quantity`, `minimum_stock`, `unit_price`, `purchase_price`,
    `status`, `notes`, `created_by`
) VALUES
(NULL, 'Device FingerPrint + Card Reader', 'FP-CARD-001', 'Biometric Devices',
 50, 10, 99.00, 75.00, 'in_stock', 
 'Combined fingerprint scanner and card reader device', 1),

(NULL, 'Device FingerPrint Only', 'FP-ONLY-002', 'Biometric Devices',
 75, 15, 90.00, 65.00, 'in_stock',
 'Standalone fingerprint scanner device', 1);

-- Add more hardware products to device_store
INSERT INTO `device_store` (`organization_id`, `product_name`, `product_sku`, `category`, `quantity`, `minimum_stock`, `unit_price`, `purchase_price`, `status`, `notes`, `created_by`) VALUES
(NULL, 'CSM Protective Case', 'CSM-CASE-001', 'Accessories', 200, 20, 25.00, 15.00, 'in_stock', 'Durable protective case for CSM devices', 1),
(NULL, 'CSM Desktop Stand', 'CSM-STAND-001', 'Accessories', 150, 15, 15.00, 8.00, 'in_stock', 'Adjustable desktop stand', 1),
(NULL, 'CSM Power Supply Kit', 'CSM-POWER-001', 'Accessories', 300, 30, 12.00, 6.00, 'in_stock', '5V/2A power supply with international plugs', 1);



UPDATE device_store SET organization_id = NULL;

SELECT 'Database schema created successfully!' AS status;
