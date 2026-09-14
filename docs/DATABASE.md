# RMS Database Documentation

Comprehensive guide to the House Rental & Booking Management System database schema.

## Overview

The RMS system uses:
- **MySQL** as the central database (source of truth)
- **SQLite** for offline-first sync on Admin Client and POS System
- **Firebase** for real-time features (supplementary)

## Database Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MySQL (Central DB)                    │
│         - Source of truth                              │
│         - All transactions and reports                 │
│         - User authentication                          │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
   ┌────▼─────────┐  ┌────▼──────────┐
   │   Admin      │  │   POS        │
   │   Client     │  │   System     │
   │  (SQLite)    │  │  (SQLite)    │
   │  + Sync      │  │  + Sync      │
   └──────────────┘  └───────────────┘
```

## Core Tables

### Users
Stores user accounts and roles.

```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role ENUM('customer', 'admin', 'cashier'),
  status ENUM('active', 'inactive', 'suspended'),
  password_hash VARCHAR(255),
  two_factor_enabled BOOLEAN,
  last_login DATETIME,
  created_at DATETIME,
  updated_at DATETIME
);
```

**Fields:**
- `id`: Unique user identifier (UUID)
- `email`: Email address (must be unique)
- `role`: User role (customer/admin/cashier)
- `status`: Account status
- `two_factor_enabled`: 2FA enabled flag

**Indexes:**
- `idx_email`: For quick email lookups
- `idx_role`: For role-based queries
- `idx_status`: For account status filtering

---

### Properties
Lists all rental properties available for booking.

```sql
CREATE TABLE properties (
  id VARCHAR(36) PRIMARY KEY,
  owner_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('one_bedroom', 'airbnb', 'single_room', 'bedsitter', 'bnb'),
  description LONGTEXT,
  address VARCHAR(500) NOT NULL,
  city VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  price_per_night DECIMAL(10, 2),
  price_per_week DECIMAL(10, 2),
  price_per_month DECIMAL(10, 2),
  capacity INT,
  bedrooms INT,
  bathrooms INT,
  status ENUM('available', 'booked', 'maintenance', 'inactive'),
  created_at DATETIME,
  updated_at DATETIME
);
```

**Fields:**
- `type`: Property type (one_bedroom, airbnb, etc.)
- `latitude/longitude`: Live location coordinates
- `price_per_*`: Flexible pricing (nightly, weekly, monthly)
- `capacity`: Number of guests
- `status`: Current availability status

**Common Queries:**

Get available properties in a city:
```sql
SELECT * FROM properties 
WHERE city = 'Nairobi' 
AND status = 'available'
AND price_per_night BETWEEN 50 AND 150;
```

Get properties by owner:
```sql
SELECT * FROM properties 
WHERE owner_id = 'user-uuid' 
ORDER BY created_at DESC;
```

---

### Property Images
Stores images for each property.

```sql
CREATE TABLE property_images (
  id VARCHAR(36) PRIMARY KEY,
  property_id VARCHAR(36) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  is_cover BOOLEAN DEFAULT FALSE,
  display_order INT,
  created_at DATETIME,
  FOREIGN KEY (property_id) REFERENCES properties(id)
);
```

**Usage:**
- Multiple images per property
- `is_cover` marks the main listing image
- `display_order` controls gallery order

---

### Amenities & Property Amenities
Define available amenities (WiFi, Parking, etc.) and link to properties.

```sql
CREATE TABLE amenities (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  icon VARCHAR(50)
);

CREATE TABLE property_amenities (
  property_id VARCHAR(36) NOT NULL,
  amenity_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (property_id, amenity_id)
);
```

**Setup:**
```sql
INSERT INTO amenities (id, name, icon) VALUES
('uuid1', 'WiFi', 'wifi-icon'),
('uuid2', 'Parking', 'parking-icon'),
('uuid3', 'Swimming Pool', 'pool-icon');

INSERT INTO property_amenities (property_id, amenity_id) VALUES
('prop-uuid', 'uuid1');
```

---

### Bookings
Tracks all property reservations.

```sql
CREATE TABLE bookings (
  id VARCHAR(36) PRIMARY KEY,
  property_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  number_of_guests INT,
  total_amount DECIMAL(10, 2),
  status ENUM('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'),
  source ENUM('website', 'pos', 'admin'),
  special_requests TEXT,
  created_at DATETIME,
  updated_at DATETIME
);
```

**Status Flow:**
```
pending → confirmed → checked_in → checked_out
    ↓
  cancelled
