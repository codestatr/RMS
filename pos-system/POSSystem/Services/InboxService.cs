using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace RMS.POSSystem.Services
{
    public sealed class InboxMessage
    {
        public string Id { get; set; }
        public string Title { get; set; }
        public string Message { get; set; }
        public string Sender { get; set; }
        public string CreatedAt { get; set; }
        public bool IsRead { get; set; }
    }

    public sealed class InboxService
    {
        private const string ApiBaseUrl = "http://localhost:3000/api/notifications";
        private readonly HttpClient _client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };

        private void ApplyToken()
        {
            _client.DefaultRequestHeaders.Authorization = string.IsNullOrWhiteSpace(AuthService.CurrentToken)
                ? null
                : new AuthenticationHeaderValue("Bearer", AuthService.CurrentToken);
        }

        public async Task<IReadOnlyList<InboxMessage>> GetMessagesAsync()
        {
            ApplyToken();
            using var response = await _client.GetAsync(ApiBaseUrl);
            response.EnsureSuccessStatusCode();
            var json = JObject.Parse(await response.Content.ReadAsStringAsync());
            var messages = new List<InboxMessage>();
            foreach (var row in json["data"] as JArray ?? new JArray())
            {
                messages.Add(new InboxMessage
                {
                    Id = row["id"]?.ToString(),
                    Title = row["title"]?.ToString(),
                    Message = row["message"]?.ToString(),
                    Sender = row["sender_name"]?.ToString() ?? "System",
                    CreatedAt = row["created_at"]?.ToString(),
                    IsRead = row["read_at"] != null && row["read_at"].Type != JTokenType.Null,
                });
            }
            return messages;
        }

        public async Task MarkReadAsync(string messageId)
        {
            ApplyToken();
            using var response = await _client.PatchAsync(
                $"{ApiBaseUrl}/{Uri.EscapeDataString(messageId)}/read",
                new StringContent("{}", Encoding.UTF8, "application/json"));
            response.EnsureSuccessStatusCode();
        }
    }
}
