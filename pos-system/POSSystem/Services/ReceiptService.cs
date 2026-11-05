using System;
using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using RMS.POSSystem.Models;

namespace RMS.POSSystem.Services
{
    public class ReceiptService
    {
        public static string GenerateReceiptText(POSTransaction tx, Property prop, string cashierName)
        {
            var nights = Math.Max(1, (int)(tx.CheckOutDate.Date - tx.CheckInDate.Date).TotalDays);
            var subtotal = Math.Round(tx.TotalAmount / 1.16m, 2);
            var tax = tx.TotalAmount - subtotal;
            var builder = new StringBuilder();
            builder.AppendLine(SystemBranding.BusinessName);
            builder.AppendLine("WALK-IN BOOKING RECEIPT");
            builder.AppendLine($"Receipt: {tx.ReceiptNumber}");
            builder.AppendLine($"Date: {tx.CreatedAt.ToLocalTime():dd MMM yyyy, HH:mm}");
            builder.AppendLine(new string('-', 36));
            builder.AppendLine($"Guest: {tx.CustomerId}");
            builder.AppendLine($"Property: {prop?.Name ?? tx.PropertyId ?? "Rental unit"}");
            if (!string.IsNullOrWhiteSpace(prop?.Address)) builder.AppendLine($"Address: {prop.Address}");
            builder.AppendLine($"Check-in: {tx.CheckInDate:dd MMM yyyy}");
            builder.AppendLine($"Check-out: {tx.CheckOutDate:dd MMM yyyy}");
            builder.AppendLine($"Nights: {nights}");
            builder.AppendLine($"Guests: {tx.NumberOfGuests}");
            builder.AppendLine($"Cashier: {cashierName}");
            builder.AppendLine($"Payment: {(tx.PaymentMethod ?? "cash").Replace('_', ' ').ToUpperInvariant()}");
            builder.AppendLine(new string('-', 36));
            builder.AppendLine($"Subtotal: KES {subtotal:N2}");
            builder.AppendLine($"VAT (16%): KES {tax:N2}");
            builder.AppendLine($"TOTAL: KES {tx.TotalAmount:N2}");
            builder.AppendLine($"Amount tendered: KES {tx.AmountPaid:N2}");
            var change = Math.Max(0, tx.AmountPaid - tx.TotalAmount);
            if (change > 0) builder.AppendLine($"Change: KES {change:N2}");
            builder.AppendLine(new string('-', 36));
            builder.AppendLine($"Thank you for choosing {SystemBranding.BusinessName}.");
            return builder.ToString();
        }

        public static string SaveReceiptText(POSTransaction tx, string receiptText)
        {
            var receiptDirectory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                "RMS Receipts");
            Directory.CreateDirectory(receiptDirectory);
            var safeReceiptNumber = string.IsNullOrWhiteSpace(tx.ReceiptNumber) ? tx.Id : tx.ReceiptNumber;
            foreach (var invalidCharacter in Path.GetInvalidFileNameChars())
            {
                safeReceiptNumber = safeReceiptNumber.Replace(invalidCharacter, '-');
            }
            var receiptPath = Path.Combine(receiptDirectory, $"{safeReceiptNumber}.txt");
            File.WriteAllText(receiptPath, receiptText, Encoding.UTF8);
            return receiptPath;
        }

        public static bool PrintReceipt(POSTransaction tx, Property prop, string cashierName)
        {
            var accent = ParseBrush(SystemBranding.AccentColor, "#176B52");
            var document = new FlowDocument
            {
                PagePadding = new Thickness(42),
                ColumnWidth = double.PositiveInfinity,
                FontFamily = new FontFamily("Arial"),
                FontSize = 11,
                Foreground = new SolidColorBrush(Color.FromRgb(31, 41, 55)),
            };
            document.Blocks.Add(BuildBrandHeader(accent));
            document.Blocks.Add(StyledText("WALK-IN BOOKING RECEIPT", 18, true, accent, 0, 4));
            document.Blocks.Add(StyledText($"Receipt {tx.ReceiptNumber}   ·   {tx.CreatedAt.ToLocalTime():dd MMM yyyy, HH:mm}", 10, false, Brushes.Gray, 0, 18));

            AddLine(document, "Guest", tx.CustomerId);
            AddLine(document, "Property", prop?.Name ?? tx.PropertyId ?? "Rental unit");
            if (!string.IsNullOrWhiteSpace(prop?.Address)) AddLine(document, "Address", prop.Address);
            AddLine(document, "Check-in", tx.CheckInDate.ToString("dd MMM yyyy"));
            AddLine(document, "Check-out", tx.CheckOutDate.ToString("dd MMM yyyy"));
            AddLine(document, "Guests", tx.NumberOfGuests.ToString());
            AddLine(document, "Cashier", cashierName);
            AddLine(document, "Payment method", (tx.PaymentMethod ?? "cash").Replace('_', ' ').ToUpperInvariant());

            var total = tx.TotalAmount;
            var subtotal = Math.Round(total / 1.16m, 2);
            AddAmount(document, "Subtotal (net)", subtotal);
            AddAmount(document, "VAT (16%)", total - subtotal);
            AddAmount(document, "TOTAL PAID", total, true, accent);
            AddAmount(document, "Amount tendered", tx.AmountPaid);
            var change = Math.Max(0, tx.AmountPaid - total);
            if (change > 0) AddAmount(document, "Change returned", change);

            document.Blocks.Add(StyledText($"Thank you for choosing {SystemBranding.BusinessName}.", 10, false, Brushes.Gray, 18, 0));
            var printDialog = new PrintDialog();
            if (printDialog.ShowDialog() != true) return false;
            printDialog.PrintDocument(((IDocumentPaginatorSource)document).DocumentPaginator,
                $"{SystemBranding.BusinessName} receipt {tx.ReceiptNumber}");
            return true;
        }

