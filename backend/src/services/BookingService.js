import { v4 as uuidv4 } from 'uuid'
import { query } from '../database/db.js'
import {
  ValidationError,
  NotFoundError,
} from '../utils/errors.js'
import {
  validateBookingStatus,
  validateDate,
  sanitizeInput,
} from '../utils/validation.js'
import NotificationService from './NotificationService.js'

class BookingService {
  /**
   * Create booking
   */
  async createBooking(customerId, data) {
    const {
      propertyId,
      checkInDate,
      checkOutDate,
      numberOfGuests,
      specialRequests,
      arrivalWindow,
      addonIds = [],
      pickupLocation,
      pickupTime,
      pickupNotes,
      pickupDestination,
      discountAmount = 0,
    } = sanitizeInput(data)

    // Validate input
    if (!propertyId || !checkInDate || !checkOutDate) {
      throw new ValidationError('Missing required fields')
    }

    if (!validateDate(checkInDate) || !validateDate(checkOutDate)) {
      throw new ValidationError('Invalid date format')
    }

    // Validate date logic
    const checkIn = new Date(checkInDate)
    const checkOut = new Date(checkOutDate)

    if (checkIn >= checkOut) {
      throw new ValidationError('Check-out date must be after check-in date')
    }

    if (checkIn < new Date()) {
      throw new ValidationError('Check-in date cannot be in the past')
    }

    // Get property
    const properties = await query(
      'SELECT id, price_per_night FROM properties WHERE id = ?',
      [propertyId]
    )

    if (properties.length === 0) {
      throw new NotFoundError('Property')
    }

    // Check availability
    const bookings = await query(
      `SELECT id FROM bookings
       WHERE property_id = ? 
       AND status IN ('confirmed', 'checked_in')
       AND check_in_date < ?
       AND check_out_date > ?`,
      [propertyId, checkOutDate, checkInDate]
    )

    if (bookings.length > 0) {
      throw new ValidationError('Property is not available for the selected dates')
    }

    const selectedAddonIds = Array.isArray(addonIds) ? [...new Set(addonIds)] : []
    const addons = selectedAddonIds.length
      ? await query(
        `SELECT id, name, price FROM service_addons
         WHERE id IN (${selectedAddonIds.map(() => '?').join(',')}) AND active = TRUE`,
        selectedAddonIds
      )
      : []
    if (addons.length !== selectedAddonIds.length) {
      throw new ValidationError('One or more selected services are unavailable')
    }
    if (selectedAddonIds.includes('addon-airport') && (!pickupLocation || !pickupTime || !pickupDestination)) {
      throw new ValidationError('Pickup location, room destination, and pickup time are required for airport or room transfer')
    }

    const roomDropoffNote = pickupDestination ? `Room destination: ${pickupDestination}` : ''
    const persistedPickupNotes = [pickupNotes, roomDropoffNote].filter(Boolean).join(' | ') || null

    // Calculate total amount, including selected local services.
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
    const stayAmount = nights * Number(properties[0].price_per_night)
    const safeDiscount = Math.min(Math.max(0, Number(discountAmount) || 0), stayAmount)
    const addonAmount = addons.reduce((sum, addon) => sum + Number(addon.price), 0)
    const taxableAmount = stayAmount - safeDiscount + addonAmount
    const totalAmount = taxableAmount + Math.round(taxableAmount * 0.16)

    // Create booking
    const bookingId = uuidv4()

    await query(
      `INSERT INTO bookings (
        id, property_id, customer_id, check_in_date, check_out_date,
        number_of_guests, total_amount, discount_code, discount_amount, status, source, special_requests, arrival_window,
        pickup_location, pickup_time, pickup_notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'website', ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        bookingId, propertyId, customerId, checkInDate, checkOutDate,
        numberOfGuests || 1, totalAmount, data.discountCode || null, safeDiscount,
        specialRequests || null, arrivalWindow || null, pickupLocation || null,
        pickupTime || null, persistedPickupNotes,
      ]
    )

    for (const addon of addons) {
      await query(
        `INSERT INTO booking_addons (id, booking_id, addon_id, quantity, unit_price)
         VALUES (?, ?, ?, 1, ?)`,
        [uuidv4(), bookingId, addon.id, addon.price]
      )
    }

    const bookingDetails = await this.getBookingById(bookingId)
    
    // Send email notification
    if (bookingDetails.email) {
      NotificationService.sendBookingConfirmation(
        bookingDetails.email,
        bookingDetails.first_name,
        {
          propertyName: bookingDetails.property_name,
          checkInDate,
          checkOutDate,
          totalAmount
        }
      )
    }

    return bookingDetails
  }

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId) {
    const bookings = await query(
      `SELECT b.*,
              p.name as property_name,
              p.type as property_type,
              p.address as property_address,
              u.first_name, u.last_name, u.email, u.phone
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       JOIN users u ON b.customer_id = u.id
       WHERE b.id = ?`,
      [bookingId]
    )

    if (bookings.length === 0) {
      throw new NotFoundError('Booking')
    }

    const addonRows = await query(
      `SELECT ba.addon_id, sa.name, sa.description, ba.quantity, ba.unit_price, ba.status
       FROM booking_addons ba JOIN service_addons sa ON sa.id = ba.addon_id
       WHERE ba.booking_id = ? ORDER BY sa.name`,
      [bookingId]
    )
    return this.formatBooking({ ...bookings[0], addons: addonRows })
  }

  async getAvailableAddons() {
    return query(
      'SELECT id, name, description, price FROM service_addons WHERE active = TRUE ORDER BY name'
    )
  }

  async getServiceRequests(status = null) {
    const params = []
    const where = status ? 'WHERE ba.status = ?' : ''
    if (status) params.push(status)
    return query(
            `SELECT ba.id, ba.booking_id, ba.addon_id, ba.quantity, ba.unit_price, ba.status,
              ba.assigned_to, ba.fulfillment_status,
              ba.created_at, ba.fulfilled_at, sa.name AS service_name,
              p.name AS property_name, b.check_in_date, b.check_out_date,
              b.pickup_location, b.pickup_time, b.pickup_notes,
              u.first_name, u.last_name, u.phone,
              assigned.first_name AS assigned_first_name, assigned.last_name AS assigned_last_name
       FROM booking_addons ba
       JOIN service_addons sa ON sa.id = ba.addon_id
       JOIN bookings b ON b.id = ba.booking_id
       JOIN properties p ON p.id = b.property_id
       JOIN users u ON u.id = b.customer_id
      LEFT JOIN users assigned ON assigned.id = ba.assigned_to
       ${where}
       ORDER BY FIELD(ba.status, 'pending', 'approved', 'fulfilled', 'declined'), ba.created_at DESC`,
      params
    )
  }

  async updateServiceRequest(requestId, status, staffId, fulfillmentStatus = null, assignedTo = null) {
    const allowed = ['approved', 'declined', 'fulfilled']
    const fulfillmentStates = ['pending', 'assigned', 'en_route', 'arrived', 'completed']
    if (!allowed.includes(status)) throw new ValidationError('Invalid service request status')
    if (fulfillmentStatus && !fulfillmentStates.includes(fulfillmentStatus)) throw new ValidationError('Invalid fulfillment status')
    const requests = await query('SELECT id, status, addon_id FROM booking_addons WHERE id = ?', [requestId])
    if (!requests.length) throw new NotFoundError('Service request')
    if (status === 'fulfilled' && requests[0].status !== 'approved') {
      throw new ValidationError('Only approved services can be marked fulfilled')
    }
    if (assignedTo) {
      const staff = await query("SELECT id FROM users WHERE id = ? AND role IN ('admin', 'cashier') AND status = 'active'", [assignedTo])
      if (!staff.length) throw new ValidationError('Assigned staff member is unavailable')
    }
    const nextFulfillment = fulfillmentStatus || (status === 'fulfilled' ? 'completed' : null)
    await query(
      `UPDATE booking_addons SET status = ?, approved_by = ?,
       assigned_to = COALESCE(?, assigned_to),
       fulfillment_status = COALESCE(?, fulfillment_status),
       fulfilled_at = ${nextFulfillment === 'completed' || status === 'fulfilled' ? 'NOW()' : 'NULL'}
       WHERE id = ?`,
      [status, staffId, assignedTo, nextFulfillment, requestId]
    )
    if (assignedTo) {
      await query(
        `INSERT INTO notifications (id, recipient_id, sender_id, title, message, type)
         VALUES (?, ?, ?, 'Pickup assigned', 'You have been assigned an airport pickup request.', 'pickup_assignment')`,
        [uuidv4(), assignedTo, staffId]
      )
    }
    return this.getServiceRequests()
  }

  /**
   * Get customer bookings
   */
  async getCustomerBookings(customerId, status = null, page = 1, limit = 20) {
    let whereClause = 'WHERE b.customer_id = ?'
    const params = [customerId]

    if (status) {
      whereClause += ' AND b.status = ?'
      params.push(status)
    }

    const offset = (page - 1) * limit

    const countResult = await query(
      `SELECT COUNT(*) as total FROM bookings b ${whereClause}`,
      params
    )
    const total = countResult[0].total

    const bookings = await query(
      `SELECT b.*, p.name as property_name, p.type as property_type
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return {
      data: bookings.map((booking) => this.formatBooking(booking)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Get all bookings (admin)
   */
  async getAllBookings(filters = {}, page = 1, limit = 20) {
    const { status, propertyId, customerId, source } = filters

    let whereClause = 'WHERE 1=1'
    const params = []

    if (status) {
      whereClause += ' AND b.status = ?'
      params.push(status)
    }

    if (propertyId) {
      whereClause += ' AND b.property_id = ?'
      params.push(propertyId)
    }

    if (customerId) {
      whereClause += ' AND b.customer_id = ?'
      params.push(customerId)
    }

    if (source) {
      whereClause += ' AND b.source = ?'
      params.push(source)
    }

    const offset = (page - 1) * limit

    const countResult = await query(
      `SELECT COUNT(*) as total FROM bookings b ${whereClause}`,
      params
    )
    const total = countResult[0].total

    const bookings = await query(
      `SELECT b.*, p.name as property_name, u.first_name, u.last_name
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       JOIN users u ON b.customer_id = u.id
       ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return {
      data: bookings.map((booking) => this.formatBooking(booking)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(bookingId, newStatus, userId = null, userRole = null) {
    if (!validateBookingStatus(newStatus)) {
      throw new ValidationError('Invalid booking status')
    }

    const bookings = await query('SELECT id, status FROM bookings WHERE id = ?', [bookingId])

    if (bookings.length === 0) {
      throw new NotFoundError('Booking')
    }

    // Validate status transitions
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['checked_in', 'cancelled'],
      checked_in: ['checked_out'],
      checked_out: [],
      cancelled: [],
    }

    if (!validTransitions[bookings[0].status].includes(newStatus)) {
      throw new ValidationError(
        `Cannot change status from ${bookings[0].status} to ${newStatus}`
      )
    }

    await query('UPDATE bookings SET status = ?, updated_at = NOW() WHERE id = ?', [
      newStatus,
      bookingId,
    ])

    return this.getBookingById(bookingId)
  }

  /**
   * Cancel booking
   */
  async cancelBooking(bookingId, customerId, reason = null) {
    const bookings = await query('SELECT customer_id, status FROM bookings WHERE id = ?', [
      bookingId,
    ])

    if (bookings.length === 0) {
      throw new NotFoundError('Booking')
    }

    if (bookings[0].customer_id !== customerId) {
      throw new ValidationError('You do not have permission to cancel this booking')
    }

    if (bookings[0].status === 'cancelled') {
      throw new ValidationError('Booking is already cancelled')
    }

    if (bookings[0].status === 'checked_out') {
      throw new ValidationError('Cannot cancel a completed booking')
    }

    await query(
      'UPDATE bookings SET status = ?, updated_at = NOW() WHERE id = ?',
      ['cancelled', bookingId]
    )

    return { message: 'Booking cancelled successfully' }
  }

  /**
   * Get bookings for a property (for availability checking)
   */
  async getPropertyBookings(propertyId, startDate, endDate) {
    const bookings = await query(
      `SELECT id, check_in_date, check_out_date, status
       FROM bookings
       WHERE property_id = ?
       AND status IN ('confirmed', 'checked_in')
       AND check_in_date < ?
       AND check_out_date > ?
       ORDER BY check_in_date`,
      [propertyId, endDate, startDate]
    )

    return bookings
  }

  async updateArrivalDetails(bookingId, customerId, arrivalWindow, specialRequests) {
    const allowedWindows = ['morning', 'afternoon', 'evening', 'late_night']
    if (arrivalWindow && !allowedWindows.includes(arrivalWindow)) {
      throw new ValidationError('Invalid arrival window')
    }

    const bookings = await query(
      'SELECT id, status FROM bookings WHERE id = ? AND customer_id = ?',
      [bookingId, customerId]
    )
    if (!bookings.length) throw new NotFoundError('Booking')
    if (['cancelled', 'checked_out'].includes(bookings[0].status)) {
      throw new ValidationError('Arrival details cannot be changed for this booking')
    }

    await query(
      `UPDATE bookings SET arrival_window = COALESCE(?, arrival_window),
       special_requests = COALESCE(?, special_requests), updated_at = NOW()
       WHERE id = ?`,
      [arrivalWindow || null, specialRequests || null, bookingId]
    )
    return this.getBookingById(bookingId)
  }

  /**
   * Format booking object
   */
  formatBooking(booking) {
    return {
      id: booking.id,
      propertyId: booking.property_id,
      propertyName: booking.property_name,
      propertyType: booking.property_type,
      propertyAddress: booking.property_address,
      customerId: booking.customer_id,
      customerName: `${booking.first_name} ${booking.last_name}`,
      customerEmail: booking.email,
      customerPhone: booking.phone,
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      numberOfGuests: booking.number_of_guests,
      totalAmount: booking.total_amount,
      status: booking.status,
      source: booking.source,
      specialRequests: booking.special_requests,
      arrivalWindow: booking.arrival_window,
      pickupLocation: booking.pickup_location,
      pickupTime: booking.pickup_time,
      pickupNotes: booking.pickup_notes,
      addons: (booking.addons || []).map((addon) => ({
        id: addon.addon_id,
        name: addon.name,
        description: addon.description,
        quantity: addon.quantity,
        unitPrice: addon.unit_price,
        status: addon.status,
      })),
      createdAt: booking.created_at,
      updatedAt: booking.updated_at,
    }
  }
}

export default new BookingService()
