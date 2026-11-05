import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import { v4 as uuidv4 } from 'uuid'

dotenv.config()

let pool

/**
 * Initialize database connection pool
 */
export async function initializeDatabase() {
  pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rms_database',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
  })

  const [ownerRole] = await pool.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`
  )
  if (ownerRole[0] && ['property_owner', 'housekeeping', 'catering'].some((role) => !ownerRole[0].COLUMN_TYPE.includes(`'${role}'`))) {
    await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('customer', 'admin', 'cashier', 'property_owner', 'housekeeping', 'catering') NOT NULL DEFAULT 'customer'")
  }

  // Prevent silent crashes when idle connections are closed by MySQL
  pool.on('connection', (connection) => {
    connection.on('error', (err) => {
      console.error('MySQL connection error:', err);
    });
  });

  pool.on('error', (err) => {
    console.error('MySQL pool error:', err);
  });

  for (const { table, index } of [
    { table: 'properties', index: 'idx_properties_sync_updated' },
    { table: 'bookings', index: 'idx_bookings_sync_updated' },
    { table: 'payments', index: 'idx_payments_sync_updated' },
  ]) {
    const [existingIndex] = await pool.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`, [table, index]
    )
    if (!existingIndex.length) await pool.query(`ALTER TABLE ${table} ADD INDEX ${index} (updated_at, id)`)
  }


  const [housekeepingColumn] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'housekeeping_status'`
  )
  if (Number(housekeepingColumn[0]?.count || 0) === 0) {
    await pool.query(
      `ALTER TABLE properties
       ADD COLUMN housekeeping_status ENUM('clean', 'dirty', 'maintenance') NOT NULL DEFAULT 'clean'`
    )
  }

  const [serviceTypeColumn] = await pool.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_service_requests' AND COLUMN_NAME = 'service_type'`
  )
  if (serviceTypeColumn[0] && !serviceTypeColumn[0].COLUMN_TYPE.includes("'refreshments'")) {
    await pool.query("ALTER TABLE guest_service_requests MODIFY COLUMN service_type ENUM('food', 'refreshments', 'transport', 'laundry', 'cleaning', 'other') NOT NULL")
  }

  const [propertyImageColumn] = await pool.query(
    `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'property_images' AND COLUMN_NAME = 'image_url'`
  )
  if (propertyImageColumn[0]?.DATA_TYPE !== 'longtext') {
    await pool.query('ALTER TABLE property_images MODIFY COLUMN image_url LONGTEXT NOT NULL')
  }

  const [discountColumns] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'
     AND COLUMN_NAME IN ('discount_code', 'discount_amount')`
  )
  const existingDiscountColumns = new Set(discountColumns.map((column) => column.COLUMN_NAME))
  if (!existingDiscountColumns.has('discount_code')) await pool.query('ALTER TABLE bookings ADD COLUMN discount_code VARCHAR(50)')
  if (!existingDiscountColumns.has('discount_amount')) await pool.query('ALTER TABLE bookings ADD COLUMN discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0')

  const [arrivalWindowColumn] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'arrival_window'`
  )
  if (Number(arrivalWindowColumn[0]?.count || 0) === 0) {
    await pool.query('ALTER TABLE bookings ADD COLUMN arrival_window VARCHAR(50)')
  }
  for (const statement of [
    'ALTER TABLE bookings ADD COLUMN pickup_location VARCHAR(255)',
    'ALTER TABLE bookings ADD COLUMN pickup_time DATETIME',
    'ALTER TABLE bookings ADD COLUMN pickup_notes VARCHAR(500)',
  ]) {
    try { await pool.query(statement) } catch (error) {
      if (!String(error.message).includes('Duplicate column name')) throw error
    }
  }

  await pool.query(`
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
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_addons (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description VARCHAR(255),
      price DECIMAL(10, 2) NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value LONGTEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  const [guestServicePaymentStatusColumn] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_service_requests' AND COLUMN_NAME = 'payment_status'`
  )
  if (!guestServicePaymentStatusColumn.length) {
    await pool.query("ALTER TABLE guest_service_requests ADD COLUMN payment_status ENUM('not_required', 'unpaid', 'pending', 'paid', 'failed') NOT NULL DEFAULT 'not_required' AFTER quoted_amount")
  }
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  const [verifiedByColumn] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_service_payments' AND COLUMN_NAME = 'verified_by'`
  )
  if (!verifiedByColumn.length) {
    await pool.query('ALTER TABLE guest_service_payments ADD COLUMN verified_by VARCHAR(36) NULL AFTER receipt_number')
  }
  const [verifiedByForeignKey] = await pool.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_service_payments'
       AND COLUMN_NAME = 'verified_by' AND REFERENCED_TABLE_NAME = 'users'`
  )
  if (!verifiedByForeignKey.length) {
    await pool.query('ALTER TABLE guest_service_payments ADD CONSTRAINT fk_guest_service_payment_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL')
  }
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  const [walkinPaymentColumns] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'catering_walkin_orders'`
  )
  const walkinPaymentColumnNames = new Set(walkinPaymentColumns.map((column) => column.COLUMN_NAME))
  if (!walkinPaymentColumnNames.has('transaction_ref')) {
    await pool.query('ALTER TABLE catering_walkin_orders ADD COLUMN transaction_ref VARCHAR(255) NULL AFTER receipt_number')
  }
  await pool.query("ALTER TABLE catering_walkin_orders MODIFY COLUMN payment_status ENUM('unpaid', 'pending', 'paid', 'failed') NOT NULL DEFAULT 'unpaid'")
  const [walkinTransactionIndex] = await pool.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'catering_walkin_orders' AND INDEX_NAME = 'uq_catering_walkin_transaction_ref'`
  )
  if (!walkinTransactionIndex.length) {
    await pool.query('ALTER TABLE catering_walkin_orders ADD UNIQUE KEY uq_catering_walkin_transaction_ref (transaction_ref)')
  }
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  const [responseImageColumns] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_service_response_images'`
  )
  const responseImageColumnNames = new Set(responseImageColumns.map((column) => column.COLUMN_NAME))
  if (!responseImageColumnNames.has('guest_response')) {
    await pool.query("ALTER TABLE guest_service_response_images ADD COLUMN guest_response ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending' AFTER caption")
  }
  if (!responseImageColumnNames.has('guest_responded_at')) {
    await pool.query('ALTER TABLE guest_service_response_images ADD COLUMN guest_responded_at DATETIME NULL AFTER guest_response')
  }
  if (!responseImageColumnNames.has('menu_item_id')) {
    await pool.query('ALTER TABLE guest_service_response_images ADD COLUMN menu_item_id VARCHAR(36) NULL AFTER request_id')
    if (responseImageColumnNames.has('image_url')) {
      const [legacyImages] = await pool.query(`SELECT id, caption, image_url FROM guest_service_response_images WHERE image_url IS NOT NULL`)
      for (const legacyImage of legacyImages) {
        const menuItemId = uuidv4()
        await pool.query(`INSERT INTO catering_menu_items (id, item_name, image_url, is_available)
          VALUES (?, ?, ?, TRUE)`, [menuItemId, String(legacyImage.caption || 'Food item').slice(0, 120), legacyImage.image_url])
        await pool.query('UPDATE guest_service_response_images SET menu_item_id = ? WHERE id = ?', [menuItemId, legacyImage.id])
      }
    }
  }
  await pool.query('ALTER TABLE guest_service_response_images MODIFY COLUMN menu_item_id VARCHAR(36) NOT NULL')
  if (responseImageColumnNames.has('image_url')) {
    await pool.query('ALTER TABLE guest_service_response_images DROP COLUMN image_url')
  }
  const [responseImageForeignKeys] = await pool.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_service_response_images'
       AND COLUMN_NAME = 'menu_item_id' AND REFERENCED_TABLE_NAME = 'catering_menu_items'`
  )
  if (!responseImageForeignKeys.length) {
    await pool.query(`ALTER TABLE guest_service_response_images
      ADD CONSTRAINT fk_guest_response_menu_item FOREIGN KEY (menu_item_id) REFERENCES catering_menu_items(id) ON DELETE RESTRICT`)
  }
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_password_reset_codes (
      user_id VARCHAR(36) PRIMARY KEY,
      code_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      KEY idx_staff_reset_expiry (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  const [settingValueColumn] = await pool.query(
    `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_settings' AND COLUMN_NAME = 'setting_value'`
  )
  if (settingValueColumn[0]?.DATA_TYPE !== 'longtext') {
    await pool.query('ALTER TABLE system_settings MODIFY COLUMN setting_value LONGTEXT NOT NULL')
  }
  await pool.query(
    "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('brand_color', '#176b52'), ('brand_name', 'CozyStay'), ('brand_logo', ''), ('business_phone', '+254 700 000000'), ('business_email', 'support@rms-rentals.com')"
  )
  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking_addons (
      id VARCHAR(36) PRIMARY KEY,
      booking_id VARCHAR(36) NOT NULL,
      addon_id VARCHAR(36) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      unit_price DECIMAL(10, 2) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY (addon_id) REFERENCES service_addons(id),
      UNIQUE KEY unique_booking_addon (booking_id, addon_id)
    )
  `)
  for (const statement of [
    "ALTER TABLE booking_addons ADD COLUMN status ENUM('pending', 'approved', 'declined', 'fulfilled') NOT NULL DEFAULT 'pending'",
    'ALTER TABLE booking_addons ADD COLUMN approved_by VARCHAR(36)',
    'ALTER TABLE booking_addons ADD COLUMN fulfilled_at DATETIME',
    'ALTER TABLE booking_addons ADD COLUMN assigned_to VARCHAR(36)',
    "ALTER TABLE booking_addons ADD COLUMN fulfillment_status ENUM('pending', 'assigned', 'en_route', 'arrived', 'completed') NOT NULL DEFAULT 'pending'",
  ]) {
    try { await pool.query(statement) } catch (error) {
      if (!String(error.message).includes('Duplicate column name')) throw error
    }
  }
  await pool.query(
    `INSERT IGNORE INTO service_addons (id, name, description, price) VALUES
      ('addon-cleaning', 'Fresh cleaning', 'A scheduled cleaning during your stay', 1200),
      ('addon-laundry', 'Laundry bundle', 'Wash and fold up to one standard bag', 800),
      ('addon-airport', 'Airport pickup', 'Pre-arranged pickup coordination', 2500),
      ('addon-early-checkin', 'Early check-in', 'Request access from 10:00 AM', 1000),
      ('addon-late-checkout', 'Late checkout', 'Request checkout until 3:00 PM', 1000)`
  )

  console.log('Database connection pool initialized')
  return pool
}

/**
 * Get database connection pool
 */
export function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.')
  }
  return pool
}

/**
 * Execute query with prepared statement (prevents SQL injection)
 */
export async function query(sql, values = []) {
  const connection = await getPool().getConnection()
  try {
    const [results] = await connection.execute(sql, values)
    return results
  } finally {
    connection.release()
  }
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction(callback) {
  const connection = await getPool().getConnection()
  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/**
 * Close database pool
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end()
    console.log('Database connection pool closed')
  }
}

export default {
  initializeDatabase,
  getPool,
  query,
  transaction,
  closeDatabase,
}
