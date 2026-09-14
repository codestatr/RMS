using System;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using RMS.POSSystem.Database;
using RMS.POSSystem.Models;
using RMS.POSSystem.Services;

namespace RMS.POSSystem.Views
{
    public partial class PaymentControl : UserControl
    {
        private readonly MainWindow _parent;
        private readonly POSDatabase _db;
        private readonly TransactionService _txService;
        private readonly Property _property;
        private readonly string _guestName;
        private readonly string _guestPhone;
        private readonly DateTime _checkIn;
        private readonly DateTime _checkOut;
        private readonly int _guests;
        private readonly decimal _totalAmount;
        private readonly string _specialRequests;
        private string _method = "cash";

        public PaymentControl(
            MainWindow parent,
            POSDatabase db,
            TransactionService txService,
            Property property,
            string guestName,
            string guestPhone,
            DateTime checkIn,
            DateTime checkOut,
            int guests,
            decimal totalAmount,
            string specialRequests)
        {
            InitializeComponent();
            _parent = parent;
            _db = db;
            _txService = txService;
            _property = property;
            _guestName = guestName;
            _guestPhone = guestPhone;
            _checkIn = checkIn;
            _checkOut = checkOut;
            _guests = guests;
            _totalAmount = totalAmount;
            _specialRequests = specialRequests;

            TxtPropSummary.Text = _property.Name;
            TxtGuestSummary.Text = $"Guest: {_guestName} ({_guestPhone})";
            TxtDatesSummary.Text = $"{_checkIn:yyyy-MM-dd} to {_checkOut:yyyy-MM-dd} ({_guests} Guests)";
            TxtAmountDue.Text = $"KES {_totalAmount:N2}";
            TxtTendered.Text = _totalAmount.ToString("F2", CultureInfo.InvariantCulture);

            UpdateChange();
        }

        private void SetMethod(string method, Button activeBtn)
        {
            _method = method;
            var inactiveBg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F3F4F6"));
            var inactiveFg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#374151"));
            var activeBg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F59E0B"));

            BtnMethodCash.Background = inactiveBg; BtnMethodCash.Foreground = inactiveFg;
            BtnMethodCard.Background = inactiveBg; BtnMethodCard.Foreground = inactiveFg;
            BtnMethodMpesa.Background = inactiveBg; BtnMethodMpesa.Foreground = inactiveFg;

            activeBtn.Background = activeBg;
            activeBtn.Foreground = Brushes.White;

            if (method == "cash")
            {
                CashPanel.Visibility = Visibility.Visible;
                RefPanel.Visibility = Visibility.Collapsed;
            }
            else
            {
                CashPanel.Visibility = Visibility.Collapsed;
                RefPanel.Visibility = Visibility.Visible;
                TxtRef.Text = method == "mpesa" ? $"MPESA_{DateTime.Now.Ticks.ToString().Substring(10)}" : $"CARD_{DateTime.Now.Ticks.ToString().Substring(10)}";
            }
        }

        private void BtnMethodCash_Click(object sender, RoutedEventArgs e) => SetMethod("cash", BtnMethodCash);
        private void BtnMethodCard_Click(object sender, RoutedEventArgs e) => SetMethod("card", BtnMethodCard);
        private void BtnMethodMpesa_Click(object sender, RoutedEventArgs e) => SetMethod("mpesa", BtnMethodMpesa);

        private void TxtTendered_TextChanged(object sender, TextChangedEventArgs e) => UpdateChange();

        private void UpdateChange()
        {
            if (decimal.TryParse(TxtTendered.Text, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal tendered))
            {
                decimal change = Math.Max(0, tendered - _totalAmount);
                TxtChange.Text = $"KES {change:N2}";
            }
        }

        private void BtnQuickExact_Click(object sender, RoutedEventArgs e)
        {
            TxtTendered.Text = _totalAmount.ToString("F2", CultureInfo.InvariantCulture);
        }

        private void BtnQuick1000_Click(object sender, RoutedEventArgs e) => TxtTendered.Text = "1000.00";
        private void BtnQuick2000_Click(object sender, RoutedEventArgs e) => TxtTendered.Text = "2000.00";
        private void BtnQuick5000_Click(object sender, RoutedEventArgs e) => TxtTendered.Text = "5000.00";
        private void BtnQuick10000_Click(object sender, RoutedEventArgs e) => TxtTendered.Text = "10000.00";

        private void BtnBack_Click(object sender, RoutedEventArgs e)
        {
            _parent.NavigateToBooking();
        }

        private void BtnCompleteTransaction_Click(object sender, RoutedEventArgs e)
        {
            decimal.TryParse(TxtTendered.Text, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal tendered);
            if (_method == "cash" && tendered < _totalAmount)
            {
                MessageBox.Show("Tendered amount cannot be less than the total bill amount.", "Insufficient Cash", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var tx = _txService.CreateWalkInBooking(
                _property.Id,
                _guestName,
                _guestPhone,
                _checkIn,
                _checkOut,
                _guests,
                _totalAmount,
                _method,
                _specialRequests
            );

            var receiptText = ReceiptService.GenerateReceiptText(tx, _property, AuthService.CurrentUser?.FullName ?? "Cashier");

            MessageBox.Show(
                $"{receiptText}\n\n[Receipt Successfully Sent to Printer & Saved]",
                "Transaction Complete - Receipt Printed",
                MessageBoxButton.OK,
                MessageBoxImage.Information
            );

            _parent.UpdateHeaderInfo();
            _parent.NavigateToTransactions();
        }
    }
}
