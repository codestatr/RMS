import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const PAGE = { width: 595.28, height: 841.89, left: 42, right: 553 };
const COLORS = {
  ink: '#171b19',
  text: '#243129',
  muted: '#627067',
  rule: '#d7dfe6',
  stripe: '#f0f4f8',
  paper: '#ffffff',
};

class PdfService {
  getBrandColor(color) {
    return /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#176b52';
  }

  getImageSource(image) {
    if (!image || !String(image).startsWith('data:image/')) return image;
    const match = String(image).match(/^data:image\/[^;]+;base64,(.+)$/);
    return match ? Buffer.from(match[1], 'base64') : image;
  }

  getSupportedLogo(image) {
    const source = this.getImageSource(image);
    if (Buffer.isBuffer(source)) {
      const isPng = source.length > 8 && source.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const isJpeg = source.length > 3 && source[0] === 0xff && source[1] === 0xd8 && source[2] === 0xff;
      return isPng || isJpeg ? source : null;
    }
    if (typeof source === 'string' && fs.existsSync(source) && /\.(png|jpe?g)$/i.test(source)) return source;
    return null;
  }

  drawLogo(doc, source, x, y, size, businessName) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    doc.circle(cx, cy, size / 2).fill('#ffffff');
    const logo = this.getSupportedLogo(source);
    if (logo) {
      try {
        doc.save();
        doc.circle(cx, cy, size / 2 - 1).clip();
        doc.image(logo, x + 2, y + 2, { fit: [size - 4, size - 4], align: 'center', valign: 'center' });
        doc.restore();
        return;
      } catch {
        doc.restore();
      }
    }
    const initials = String(businessName || 'CozyStay').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    doc.fillColor('#176b52').font('Helvetica-Bold').fontSize(size * 0.28)
      .text(initials || 'CS', x, y + size * 0.36, { width: size, align: 'center', lineBreak: false });
  }

  drawBrandHeader(doc, business, subtitle, accent) {
    const x = PAGE.left;
    const y = 28;
    const width = PAGE.right - PAGE.left;
    const height = 72;
    const name = business.name || process.env.BUSINESS_NAME || 'CozyStay';
    doc.rect(x, y, width, height).fill(COLORS.ink);
    doc.rect(x, y, 5, height).fill(accent);
    doc.path(`M ${x} ${y + height} L ${x + 28} ${y + height} L ${x} ${y + height - 20} Z`).fill(accent);
    doc.circle(PAGE.right - 8, y + 2, 34).fill(accent);
    doc.circle(PAGE.right - 8, y + 2, 18).fill(COLORS.ink);
    doc.circle(PAGE.right - 8, y + 2, 13).lineWidth(1.2).stroke('#ffffff');
    this.drawLogo(doc, business.logo, x + 15, y + 14, 40, name);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15)
      .text(name, x + 68, y + 15, { width: 330, height: 19, ellipsis: true, lineBreak: false });
    doc.fillColor('#e4e8e5').font('Helvetica-Bold').fontSize(8)
      .text(subtitle.toUpperCase(), x + 68, y + 37, { width: 330, lineBreak: false, characterSpacing: 0.5 });
    const contact = [business.phone ?? process.env.BUSINESS_PHONE, business.email ?? process.env.BUSINESS_EMAIL]
      .filter(Boolean).join('  /  ');
    if (contact) {
      doc.fillColor('#c7cfca').font('Helvetica').fontSize(7)
        .text(contact, x + 68, y + 53, { width: 390, height: 10, ellipsis: true, lineBreak: false });
    }
  }

  drawFooter(doc, business, pageNumber) {
    const y = 768;
    const x = PAGE.left;
    const width = PAGE.right - PAGE.left;
    const accent = this.getBrandColor(business.brandColor);
    doc.rect(x, y, width, 3).fill(accent);
    doc.rect(x, y + 3, 3, 18).fill(accent);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8)
      .text(business.name || process.env.BUSINESS_NAME || 'CozyStay', x + 10, y + 7, { lineBreak: false });
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7)
      .text('Guest stays / reservations / payment records', x + 10, y + 18, { lineBreak: false });
    doc.fillColor(COLORS.muted).fontSize(7)
      .text(`Page ${pageNumber}`, x + width - 70, y + 10, { width: 60, align: 'right', lineBreak: false });
  }

  formatDate(value, includeTime = false) {
    if (!value) return '-';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const [year, month, day] = value.slice(0, 10).split('-');
      if (!includeTime) return `${day}/${month}/${year}`;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-KE', includeTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium' }).format(date);
  }

  formatMoney(value, currency = 'KES') {
    return `${currency} ${Number(value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  collectPdf(doc) {
    return new Promise((resolve, reject) => {
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);
    });
  }

  async generateReceiptPdf(data) {
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
    const output = this.collectPdf(doc);
    const business = data.business || {};
    const accent = this.getBrandColor(business.brandColor);
    this.drawBrandHeader(doc, business, 'Guest payment record', accent);

    let y = 120;
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(18).text('Payment receipt', PAGE.left, y);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
      .text(`Receipt ${data.receiptNumber || '-'}  /  Issued ${this.formatDate(data.issuedAt, true)}`, PAGE.left, y + 26);
    doc.fillColor(accent).font('Helvetica-Bold').fontSize(8)
      .text(String(data.billing?.paymentStatus || 'PAID').replaceAll('_', ' ').toUpperCase(), PAGE.right - 100, y + 3, { width: 100, align: 'right' });

    y += 57;
    const gap = 14;
    const blockWidth = (PAGE.right - PAGE.left - gap) / 2;
    const blockHeight = 116;
    const drawInfoBlock = (x, title, lines) => {
      doc.rect(x, y, blockWidth, blockHeight).lineWidth(0.7).strokeColor(COLORS.rule).stroke();
      doc.rect(x, y, blockWidth, 3).fill(accent);
      doc.fillColor(accent).font('Helvetica-Bold').fontSize(8).text(title.toUpperCase(), x + 12, y + 13, { characterSpacing: 0.4 });
      let lineY = y + 33;
      lines.forEach(([label, value]) => {
        doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7).text(label, x + 12, lineY, { width: 76, lineBreak: false });
        doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8)
          .text(String(value || '-'), x + 90, lineY, { width: blockWidth - 102, height: 22, ellipsis: true, lineBreak: false });
        lineY += 21;
      });
    };
    drawInfoBlock(PAGE.left, 'Guest', [
      ['Name', data.customer?.name], ['Email', data.customer?.email], ['Phone', data.customer?.phone],
    ]);
    drawInfoBlock(PAGE.left + blockWidth + gap, 'Stay', [
      ['Property', data.property?.name], ['Check-in', this.formatDate(data.stay?.checkInDate)],
      ['Check-out', this.formatDate(data.stay?.checkOutDate)], ['Guests', data.stay?.guests],
    ]);

    y += blockHeight + 28;
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11).text('Payment details', PAGE.left, y);
    y += 22;
    const tableX = PAGE.left;
    const tableWidth = PAGE.right - PAGE.left;
    const columns = [
      { title: 'Description', x: tableX, width: 300, align: 'left' },
      { title: 'Amount', x: tableX + 300, width: tableWidth - 300, align: 'right' },
    ];
    doc.rect(tableX, y, tableWidth, 25).fill(COLORS.ink);
    columns.forEach((column) => doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8)
      .text(column.title, column.x + 9, y + 8, { width: column.width - 18, align: column.align, lineBreak: false }));
    y += 25;
    const currency = data.billing?.currency || 'KES';
    const billingRows = [
      ['Subtotal (before VAT)', this.formatMoney(data.billing?.subtotal, currency)],
      [`VAT ${data.billing?.taxRate || ''}`.trim(), this.formatMoney(data.billing?.taxAmount, currency)],
      ['Amount paid', this.formatMoney(data.billing?.amountPaid, currency)],
    ];
    billingRows.forEach(([label, value], index) => {
      doc.rect(tableX, y, tableWidth, 29).fill(index % 2 ? '#ffffff' : COLORS.stripe);
      doc.rect(tableX, y, tableWidth, 29).lineWidth(0.45).strokeColor(COLORS.rule).stroke();
      doc.fillColor(COLORS.text).font(index === 2 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
        .text(label, tableX + 9, y + 9, { width: 280, lineBreak: false })
        .text(value, tableX + 309, y + 9, { width: tableWidth - 318, align: 'right', lineBreak: false });
      y += 29;
    });

    y += 10;
    doc.rect(tableX, y, tableWidth, 42).fill(accent);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
      .text('TOTAL PAID', tableX + 12, y + 15, { lineBreak: false })
      .text(this.formatMoney(data.billing?.amountPaid, currency), tableX + 260, y + 14, { width: tableWidth - 272, align: 'right', lineBreak: false });
    y += 59;

    const detailRows = [
      ['Payment method', String(data.billing?.paymentMethod || '-').replaceAll('_', ' ').toUpperCase()],
      ['Transaction reference', data.billing?.transactionRef || '-'],
      ['Issued by', data.issuedBy || 'CozyStay'],
      ['Balance remaining', this.formatMoney(data.billing?.balanceRemaining, currency)],
    ];
    detailRows.forEach(([label, value], index) => {
      const x = PAGE.left + (index % 2) * (blockWidth + gap);
      const rowY = y + Math.floor(index / 2) * 34;
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7).text(label.toUpperCase(), x, rowY, { width: blockWidth, lineBreak: false, characterSpacing: 0.25 });
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8).text(String(value), x, rowY + 12, { width: blockWidth, height: 14, ellipsis: true, lineBreak: false });
    });

    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page += 1) {
      doc.switchToPage(page);
      this.drawFooter(doc, business, page - range.start + 1);
    }
    doc.end();
    return output;
  }

  async generateReportPdf(data) {
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
    const output = this.collectPdf(doc);
    const business = {
      name: data.businessName || process.env.BUSINESS_NAME || 'CozyStay',
      logo: data.logo || process.env.BUSINESS_LOGO_PATH,
      brandColor: data.brandColor,
      phone: data.phone ?? process.env.BUSINESS_PHONE,
      email: data.email ?? process.env.BUSINESS_EMAIL,
    };
    const accent = this.getBrandColor(business.brandColor);
    const reportName = String(data.reportType || 'Financial & Occupancy').replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    const generated = this.formatDate(new Date(), true);
    let y = 0;

    const drawPageHeading = () => {
      this.drawBrandHeader(doc, business, 'Management report', accent);
      doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(16).text(`${reportName} Report`, PAGE.left, 117, { width: 350, ellipsis: true, lineBreak: false });
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
        .text(`Generated ${generated}${data.startDate || data.endDate ? `  /  Period ${this.formatDate(data.startDate) } to ${this.formatDate(data.endDate)}` : ''}`, PAGE.left, 141, { width: PAGE.right - PAGE.left });
      y = 168;
    };
    const startNextPage = () => {
      doc.addPage();
      drawPageHeading();
    };
    const ensureSpace = (height) => {
      if (y + height > 752) startNextPage();
    };
    const drawSectionTitle = (title) => {
      ensureSpace(38);
      doc.rect(PAGE.left, y, 3, 15).fill(accent);
      doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10).text(title, PAGE.left + 10, y + 2, { lineBreak: false });
      y += 24;
    };
    const drawTable = (columns, rows) => {
      const x = PAGE.left;
      const tableWidth = PAGE.right - PAGE.left;
      const rowHeight = 25;
      const drawHeader = () => {
        doc.rect(x, y, tableWidth, 24).fill(COLORS.ink);
        let cursorX = x;
        columns.forEach((column) => {
          doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5)
            .text(column.label, cursorX + 7, y + 8, { width: column.width - 14, lineBreak: false, ellipsis: true });
          cursorX += column.width;
        });
        y += 24;
      };
      ensureSpace(24 + rowHeight);
      drawHeader();
      rows.forEach((row, rowIndex) => {
        if (y + rowHeight > 752) {
          startNextPage();
          drawHeader();
        }
        doc.rect(x, y, tableWidth, rowHeight).fill(rowIndex % 2 ? '#ffffff' : COLORS.stripe);
        doc.rect(x, y, tableWidth, rowHeight).lineWidth(0.45).strokeColor(COLORS.rule).stroke();
        let cursorX = x;
        columns.forEach((column, columnIndex) => {
          const value = row[columnIndex] === null || row[columnIndex] === undefined || row[columnIndex] === '' ? '-' : String(row[columnIndex]);
          doc.fillColor(COLORS.text).font('Helvetica').fontSize(8)
            .text(value, cursorX + 7, y + 8, { width: column.width - 14, height: 11, ellipsis: true, lineBreak: false, align: column.align || 'left' });
          cursorX += column.width;
        });
        y += rowHeight;
      });
      y += 20;
    };

    drawPageHeading();
    drawSectionTitle('Report summary');
    const kpis = [
      ['Revenue', this.formatMoney(data.kpis?.totalRevenue)],
      ['Bookings', Number(data.kpis?.totalBookings || 0).toLocaleString('en-KE')],
      ['Occupancy', `${Number(data.kpis?.occupancyRate || 0).toLocaleString('en-KE')}%`],
      ['Properties', Number(data.kpis?.totalProperties || 0).toLocaleString('en-KE')],
    ];
    const gap = 8;
    const cardWidth = (PAGE.right - PAGE.left - gap * 3) / 4;
    kpis.forEach(([label, value], index) => {
      const x = PAGE.left + index * (cardWidth + gap);
      doc.rect(x, y, cardWidth, 54).fill(COLORS.stripe);
      doc.rect(x, y, cardWidth, 3).fill(accent);
      doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), x + 9, y + 12, { width: cardWidth - 18, lineBreak: false });
      doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11).text(value, x + 9, y + 29, { width: cardWidth - 18, height: 14, ellipsis: true, lineBreak: false });
    });
    y += 72;

    drawSectionTitle('Revenue by property');
    const propertyColumns = [
      { label: 'Property', width: 300 },
      { label: 'Revenue (KES)', width: 125, align: 'right' },
      { label: 'Share', width: 86, align: 'right' },
    ];
    const propertyRows = (data.topProperties || []).map((property) => {
      const revenue = Number(property.revenue || 0);
      const total = Number(data.kpis?.totalRevenue || 0);
      const share = total > 0 ? `${(revenue / total * 100).toFixed(1)}%` : '-';
      return [property.name || 'Property', this.formatMoney(revenue), share];
    });
    drawTable(propertyColumns, propertyRows.length ? propertyRows : [['No property revenue recorded', '-', '-']]);

    drawSectionTitle('Payments by method');
    const paymentColumns = [
      { label: 'Payment method', width: 215 },
      { label: 'Transactions', width: 120, align: 'right' },
      { label: 'Amount (KES)', width: 176, align: 'right' },
    ];
    const paymentRows = (data.paymentBreakdown || []).map((payment) => [
      String(payment.method || 'Other').replaceAll('_', ' ').toUpperCase(),
      Number(payment.count || 0).toLocaleString('en-KE'),
      this.formatMoney(payment.total),
    ]);
    drawTable(paymentColumns, paymentRows.length ? paymentRows : [['No payments recorded', '-', '-']]);

    const pageRange = doc.bufferedPageRange();
    for (let page = pageRange.start; page < pageRange.start + pageRange.count; page += 1) {
      doc.switchToPage(page);
      this.drawFooter(doc, business, page - pageRange.start + 1);
    }
    doc.end();
    return output;
  }
}

export default new PdfService();
