import axios from 'axios';
import db from '../db/DatabaseManager.js';
import { v4 as uuidv4 } from 'uuid';

const yieldToMainLoop = () => new Promise((resolve) => setImmediate(resolve));

class SyncManager {
  constructor(token = '') {
    this.apiClient = axios.create({
      baseURL: process.env.REACT_APP_API_URL || process.env.VITE_API_URL || 'http://localhost:3000/api',
      timeout: 10000,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    this.isSyncing = false;
    this.syncPromise = null;
    this.lastSyncTime = db.get('SELECT value FROM sync_state WHERE key = ?', ['last_sync'])?.value || null;
  }

  setToken(token = '') {
    if (token) this.apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete this.apiClient.defaults.headers.common.Authorization;
  }

  async sync() {
    if (this.syncPromise) return this.syncPromise;
    this.isSyncing = true;
    this.syncPromise = (async () => {
      try {
        const serverTime = await this.pullDelta();
        await this.pushPendingChanges();
        this.lastSyncTime = serverTime || new Date().toISOString();
        db.run(`INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        ['last_sync', String(this.lastSyncTime)]);
        return { success: true, lastSync: this.lastSyncTime };
      } catch (error) {
        console.error('Sync error:', error);
        throw error;
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();
    return this.syncPromise;
  }

  async pullDelta() {
    try {
      let cursors = null;
      let serverTime = null;
      let pages = 0;
      const applyRecords = (entity, records, upsert) => {
        for (const record of records || []) {
          try {
            upsert.call(this, record);
          } catch (error) {
            error.message = `Failed to sync ${entity} ${record.id || '(unknown id)'}: ${error.message}`;
            throw error;
          }
        }
      };
      const applyPage = db.batch((delta) => {
        applyRecords('property', delta.properties, this.upsertProperty);
        applyRecords('booking', delta.bookings, this.upsertBooking);
        applyRecords('payment', delta.payments, this.upsertPayment);
      });
      do {
        const res = await this.apiClient.post('/sync/pull', { sinceTimestamp: this.lastSyncTime, cursors });
        const data = res.data?.data;
        const delta = data?.delta;
        if (!serverTime) serverTime = data?.serverTime || null;
        if (!delta) break;

        applyPage(delta);
        cursors = data?.nextCursors || null;
        const hasMore = cursors && Object.values(cursors).some((cursor) => cursor && !cursor.done);
        pages += 1;
        await yieldToMainLoop();
        if (pages > 10000) throw new Error('Sync stopped after too many data batches.');
        if (!hasMore) break;
      } while (true);
      return serverTime;
    } catch (error) {
      console.error('Error pulling delta:', error);
      throw error;
    }
  }

  async pushPendingChanges() {
    try {
      const batchSize = 100;
      while (true) {
        const pendingLogs = db.all('SELECT * FROM sync_logs WHERE status = ? ORDER BY timestamp, id LIMIT ?', ['pending', batchSize]);
        if (!pendingLogs.length) return;
        const payload = { properties: [], bookings: [], payments: [], shifts: [], logs: pendingLogs };

        for (const [index, log] of pendingLogs.entries()) {
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
          if ((index + 1) % 25 === 0) await yieldToMainLoop();
        }

        await this.apiClient.post('/sync/push', { deviceId: 'electron-admin-node', payload });

        db.batch(() => {
          for (const log of pendingLogs) db.run('UPDATE sync_logs SET status = ? WHERE id = ?', ['synced', log.id]);
        })();
        await yieldToMainLoop();
      }
    } catch (error) {
      console.error('Error pushing pending changes:', error);
      throw error;
    }
  }

  upsertProperty(prop) {
    const now = new Date().toISOString();
    const ownerId = prop.owner_id || prop.ownerId || null;
    if (ownerId) this.ensureLocalUser(ownerId, '', 'property_owner');
    db.run(`INSERT INTO properties
      (id, name, type, description, address, latitude, longitude, image_url, price_per_night, status, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, type = excluded.type, description = excluded.description,
        address = excluded.address, latitude = excluded.latitude, longitude = excluded.longitude,
        image_url = excluded.image_url, price_per_night = excluded.price_per_night,
        status = excluded.status, owner_id = excluded.owner_id, updated_at = excluded.updated_at`, [
      prop.id, prop.name, prop.type, prop.description || null, prop.address, prop.latitude ?? null, prop.longitude ?? null,
      prop.image_url || prop.imageUrl || null, prop.price_per_night ?? prop.pricePerNight ?? 0, prop.status,
      ownerId, prop.created_at || now, prop.updated_at || now,
    ]);
  }

  upsertBooking(booking) {
    const propertyId = booking.property_id || booking.propertyId
    const customerId = booking.customer_id || booking.customerId
    const checkInDate = booking.check_in_date || booking.checkInDate
    const checkOutDate = booking.check_out_date || booking.checkOutDate
    const customerName = booking.customer_name || booking.customerName || `${booking.first_name || ''} ${booking.last_name || ''}`.trim()
    const propertyName = booking.property_name || booking.propertyName || ''
    const now = new Date().toISOString()
    // Delta pages are ordered independently by entity, so a booking can arrive
    // before its property. Create a minimal parent row; the property delta will
    // replace it when that record is pulled.
    if (propertyId) this.ensureLocalProperty(propertyId, propertyName)
    if (customerId) this.ensureLocalUser(customerId, customerName)
    db.run(`INSERT INTO bookings
      (id, property_id, customer_id, check_in_date, check_out_date, status, source, guest_name, property_name,
       number_of_guests, total_amount, special_requests, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET property_id = excluded.property_id, customer_id = excluded.customer_id,
        check_in_date = excluded.check_in_date, check_out_date = excluded.check_out_date, status = excluded.status,
        guest_name = excluded.guest_name, property_name = excluded.property_name,
        number_of_guests = excluded.number_of_guests, total_amount = excluded.total_amount,
        special_requests = excluded.special_requests, updated_at = excluded.updated_at`, [
      booking.id, propertyId, customerId, checkInDate, checkOutDate, booking.status,
      booking.source || 'website', customerName, propertyName,
      booking.number_of_guests ?? booking.numberOfGuests ?? 1,
      booking.total_amount ?? booking.totalAmount ?? 0,
      booking.special_requests || booking.specialRequests || null,
      booking.created_at || now, booking.updated_at || now,
    ]);
  }

  upsertPayment(payment) {
    const now = new Date().toISOString();
    const bookingId = payment.booking_id || payment.bookingId;
    // Payments and bookings have separate sync cursors, so retain referential
    // integrity when a payment is received before its booking delta.
    if (bookingId) this.ensureLocalBooking(bookingId);
    db.run(`INSERT INTO payments (id, booking_id, amount, method, status, transaction_ref, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET booking_id = excluded.booking_id, amount = excluded.amount,
        method = excluded.method, status = excluded.status, transaction_ref = excluded.transaction_ref,
        updated_at = excluded.updated_at`, [
      payment.id, bookingId, payment.amount, payment.method, payment.status,
      payment.transaction_ref || payment.transactionRef || null, payment.created_at || now, payment.updated_at || now,
    ]);
  }

  ensureLocalUser(id, name = '', role = 'customer') {
    db.run(`INSERT OR IGNORE INTO users (id, name, role, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))`, [id, name || null, role]);
  }

  ensureLocalProperty(id, name = '') {
    db.run(`INSERT OR IGNORE INTO properties (id, name, status, created_at, updated_at)
      VALUES (?, ?, 'available', datetime('now'), datetime('now'))`, [id, name || null]);
  }

  ensureLocalBooking(id) {
    db.run(`INSERT OR IGNORE INTO bookings (id, status, created_at, updated_at)
      VALUES (?, 'pending', datetime('now'), datetime('now'))`, [id]);
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
