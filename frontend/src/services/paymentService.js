import api from './api';

export const paymentService = {
  async create(data) {
    const res = await api.post('/payments', data);
    return res.data;
  },

  async initiateMpesaStk(data) {
    const res = await api.post('/payments/mpesa/stk-push', data);
    return res.data;
  },

  async getMpesaStatus(checkoutRequestId) {
    const res = await api.get(`/payments/mpesa/status/${checkoutRequestId}`);
    return res.data;
  },

  async getReceipt(paymentId) {
    const res = await api.get(`/receipts/payment/${paymentId}`);
    return res.data;
  },

  async getReceiptByNumber(receiptNumber) {
    const res = await api.get(`/receipts/number/${receiptNumber}`);
    return res.data;
  },

  async getBookingPayments(bookingId) {
    const res = await api.get(`/payments/booking/${bookingId}`);
    return res.data;
  },
};
