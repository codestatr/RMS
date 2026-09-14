import express from 'express'
import PdfService from '../services/PdfService.js'
import ReportService from '../services/ReportService.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { asyncHandler, ValidationError } from '../utils/errors.js'

const router = express.Router()

/**
 * GET /api/reports/dashboard
 * Get dashboard KPIs and analytics
 */
router.get(
  '/dashboard',
  authenticate,
  requireRole('admin', 'cashier'),
  asyncHandler(async (req, res) => {
    const result = await ReportService.getDashboardKPIs()

    res.json({
      success: true,
      message: 'Dashboard KPIs retrieved',
      data: result,
    })
  })
)

/**
 * GET /api/reports/revenue
 * Get revenue report by date range
 */
router.get(
  '/revenue',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, propertyId } = req.query

    if (!startDate || !endDate) {
      throw new ValidationError('startDate and endDate are required')
    }

    const result = await ReportService.getRevenueByDateRange(startDate, endDate, propertyId)

    res.json({
      success: true,
      message: 'Revenue report retrieved',
      data: {
        startDate,
        endDate,
        revenue: result,
        totalRevenue: result.reduce((sum, r) => sum + (r.revenue || 0), 0),
      },
    })
  })
)

/**
 * GET /api/reports/occupancy
 * Get occupancy rate report
 */
router.get(
  '/occupancy',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, propertyId } = req.query

    const result = await ReportService.getPropertyOccupancyRate(
      propertyId,
      startDate,
      endDate
    )

    res.json({
      success: true,
      message: 'Occupancy report retrieved',
      data: result,
    })
  })
)

/**
 * GET /api/reports/bookings
 * Get bookings report
 */
router.get(
  '/bookings',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const result = await ReportService.getBookingsByStatus()

    res.json({
      success: true,
      message: 'Bookings report retrieved',
      data: {
        byStatus: result,
        totalBookings: result.reduce((sum, r) => sum + r.count, 0),
      },
    })
  })
)

/**
 * GET /api/reports/payments
 * Get payments report by method
 */
router.get(
  '/payments',
  authenticate,
  requireRole('admin', 'cashier'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query

    const result = await ReportService.getPaymentBreakdown(startDate, endDate)

    res.json({
      success: true,
      message: 'Payments report retrieved',
      data: {
        byMethod: result,
        totalRevenue: result.reduce((sum, r) => sum + (r.total || 0), 0),
        totalTransactions: result.reduce((sum, r) => sum + r.count, 0),
      },
    })
  })
)

/**
 * GET /api/reports/outstanding
 * Get outstanding balances report
 */
router.get(
  '/outstanding',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const result = await ReportService.getOutstandingBalances()

    res.json({
      success: true,
      message: 'Outstanding balances report retrieved',
      data: {
        records: result,
        totalOutstanding: result.reduce((sum, r) => sum + (r.outstanding_amount || 0), 0),
      },
    })
  })
)

/**
 * GET /api/reports/top-properties
 * Get top properties by revenue
 */
router.get(
  '/top-properties',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { limit = 10, month } = req.query

    const result = await ReportService.getTopPropertiesByRevenue(limit, month)

    res.json({
      success: true,
      message: 'Top properties retrieved',
      data: result,
    })
  })
)

/**
 * GET /api/reports/customer-activity/:customerId
 * Get customer activity summary
 */
router.get(
  '/customer-activity/:customerId',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const result = await ReportService.getCustomerActivity(req.params.customerId)

    res.json({
      success: true,
      message: 'Customer activity retrieved',
      data: result,
    })
  })
)

/**
 * POST /api/reports/export
 * Export report as PDF or Excel (TODO)
 */
router.post(
  '/export',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { reportType, format, startDate, endDate } = req.body

    if (!reportType || !format) {
      throw new ValidationError('reportType and format are required')
    }

    if (format === 'pdf') {
      const [kpis, paymentBreakdown, topProperties] = await Promise.all([
        ReportService.getDashboardKPIs(),
        ReportService.getPaymentBreakdown(startDate, endDate),
        ReportService.getTopPropertiesByRevenue(10),
      ])
      const pdfBuffer = await PdfService.generateReportPdf({
        kpis,
        paymentBreakdown,
        topProperties,
        businessName: req.body.branding?.name || process.env.BUSINESS_NAME,
        logo: req.body.branding?.logo,
      })
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename=RMS-${reportType}-report.pdf`)
      return res.send(pdfBuffer)
    }

    if (format === 'json' && reportType === 'backup') {
      const data = await ReportService.exportDatabase()
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', 'attachment; filename=rms-backup.json')
      return res.send(JSON.stringify(data, null, 2))
    }

    res.json({
      success: true,
      message: 'Export format/type not fully implemented yet.',
      data: {
        reportType,
        format,
        status: 'pending',
      },
    })
  })
)

export default router
