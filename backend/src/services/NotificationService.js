import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class NotificationService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: process.env.SMTP_PORT || 587,
      auth: {
        user: process.env.SMTP_USER || 'test@ethereal.email',
        pass: process.env.SMTP_PASS || 'testpass',
      },
    });
  }

  async sendEmail(to, subject, htmlContent) {
    try {
      const info = await this.transporter.sendMail({
        from: `"RMS System" <${process.env.SMTP_USER || 'noreply@rms.local'}>`,
        to,
        subject,
        html: htmlContent,
      });
      console.log(`Email sent successfully to ${to}. Message ID: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  async sendBookingConfirmation(email, name, bookingDetails) {
    const subject = `Booking Confirmed - ${bookingDetails.propertyName}`;
    const html = `
      <h1>Hello ${name},</h1>
      <p>Your booking for <strong>${bookingDetails.propertyName}</strong> has been confirmed!</p>
      <p><strong>Check-in:</strong> ${bookingDetails.checkInDate}</p>
      <p><strong>Check-out:</strong> ${bookingDetails.checkOutDate}</p>
      <p><strong>Total Amount:</strong> $${bookingDetails.totalAmount}</p>
      <p>Thank you for choosing RMS.</p>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendPaymentReceipt(email, name, paymentDetails, pdfBuffer = null) {
    const subject = `Payment Receipt - ${paymentDetails.receiptNumber}`;
    const html = `
      <h1>Hello ${name},</h1>
      <p>We have received your payment of <strong>$${paymentDetails.amount}</strong>.</p>
      <p>Your receipt number is ${paymentDetails.receiptNumber}.</p>
      <p>Thank you for your business!</p>
    `;
    
    const mailOptions = {
        from: `"RMS System" <${process.env.SMTP_USER || 'noreply@rms.local'}>`,
        to: email,
        subject,
        html,
    };
    
    if (pdfBuffer) {
        mailOptions.attachments = [
            {
                filename: `Receipt-${paymentDetails.receiptNumber}.pdf`,
                content: pdfBuffer
            }
        ];
    }
    
    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Receipt email sent successfully to ${email}. Message ID: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error('Error sending receipt email:', error);
      return false;
    }
  }
  
  async sendOTP(email, name, otp) {
    const subject = `Your RMS Login Verification Code`;
    const html = `
      <h1>Hello ${name},</h1>
      <p>Your two-factor authentication code is:</p>
      <h2 style="background-color: #f59e0b; padding: 10px; display: inline-block; color: white;">${otp}</h2>
      <p>This code will expire in 10 minutes.</p>
    `;
    return this.sendEmail(email, subject, html);
  }
}

export default new NotificationService();
