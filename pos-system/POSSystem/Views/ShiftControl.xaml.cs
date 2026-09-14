using System;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using RMS.POSSystem.Database;
using RMS.POSSystem.Models;
using RMS.POSSystem.Services;

namespace RMS.POSSystem.Views
{
    public partial class ShiftControl : UserControl
    {
        private readonly MainWindow _parent;
        private readonly POSDatabase _db;
        private readonly ShiftService _shiftService;
        private CashierShift _currentShift;

        public ShiftControl(MainWindow parent, POSDatabase db, ShiftService shiftService)
        {
            InitializeComponent();
            _parent = parent;
            _db = db;
            _shiftService = shiftService;

            RefreshShiftState();
        }

        private void RefreshShiftState()
        {
            var cashierId = AuthService.CurrentUser?.Id;
            _currentShift = _shiftService.GetActiveShift(cashierId);

            if (_currentShift != null)
            {
                ActiveShiftPanel.Visibility = Visibility.Visible;
                NoShiftPanel.Visibility = Visibility.Collapsed;
                TxtOpenTime.Text = _currentShift.OpenTime.ToLocalTime().ToString("yyyy-MM-dd hh:mm tt");
                TxtOpenBalance.Text = $"KES {_currentShift.OpeningBalance:N2}";
                TxtActualCash.Text = _currentShift.OpeningBalance.ToString("F2", CultureInfo.InvariantCulture);
            }
            else
            {
                ActiveShiftPanel.Visibility = Visibility.Collapsed;
                NoShiftPanel.Visibility = Visibility.Visible;
            }

            _parent.UpdateHeaderInfo();
        }

        private void BtnOpenShift_Click(object sender, RoutedEventArgs e)
        {
            if (decimal.TryParse(TxtStartBalance.Text, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal openingFloat))
            {
                try
                {
                    _shiftService.OpenShift(AuthService.CurrentUser?.Id, openingFloat, TxtStartNotes.Text.Trim());
                    MessageBox.Show($"Shift successfully opened with KES {openingFloat:N2} starting float.", "Shift Opened", MessageBoxButton.OK, MessageBoxImage.Information);
                    RefreshShiftState();
                }
                catch (Exception ex)
                {
                    MessageBox.Show(ex.Message, "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            else
            {
                MessageBox.Show("Please enter a valid starting balance amount.", "Invalid Input", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private void BtnCloseShift_Click(object sender, RoutedEventArgs e)
        {
            if (_currentShift == null) return;

            if (decimal.TryParse(TxtActualCash.Text, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal actualCash))
            {
                var confirm = MessageBox.Show(
                    $"Are you sure you want to reconcile and close this shift?\n\nCounted Cash: KES {actualCash:N2}",
                    "Confirm Shift Close",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Question
                );

                if (confirm == MessageBoxResult.Yes)
                {
                    try
                    {
                        var closedShift = _shiftService.CloseShift(_currentShift.Id, actualCash, TxtClosingNotes.Text.Trim());
                        decimal discrepancy = closedShift.ActualClosingBalance - closedShift.ExpectedClosingBalance;

                        string report = $"========================================\n" +
                                        $"       CASHIER SHIFT RECONCILIATION     \n" +
                                        $"========================================\n" +
                                        $"Cashier          : {AuthService.CurrentUser?.FullName}\n" +
                                        $"Shift Open       : {closedShift.OpenTime:yyyy-MM-dd HH:mm}\n" +
                                        $"Shift Close      : {closedShift.CloseTime:yyyy-MM-dd HH:mm}\n" +
                                        $"Transactions     : {closedShift.TransactionCount}\n" +
                                        $"----------------------------------------\n" +
                                        $"Opening Float    : KES {closedShift.OpeningBalance:N2}\n" +
                                        $"Expected Balance : KES {closedShift.ExpectedClosingBalance:N2}\n" +
                                        $"Actual Counted   : KES {closedShift.ActualClosingBalance:N2}\n" +
                                        $"----------------------------------------\n" +
                                        $"DISCREPANCY      : KES {(discrepancy >= 0 ? "+" : "")}{discrepancy:N2} ({(discrepancy == 0 ? "BALANCED" : discrepancy > 0 ? "OVERAGE" : "SHORTAGE")})\n" +
                                        $"========================================\n";

                        MessageBox.Show(report, "Shift Closed & Reconciled", MessageBoxButton.OK, MessageBoxImage.Information);
                        RefreshShiftState();
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show(ex.Message, "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                }
            }
        }
    }
}
