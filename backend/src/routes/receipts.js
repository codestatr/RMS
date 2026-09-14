import express from 'express';
import ReceiptService from '../services/ReceiptService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';

const router = express.Router();

/**
 * GET /api/receipts/payment/:paymentId
 * Generate or get receipt for a specific payment
 */
router.get(
  '/payment/:paymentId',
  authenticate,
  asyncHandler(async (req, res) => {
    await ReceiptService.assertAccess(req.params.paymentId, req.user);
    const result = await ReceiptService.generateReceipt(req.params.paymentId);

    res.json({
      success: true,
      data: result,
    });
  })
);

router.post(
  '/payment/:paymentId/pdf',
  authenticate,
  asyncHandler(async (req, res) => {
    await ReceiptService.assertAccess(req.params.paymentId, req.user);
    const pdfBuffer = await ReceiptService.generateReceiptPdfBuffer(req.params.paymentId, req.body?.branding || {});
    const receipt = await ReceiptService.generateReceipt(req.params.paymentId);
    const customerName = String(receipt.customer?.name || 'Customer').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${customerName || 'Customer'}-${receipt.receiptNumber}.pdf"`);
    res.send(pdfBuffer);
  })
);

/**
 * GET /api/receipts/payment/:paymentId/pdf
 * Download receipt as PDF
 */
router.get(
  '/payment/:paymentId/pdf',
  authenticate,
  asyncHandler(async (req, res) => {
    await ReceiptService.assertAccess(req.params.paymentId, req.user);
    const pdfBuffer = await ReceiptService.generateReceiptPdfBuffer(req.params.paymentId, {
      name: req.query.businessName,
      logo: req.query.logo,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Receipt-${req.params.paymentId}.pdf`);
    res.send(pdfBuffer);
  })
);

/**
 * GET /api/receipts/number/:receiptNumber
 * Fetch receipt by receipt number
 */
router.get(
  '/number/:receiptNumber',
  authenticate,
  asyncHandler(async (req, res) => {
    const receipt = await ReceiptService.getReceiptByNumber(req.params.receiptNumber);
    await ReceiptService.assertAccess(receipt.paymentId, req.user);
    const result = receipt;

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/receipts
 * List all receipts (Admin / Staff)
 */
router.get(
  '/',
  authenticate,
  requireRole('admin', 'cashier'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const result = await ReceiptService.getAllReceipts(parseInt(page), parseInt(limit));

    res.json({
      success: true,
      data: result,
    });
  })
);

export default router;
