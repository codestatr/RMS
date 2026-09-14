import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

const dbPath = path.join(app.getPath('userData'), 'rms.db')

class DatabaseManager {
  constructor() {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initializeSchema()
  }

  initializeSchema() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        name TEXT,
        role TEXT,
        password_hash TEXT,
        created_at DATETIME,
        updated_at DATETIME
      )
    `)

    // Properties table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        description TEXT,
        address TEXT,
        latitude REAL,
        longitude REAL,
        image_url TEXT,
        price_per_night REAL,
        status TEXT,
        owner_id TEXT,
        created_at DATETIME,
        updated_at DATETIME,
        FOREIGN KEY (owner_id) REFERENCES users(id)
      )
    `)
    try {
      this.db.exec('ALTER TABLE properties ADD COLUMN image_url TEXT')
    } catch (error) {
      if (!String(error.message).includes('duplicate column name')) throw error
    }

    // Bookings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        property_id TEXT,
        customer_id TEXT,
        check_in_date DATE,
        check_out_date DATE,
        status TEXT,
        source TEXT,
        created_at DATETIME,
        updated_at DATETIME,
        FOREIGN KEY (property_id) REFERENCES properties(id),
        FOREIGN KEY (customer_id) REFERENCES users(id)
      )
    `)
    for (const column of ['guest_name TEXT', 'property_name TEXT', 'number_of_guests INTEGER', 'total_amount REAL', 'special_requests TEXT']) {
      try {
        this.db.exec(`ALTER TABLE bookings ADD COLUMN ${column}`)
      } catch (error) {
        if (!String(error.message).includes('duplicate column name')) throw error
      }
    }

    // Payments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        booking_id TEXT,
        amount REAL,
        method TEXT,
        status TEXT,
        transaction_ref TEXT,
        created_at DATETIME,
        updated_at DATETIME,
        FOREIGN KEY (booking_id) REFERENCES bookings(id)
      )
    `)

    // Receipts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        payment_id TEXT,
        receipt_number TEXT UNIQUE,
        pdf_path TEXT,
        created_at DATETIME,
        FOREIGN KEY (payment_id) REFERENCES payments(id)
      )
    `)

    // Sync logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id TEXT PRIMARY KEY,
        entity_type TEXT,
        entity_id TEXT,
        action TEXT,
        status TEXT,
        timestamp DATETIME,
        error_message TEXT
      )
    `)

    // Cashier shifts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY,
        cashier_id TEXT,
        open_time DATETIME NOT NULL,
        close_time DATETIME,
        opening_balance REAL NOT NULL DEFAULT 0,
        expected_closing_balance REAL,
        actual_closing_balance REAL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at DATETIME,
        updated_at DATETIME
      )
    `)
  }

  run(sql, params = []) {
    const stmt = this.db.prepare(sql)
    return stmt.run(...params)
  }

  get(sql, params = []) {
    const stmt = this.db.prepare(sql)
    return stmt.get(...params)
  }

  all(sql, params = []) {
    const stmt = this.db.prepare(sql)
    return stmt.all(...params)
  }

  close() {
    this.db.close()
  }
}

export default new DatabaseManager()
