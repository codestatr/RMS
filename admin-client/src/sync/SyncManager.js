import axios from 'axios';
import db from '../db/DatabaseManager.js';
import { v4 as uuidv4 } from 'uuid';

class SyncManager {
  constructor(token = '') {
    this.apiClient = axios.create({
      baseURL: process.env.REACT_APP_API_URL || process.env.VITE_API_URL || 'http://localhost:3000/api',
      timeout: 30000,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    this.isSyncing = false;
    this.lastSyncTime = null;
  }

  async sync() {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    this.isSyncing = true;

    try {
      // 1. Pull delta updates from server
      await this.pullDelta();

      // 2. Push local pending changes to server
      await this.pushPendingChanges();

      this.lastSyncTime = new Date();
      this.isSyncing = false;

      return { success: true, lastSync: this.lastSyncTime };
    } catch (error) {
      console.error('Sync error:', error);
      this.isSyncing = false;
      throw error;
    }
  }

  async pullDelta() {
    try {
      const lastSyncISO = this.lastSyncTime ? this.lastSyncTime.toISOString() : null;
      const res = await this.apiClient.post('/sync/pull', { sinceTimestamp: lastSyncISO });
      const delta = res.data?.data?.delta;

      if (!delta) return;

      // Upsert properties
      if (delta.properties && Array.isArray(delta.properties)) {
        for (const prop of delta.properties) {
          this.upsertProperty(prop);
        }
      }

      // Upsert bookings
      if (delta.bookings && Array.isArray(delta.bookings)) {
        for (const booking of delta.bookings) {
          this.upsertBooking(booking);
        }
      }

      // Upsert payments
      if (delta.payments && Array.isArray(delta.payments)) {
        for (const payment of delta.payments) {
          this.upsertPayment(payment);
        }
      }
    } catch (error) {
      console.error('Error pulling delta:', error);
      throw error;
    }
  }

  async pushPendingChanges() {
    try {
      const pendingLogs = db.all('SELECT * FROM sync_logs WHERE status = ?', ['pending']);
      if (!pendingLogs || pendingLogs.length === 0) return;

      const payload = {
        properties: [],
        bookings: [],
        payments: [],
        shifts: [],
        logs: pendingLogs,
      };

      for (const log of pendingLogs) {
        if (log.entity_type === 'property') {
          const item = db.get('SELECT * FROM properties WHERE id = ?', [log.entity_id]);
          if (item) payload.properties.push(item);
        } else if (log.entity_type === 'booking') {
          const item = db.get('SELECT * FROM bookings WHERE id = ?', [log.entity_id]);
          if (item) payload.bookings.push(item);
        } else if (log.entity_type === 'payment') {
          const item = db.get('SELECT * FROM payments WHERE id = ?', [log.entity_id]);
          if (item) payload.payments.push(item);
        }
      }

      await this.apiClient.post('/sync/push', {
        deviceId: 'electron-admin-node',
        payload,
      });

      // Mark logs as synced
      for (const log of pendingLogs) {
        db.run('UPDATE sync_logs SET status = ? WHERE id = ?', ['synced', log.id]);
      }
    } catch (error) {
      console.error('Error pushing pending changes:', error);
      throw error;
    }
  }

  upsertProperty(prop) {
    const existing = db.get('SELECT id FROM properties WHERE id = ?', [prop.id]);
    if (existing) {
      db.run(
        `UPDATE properties SET name = ?, type = ?, description = ?, address = ?, 
         latitude = ?, longitude = ?, image_url = ?, price_per_night = ?, status = ?, updated_at = ? 
         WHERE id = ?`,
        [
          prop.name,
          prop.type,
          prop.description,
          prop.address,
          prop.latitude,
          prop.longitude,
          prop.image_url || prop.imageUrl || null,
          prop.price_per_night || prop.pricePerNight,
          prop.status,
          new Date().toISOString(),
          prop.id,
        ]
      );
    } else {
      db.run(
        `INSERT INTO properties (id, name, type, description, address, latitude, 
         longitude, image_url, price_per_night, status, owner_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prop.id,
          prop.name,
          prop.type,
          prop.description,
          prop.address,
          prop.latitude,
          prop.longitude,
          prop.image_url || prop.imageUrl || null,
          prop.price_per_night || prop.pricePerNight,
          prop.status,
          prop.owner_id || prop.ownerId || 'admin',
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );
    }
  }

  upsertBooking(booking) {
    const propertyId = booking.property_id || booking.propertyId
    const customerId = booking.customer_id || booking.customerId
    const checkInDate = booking.check_in_date || booking.checkInDate
    const checkOutDate = booking.check_out_date || booking.checkOutDate
    const customerName = booking.customer_name || booking.customerName || `${booking.first_name || ''} ${booking.last_name || ''}`.trim()
    const propertyName = booking.property_name || booking.propertyName || ''
    const now = new Date().toISOString()
    const existing = db.get('SELECT id FROM bookings WHERE id = ?', [booking.id]);
    if (existing) {
      db.run(
        `UPDATE bookings SET property_id = ?, customer_id = ?, check_in_date = ?, 
         check_out_date = ?, status = ?, guest_name = ?, property_name = ?, number_of_guests = ?,
         total_amount = ?, special_requests = ?, updated_at = ? WHERE id = ?`,
        [
          propertyId, customerId, checkInDate, checkOutDate,
          booking.status,
          customerName, propertyName, booking.number_of_guests || booking.numberOfGuests || 1,
          booking.total_amount || booking.totalAmount || 0, booking.special_requests || booking.specialRequests || null,
          now,
          booking.id,
        ]
      );
    } else {
      db.run(
        `INSERT INTO bookings (id, property_id, customer_id, check_in_date, check_out_date, status, source,
         guest_name, property_name, number_of_guests, total_amount, special_requests, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          booking.id, propertyId, customerId, checkInDate, checkOutDate, booking.status,
          booking.source || 'website', customerName, propertyName,
          booking.number_of_guests || booking.numberOfGuests || 1,
          booking.total_amount || booking.totalAmount || 0,
          booking.special_requests || booking.specialRequests || null, now, now,
        ]
      );
    }
  }

  upsertPayment(payment) {
    const existing = db.get('SELECT id FROM payments WHERE id = ?', [payment.id]);
    if (existing) {
      db.run(
        `UPDATE payments SET booking_id = ?, amount = ?, method = ?, status = ?, 
         updated_at = ? WHERE id = ?`,
        [
          payment.booking_id || payment.bookingId,
          payment.amount,
          payment.method,
          payment.status,
          new Date().toISOString(),
          payment.id,
        ]
      );
    } else {
      db.run(
        `INSERT INTO payments (id, booking_id, amount, method, status, 
         transaction_ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payment.id,
          payment.booking_id || payment.bookingId,
          payment.amount,
          payment.method,
          payment.status,
          payment.transaction_ref || payment.transactionRef,
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );
    }
  }

  async getStatus() {
    const pendingCount = db.get('SELECT COUNT(*) as count FROM sync_logs WHERE status = ?', ['pending']);
    const errorCount = db.get('SELECT COUNT(*) as count FROM sync_logs WHERE status = ?', ['error']);

    return {
      isSyncing: this.isSyncing,
      lastSync: this.lastSyncTime,
      pending: pendingCount?.count || 0,
      errors: errorCount?.count || 0,
    };
  }

  logSync(entityType, entityId, action, status, errorMessage = null) {
    db.run(
      `INSERT INTO sync_logs (id, entity_type, entity_id, action, status, timestamp, error_message) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), entityType, entityId, action, status, new Date().toISOString(), errorMessage]
    );
  }
}

export { SyncManager };
