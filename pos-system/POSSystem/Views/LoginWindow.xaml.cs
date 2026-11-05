using System;
using System.Windows;
using RMS.POSSystem.Database;
using RMS.POSSystem.Services;

namespace RMS.POSSystem.Views
{
    public partial class LoginWindow : Window
    {
        private readonly POSDatabase _db;
        private readonly AuthService _authService;

        public LoginWindow()
        {
            InitializeComponent();
            Title = $"{SystemBranding.BusinessName} POS - Staff Sign In";
            TxtBrandName.Text = $"{SystemBranding.BusinessName} POS";
            _db = new POSDatabase();
            _db.Initialize();
            _authService = new AuthService(_db);
        }

        private void BtnLogin_Click(object sender, RoutedEventArgs e)
        {
            var ident = TxtUsername.Text.Trim();
            var pass = TxtPassword.Password.Trim();

            if (_authService.Login(ident, pass, out string error))
            {
                var mainWindow = new MainWindow(_db);
                Application.Current.MainWindow = mainWindow;
                mainWindow.Show();
                this.Close();
            }
            else
            {
                TxtError.Text = error;
                TxtError.Visibility = Visibility.Visible;
            }
        }

        private void TxtPassword_PasswordChanged(object sender, RoutedEventArgs e)
        {
            if (BtnTogglePassword.IsChecked != true)
            {
                TxtPasswordVisible.Text = TxtPassword.Password;
            }
        }

        private void TxtPasswordVisible_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            if (BtnTogglePassword.IsChecked == true)
            {
                TxtPassword.Password = TxtPasswordVisible.Text;
            }
        }

        private void BtnTogglePassword_Checked(object sender, RoutedEventArgs e)
        {
            TxtPasswordVisible.Text = TxtPassword.Password;
            TxtPassword.Visibility = Visibility.Collapsed;
            TxtPasswordVisible.Visibility = Visibility.Visible;
            TxtPasswordVisible.Focus();
            TxtPasswordVisible.CaretIndex = TxtPasswordVisible.Text.Length;
            TxtPasswordVisibilityIcon.Text = "\uE8D2";
            BtnTogglePassword.ToolTip = "Hide password";
        }

        private void BtnTogglePassword_Unchecked(object sender, RoutedEventArgs e)
        {
            TxtPassword.Password = TxtPasswordVisible.Text;
            TxtPasswordVisible.Visibility = Visibility.Collapsed;
            TxtPassword.Visibility = Visibility.Visible;
            TxtPassword.Focus();
            TxtPasswordVisibilityIcon.Text = "\uE890";
            BtnTogglePassword.ToolTip = "Show password";
        }

    }
}
