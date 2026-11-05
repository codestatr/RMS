import { v4 as uuidv4 } from 'uuid'
import { query, transaction } from '../database/db.js'
import { ValidationError, NotFoundError } from '../utils/errors.js'

const SERVICE_TYPES = ['food', 'refreshments', 'transport', 'laundry', 'cleaning', 'other']
const CATERING_TYPES = ['food', 'refreshments']

class GuestServiceService {
  async getCateringMenu(includeUnavailable = false) {
    return query(`SELECT id, item_name, description, image_url, is_available, created_at, updated_at
      FROM catering_menu_items ${includeUnavailable ? '' : 'WHERE is_available = TRUE'} ORDER BY item_name`)
  }

  async createCateringMenuItem(user, input = {}) {
    const itemName = String(input.itemName || '').trim().slice(0, 120)
    const description = String(input.description || '').trim().slice(0, 500)
    const imageUrl = String(input.imageUrl || '')
    if (!itemName) throw new ValidationError('Enter a food or refreshment name')
    if (imageUrl.length > 2_000_000 || !/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/]+=*$/i.test(imageUrl)) {
      throw new ValidationError('Upload a valid compressed JPG, PNG, or WebP image')
    }
    const id = uuidv4()
    await query(`INSERT INTO catering_menu_items (id, item_name, description, image_url, created_by)
      VALUES (?, ?, ?, ?, ?)`, [id, itemName, description || null, imageUrl, user.id])
    const [item] = await query(`SELECT id, item_name, description, image_url, is_available, created_at, updated_at
      FROM catering_menu_items WHERE id = ?`, [id])
    return item
  }

  async setCateringMenuItemAvailability(id, isAvailable) {
    if (typeof isAvailable !== 'boolean') throw new ValidationError('Choose whether this menu item is available')
    await query('UPDATE catering_menu_items SET is_available = ?, updated_at = NOW() WHERE id = ?', [Boolean(isAvailable), id])
    const [item] = await query(`SELECT id, item_name, description, image_url, is_available, created_at, updated_at
      FROM catering_menu_items WHERE id = ?`, [id])
    if (!item) throw new NotFoundError('Catering menu item')
    return item
  }

  async withResponseImages(requests) {
    if (!requests.length) return requests
    const ids = requests.map((request) => request.id)
    const images = await query(`SELECT response.request_id, response.id, response.menu_item_id, response.caption,
        response.guest_response, response.guest_responded_at, menu.image_url, response.created_at
      FROM guest_service_response_images response JOIN catering_menu_items menu ON menu.id = response.menu_item_id
      WHERE response.request_id IN (${ids.map(() => '?').join(',')}) ORDER BY response.created_at`, ids)
    const byRequest = new Map()
    for (const image of images) byRequest.set(image.request_id, [...(byRequest.get(image.request_id) || []), image])
    return requests.map((request) => ({ ...request, response_images: byRequest.get(request.id) || [] }))
  }

  async create(customer, input = {}) {
    const bookingId = String(input.bookingId || '')
    const serviceType = String(input.serviceType || '')
    let details = String(input.details || '').trim().slice(0, 2000)
    let selectedMenuLines = []
    const serviceLocation = String(input.serviceLocation || '').trim().slice(0, 255)
    const pickupLocation = String(input.pickupLocation || '').trim().slice(0, 255)
    const destination = String(input.destination || '').trim().slice(0, 255)
    if (!bookingId || !SERVICE_TYPES.includes(serviceType)) {
      throw new ValidationError('Choose a booking and service, and describe what you need')
    }
    if (serviceType === 'transport' && (!pickupLocation || !destination || !input.requestedFor)) {
      throw new ValidationError('Transport needs a pickup location, destination, and pickup time')
    }
    if (serviceType === 'transport' && !details) details = `Additional transport from ${pickupLocation} to ${destination}`
    if (CATERING_TYPES.includes(serviceType) && input.menuItems !== undefined) {
      if (!Array.isArray(input.menuItems) || input.menuItems.length > 12) throw new ValidationError('Choose up to 12 menu items')
      const uniqueItems = new Map()
      for (const item of input.menuItems) {
        const menuItemId = String(item?.menuItemId || '')
        const quantity = Number(item?.quantity)
        if (!menuItemId || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw new ValidationError('Choose a valid menu item and quantity')
        uniqueItems.set(menuItemId, quantity)
      }
      if (uniqueItems.size !== input.menuItems.length) throw new ValidationError('Each menu item can only be selected once')
      if (uniqueItems.size) {
        const menu = await query(`SELECT id, item_name FROM catering_menu_items WHERE is_available = TRUE AND id IN (${[...uniqueItems.keys()].map(() => '?').join(',')})`, [...uniqueItems.keys()])
        if (menu.length !== uniqueItems.size) throw new ValidationError('One or more selected menu items are unavailable. Refresh the menu and try again.')
        selectedMenuLines = menu.map((item) => `${uniqueItems.get(item.id)} x ${item.item_name}`)
      }
    }
    if (selectedMenuLines.length) details = [`Selected menu items:\n${selectedMenuLines.join('\n')}`, details].filter(Boolean).join('\n\n').slice(0, 2000)
    if (!details) throw new ValidationError('Choose at least one available menu item or describe what you need')
    let requestedFor = null
    if (input.requestedFor) {
      const date = new Date(input.requestedFor)
      if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() - 60_000) throw new ValidationError('Choose a valid future service time')
      requestedFor = date
    }
    const [booking] = await query(`SELECT b.id, b.property_id, b.status FROM bookings b
      WHERE b.id = ? AND b.customer_id = ?`, [bookingId, customer.id])
    if (!booking) throw new NotFoundError('Booking')
    if (!['confirmed', 'checked_in'].includes(booking.status)) {
      throw new ValidationError('Guest services can be requested for confirmed or active stays')
    }
    const id = uuidv4()
    await query(`INSERT INTO guest_service_requests
      (id, booking_id, property_id, customer_id, service_type, request_details, service_location, pickup_location, destination, requested_for)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, booking.id, booking.property_id, customer.id, serviceType, details, serviceLocation || (serviceType === 'transport' ? null : 'Inside the room'), pickupLocation || null, destination || null, requestedFor])

    const staff = await query(`SELECT id FROM users WHERE status = 'active' AND (
      role IN ('admin', 'cashier')
      OR (role = 'catering' AND ? IN ('food', 'refreshments'))
      OR (role = 'property_owner' AND id = (SELECT owner_id FROM properties WHERE id = ?))
      OR (role = 'housekeeping' AND ? IN ('cleaning', 'laundry'))
    )`, [serviceType, booking.property_id, serviceType])
    const teamBoard = CATERING_TYPES.includes(serviceType)
      ? 'Catering Orders'
      : ['laundry', 'cleaning'].includes(serviceType)
        ? 'Housekeeping Workboard'
        : 'Guest Services Desk'
    for (const recipient of staff) {
      await query(`INSERT INTO notifications (id, recipient_id, sender_id, title, message, type)
        VALUES (?, ?, ?, ?, ?, 'guest_service_request')`, [uuidv4(), recipient.id, customer.id,
        `${serviceType[0].toUpperCase()}${serviceType.slice(1)} service requested`, `A guest requested ${serviceType} service. Open ${teamBoard} to review.`])
    }
    return this.getById(id)
  }

  async getById(id) {
    const rows = await query(`SELECT r.*, p.name AS property_name, b.check_in_date, b.check_out_date,
      (SELECT payment.receipt_number FROM guest_service_payments payment
       WHERE payment.request_id = r.id AND payment.status = 'paid'
       ORDER BY payment.created_at DESC LIMIT 1) AS service_payment_receipt,
      (SELECT payment.transaction_ref FROM guest_service_payments payment
       WHERE payment.request_id = r.id AND payment.status = 'pending'
       ORDER BY payment.created_at DESC LIMIT 1) AS service_payment_checkout_id,
      (SELECT payment.notes FROM guest_service_payments payment
       WHERE payment.request_id = r.id AND payment.status = 'pending'
       ORDER BY payment.created_at DESC LIMIT 1) AS service_payment_note,
      u.first_name, u.last_name, u.email, u.phone, handled.first_name AS handled_first_name, handled.last_name AS handled_last_name
      FROM guest_service_requests r JOIN properties p ON p.id = r.property_id
      JOIN bookings b ON b.id = r.booking_id JOIN users u ON u.id = r.customer_id
      LEFT JOIN users handled ON handled.id = r.handled_by WHERE r.id = ?`, [id])
    if (!rows.length) throw new NotFoundError('Guest service request')
    return (await this.withResponseImages(rows))[0]
  }

  async getMine(customerId) {
    const rows = await query(`SELECT r.*, p.name AS property_name, b.check_in_date, b.check_out_date,
      (SELECT payment.receipt_number FROM guest_service_payments payment
       WHERE payment.request_id = r.id AND payment.status = 'paid'
       ORDER BY payment.created_at DESC LIMIT 1) AS service_payment_receipt,
      (SELECT payment.transaction_ref FROM guest_service_payments payment
       WHERE payment.request_id = r.id AND payment.status = 'pending'
       ORDER BY payment.created_at DESC LIMIT 1) AS service_payment_checkout_id,
      (SELECT payment.notes FROM guest_service_payments payment
       WHERE payment.request_id = r.id AND payment.status = 'pending'
       ORDER BY payment.created_at DESC LIMIT 1) AS service_payment_note
      FROM guest_service_requests r JOIN properties p ON p.id = r.property_id
      JOIN bookings b ON b.id = r.booking_id WHERE r.customer_id = ?
      ORDER BY r.created_at DESC LIMIT 200`, [customerId])
    return this.withResponseImages(rows)
  }

  async getForStaff(user) {
    const clauses = []
    const params = []
    if (user.role === 'property_owner') { clauses.push('p.owner_id = ?'); params.push(user.id) }
    if (user.role === 'housekeeping') { clauses.push("r.service_type IN ('cleaning', 'laundry')") }
    if (user.role === 'catering') { clauses.push("r.service_type IN ('food', 'refreshments')") }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = await query(`SELECT r.*, p.name AS property_name, b.check_in_date, b.check_out_date,
      (SELECT payment.receipt_number FROM guest_service_payments payment
       WHERE payment.request_id = r.id AND payment.status = 'paid'
       ORDER BY payment.created_at DESC LIMIT 1) AS service_payment_receipt,
      (SELECT payment.transaction_ref FROM guest_service_payments payment
       WHERE payment.request_id = r.id AND payment.status = 'pending'
       ORDER BY payment.created_at DESC LIMIT 1) AS service_payment_checkout_id,
      u.first_name, u.last_name, u.email, u.phone,
      handled.first_name AS handled_first_name, handled.last_name AS handled_last_name
      FROM guest_service_requests r JOIN properties p ON p.id = r.property_id
      JOIN bookings b ON b.id = r.booking_id JOIN users u ON u.id = r.customer_id
      LEFT JOIN users handled ON handled.id = r.handled_by ${where}
      ORDER BY FIELD(r.status, 'requested', 'accepted', 'in_progress', 'completed', 'declined'), r.created_at DESC LIMIT 300`, params)
    return this.withResponseImages(rows)
  }

  async update(id, input, user) {
    const request = await this.getById(id)
    if (user.role === 'property_owner') {
      const [ownership] = await query('SELECT id FROM properties WHERE id = ? AND owner_id = ?', [request.property_id, user.id])
      if (!ownership) throw new ValidationError('This service request is not for your property')
    }
    if (user.role === 'housekeeping' && !['cleaning', 'laundry'].includes(request.service_type)) {
      throw new ValidationError('Housekeeping staff can only handle cleaning and laundry requests')
    }
    if (user.role === 'catering' && !CATERING_TYPES.includes(request.service_type)) {
      throw new ValidationError('Catering staff can only handle food and refreshments requests')
    }
    let selectedMenuItems = null
    if (input.menuItemIds !== undefined) {
      if (!['admin', 'catering'].includes(user.role) || !CATERING_TYPES.includes(request.service_type)) {
        throw new ValidationError('Only catering staff can attach food images to food and refreshments requests')
      }
      const ids = [...new Set(Array.isArray(input.menuItemIds) ? input.menuItemIds.map(String) : [])]
      if (ids.length > 8) throw new ValidationError('Choose up to 8 food images for a guest reply')
      selectedMenuItems = ids.length
      ? await query(`SELECT menu.id, menu.item_name FROM catering_menu_items menu
          WHERE menu.id IN (${ids.map(() => '?').join(',')})
          AND (menu.is_available = TRUE OR EXISTS (
            SELECT 1 FROM guest_service_response_images response
            WHERE response.request_id = ? AND response.menu_item_id = menu.id
          ))`, [...ids, id])
        : []
      if (selectedMenuItems.length !== ids.length) throw new ValidationError('One or more selected food items are no longer available')
    }
    const status = input.status
    if (!['accepted', 'in_progress', 'completed', 'declined'].includes(status)) throw new ValidationError('Invalid service request status')
    const amount = input.quotedAmount === undefined || input.quotedAmount === '' ? request.quoted_amount : Number(input.quotedAmount)
    if (amount !== null && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) throw new ValidationError('Quoted amount must be zero or more')
    const amountChanged = Number(amount ?? 0) !== Number(request.quoted_amount ?? 0)
    if (amountChanged && request.payment_status === 'paid') throw new ValidationError('A paid service quote cannot be changed')
    if (amountChanged && request.payment_status === 'pending') throw new ValidationError('Wait for the pending M-Pesa payment to finish before changing the quote')
    if (status === 'accepted' && CATERING_TYPES.includes(request.service_type) && !(Number(amount) > 0)) {
      throw new ValidationError('Enter a food quote greater than zero before accepting this order')
    }
    if (status === 'accepted' && ['laundry', 'transport'].includes(request.service_type) && amount === null) {
      throw new ValidationError('Enter the service quote before accepting this order')
    }
    if (status === 'in_progress' && request.response_images.length > 0 && !request.response_images.some((image) => image.guest_response === 'accepted')) {
      throw new ValidationError('Wait for the guest to accept at least one food photo before preparing the order')
    }
    if (status === 'in_progress' && Number(amount || 0) > 0 && request.payment_status !== 'paid') {
      throw new ValidationError('Wait for the guest to pay the service quote before starting the order')
    }
    if (status === 'in_progress' && CATERING_TYPES.includes(request.service_type) && (!(Number(amount) > 0) || request.payment_status !== 'paid')) {
      throw new ValidationError('Food and refreshments must be paid in full before preparation starts')
    }
    if (status === 'declined' && request.payment_status === 'paid') throw new ValidationError('A paid service request cannot be declined')
    const paymentStatus = Number(amount || 0) > 0
      ? (amountChanged || request.payment_status === 'not_required' ? 'unpaid' : request.payment_status || 'unpaid')
      : 'not_required'
    const notes = input.staffNotes === undefined ? request.staff_notes : String(input.staffNotes).trim().slice(0, 1000)
    if (selectedMenuItems === null) {
      await query(`UPDATE guest_service_requests SET status = ?, quoted_amount = ?, payment_status = ?, staff_notes = ?, handled_by = ?, updated_at = NOW() WHERE id = ?`,
        [status, amount ?? null, paymentStatus, notes || null, user.id, id])
    } else {
      await transaction(async (connection) => {
        await connection.execute(`UPDATE guest_service_requests SET status = ?, quoted_amount = ?, payment_status = ?, staff_notes = ?, handled_by = ?, updated_at = NOW() WHERE id = ?`,
          [status, amount ?? null, paymentStatus, notes || null, user.id, id])
        await connection.execute('DELETE FROM guest_service_response_images WHERE request_id = ?', [id])
        for (const item of selectedMenuItems) {
          await connection.execute(`INSERT INTO guest_service_response_images (id, request_id, menu_item_id, caption) VALUES (?, ?, ?, ?)`,
            [uuidv4(), id, item.id, item.item_name])
        }
      })
    }
    return this.getById(id)
  }

  async shareMenuItems(id, menuItemIds, user) {
    const request = await this.getById(id)
    if (!['admin', 'catering'].includes(user.role) || !CATERING_TYPES.includes(request.service_type)) {
      throw new ValidationError('Only catering staff can send food photos for food and refreshments requests')
    }
    const ids = [...new Set(Array.isArray(menuItemIds) ? menuItemIds.map(String) : [])]
    if (!ids.length) throw new ValidationError('Select at least one available menu photo to send')
    if (ids.length > 8) throw new ValidationError('Choose up to 8 food photos for a guest reply')
    const menuItems = await query(`SELECT menu.id, menu.item_name FROM catering_menu_items menu
      WHERE menu.id IN (${ids.map(() => '?').join(',')})
      AND (menu.is_available = TRUE OR EXISTS (
        SELECT 1 FROM guest_service_response_images response
        WHERE response.request_id = ? AND response.menu_item_id = menu.id
      ))`, [...ids, id])
    if (menuItems.length !== ids.length) throw new ValidationError('One or more selected food items are no longer available')

    await transaction(async (connection) => {
      await connection.execute('DELETE FROM guest_service_response_images WHERE request_id = ?', [id])
      for (const item of menuItems) {
        await connection.execute(`INSERT INTO guest_service_response_images (id, request_id, menu_item_id, caption)
          VALUES (?, ?, ?, ?)`, [uuidv4(), id, item.id, item.item_name])
      }
      await connection.execute('UPDATE guest_service_requests SET handled_by = ?, updated_at = NOW() WHERE id = ?', [user.id, id])
    })
    return this.getById(id)
  }

  async respondToPhoto(id, responseImageId, decision, customerId) {
    if (!['accepted', 'declined'].includes(decision)) throw new ValidationError('Choose whether to accept or decline this food item')
    const request = await this.getById(id)
    if (request.customer_id !== customerId) throw new NotFoundError('Guest service request')
    if (!CATERING_TYPES.includes(request.service_type)) throw new ValidationError('Food photo responses are only available for catering requests')
    if (['in_progress', 'completed', 'declined'].includes(request.status)) {
      throw new ValidationError('This order can no longer be changed')
    }
    const image = request.response_images.find((item) => item.id === responseImageId)
    if (!image) throw new NotFoundError('Food photo')

    await query(`UPDATE guest_service_response_images SET guest_response = ?, guest_responded_at = NOW()
      WHERE id = ? AND request_id = ?`, [decision, responseImageId, id])
    const staff = await query("SELECT id FROM users WHERE status = 'active' AND role IN ('admin', 'catering')")
    const verb = decision === 'accepted' ? 'accepted' : 'declined'
    for (const recipient of staff) {
      await query(`INSERT INTO notifications (id, recipient_id, sender_id, title, message, type)
        VALUES (?, ?, ?, ?, ?, 'guest_service_request')`, [uuidv4(), recipient.id, customerId,
        `Guest ${verb} a food photo`, `The guest ${verb} ${image.caption}. Open Catering Orders to review.`])
    }
    return this.getById(id)
  }

  async verifyGuestServicePayment(id, receiptNumber, user) {
    if (!['admin', 'cashier', 'catering'].includes(user.role)) {
      throw new ValidationError('Only catering or payment staff can verify a service payment')
    }
    const receipt = String(receiptNumber || '').trim().toUpperCase()
    if (!/^[A-Z0-9]{5,20}$/.test(receipt)) {
      throw new ValidationError('Enter the M-Pesa receipt code from the guest payment confirmation')
    }
    const request = await this.getById(id)
    if (!CATERING_TYPES.includes(request.service_type)) {
      throw new ValidationError('Manual receipt verification is only available for catering orders')
    }
    if (request.status !== 'accepted' || !(Number(request.quoted_amount) > 0)) {
      throw new ValidationError('Only an accepted catering order with a positive quote can be verified')
    }
    if (request.payment_status === 'paid') return request
    const [payment] = await query(`SELECT id, status FROM guest_service_payments
      WHERE request_id = ? ORDER BY created_at DESC LIMIT 1`, [id])
    if (!payment || !['pending', 'failed'].includes(payment.status)) {
      throw new ValidationError('There is no pending M-Pesa payment to verify')
    }
    await transaction(async (connection) => {
      await connection.execute(`UPDATE guest_service_payments
        SET status = 'paid', receipt_number = ?, verified_by = ?, notes = 'Receipt verified by catering staff', updated_at = NOW()
        WHERE id = ?`, [receipt, user.id, payment.id])
      await connection.execute("UPDATE guest_service_requests SET payment_status = 'paid', updated_at = NOW() WHERE id = ?", [id])
    })
    return this.getById(id)
  }
}

export default new GuestServiceService()
