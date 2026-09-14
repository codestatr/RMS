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
                mainWindow.Show();
                this.Close();
            }
            else
            {
                TxtError.Text = error;
                TxtError.Visibility = Visibility.Visible;
            }
        }

    }
}
