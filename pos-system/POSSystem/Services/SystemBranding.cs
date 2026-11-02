using System;
using System.Net.Http;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using Newtonsoft.Json.Linq;

namespace RMS.POSSystem.Services
{
    public static class SystemBranding
    {
        public const string DefaultColor = "#176B52";
        public static string BusinessName { get; private set; } = "CozyStay";
        public static string AccentColor { get; private set; } = DefaultColor;
        public static string LogoDataUri { get; private set; } = string.Empty;
        private static DateTime _lastLoadedUtc = DateTime.MinValue;

        public static async Task LoadAsync()
        {
            if (DateTime.UtcNow - _lastLoadedUtc < TimeSpan.FromSeconds(45)) return;
            _lastLoadedUtc = DateTime.UtcNow;
            var apiBaseUrl = Environment.GetEnvironmentVariable("RMS_API_URL") ?? "http://localhost:3000/api";
            try
            {
                using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
                var response = await client.GetStringAsync($"{apiBaseUrl.TrimEnd('/')}/settings/branding");
                var data = JObject.Parse(response)["data"];
                var name = data?["brandName"]?.ToString();
                if (!string.IsNullOrWhiteSpace(name)) BusinessName = name.Trim();
                LogoDataUri = data?["logo"]?.ToString() ?? string.Empty;
                var color = data?["brandColor"]?.ToString();
                if (IsHexColor(color))
                {
                    AccentColor = color;
                    Application.Current.Resources["AmberBrush"] = MakeBrush(color);
                    Application.Current.Resources["AmberDarkBrush"] = MakeBrush(color, 0.18);
                    Application.Current.Resources["AccentBrush"] = MakeBrush(color);
                }
            }
            catch
            {
                // The POS remains usable offline and keeps its default accent.
            }
        }

        private static bool IsHexColor(string color) =>
            !string.IsNullOrWhiteSpace(color) && System.Text.RegularExpressions.Regex.IsMatch(color, "^#[0-9a-fA-F]{6}$");

        private static SolidColorBrush MakeBrush(string color, double darken = 0)
        {
            var source = (Color)ColorConverter.ConvertFromString(color);
            var brush = new SolidColorBrush(Color.FromRgb(
                (byte)(source.R * (1 - darken)),
                (byte)(source.G * (1 - darken)),
                (byte)(source.B * (1 - darken))));
            brush.Freeze();
            return brush;
        }
    }
}
