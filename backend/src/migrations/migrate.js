import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('Starting Database Migration...');

  // Connect to MySQL server (create DB if not exists)
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const dbName = process.env.DB_NAME || 'rms_database';
  console.log(`📦 Ensuring database '${dbName}' exists...`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`USE \`${dbName}\`;`);

  // Read schema.sql
  const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('📜 Executing schema.sql statements...');
    await connection.query(schemaSql);
    console.log('Schema migration completed successfully!');
  } else {
    console.error(`Schema file not found at: ${schemaPath}`);
  }

  const [roleColumn] = await connection.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`, [dbName]
  );
  if (roleColumn[0] && ['property_owner', 'housekeeping', 'catering'].some((role) => !roleColumn[0].COLUMN_TYPE.includes(`'${role}'`))) {
    await connection.query("ALTER TABLE users MODIFY COLUMN role ENUM('customer', 'admin', 'cashier', 'property_owner', 'housekeeping', 'catering') NOT NULL DEFAULT 'customer'");
    console.log('Added owner, housekeeping, and catering staff roles.');
  }

  const [serviceTypeColumn] = await connection.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'guest_service_requests' AND COLUMN_NAME = 'service_type'`, [dbName]
  );
  if (serviceTypeColumn[0] && !serviceTypeColumn[0].COLUMN_TYPE.includes("'refreshments'")) {
    await connection.query("ALTER TABLE guest_service_requests MODIFY COLUMN service_type ENUM('food', 'refreshments', 'transport', 'laundry', 'cleaning', 'other') NOT NULL");
    console.log('Added refreshments service requests.');
  }

  const [servicePaymentStatusColumn] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'guest_service_requests' AND COLUMN_NAME = 'payment_status'`, [dbName]
  );
  if (!servicePaymentStatusColumn.length) {
    await connection.query("ALTER TABLE guest_service_requests ADD COLUMN payment_status ENUM('not_required', 'unpaid', 'pending', 'paid', 'failed') NOT NULL DEFAULT 'not_required' AFTER quoted_amount");
  }
  const [verifiedByColumn] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'guest_service_payments' AND COLUMN_NAME = 'verified_by'`, [dbName]
  );
  if (!verifiedByColumn.length) {
    await connection.query('ALTER TABLE guest_service_payments ADD COLUMN verified_by VARCHAR(36) NULL AFTER receipt_number');
  }
  const [verifiedByForeignKey] = await connection.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'guest_service_payments'
       AND COLUMN_NAME = 'verified_by' AND REFERENCED_TABLE_NAME = 'users'`, [dbName]
  );
  if (!verifiedByForeignKey.length) {
    await connection.query('ALTER TABLE guest_service_payments ADD CONSTRAINT fk_guest_service_payment_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL');
  }

  const [guestPhotoResponseColumns] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'guest_service_response_images'
       AND COLUMN_NAME IN ('guest_response', 'guest_responded_at')`, [dbName]
  );
  const existingGuestPhotoResponseColumns = new Set(guestPhotoResponseColumns.map((column) => column.COLUMN_NAME));
  if (!existingGuestPhotoResponseColumns.has('guest_response')) {
    await connection.query("ALTER TABLE guest_service_response_images ADD COLUMN guest_response ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending' AFTER caption");
  }
  if (!existingGuestPhotoResponseColumns.has('guest_responded_at')) {
    await connection.query('ALTER TABLE guest_service_response_images ADD COLUMN guest_responded_at DATETIME NULL AFTER guest_response');
  }

  const [housekeepingColumn] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'housekeeping_status'`,
    [dbName]
  );
  if (Number(housekeepingColumn[0]?.count || 0) === 0) {
    await connection.query(
      `ALTER TABLE properties
       ADD COLUMN housekeeping_status ENUM('clean', 'dirty', 'maintenance') NOT NULL DEFAULT 'clean'`
    );
    console.log('Added properties.housekeeping_status');
  }

  const [discountColumns] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings'
     AND COLUMN_NAME IN ('discount_code', 'discount_amount')`,
    [dbName]
  );
  const existingDiscountColumns = new Set(discountColumns.map((column) => column.COLUMN_NAME));
  if (!existingDiscountColumns.has('discount_code')) {
    await connection.query('ALTER TABLE bookings ADD COLUMN discount_code VARCHAR(50)');
  }
  if (!existingDiscountColumns.has('discount_amount')) {
    await connection.query('ALTER TABLE bookings ADD COLUMN discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0');
  }

  await connection.end();
}

runMigration().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
