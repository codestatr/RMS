using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using BCrypt.Net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RMS.POSSystem.Database;
using RMS.POSSystem.Models;

namespace RMS.POSSystem.Services
{
    public class AuthService
    {
        private readonly POSDatabase _db;
        private readonly HttpClient _client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
        public static POSUser CurrentUser { get; private set; }
        public static string CurrentToken { get; private set; }

        public AuthService(POSDatabase db)
        {
            _db = db;
        }

        public bool Login(string emailOrUsername, string password, out string errorMessage)
        {
            errorMessage = string.Empty;

            var users = _db.ExecuteQuery(
                "SELECT * FROM Users WHERE Email = @ident OR Username = @ident",
                new Dictionary<string, object> { { "ident", emailOrUsername } }
            );

            if (users.Count == 0)
            {
                return LoginAgainstServer(emailOrUsername, password, out errorMessage);
            }

            var row = users[0];
            var status = row["Status"]?.ToString();
            if (status != "active")
            {
                return LoginAgainstServer(emailOrUsername, password, out errorMessage);
            }

            var passwordHash = row["PasswordHash"]?.ToString();
            if (string.IsNullOrWhiteSpace(passwordHash) || !BCrypt.Net.BCrypt.Verify(password, passwordHash))
            {
                return LoginAgainstServer(emailOrUsername, password, out errorMessage);
            }

            var role = row["Role"]?.ToString()?.ToLowerInvariant();
            if (role != "admin" && role != "cashier")
            {
                errorMessage = "Customer accounts must sign in through the web application";
                return false;
            }

            CurrentUser = new POSUser
            {
                Id = row["Id"]?.ToString(),
                Username = row["Username"]?.ToString(),
                Email = row["Email"]?.ToString(),
                FullName = row["FullName"]?.ToString(),
                Role = role,
                Status = status,
            };

            // Update LastLogin
            _db.ExecuteNonQuery(
                "UPDATE Users SET LastLogin = @now WHERE Id = @id",
                new Dictionary<string, object> { { "now", DateTime.UtcNow }, { "id", CurrentUser.Id } }
            );

            // Keep offline login available, while acquiring a server token when the API is reachable.
            var localUser = CurrentUser;
            LoginAgainstServer(CurrentUser.Email ?? emailOrUsername, password, out _);
            CurrentUser ??= localUser;

            return true;
        }

        private bool LoginAgainstServer(string emailOrUsername, string password, out string errorMessage)
        {
            errorMessage = string.Empty;
            try
            {
                var body = JsonConvert.SerializeObject(new { email = emailOrUsername, password, client = "pos" });
                using var content = new StringContent(body, Encoding.UTF8, "application/json");
                var response = _client.PostAsync("http://localhost:3000/api/auth/login", content).GetAwaiter().GetResult();
                var json = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                if (!response.IsSuccessStatusCode) { errorMessage = "Invalid staff credentials"; return false; }

                var data = JObject.Parse(json)["data"];
                var role = data?["user"]?["role"]?.ToString()?.ToLowerInvariant();
                if (role != "admin" && role != "cashier") { errorMessage = "Only cashier and admin accounts can use the POS"; return false; }

                CurrentToken = data["token"]?.ToString();
                CurrentUser = new POSUser
                {
                    Id = data["user"]?["id"]?.ToString(),
                    Email = data["user"]?["email"]?.ToString(),
                    FullName = $"{data["user"]?["firstName"]} {data["user"]?["lastName"]}".Trim(),
                    Role = role,
                    Status = "active"
                };
                return true;
            }
            catch
            {
                errorMessage = "Unable to reach the server. Contact an administrator or check the network.";
                return false;
            }
        }

        public static void Logout()
        {
            CurrentUser = null;
            CurrentToken = null;
        }

        public bool IsAdmin()
        {
            return CurrentUser != null && CurrentUser.Role?.ToLower() == "admin";
        }
    }
}