```

**Key Features:**
- Tracks booking source (website, POS, admin)
- Special requests field for customer notes
- Calculate nights: `DATEDIFF(check_out_date, check_in_date)`

**Common Queries:**

Get availability for a property:
```sql
SELECT * FROM bookings
WHERE property_id = 'prop-uuid'
AND status IN ('confirmed', 'checked_in')
AND check_in_date < '2026-09-15'
AND check_out_date > '2026-09-10';
```

Calculate occupancy rate:
```sql
SELECT 
  property_id,
  SUM(DATEDIFF(check_out_date, check_in_date)) as occupied_days,
  ROUND((SUM(DATEDIFF(check_out_date, check_in_date)) / 365) * 100, 2) as occupancy_pct
FROM bookings
WHERE status IN ('confirmed', 'checked_out')
GROUP BY property_id;
```

---

### Payments
Records all payment transactions.

```sql
CREATE TABLE payments (
  id VARCHAR(36) PRIMARY KEY,
  booking_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  method ENUM('card', 'mpesa', 'paypal', 'bank_transfer', 'cash'),
  status ENUM('pending', 'paid', 'partially_paid', 'refunded', 'failed'),
  transaction_ref VARCHAR(255) UNIQUE,
  issued_by VARCHAR(36),
  notes TEXT,
  created_at DATETIME,
  updated_at DATETIME
);
```

**Status Flow:**
```
pending → paid
       ↓
       refunded / failed
```

**Payment Methods:**
- `card`: Credit/Debit card (Stripe, Flutterwave)
- `mpesa`: M-Pesa mobile money
- `paypal`: PayPal
- `bank_transfer`: Direct bank transfer
- `cash`: Walk-in cash (POS only)

**Common Queries:**

Get daily revenue:
```sql
SELECT 
  DATE(created_at) as date,
  SUM(amount) as total_revenue,
  COUNT(*) as transaction_count
FROM payments
WHERE status = 'paid'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

Get revenue by payment method:
```sql
SELECT 
  method,
  SUM(amount) as total,
  COUNT(*) as count,
  AVG(amount) as avg_transaction
FROM payments
WHERE status = 'paid'
GROUP BY method;
```

---

### Receipts
Stores generated receipts for payments.

```sql
CREATE TABLE receipts (
  id VARCHAR(36) PRIMARY KEY,
  payment_id VARCHAR(36) NOT NULL,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  pdf_url VARCHAR(500),
  created_at DATETIME
);
```

**Receipt Number Format:**
- Auto-generated: `RCP-YYYY-MM-DDXXX`
- Example: `RCP-2026-09-02001`

---

### Shifts
Tracks cashier work sessions for POS.

```sql
CREATE TABLE shifts (
  id VARCHAR(36) PRIMARY KEY,
  cashier_id VARCHAR(36) NOT NULL,
  open_time DATETIME NOT NULL,
  close_time DATETIME,
  opening_balance DECIMAL(10, 2),
  expected_closing_balance DECIMAL(10, 2),
  actual_closing_balance DECIMAL(10, 2),
  transaction_count INT,
  status ENUM('open', 'closed'),
  notes TEXT
);
```

**Shift Management:**
- Open shift when cashier logs in
- Close shift at end of work day
- Track cash balance reconciliation
- Calculate variance: `actual - expected`

**Query Example:**
```sql
SELECT 
  cashier_id,
  DATE(open_time) as work_date,
  COUNT(*) as transaction_count,
  SUM(expected_closing_balance) as expected_total
FROM shifts
WHERE DATE(open_time) = '2026-09-02'
GROUP BY cashier_id;
```

---

### Sync Logs
Tracks offline-sync status for distributed databases.

```sql
CREATE TABLE sync_logs (
  id VARCHAR(36) PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  action VARCHAR(50) NOT NULL,
  status ENUM('pending', 'synced', 'error'),
  device_id VARCHAR(255),
  error_message TEXT,
  timestamp DATETIME
);
```

**Entity Types:**
- property
- booking
- payment
- shift
- user

**Actions:**
- INSERT
- UPDATE
- DELETE

**Status Tracking:**
- `pending`: Waiting to sync
- `synced`: Successfully synced
- `error`: Failed sync with error message

