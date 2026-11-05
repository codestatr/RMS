import { query } from '../database/db.js'
import { ValidationError, NotFoundError } from '../utils/errors.js'

class ReportService {
  async getOperationsSnapshot(user) {
    const ownerScoped = user.role === 'property_owner'
    const propertyFilter = ownerScoped ? ' AND p.owner_id = ?' : ''
    const propertyParams = ownerScoped ? [user.id] : []

    const balanceQuery = user.role === 'cashier'
      ? Promise.resolve([])
      : query(
        `SELECT b.id, b.total_amount, p.name AS property_name, u.first_name, u.last_name,
                GREATEST(b.total_amount - COALESCE(SUM(CASE WHEN pay.status = 'paid' THEN pay.amount ELSE 0 END), 0), 0) AS balance
         FROM bookings b JOIN properties p ON p.id = b.property_id
         JOIN users u ON u.id = b.customer_id
         LEFT JOIN payments pay ON pay.booking_id = b.id
         WHERE b.status IN ('pending', 'confirmed', 'checked_in')${propertyFilter}
         GROUP BY b.id, b.total_amount, p.name, u.first_name, u.last_name
         HAVING balance > 0 ORDER BY balance DESC LIMIT 8`, propertyParams
      )

    const [arrivals, departures, balances, readiness, requests, guestServiceRequests, arrivalCount, departureCount, balanceCount, readinessCount, requestCount, guestServiceRequestCount] = await Promise.all([
      query(
        `SELECT b.id, b.check_in_date, b.status, b.total_amount, p.name AS property_name,
                u.first_name, u.last_name
         FROM bookings b JOIN properties p ON p.id = b.property_id
         JOIN users u ON u.id = b.customer_id
         WHERE DATE(b.check_in_date) = CURDATE() AND b.status IN ('pending', 'confirmed')${propertyFilter}
         ORDER BY b.check_in_date LIMIT 8`, propertyParams
      ),
      query(
        `SELECT b.id, b.check_out_date, b.status, p.name AS property_name,
                u.first_name, u.last_name
         FROM bookings b JOIN properties p ON p.id = b.property_id
         JOIN users u ON u.id = b.customer_id
         WHERE DATE(b.check_out_date) = CURDATE() AND b.status = 'checked_in'${propertyFilter}
         ORDER BY b.check_out_date LIMIT 8`, propertyParams
      ),
      balanceQuery,
      query(
        `SELECT id, name, type, housekeeping_status FROM properties
         WHERE (housekeeping_status IN ('dirty', 'maintenance') OR status = 'maintenance')${ownerScoped ? ' AND owner_id = ?' : ''}
         ORDER BY CASE WHEN housekeeping_status = 'maintenance' OR status = 'maintenance' THEN 0 ELSE 1 END, name LIMIT 8`, propertyParams
      ),
      query(
        `SELECT ba.id, ba.status, ba.fulfillment_status, sa.name AS service_name,
                p.name AS property_name, u.first_name, u.last_name
         FROM booking_addons ba JOIN service_addons sa ON sa.id = ba.addon_id
         JOIN bookings b ON b.id = ba.booking_id JOIN properties p ON p.id = b.property_id
         JOIN users u ON u.id = b.customer_id
         WHERE ba.status IN ('pending', 'approved') AND COALESCE(ba.fulfillment_status, 'pending') <> 'completed'${propertyFilter}
         ORDER BY ba.created_at DESC LIMIT 8`, propertyParams
      ),
      query(
        `SELECT r.id, r.status, r.service_type AS service_name, r.request_details, r.service_location,
                r.pickup_location, r.destination, p.name AS property_name, u.first_name, u.last_name, r.created_at
         FROM guest_service_requests r JOIN properties p ON p.id = r.property_id
         JOIN users u ON u.id = r.customer_id
         WHERE r.status IN ('requested', 'accepted', 'in_progress')${propertyFilter}
         ORDER BY r.created_at DESC LIMIT 8`, propertyParams
      ),
      query(
        `SELECT COUNT(*) AS count FROM bookings b JOIN properties p ON p.id = b.property_id
         WHERE DATE(b.check_in_date) = CURDATE() AND b.status IN ('pending', 'confirmed')${propertyFilter}`, propertyParams
      ),
      query(
        `SELECT COUNT(*) AS count FROM bookings b JOIN properties p ON p.id = b.property_id
         WHERE DATE(b.check_out_date) = CURDATE() AND b.status = 'checked_in'${propertyFilter}`, propertyParams
      ),
      user.role === 'cashier' ? Promise.resolve([{ count: 0 }]) : query(
        `SELECT COUNT(*) AS count FROM (
           SELECT b.id, GREATEST(b.total_amount - COALESCE(SUM(CASE WHEN pay.status = 'paid' THEN pay.amount ELSE 0 END), 0), 0) AS balance
           FROM bookings b JOIN properties p ON p.id = b.property_id LEFT JOIN payments pay ON pay.booking_id = b.id
           WHERE b.status IN ('pending', 'confirmed', 'checked_in')${propertyFilter}
           GROUP BY b.id, b.total_amount HAVING balance > 0
         ) outstanding`, propertyParams
      ),
      query(
        `SELECT COUNT(*) AS count FROM properties
         WHERE (housekeeping_status IN ('dirty', 'maintenance') OR status = 'maintenance')${ownerScoped ? ' AND owner_id = ?' : ''}`, propertyParams
      ),
      query(
        `SELECT COUNT(*) AS count FROM booking_addons ba JOIN bookings b ON b.id = ba.booking_id
         JOIN properties p ON p.id = b.property_id
         WHERE ba.status IN ('pending', 'approved') AND COALESCE(ba.fulfillment_status, 'pending') <> 'completed'${propertyFilter}`, propertyParams
      ),
      query(
        `SELECT COUNT(*) AS count FROM guest_service_requests r JOIN properties p ON p.id = r.property_id
         WHERE r.status IN ('requested', 'accepted', 'in_progress')${propertyFilter}`, propertyParams
      ),
    ])

    const formatGuest = (row) => ({ ...row, guestName: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Guest' })
    return {
      arrivals: arrivals.map(formatGuest),
      departures: departures.map(formatGuest),
      outstandingBalances: balances.map(formatGuest),
      roomReadiness: readiness,
      guestRequests: [...guestServiceRequests, ...requests].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 8).map(formatGuest),
      counts: {
        arrivals: Number(arrivalCount[0]?.count || 0),
        departures: Number(departureCount[0]?.count || 0),
        outstandingBalances: Number(balanceCount[0]?.count || 0),
        roomReadiness: Number(readinessCount[0]?.count || 0),
        guestRequests: Number(requestCount[0]?.count || 0) + Number(guestServiceRequestCount[0]?.count || 0),
      },
    }
  }

  /**
   * Get dashboard KPIs
   */
  async getDashboardKPIs() {
    // Total revenue
    const revenueResult = await query(
      `SELECT SUM(amount) as total_revenue FROM payments WHERE status = 'paid'`
    )

    // Total bookings
    const bookingsResult = await query(
      `SELECT COUNT(*) as total_bookings FROM bookings`
    )

    // Total properties
    const propertiesResult = await query(
      `SELECT COUNT(*) as total_properties FROM properties WHERE status = 'available'`
    )

    // Total customers
    const customersResult = await query(
      `SELECT COUNT(*) as total_customers FROM users WHERE role = 'customer'`
    )

    // Occupancy rate (booked nights / total available nights)
    const occupancyResult = await query(
      `SELECT 
        COUNT(DISTINCT DATE(DATE_ADD(b.check_in_date, INTERVAL n.i DAY))) as booked_nights,
        DATEDIFF(CURDATE(), DATE_SUB(CURDATE(), INTERVAL 30 DAY)) * (
          SELECT COUNT(*) FROM properties WHERE status = 'available'
        ) as total_available_nights
       FROM bookings b
       CROSS JOIN (
         SELECT 0 as i UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
         UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
         UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
         UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
         UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
         UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29
       ) n
       WHERE b.status IN ('confirmed', 'checked_in', 'checked_out')
       AND DATE_ADD(b.check_in_date, INTERVAL n.i DAY) < b.check_out_date
       AND DATE_ADD(b.check_in_date, INTERVAL n.i DAY) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       AND DATE_ADD(b.check_in_date, INTERVAL n.i DAY) <= CURDATE()`
    )

    const bookedNights = occupancyResult[0].booked_nights || 0
    const totalNights = occupancyResult[0].total_available_nights || 1
    const occupancyRate = ((bookedNights / totalNights) * 100).toFixed(2)

    return {
      totalRevenue: revenueResult[0].total_revenue || 0,
      totalBookings: bookingsResult[0].total_bookings || 0,
      totalProperties: propertiesResult[0].total_properties || 0,
      totalCustomers: customersResult[0].total_customers || 0,
      occupancyRate: parseFloat(occupancyRate),
    }
  }

  async getCashierDashboardKPIs(cashierId) {
    const [summary] = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'paid' AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN amount ELSE 0 END), 0) AS monthly_revenue,
         COUNT(CASE WHEN created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 1 END) AS monthly_transactions,
         COUNT(DISTINCT CASE WHEN created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN booking_id END) AS monthly_bookings,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS lifetime_revenue,
         COUNT(*) AS lifetime_transactions
       FROM payments WHERE issued_by = ?`,
      [cashierId]
    )

    return {
      monthlyRevenue: Number(summary.monthly_revenue || 0),
      monthlyTransactions: Number(summary.monthly_transactions || 0),
      monthlyBookings: Number(summary.monthly_bookings || 0),
      lifetimeRevenue: Number(summary.lifetime_revenue || 0),
      lifetimeTransactions: Number(summary.lifetime_transactions || 0),
    }
  }

  /**
   * Get property monthly revenue
   */
  async getPropertyMonthlyRevenue(propertyId = null, month = null) {
    if (!month) {
      month = new Date().toISOString().substring(0, 7) // YYYY-MM
    }

    const [year, monthNumber] = month.split('-').map(Number)
    let whereClause = 'WHERE pmr.year = ? AND pmr.month = ?'
    const params = [year, monthNumber]

    if (propertyId) {
      whereClause += ' AND pmr.id = ?'
      params.push(propertyId)
    }

    const result = await query(
      `SELECT pmr.id as property_id,
              CONCAT(pmr.year, '-', LPAD(pmr.month, 2, '0')) as month,
              pmr.total_revenue as revenue, pmr.booking_count
       FROM property_monthly_revenue pmr
       ${whereClause}
       ORDER BY pmr.total_revenue DESC`,
      params
    )

    return result
  }

  /**
   * Get property occupancy rate
   */
  async getPropertyOccupancyRate(propertyId = null, startDate = null, endDate = null) {
    let whereClause = 'WHERE 1=1'
    const params = []

    if (propertyId) {
      whereClause += ' AND por.id = ?'
      params.push(propertyId)
    }

    if (startDate) {
      // The summary view is annual; date filters are applied by callers using the report period.
    }

    if (endDate) {
      // The summary view has no daily date column.
    }

    const result = await query(
      `SELECT id as property_id, occupancy_percentage as avg_occupancy_rate
       FROM property_occupancy_rate por
       ${whereClause}
      GROUP BY id, occupancy_percentage`,
      params
    )

    return result
  }

  /**
   * Get bookings by status
   */
  async getBookingsByStatus() {
    const result = await query(
      `SELECT status, COUNT(*) as count FROM bookings GROUP BY status`
    )

    return result
  }

  /**
   * Get payment breakdown
   */
  async getPaymentBreakdown(startDate = null, endDate = null, issuedBy = null) {
    let whereClause = 'WHERE status = "paid"'
    const params = []

    if (startDate) {
      whereClause += ' AND DATE(created_at) >= ?'
      params.push(startDate)
    }

    if (endDate) {
      whereClause += ' AND DATE(created_at) <= ?'
      params.push(endDate)
    }

    if (issuedBy) {
      whereClause += ' AND issued_by = ?'
      params.push(issuedBy)
    }

    const result = await query(
      `SELECT method, SUM(amount) as total, COUNT(*) as count
       FROM payments
       ${whereClause}
       GROUP BY method
       ORDER BY total DESC`,
      params
    )

    return result
  }

  /**
   * Get top properties by revenue
   */
  async getTopPropertiesByRevenue(limit = 10, month = null, startDate = null, endDate = null) {
    const safeLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 10))

    if (startDate && endDate) {
      return query(
        `SELECT p.id, p.name, p.type, p.city,
                COALESCE(SUM(pay.amount), 0) AS revenue,
                COUNT(DISTINCT b.id) AS booking_count,
                COUNT(pay.id) AS transaction_count
         FROM properties p
         JOIN bookings b ON b.property_id = p.id
         JOIN payments pay ON pay.booking_id = b.id AND pay.status = 'paid'
         WHERE DATE(pay.created_at) >= ? AND DATE(pay.created_at) <= ?
         GROUP BY p.id, p.name, p.type, p.city
         ORDER BY revenue DESC
         LIMIT ?`,
        [startDate, endDate, safeLimit]
      )
    }

    if (!month) {
      month = new Date().toISOString().substring(0, 7)
    }

    const result = await query(
      `SELECT p.id, p.name, p.city, pmr.total_revenue as revenue, pmr.booking_count
       FROM property_monthly_revenue pmr
      JOIN properties p ON pmr.id = p.id
       WHERE pmr.year = ? AND pmr.month = ?
       ORDER BY pmr.total_revenue DESC
       LIMIT ?`,
      (() => {
        const [year, monthNumber] = month.split('-').map(Number)
        return [year, monthNumber, safeLimit]
      })()
    )

    return result
  }

  /**
   * Get cashier shift summary (for POS system)
   */
  async getCashierShiftSummary(shiftId) {
    const shifts = await query(
            `SELECT id, cashier_id, open_time, close_time, opening_balance,
              expected_closing_balance, actual_closing_balance, status
       FROM shifts WHERE id = ?`,
      [shiftId]
    )

    if (shifts.length === 0) {
      throw new NotFoundError('Shift')
    }

    const shift = shifts[0]

    // Get transactions for this shift
    const transactions = await query(
      `SELECT p.id, p.amount, p.method, p.status, b.id as booking_id,
              pr.name as property_name, u.first_name, u.last_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN properties pr ON b.property_id = pr.id
       JOIN users u ON b.customer_id = u.id
       WHERE p.issued_by = ? AND DATE(p.created_at) = DATE(?)
       AND p.created_at >= ? AND p.created_at <= ?
       ORDER BY p.created_at DESC`,
      [shift.cashier_id, shift.open_time, shift.open_time, shift.close_time || new Date()]
    )

    return {
      shift,
      transactions,
    }
  }

  /**
   * Get revenue by date range
   */
  async getRevenueByDateRange(startDate, endDate, propertyId = null) {
    let whereClause = "WHERE pay.status = 'paid' AND DATE(pay.created_at) >= ? AND DATE(pay.created_at) <= ?"
    const params = [startDate, endDate]

    if (propertyId) {
      whereClause += ' AND b.property_id = ?'
      params.push(propertyId)
    }

    const result = await query(
      `SELECT DATE(pay.created_at) as date, SUM(pay.amount) as revenue, COUNT(*) as transaction_count
       FROM payments pay
       JOIN bookings b ON b.id = pay.booking_id
       ${whereClause}
       GROUP BY DATE(pay.created_at)
       ORDER BY date ASC`,
      params
    )

    return result
  }

  /**
   * Get customer activity
   */
  async getCustomerActivity(customerId) {
    // Get booking count
    const bookingCount = await query(
      `SELECT COUNT(*) as count FROM bookings WHERE customer_id = ?`,
      [customerId]
    )

    // Get total spent
    const totalSpent = await query(
      `SELECT SUM(amount) as total FROM payments 
       WHERE booking_id IN (SELECT id FROM bookings WHERE customer_id = ?)
       AND status = 'paid'`,
      [customerId]
    )

    // Get reviews
    const reviews = await query(
      `SELECT COUNT(*) as count FROM reviews WHERE customer_id = ?`,
      [customerId]
    )

    // Get average rating
    const avgRating = await query(
      `SELECT AVG(rating) as average FROM reviews WHERE customer_id = ?`,
      [customerId]
    )

    return {
      totalBookings: bookingCount[0].count || 0,
      totalSpent: totalSpent[0].total || 0,
      reviewsGiven: reviews[0].count || 0,
      averageRating: avgRating[0].average ? parseFloat(avgRating[0].average).toFixed(1) : 0,
    }
  }

  /**
   * Get outstanding balances
   */
  async getOutstandingBalances() {
    const result = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email,
              b.id as booking_id, b.total_amount,
              COALESCE(SUM(p.amount), 0) as paid_amount,
              b.total_amount - COALESCE(SUM(p.amount), 0) as outstanding_amount
       FROM users u
       JOIN bookings b ON u.id = b.customer_id
       LEFT JOIN payments p ON b.id = p.booking_id AND p.status = 'paid'
       WHERE b.status IN ('pending', 'confirmed')
       GROUP BY b.id
       HAVING outstanding_amount > 0
       ORDER BY outstanding_amount DESC`
    )

    return result
  }
  /**
   * Export entire database to JSON
   */
  async exportDatabase() {
    const users = await query('SELECT * FROM users');
    const properties = await query('SELECT * FROM properties');
    const bookings = await query('SELECT * FROM bookings');
    const payments = await query('SELECT * FROM payments');
    const shifts = await query('SELECT * FROM shifts');
    
    return {
      exportDate: new Date().toISOString(),
      data: {
        users,
        properties,
        bookings,
        payments,
        shifts
      }
    };
  }
}

export default new ReportService()
