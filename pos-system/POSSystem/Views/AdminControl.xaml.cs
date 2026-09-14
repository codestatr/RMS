using System;
using System.Windows;
using System.Windows.Controls;
using RMS.POSSystem.Database;
using RMS.POSSystem.Services;
using RMS.POSSystem.Sync;

namespace RMS.POSSystem.Views
{
    public partial class AdminControl : UserControl
    {
        private readonly MainWindow _parent;
        private readonly POSDatabase _db;
        private readonly ShiftService _shiftService;
        private readonly SyncService _syncService;

        public AdminControl(MainWindow parent, POSDatabase db, ShiftService shiftService, SyncService syncService)
        {
            InitializeComponent();
            _parent = parent;
            _db = db;
            _shiftService = shiftService;
            _syncService = syncService;

            LoadAllShifts();
        }

        private void LoadAllShifts()
        {
            var shifts = _shiftService.GetAllShifts();
            DgShifts.ItemsSource = shifts;
        }

        private async void BtnForceSync_Click(object sender, RoutedEventArgs e)
        {
            bool success = await _syncService.SyncNowAsync();
            if (success)
            {
                MessageBox.Show("Full synchronization with central MySQL server completed!", "Sync Success", MessageBoxButton.OK, MessageBoxImage.Information);
                LoadAllShifts();
            }
            else
            {
                MessageBox.Show("Unable to reach central API server. Local offline data preserved in SQLite.", "Sync Warning", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }
    }
}
