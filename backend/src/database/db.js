import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

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

  // Prevent silent crashes when idle connections are closed by MySQL
  pool.on('connection', (connection) => {
    connection.on('error', (err) => {
      console.error('MySQL connection error:', err);
    });
  });

  pool.on('error', (err) => {
    console.error('MySQL pool error:', err);
  });


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