        private static BlockUIContainer BuildBrandHeader(Brush accent)
        {
            var row = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
            var logo = LoadBrandLogo();
            if (logo != null)
            {
                logo.Width = 50;
                logo.Height = 50;
                logo.Stretch = Stretch.UniformToFill;
                logo.Clip = new EllipseGeometry(new Rect(0, 0, 50, 50));
                logo.Margin = new Thickness(0, 0, 14, 0);
                row.Children.Add(logo);
            }
            var brand = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
            brand.Children.Add(new TextBlock { Text = SystemBranding.BusinessName, Foreground = Brushes.White, FontSize = 19, FontWeight = FontWeights.Bold });
            brand.Children.Add(new TextBlock { Text = "GUEST STAYS  /  PAYMENT RECEIPT", Foreground = Brushes.White, FontSize = 9, Margin = new Thickness(0, 3, 0, 0) });
            row.Children.Add(brand);
            var header = new Border { Background = new SolidColorBrush(Color.FromRgb(23, 27, 26)), BorderBrush = accent, BorderThickness = new Thickness(5, 0, 0, 0), Padding = new Thickness(16), Child = row };
            var block = new BlockUIContainer(header) { Margin = new Thickness(0, 0, 0, 18) };
            return block;
        }

        private static Image LoadBrandLogo()
        {
            try
            {
                var dataUri = SystemBranding.LogoDataUri;
                var separator = dataUri.IndexOf(',');
                if (separator < 0) return null;
                var bytes = Convert.FromBase64String(dataUri.Substring(separator + 1));
                using var stream = new MemoryStream(bytes);
                var bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.StreamSource = stream;
                bitmap.EndInit();
                bitmap.Freeze();
                return new Image { Source = bitmap };
            }
            catch { return null; }
        }

        private static void AddLine(FlowDocument document, string label, string value)
        {
            var paragraph = new Paragraph { Margin = new Thickness(0, 0, 0, 7), BorderBrush = new SolidColorBrush(Color.FromRgb(226, 232, 240)), BorderThickness = new Thickness(0, 0, 0, 1), Padding = new Thickness(0, 0, 0, 6) };
            paragraph.Inlines.Add(new Run($"{label}: ") { FontWeight = FontWeights.Bold });
            paragraph.Inlines.Add(new Run(string.IsNullOrWhiteSpace(value) ? "—" : value));
            document.Blocks.Add(paragraph);
        }

        private static void AddAmount(FlowDocument document, string label, decimal value, bool strong = false, Brush foreground = null)
        {
            var paragraph = new Paragraph { TextAlignment = TextAlignment.Right, Margin = new Thickness(0, strong ? 10 : 2, 0, 4) };
            paragraph.Inlines.Add(new Run($"{label}     KES {value:N2}")
            {
                FontWeight = strong ? FontWeights.Bold : FontWeights.Normal,
                FontSize = strong ? 14 : 11,
                Foreground = foreground ?? Brushes.DarkSlateGray,
            });
            document.Blocks.Add(paragraph);
        }

        private static Paragraph StyledText(string text, double size, bool bold, Brush foreground, double before, double after) =>
            new Paragraph(new Run(text)) { FontSize = size, FontWeight = bold ? FontWeights.Bold : FontWeights.Normal, Foreground = foreground, Margin = new Thickness(0, before, 0, after) };

        private static Brush ParseBrush(string value, string fallback)
        {
            try { return new SolidColorBrush((Color)ColorConverter.ConvertFromString(value)); }
            catch { return new SolidColorBrush((Color)ColorConverter.ConvertFromString(fallback)); }
        }

    }
}