---

### Reviews & Ratings
Customer reviews for properties.

```sql
CREATE TABLE reviews (
  id VARCHAR(36) PRIMARY KEY,
  property_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  booking_id VARCHAR(36) NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  comment TEXT,
  status ENUM('pending', 'approved', 'rejected'),
  created_at DATETIME,
  updated_at DATETIME
);
```

**Query Example - Top Rated Properties:**
```sql
SELECT 
  p.id,
  p.name,
  AVG(r.rating) as avg_rating,
  COUNT(r.id) as review_count
FROM properties p
LEFT JOIN reviews r ON p.id = r.property_id AND r.status = 'approved'
GROUP BY p.id
ORDER BY avg_rating DESC, review_count DESC
LIMIT 10;
```

---

### Wishlists
Customer saved/favorited properties.

```sql
CREATE TABLE wishlists (
  id VARCHAR(36) PRIMARY KEY,
  customer_id VARCHAR(36) NOT NULL,
  property_id VARCHAR(36) NOT NULL,
  created_at DATETIME,
  UNIQUE KEY (customer_id, property_id)
);
```

---

### Audit Logs
Complete audit trail of system actions.

```sql
CREATE TABLE audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(36),
  old_value LONGTEXT,
  new_value LONGTEXT,
  ip_address VARCHAR(45),
  timestamp DATETIME
);
```

---

## Useful Views

### Property Monthly Revenue
```sql
CREATE VIEW property_monthly_revenue AS
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
```

### Occupancy Rate
```sql
CREATE VIEW property_occupancy_rate AS
SELECT 
  p.id,
  p.name,
  COUNT(DISTINCT b.id) as total_bookings,
  SUM(DATEDIFF(b.check_out_date, b.check_in_date)) as occupied_days,
  ROUND((SUM(DATEDIFF(b.check_out_date, b.check_in_date)) / 365) * 100, 2) as occupancy_pct
FROM properties p
LEFT JOIN bookings b ON p.id = b.property_id 
  AND b.status IN ('confirmed', 'checked_out')
GROUP BY p.id;
```

---

## Performance Optimization

### Recommended Indexes

```sql
-- Already created in schema.sql

-- Additional indexes for common queries
CREATE INDEX idx_bookings_date_range ON bookings(check_in_date, check_out_date);
CREATE INDEX idx_properties_availability ON properties(status, id);
CREATE INDEX idx_payments_created ON payments(created_at DESC);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
```

### Query Tips

1. **Always filter by status** when querying bookings/payments
2. **Use date indexes** for range queries on bookings
3. **Partition tables** by month for large datasets
4. **Archive old records** (sync logs, audit logs) regularly
5. **Use JOINs carefully** - consider denormalization for frequently accessed data

---

## Offline Sync Strategy

### Admin Client & POS System

1. **Local SQLite Mirror**
   - All core tables replicated locally
   - Same schema as MySQL

2. **Sync Process**
   - Pull: Download changes from MySQL
   - Work: All operations on local SQLite
   - Push: Upload local changes to MySQL

3. **Conflict Resolution**
   - Last-write-wins strategy
   - Timestamp-based merging
   - Manual review screen for conflicts

4. **Sync Logs**
   - Track all pending changes
   - Log errors for manual review
   - Trigger re-sync on failures

---

## Data Retention & Archival

| Table | Retention | Archive Strategy |
|-------|-----------|------------------|
| users | Forever | Never |
| properties | Forever | Never |
| bookings | 7+ years | Annual archive tables |
| payments | 7+ years | Annual archive tables |
| receipts | 7+ years | Annual archive tables |
| sync_logs | 90 days | Delete old records |
| audit_logs | 1-2 years | Monthly archive |

---

## Backup Strategy

### Regular Backups

```bash
# Daily backup
mysqldump -u root -p rms_database > backup-$(date +%Y%m%d).sql

# Compress
gzip backup-*.sql

# Store offsite
aws s3 cp backup-*.sql.gz s3://rms-backups/
```

### Restore

```bash
gunzip backup-20260902.sql.gz
mysql -u root -p rms_database < backup-20260902.sql
```

---

## Support

For database questions and optimization:
- Email: database-support@rms-system.com
- Documentation: Additional examples in the repository
- GitHub Issues: Report schema issues
