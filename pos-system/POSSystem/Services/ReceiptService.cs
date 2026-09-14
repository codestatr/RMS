using System;
using System.IO;
using System.Text;
using RMS.POSSystem.Models;

namespace RMS.POSSystem.Services
{
    public class ReceiptService
    {
        public static string GenerateReceiptText(POSTransaction tx, Property prop, string cashierName)
        {
            var sb = new StringBuilder();
            sb.AppendLine("========================================");
            sb.AppendLine("       RMS RENTAL MANAGEMENT POS        ");
            sb.AppendLine("         Official Sales Receipt         ");
            sb.AppendLine("========================================");
            sb.AppendLine($"Receipt No : {tx.ReceiptNumber}");
            sb.AppendLine($"Date       : {tx.CreatedAt:yyyy-MM-dd HH:mm:ss}");
            sb.AppendLine($"Cashier    : {cashierName}");
            sb.AppendLine("----------------------------------------");
            sb.AppendLine($"Guest Name : {tx.CustomerId}");
            sb.AppendLine($"Property   : {prop?.Name ?? "Rental Unit"}");
            sb.AppendLine($"Check-In   : {tx.CheckInDate:yyyy-MM-dd}");
            sb.AppendLine($"Check-Out  : {tx.CheckOutDate:yyyy-MM-dd}");
            sb.AppendLine($"Guests     : {tx.NumberOfGuests}");
            sb.AppendLine("----------------------------------------");

            decimal total = tx.TotalAmount;
            decimal subtotal = Math.Round(total / 1.16m, 2);
            decimal vat = total - subtotal;

            sb.AppendLine($"Subtotal (Net)     : KES {subtotal,10:N2}");
            sb.AppendLine($"VAT Tax (16%)      : KES {vat,10:N2}");
            sb.AppendLine($"TOTAL AMOUNT       : KES {total,10:N2}");
            sb.AppendLine("----------------------------------------");
            sb.AppendLine($"Payment Method     : {tx.PaymentMethod.ToUpper()} (KES)");
            sb.AppendLine($"Amount Tendered    : KES {tx.AmountPaid,10:N2}");
            decimal change = Math.Max(0, tx.AmountPaid - total);
            if (change > 0)
            {
                sb.AppendLine($"Change Returned    : KES {change,10:N2}");
            }
            sb.AppendLine("========================================");
            sb.AppendLine("    Thank you for choosing RMS Stays!   ");
            sb.AppendLine("       KRA PIN: P051234567Z | 16% VAT   ");
            sb.AppendLine("========================================");

            return sb.ToString();
        }

        public static string SaveReceiptText(POSTransaction tx, string receiptText)
        {
            var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "RMS", "Receipts");
            Directory.CreateDirectory(directory);

            var fileName = $"receipt_{(tx?.ReceiptNumber ?? "manual")}_{DateTime.Now:yyyyMMdd_HHmmss}.txt";
            var fullPath = Path.Combine(directory, fileName);
            File.WriteAllText(fullPath, receiptText ?? string.Empty);
            return fullPath;
        }
    }
}
