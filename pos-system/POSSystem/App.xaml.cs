using System;
using System.Windows;
using RMS.POSSystem.Database;
using RMS.POSSystem.Services;
using RMS.POSSystem.Views;

namespace RMS.POSSystem
{
    public partial class App : Application
    {
        private void Application_Startup(object sender, StartupEventArgs e)
        {
            AuthService.Logout();

            Exit += (_, _) =>
            {
                AuthService.Logout();
            };

            try
            {
                var db = new POSDatabase("pos_system.db");
                db.Initialize();

                var loginWindow = new LoginWindow();
                loginWindow.Show();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to launch POS system: {ex.Message}", "Fatal Startup Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
