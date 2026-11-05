-- RMS House Rental & Booking Management System - MySQL Schema
-- Central database (source of truth)
-- Created: 2026-09-02

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role ENUM('customer', 'admin', 'cashier', 'property_owner', 'housekeeping', 'catering') NOT NULL DEFAULT 'customer',
  status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  password_hash VARCHAR(255) NOT NULL,
  profile_image_url VARCHAR(500),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  otp_code VARCHAR(6),
  otp_expires_at DATETIME,
  last_login DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_email (email),
  KEY idx_role (role),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One active, hashed, short-lived recovery code per staff account.
CREATE TABLE IF NOT EXISTS staff_password_reset_codes (
  user_id VARCHAR(36) PRIMARY KEY,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_staff_reset_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id VARCHAR(36) PRIMARY KEY,
  owner_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('one_bedroom', 'airbnb', 'single_room', 'bedsitter', 'bnb') NOT NULL,
  description LONGTEXT,
  address VARCHAR(500) NOT NULL,
  city VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  price_per_night DECIMAL(10, 2) NOT NULL,
  price_per_week DECIMAL(10, 2),
  price_per_month DECIMAL(10, 2),
  capacity INT NOT NULL DEFAULT 1,
  bedrooms INT,
  bathrooms INT,
  status ENUM('available', 'booked', 'maintenance', 'inactive') NOT NULL DEFAULT 'available',
  housekeeping_status ENUM('clean', 'dirty', 'maintenance') NOT NULL DEFAULT 'clean',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_owner (owner_id),
  KEY idx_status (status),
  KEY idx_city (city),
  KEY idx_properties_sync_updated (updated_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Property Images table
CREATE TABLE IF NOT EXISTS property_images (
  id VARCHAR(36) PRIMARY KEY,
  property_id VARCHAR(36) NOT NULL,
  image_url LONGTEXT NOT NULL,
  is_cover BOOLEAN DEFAULT FALSE,
  display_order INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  KEY idx_property (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id VARCHAR(36) PRIMARY KEY,
  property_id VARCHAR(36) NOT NULL,
  task_type ENUM('cleaning', 'maintenance') NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  priority ENUM('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
  status ENUM('open', 'in_progress', 'completed') NOT NULL DEFAULT 'open',
  assigned_to VARCHAR(36),
  created_by VARCHAR(36),
  completed_by VARCHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_housekeeping_status (status, priority, created_at),
  KEY idx_housekeeping_property (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Amenities table
CREATE TABLE IF NOT EXISTS amenities (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(50),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Property Amenities junction table
CREATE TABLE IF NOT EXISTS property_amenities (
  property_id VARCHAR(36) NOT NULL,
  amenity_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (property_id, amenity_id),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (amenity_id) REFERENCES amenities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(36) PRIMARY KEY,
  property_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  number_of_guests INT NOT NULL DEFAULT 1,
  total_amount DECIMAL(10, 2) NOT NULL,
  discount_code VARCHAR(50),
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status ENUM('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled') NOT NULL DEFAULT 'pending',
  source ENUM('website', 'pos', 'admin') NOT NULL DEFAULT 'website',
  special_requests TEXT,
  arrival_window VARCHAR(50),
  pickup_location VARCHAR(255),
  pickup_time DATETIME,
  pickup_notes VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_property (property_id),
  KEY idx_customer (customer_id),
  KEY idx_status (status),
  KEY idx_check_in (check_in_date),
  KEY idx_source (source),
  KEY idx_bookings_sync_updated (updated_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guest_service_requests (
  id VARCHAR(36) PRIMARY KEY,
  booking_id VARCHAR(36) NOT NULL,
  property_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  service_type ENUM('food', 'refreshments', 'transport', 'laundry', 'cleaning', 'other') NOT NULL,
  request_details TEXT NOT NULL,
  service_location VARCHAR(255),
  pickup_location VARCHAR(255),
  destination VARCHAR(255),
  requested_for DATETIME,
  quoted_amount DECIMAL(10, 2),
  payment_status ENUM('not_required', 'unpaid', 'pending', 'paid', 'failed') NOT NULL DEFAULT 'not_required',
  status ENUM('requested', 'accepted', 'in_progress', 'completed', 'declined') NOT NULL DEFAULT 'requested',
  staff_notes VARCHAR(1000),
  handled_by VARCHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_guest_service_status (status, created_at),
  KEY idx_guest_service_customer (customer_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guest_service_payments (
  id VARCHAR(36) PRIMARY KEY,
  request_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  method ENUM('mpesa') NOT NULL DEFAULT 'mpesa',
  status ENUM('pending', 'paid', 'failed') NOT NULL DEFAULT 'pending',
  transaction_ref VARCHAR(255),
  phone VARCHAR(20),
  receipt_number VARCHAR(50),
  verified_by VARCHAR(36),
  notes VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES guest_service_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_guest_service_mpesa_reference (transaction_ref),
  KEY idx_guest_service_payment_request (request_id, created_at),
  KEY idx_guest_service_payment_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catering_menu_items (
  id VARCHAR(36) PRIMARY KEY,
  item_name VARCHAR(120) NOT NULL,
  description VARCHAR(500),
  image_url LONGTEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_catering_menu_available (is_available, item_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catering_walkin_orders (
  id VARCHAR(36) PRIMARY KEY,
  guest_name VARCHAR(200) NOT NULL,
  phone VARCHAR(30),
  order_details TEXT NOT NULL,
  quoted_amount DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('cash', 'mpesa') NOT NULL,
  payment_status ENUM('unpaid', 'pending', 'paid', 'failed') NOT NULL DEFAULT 'unpaid',
  receipt_number VARCHAR(20),
  transaction_ref VARCHAR(255),
  status ENUM('accepted', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'accepted',
  handled_by VARCHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_catering_walkin_transaction_ref (transaction_ref),
  KEY idx_catering_walkin_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guest_service_response_images (
  id VARCHAR(36) PRIMARY KEY,
  request_id VARCHAR(36) NOT NULL,
  menu_item_id VARCHAR(36) NOT NULL,
  caption VARCHAR(120) NOT NULL,
  guest_response ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
  guest_responded_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES guest_service_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES catering_menu_items(id) ON DELETE RESTRICT,
  KEY idx_guest_response_image_request (request_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  recipient_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36),
  title VARCHAR(150) NOT NULL,
  message VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'staff_message',
  read_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_recipient_read (recipient_id, read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional local services sold with a booking
CREATE TABLE IF NOT EXISTS service_addons (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255),
  price DECIMAL(10, 2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_addons (
  id VARCHAR(36) PRIMARY KEY,
  booking_id VARCHAR(36) NOT NULL,
  addon_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'approved', 'declined', 'fulfilled') NOT NULL DEFAULT 'pending',
  approved_by VARCHAR(36),
  assigned_to VARCHAR(36),
  fulfillment_status ENUM('pending', 'assigned', 'en_route', 'arrived', 'completed') NOT NULL DEFAULT 'pending',
  fulfilled_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (addon_id) REFERENCES service_addons(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  UNIQUE KEY unique_booking_addon (booking_id, addon_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  booking_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  method ENUM('card', 'mpesa', 'paypal', 'bank_transfer', 'cash') NOT NULL,
  status ENUM('pending', 'paid', 'partially_paid', 'refunded', 'failed') NOT NULL DEFAULT 'pending',
  transaction_ref VARCHAR(255),
  issued_by VARCHAR(36),
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (issued_by) REFERENCES users(id),
  KEY idx_booking (booking_id),
  KEY idx_status (status),
  KEY idx_method (method),
  KEY idx_payments_sync_updated (updated_at, id),
  UNIQUE KEY idx_transaction_ref (transaction_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Receipts table
CREATE TABLE IF NOT EXISTS receipts (
  id VARCHAR(36) PRIMARY KEY,
  payment_id VARCHAR(36) NOT NULL,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  pdf_url VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  KEY idx_payment (payment_id),
  KEY idx_receipt_number (receipt_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shifts table (for POS cashier tracking)
CREATE TABLE IF NOT EXISTS shifts (
  id VARCHAR(36) PRIMARY KEY,
  cashier_id VARCHAR(36) NOT NULL,
  open_time DATETIME NOT NULL,
  close_time DATETIME,
  opening_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  expected_closing_balance DECIMAL(10, 2),
  actual_closing_balance DECIMAL(10, 2),
  transaction_count INT DEFAULT 0,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_cashier (cashier_id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sync Logs table (for tracking sync status across devices)
CREATE TABLE IF NOT EXISTS sync_logs (
  id VARCHAR(36) PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  action VARCHAR(50) NOT NULL,
  status ENUM('pending', 'synced', 'error') NOT NULL DEFAULT 'pending',
  device_id VARCHAR(255),
  error_message TEXT,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_status (status),
  KEY idx_entity (entity_type, entity_id),
  KEY idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(36) PRIMARY KEY,
  property_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  booking_id VARCHAR(36) NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  comment TEXT,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  KEY idx_property (property_id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wishlist table
CREATE TABLE IF NOT EXISTS wishlists (
  id VARCHAR(36) PRIMARY KEY,
  customer_id VARCHAR(36) NOT NULL,
  property_id VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_wishlist (customer_id, property_id),
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  KEY idx_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Trail table
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(36),
  old_value LONGTEXT,
  new_value LONGTEXT,
  ip_address VARCHAR(45),
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_user (user_id),
  KEY idx_timestamp (timestamp),
  KEY idx_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes and constraints are embedded in table definitions above

-- Create views for common queries

-- View: Monthly revenue by property
CREATE OR REPLACE VIEW property_monthly_revenue AS
SELECT 
  p.id,
  p.name,
  YEAR(pay.created_at) as year,
  MONTH(pay.created_at) as month,
  SUM(pay.amount) as total_revenue,
  COUNT(DISTINCT b.id) as booking_count
FROM properties p
LEFT JOIN bookings b ON p.id = b.property_id
LEFT JOIN payments pay ON b.id = pay.booking_id AND pay.status = 'paid'
GROUP BY p.id, YEAR(pay.created_at), MONTH(pay.created_at);

-- View: Occupancy rate
CREATE OR REPLACE VIEW property_occupancy_rate AS
SELECT 
  p.id,
  p.name,
  COUNT(DISTINCT b.id) as total_bookings,
  SUM(DATEDIFF(b.check_out_date, b.check_in_date)) as total_occupied_days,
  ROUND((SUM(DATEDIFF(b.check_out_date, b.check_in_date)) / 365) * 100, 2) as occupancy_percentage
FROM properties p
LEFT JOIN bookings b ON p.id = b.property_id AND b.status IN ('confirmed', 'checked_out')
GROUP BY p.id;
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value LONGTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guest_message_log (
  id VARCHAR(36) PRIMARY KEY,
  booking_id VARCHAR(36) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  status ENUM('sending', 'sent', 'failed') NOT NULL DEFAULT 'sending',
  last_error VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_guest_message_booking_type (booking_id, message_type),
  KEY idx_guest_message_status (status, updated_at),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('brand_color', '#176b52');
INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('brand_name', 'CozyStay'), ('brand_logo', '');
