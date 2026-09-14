using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using RMS.POSSystem.Database;
using RMS.POSSystem.Models;
using RMS.POSSystem.Services;

namespace RMS.POSSystem.Views
{
    public partial class WalkInBookingControl : UserControl
    {
        private readonly MainWindow _parent;
        private readonly POSDatabase _db;
        private readonly TransactionService _txService;
        private readonly ShiftService _shiftService;
        private List<Property> _properties;

        public WalkInBookingControl(MainWindow parent, POSDatabase db, TransactionService txService, ShiftService shiftService)
        {
            InitializeComponent();
            _parent = parent;
            _db = db;
            _txService = txService;
            _shiftService = shiftService;

            DpCheckIn.SelectedDate = DateTime.Today;
            DpCheckOut.SelectedDate = DateTime.Today.AddDays(1);

            LoadProperties();
        }

        private void LoadProperties()
        {
            _properties = _txService.GetAvailableProperties();
            CmbProperties.ItemsSource = _properties;
            CmbProperties.DisplayMemberPath = "Name";
            CmbProperties.SelectedValuePath = "Id";

            if (_properties.Count > 0)
            {
                CmbProperties.SelectedIndex = 0;
            }
        }

        private void CmbProperties_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            RecalculateTotals();
        }

        private void Dates_Changed(object sender, SelectionChangedEventArgs e)
        {
            RecalculateTotals();
        }

        private void RecalculateTotals()
        {
            if (CmbProperties.SelectedItem is Property prop && DpCheckIn.SelectedDate.HasValue && DpCheckOut.SelectedDate.HasValue)
            {
                var checkIn = DpCheckIn.SelectedDate.Value;
                var checkOut = DpCheckOut.SelectedDate.Value;
                int nights = Math.Max(1, (int)(checkOut.Date - checkIn.Date).TotalDays);

                decimal rate = prop.PricePerNight;
                decimal subtotal = rate * nights;
                decimal tax = subtotal * 0.16m;
                decimal total = subtotal + tax;

                TxtRate.Text = $"KES {rate:N2} / night";
                TxtNights.Text = $"{nights} Night(s)";
                TxtSubtotal.Text = $"KES {subtotal:N2}";
                TxtTax.Text = $"KES {tax:N2}";
                TxtTotal.Text = $"KES {total:N2}";
            }
        }

        private void BtnProceedPayment_Click(object sender, RoutedEventArgs e)
        {
            var activeShift = _shiftService.GetActiveShift(AuthService.CurrentUser?.Id);
            if (activeShift == null)
            {
                var res = MessageBox.Show("You do not currently have an active open shift. Would you like to open your shift now?", "Shift Required", MessageBoxButton.YesNo, MessageBoxImage.Warning);
                if (res == MessageBoxResult.Yes)
                {
                    _parent.NavigateToShift();
                }
                return;
            }

            if (CmbProperties.SelectedItem is Property prop && DpCheckIn.SelectedDate.HasValue && DpCheckOut.SelectedDate.HasValue)
            {
                int.TryParse(TxtGuestCount.Text, out int guests);
                if (guests <= 0) guests = 1;

                var checkIn = DpCheckIn.SelectedDate.Value;
                var checkOut = DpCheckOut.SelectedDate.Value;
                int nights = Math.Max(1, (int)(checkOut.Date - checkIn.Date).TotalDays);
                decimal subtotal = prop.PricePerNight * nights;
                decimal total = subtotal * 1.16m;

                var paymentControl = new PaymentControl(
                    _parent,
                    _db,
                    _txService,
                    prop,
                    TxtGuestName.Text.Trim(),
                    TxtGuestPhone.Text.Trim(),
                    checkIn,
                    checkOut,
                    guests,
                    total,
                    TxtSpecialRequests.Text.Trim()
                );

                _parent.MainContentContainer.Children.Clear();
                _parent.MainContentContainer.Children.Add(paymentControl);
            }
        }
    }
}
