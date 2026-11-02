using System;
using System.Windows;
using System.Windows.Controls;
using RMS.POSSystem.Database;
using RMS.POSSystem.Models;
using RMS.POSSystem.Services;

namespace RMS.POSSystem.Views
{
    public partial class TransactionsControl : UserControl
    {
        private readonly MainWindow _parent;
        private readonly POSDatabase _db;
        private readonly TransactionService _txService;

        public TransactionsControl(MainWindow parent, POSDatabase db, TransactionService txService)
        {
            InitializeComponent();
            _parent = parent;
            _db = db;
            _txService = txService;

            LoadTransactions();
        }

        private void LoadTransactions()
        {
            var list = _txService.GetRecentTransactions();
            DgTransactions.ItemsSource = list;
        }

        public void RefreshTransactions()
        {
            LoadTransactions();
        }

        private void BtnRefresh_Click(object sender, RoutedEventArgs e)
        {
            LoadTransactions();
        }

        private void BtnReprint_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is POSTransaction tx)
            {
                var printed = ReceiptService.PrintReceipt(tx, null, AuthService.CurrentUser?.FullName ?? "Cashier");
                if (printed)
                    MessageBox.Show("Receipt sent to the selected printer. Choose Microsoft Print to PDF in the printer list to save a PDF.", "Receipt Reprint", MessageBoxButton.OK, MessageBoxImage.Information);
            }
        }
    }
}
