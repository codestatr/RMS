import { query, transaction } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '../utils/auth.js';

class SyncService {
  /**
   * Pull delta updates from central MySQL database
   */
  async pullUpdates(sinceTimestamp = null) {
    const defaultTime = '1970-01-01 00:00:00';
    const cutoff = sinceTimestamp || defaultTime;

    // Fetch modified properties
    const properties = await query(
      `SELECT p.*, 
              AVG(r.rating) as avg_rating,
              COUNT(DISTINCT r.id) as review_count,
              GROUP_CONCAT(pi.image_url SEPARATOR '||') as images
       FROM properties p
       LEFT JOIN reviews r ON p.id = r.property_id AND r.status = 'approved'
       LEFT JOIN property_images pi ON p.id = pi.property_id
       WHERE p.updated_at >= ?
       GROUP BY p.id`,
      [cutoff]
    );

    // Fetch modified bookings
    const bookings = await query(
      `SELECT b.*, p.name as property_name, u.first_name, u.last_name, u.email, u.phone
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       JOIN users u ON b.customer_id = u.id
       WHERE b.updated_at >= ?`,
      [cutoff]
    );

    // Fetch modified payments
    const payments = await query(
      `SELECT p.*, b.total_amount, pr.name as property_name, u.first_name, u.last_name, u.email
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN properties pr ON b.property_id = pr.id
       JOIN users u ON b.customer_id = u.id
       WHERE p.updated_at >= ?`,
      [cutoff]
    );

    // Fetch modified shifts
    const shifts = await query(
      `SELECT s.*, u.first_name as cashier_first_name, u.last_name as cashier_last_name
       FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       WHERE s.updated_at >= ?`,
      [cutoff]
    );

    const nowResult = await query('SELECT NOW() as sync_server_time');
    const serverTime = nowResult[0]?.sync_server_time || new Date().toISOString();

    return {
      serverTime,
      delta: {
        properties,
        bookings,
        payments,
        shifts,
      },
    };
  }

