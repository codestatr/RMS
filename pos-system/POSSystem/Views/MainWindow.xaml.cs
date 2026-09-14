using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using System.Threading.Tasks;
using RMS.POSSystem.Database;
using RMS.POSSystem.Services;
using RMS.POSSystem.Sync;

namespace RMS.POSSystem.Views
{
    public partial class MainWindow : Window
    {
        private readonly POSDatabase _db;
        private readonly ShiftService _shiftService;
        private readonly TransactionService _txService;
        private readonly SyncService _syncService;
        private readonly DispatcherTimer _syncTimer;
        private TransactionsControl _transactionsControl;

        public MainWindow(POSDatabase db)
        {
            InitializeComponent();
            _db = db;
            _shiftService = new ShiftService(_db);
            _txService = new TransactionService(_db);
            _syncService = new SyncService(_db);

            UpdateHeaderInfo();
            NavigateToBooking();

            _syncTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(10) };
            _syncTimer.Tick += async (_, _) => await RunSyncAsync();
            _syncTimer.Start();
            Loaded += async (_, _) => await RunSyncAsync();
            Closed += (_, _) =>
            {
                _syncTimer.Stop();
                AuthService.Logout();

                try
                {
                    Application.Current?.Shutdown();
                }
                catch
                {
                    // ignore shutdown race conditions during close
                }

                Environment.Exit(0);
            };
        }

        public void UpdateHeaderInfo()
        {
            var user = AuthService.CurrentUser;
            if (user != null)
            {
                TxtCashierName.Text = user.FullName ?? user.Username;
                TxtCashierRole.Text = user.Role?.ToUpper() ?? "CASHIER";

                if (user.Role?.ToLower() != "admin")
                {
                    LblAdminSection.Visibility = Visibility.Collapsed;
                    NavAdmin.Visibility = Visibility.Collapsed;
                }

                var shift = _shiftService.GetActiveShift(user.Id);
                if (shift != null)
                {
                    TxtShiftStatus.Text = "● Shift Open ($" + shift.OpeningBalance.ToString("F2") + ")";
                    ShiftStatusBadge.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#ECFDF5"));
                    TxtShiftStatus.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#065F46"));
                }
                else
                {
                    TxtShiftStatus.Text = "○ No Active Shift";
                    ShiftStatusBadge.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FEF2F2"));
                    TxtShiftStatus.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#991B1B"));
                }
            }
        }

        private void SetActiveButton(Button activeBtn)
        {
            var inactiveBg = Brushes.Transparent;
            var inactiveFg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#374151"));
            var activeBg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F59E0B"));
            var activeFg = Brushes.White;

            NavBooking.Background = inactiveBg; NavBooking.Foreground = inactiveFg;
            NavShift.Background = inactiveBg; NavShift.Foreground = inactiveFg;
            NavTransactions.Background = inactiveBg; NavTransactions.Foreground = inactiveFg;
            NavAdmin.Background = inactiveBg; NavAdmin.Foreground = inactiveFg;

            activeBtn.Background = activeBg;
            activeBtn.Foreground = activeFg;
        }

        public void NavigateToBooking()
        {
            _transactionsControl = null;
            SetActiveButton(NavBooking);
            MainContentContainer.Children.Clear();
            MainContentContainer.Children.Add(new WalkInBookingControl(this, _db, _txService, _shiftService));
        }

        public void NavigateToShift()
        {
            _transactionsControl = null;
            SetActiveButton(NavShift);
            MainContentContainer.Children.Clear();
            MainContentContainer.Children.Add(new ShiftControl(this, _db, _shiftService));
        }

        public void NavigateToTransactions()
        {
            SetActiveButton(NavTransactions);
            MainContentContainer.Children.Clear();
            _transactionsControl = new TransactionsControl(this, _db, _txService);
            MainContentContainer.Children.Add(_transactionsControl);
        }

        public void NavigateToAdmin()
        {
            _transactionsControl = null;
            SetActiveButton(NavAdmin);
            MainContentContainer.Children.Clear();
            MainContentContainer.Children.Add(new AdminControl(this, _db, _shiftService, _syncService));
        }

        private void NavBooking_Click(object sender, RoutedEventArgs e) => NavigateToBooking();
        private void NavShift_Click(object sender, RoutedEventArgs e) => NavigateToShift();
        private void NavTransactions_Click(object sender, RoutedEventArgs e) => NavigateToTransactions();
        private void NavAdmin_Click(object sender, RoutedEventArgs e) => NavigateToAdmin();

        private async void BtnSync_Click(object sender, RoutedEventArgs e)
        {
            bool ok = await RunSyncAsync();
            if (ok)
            {
                MessageBox.Show("Local SQLite database synchronized with central MySQL server!", "Sync Complete", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            else
            {
                MessageBox.Show("Sync offline mode active. Local changes will queue and sync when network connection resumes.", "Offline Notice", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private async Task<bool> RunSyncAsync()
        {
            var ok = await _syncService.SyncNowAsync();
            if (ok) _transactionsControl?.RefreshTransactions();
            return ok;
        }

        private void BtnSignOut_Click(object sender, RoutedEventArgs e)
        {
            AuthService.Logout();
            var login = new LoginWindow();
            login.Show();
            this.Close();
        }
    }
}