  /**
   * Push queued offline records to MySQL
   */
  async pushUpdates(deviceId, payload) {
    const { properties = [], bookings = [], payments = [], shifts = [], logs = [] } = payload;
    let syncedCount = 0;
    const conflicts = [];

    await transaction(async (connection) => {
      // 1. Process Properties
      for (const prop of properties) {
        const [existing] = await connection.execute('SELECT id, updated_at FROM properties WHERE id = ?', [prop.id]);
        if (existing.length === 0) {
          await connection.execute(
            `INSERT INTO properties (
              id, owner_id, name, type, description, address, city, country,
              latitude, longitude, price_per_night, capacity, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              prop.id || uuidv4(),
              prop.ownerId || prop.owner_id,
              prop.name,
              prop.type,
              prop.description || '',
              prop.address,
              prop.city || 'Nairobi',
              prop.country || 'Kenya',
              prop.latitude || null,
              prop.longitude || null,
              prop.pricePerNight || prop.price_per_night,
              prop.capacity || 1,
              prop.status || 'available',
            ]
          );
        } else {
          await connection.execute(
            `UPDATE properties SET 
              name = ?, type = ?, description = ?, address = ?, city = ?, country = ?,
              latitude = ?, longitude = ?, price_per_night = ?, capacity = ?, status = ?, updated_at = NOW()
             WHERE id = ?`,
            [
              prop.name,
              prop.type,
              prop.description || '',
              prop.address,
              prop.city || 'Nairobi',
              prop.country || 'Kenya',
              prop.latitude || null,
              prop.longitude || null,
              prop.pricePerNight || prop.price_per_night,
              prop.capacity || 1,
              prop.status || 'available',
              prop.id,
            ]
          );
        }
        syncedCount++;
      }

      // 2. Process Bookings
      for (const b of bookings) {
        const customerId = await this.resolveBookingCustomer(connection, b);
        const [existing] = await connection.execute('SELECT id, updated_at, status FROM bookings WHERE id = ?', [b.id]);
        if (existing.length === 0) {
          await connection.execute(
            `INSERT INTO bookings (
              id, property_id, customer_id, check_in_date, check_out_date,
              number_of_guests, total_amount, status, source, special_requests,
              pickup_location, pickup_time, pickup_notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              b.id || uuidv4(),
              b.propertyId || b.property_id,
              customerId,
              b.checkInDate || b.check_in_date,
              b.checkOutDate || b.check_out_date,
              b.numberOfGuests || b.number_of_guests || 1,
              b.totalAmount || b.total_amount,
              b.status || 'pending',
              b.source || 'admin',
              b.specialRequests || b.special_requests || null,
              b.pickupLocation || b.pickup_location || null,
              b.pickupTime || b.pickup_time || null,
              b.pickupNotes || b.pickup_notes || null,
            ]
          );
        } else {
          await connection.execute(
            `UPDATE bookings SET 
              status = ?, check_in_date = ?, check_out_date = ?, 
              number_of_guests = ?, total_amount = ?, special_requests = ?,
              pickup_location = ?, pickup_time = ?, pickup_notes = ?, updated_at = NOW()
             WHERE id = ?`,
            [
              b.status,
              b.checkInDate || b.check_in_date,
              b.checkOutDate || b.check_out_date,
              b.numberOfGuests || b.number_of_guests || 1,
              b.totalAmount || b.total_amount,
              b.specialRequests || b.special_requests || null,
              b.pickupLocation || b.pickup_location || null,
              b.pickupTime || b.pickup_time || null,
              b.pickupNotes || b.pickup_notes || null,
              b.id,
            ]
          );
        }
        syncedCount++;
      }

      // 3. Process Payments
      for (const p of payments) {
        const [existing] = await connection.execute('SELECT id FROM payments WHERE id = ?', [p.id]);
        if (existing.length === 0) {
          await connection.execute(
            `INSERT INTO payments (
              id, booking_id, amount, method, status, transaction_ref, issued_by, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              p.id || uuidv4(),
              p.bookingId || p.booking_id,
              p.amount,
              p.method,
              p.status || 'paid',
              p.transactionRef || p.transaction_ref || null,
              p.issuedBy || p.issued_by || null,
              p.notes || null,
            ]
          );
        } else {
          await connection.execute(
            `UPDATE payments SET amount = ?, method = ?, status = ?, transaction_ref = ?, notes = ?, updated_at = NOW()
             WHERE id = ?`,
            [
              p.amount,
              p.method,
              p.status,
              p.transactionRef || p.transaction_ref || null,
              p.notes || null,
              p.id,
            ]
          );
        }
        syncedCount++;
      }

      // 4. Process Shifts
      for (const s of shifts) {
        const [existing] = await connection.execute('SELECT id FROM shifts WHERE id = ?', [s.id]);
        if (existing.length === 0) {
          await connection.execute(
            `INSERT INTO shifts (
              id, cashier_id, open_time, close_time, opening_balance,
              expected_closing_balance, actual_closing_balance, transaction_count, status, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              s.id || uuidv4(),
              s.cashierId || s.cashier_id,
              s.openTime || s.open_time || new Date(),
              s.closeTime || s.close_time || null,
              s.openingBalance || s.opening_balance || 0,
              s.expectedClosingBalance || s.expected_closing_balance || null,
              s.actualClosingBalance || s.actual_closing_balance || null,
              s.transactionCount || s.transaction_count || 0,
              s.status || 'open',
              s.notes || null,
            ]
          );
        } else {
          await connection.execute(
            `UPDATE shifts SET 
              close_time = ?, expected_closing_balance = ?, actual_closing_balance = ?,
              transaction_count = ?, status = ?, notes = ?, updated_at = NOW()
             WHERE id = ?`,
            [
              s.closeTime || s.close_time || null,
              s.expectedClosingBalance || s.expected_closing_balance || null,
              s.actualClosingBalance || s.actual_closing_balance || null,
              s.transactionCount || s.transaction_count || 0,
              s.status,
              s.notes || null,
              s.id,
            ]
          );
        }
        syncedCount++;
      }

      // 5. Ingest Audit / Sync Log
      await connection.execute(
        `INSERT INTO sync_logs (id, entity_type, entity_id, action, status, device_id, timestamp)
         VALUES (?, 'batch_sync', ?, 'push', 'synced', ?, NOW())`,
        [uuidv4(), deviceId || 'unknown_device', deviceId || 'client']
      );
    });

    return {
      success: true,
      syncedCount,
      conflicts,
      timestamp: new Date().toISOString(),
    };
  }

  async resolveBookingCustomer(connection, booking) {
    const requestedId = booking.customerId || booking.customer_id;
    if (requestedId) {
      const [existing] = await connection.execute('SELECT id FROM users WHERE id = ?', [requestedId]);
      if (existing.length > 0) return requestedId;
    }

    const phone = booking.customerPhone || booking.customer_phone || null;
    if (phone) {
      const [existing] = await connection.execute('SELECT id FROM users WHERE phone = ?', [phone]);
      if (existing.length > 0) return existing[0].id;
    }

    const customerId = uuidv4();
    const name = (booking.customerName || booking.customer_name || 'POS Guest').trim().split(/\s+/);
    const email = booking.customerEmail || booking.customer_email || `pos-${customerId}@rms.local`;
    await connection.execute(
      `INSERT INTO users (id, email, phone, first_name, last_name, role, status, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'customer', 'active', ?, NOW(), NOW())`,
      [customerId, email, phone, name[0] || 'POS', name.slice(1).join(' ') || 'Guest', await hashPassword(uuidv4())]
    );
    return customerId;
  }

  /**
   * Get sync activity logs
   */
  async getSyncLogs(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [count] = await query('SELECT COUNT(*) as total FROM sync_logs');
    const logs = await query(
      'SELECT * FROM sync_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total: count.total,
        pages: Math.ceil(count.total / limit),
      },
    };
  }
}

export default new SyncService();
