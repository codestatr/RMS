using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RMS.POSSystem.Database;
using RMS.POSSystem.Services;

namespace RMS.POSSystem.Sync
{
    public class SyncService
    {
        private readonly POSDatabase _db;
        private readonly HttpClient _client;
        private readonly string _apiBaseUrl;

        public SyncService(POSDatabase db, string apiBaseUrl = "http://localhost:3000/api")
        {
            _db = db;
            _apiBaseUrl = apiBaseUrl;
            _client = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        }

        public async Task<bool> SyncNowAsync()
        {
            try
            {
                if (string.IsNullOrWhiteSpace(AuthService.CurrentToken)) return false;
                _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthService.CurrentToken);

                var state = _db.ExecuteQuery("SELECT LastPullAt FROM SyncState WHERE Id = 'central'");
                var since = state.Count > 0 ? state[0]["LastPullAt"]?.ToString() : "1970-01-01 00:00:00";
                var pullResponse = await _client.PostAsync($"{_apiBaseUrl}/sync/pull", JsonContent(new { sinceTimestamp = since }));
                if (!pullResponse.IsSuccessStatusCode) return false;

                var data = JObject.Parse(await pullResponse.Content.ReadAsStringAsync())["data"];
                ImportProperties(data?["delta"]?["properties"] as JArray);
                ImportBookings(data?["delta"]?["bookings"] as JArray, data?["delta"]?["payments"] as JArray);

                var serverTime = data?["serverTime"]?.ToString();
                if (!string.IsNullOrWhiteSpace(serverTime))
                {
                    _db.ExecuteNonQuery(
                        "INSERT INTO SyncState (Id, LastPullAt) VALUES ('central', @time) ON CONFLICT(Id) DO UPDATE SET LastPullAt=@time",
                        new Dictionary<string, object> { { "time", serverTime } });
                }

                return await PushPendingTransactionsAsync();
            }
            catch
            {
                return false;
            }
        }

        private void ImportProperties(JArray properties)
        {
            if (properties == null) return;
            foreach (JObject property in properties)
            {
                _db.ExecuteNonQuery(
                    @"INSERT INTO Properties (Id, Name, Type, Address, PricePerNight, Capacity, Status, CreatedAt, UpdatedAt)
                      VALUES (@id, @name, @type, @address, @price, @capacity, @status, @now, @now)
                      ON CONFLICT(Id) DO UPDATE SET Name=@name, Type=@type, Address=@address,
                      PricePerNight=@price, Capacity=@capacity, Status=@status, UpdatedAt=@now",
                    new Dictionary<string, object>
                    {
                        { "id", property["id"]?.ToString() }, { "name", property["name"]?.ToString() },
                        { "type", property["type"]?.ToString() }, { "address", property["address"]?.ToString() },
                        { "price", property["price_per_night"]?.Value<decimal>() ?? 0m },
                        { "capacity", property["capacity"]?.Value<int>() ?? 1 },
                        { "status", property["status"]?.ToString() ?? "available" }, { "now", DateTime.UtcNow }
                    });
            }
        }

        private void ImportBookings(JArray bookings, JArray payments)
        {
            if (bookings == null) return;
            var paymentsByBooking = new Dictionary<string, JObject>();
            if (payments != null)
            {
                foreach (JObject payment in payments)
                {
                    var bookingId = payment["booking_id"]?.ToString();
                    if (!string.IsNullOrWhiteSpace(bookingId)) paymentsByBooking[bookingId] = payment;
                }
            }

            foreach (JObject booking in bookings)
            {
                var bookingId = booking["id"]?.ToString();
                if (string.IsNullOrWhiteSpace(bookingId)) continue;
                paymentsByBooking.TryGetValue(bookingId, out var payment);
                var customerName = $"{booking["first_name"]} {booking["last_name"]}".Trim();
                _db.ExecuteNonQuery(
                    @"INSERT INTO Transactions
                      (Id, PropertyId, CustomerId, CashierId, CheckInDate, CheckOutDate, NumberOfGuests,
                       TotalAmount, AmountPaid, PaymentMethod, TransactionReference, TransactionStatus,
                       SyncStatus, ReceiptNumber, CreatedAt, UpdatedAt, SpecialRequests,
                       PickupLocation, PickupDestination, PickupTime, PickupNotes)
                      VALUES (@id, @property, @customer, @cashier, @checkin, @checkout, @guests, @total, @paid,
                       @method, @reference, @status, 'synced', @receipt, @created, @updated, @notes,
                       @pickupLocation, @pickupDestination, @pickupTime, @pickupNotes)
                      ON CONFLICT(Id) DO UPDATE SET PropertyId=@property, CustomerId=@customer,
                       CheckInDate=@checkin, CheckOutDate=@checkout, NumberOfGuests=@guests, TotalAmount=@total,
                       AmountPaid=@paid, PaymentMethod=@method, TransactionReference=@reference,
                       TransactionStatus=@status, SyncStatus='synced', UpdatedAt=@updated,
                       SpecialRequests=@notes, PickupLocation=@pickupLocation,
                       PickupDestination=@pickupDestination, PickupTime=@pickupTime,
                       PickupNotes=@pickupNotes",
                    new Dictionary<string, object>
                    {
                        { "id", bookingId }, { "property", booking["property_id"]?.ToString() },
                        { "customer", customerName }, { "cashier", AuthService.CurrentUser?.Id },
                        { "checkin", booking["check_in_date"]?.ToString() }, { "checkout", booking["check_out_date"]?.ToString() },
                        { "guests", booking["number_of_guests"]?.Value<int>() ?? 1 },
                        { "total", booking["total_amount"]?.Value<decimal>() ?? 0m },
                        { "paid", payment?["amount"]?.Value<decimal>() ?? 0m },
                        { "method", payment?["method"]?.ToString() ?? "online" },
                        { "reference", payment?["transaction_ref"]?.ToString() ?? "" },
                        { "status", booking["status"]?.ToString() ?? "pending" }, { "receipt", $"WEB-{bookingId}" },
                        { "created", booking["created_at"] != null ? (object)booking["created_at"].ToString() : DateTime.UtcNow },
                        { "updated", booking["updated_at"] != null ? (object)booking["updated_at"].ToString() : DateTime.UtcNow },
                        { "notes", booking["special_requests"]?.ToString() ?? "" },
                        { "pickupLocation", booking["pickup_location"]?.ToString() ?? "" },
                        { "pickupDestination", booking["pickup_destination"]?.ToString() ?? "" },
                        { "pickupTime", booking["pickup_time"]?.ToString() ?? "" },
                        { "pickupNotes", booking["pickup_notes"]?.ToString() ?? "" }
                    });
            }
        }

        private async Task<bool> PushPendingTransactionsAsync()
        {
            var pending = _db.ExecuteQuery("SELECT * FROM Transactions WHERE SyncStatus = 'pending' LIMIT 50");
            if (pending.Count == 0) return true;

            var bookings = new List<object>();
            var payments = new List<object>();
            foreach (var tx in pending)
            {
                bookings.Add(new
                {
                    id = tx["Id"], propertyId = tx["PropertyId"], customerId = tx["CustomerId"],
                    customerName = tx["CustomerId"],
                    checkInDate = tx["CheckInDate"], checkOutDate = tx["CheckOutDate"],
                    numberOfGuests = tx["NumberOfGuests"], totalAmount = tx["TotalAmount"],
                    status = tx["TransactionStatus"], source = "pos", specialRequests = tx["SpecialRequests"],
                    pickupLocation = tx["PickupLocation"], pickupDestination = tx["PickupDestination"],
                    pickupTime = tx["PickupTime"], pickupNotes = tx["PickupNotes"]
                });
                if (Convert.ToDecimal(tx["AmountPaid"] ?? 0m) > 0)
                {
                    payments.Add(new
                    {
                        id = $"{tx["Id"]}-payment", bookingId = tx["Id"], amount = tx["AmountPaid"],
                        method = tx["PaymentMethod"], status = "paid", transactionRef = tx["TransactionReference"],
                        issuedBy = tx["CashierId"]
                    });
                }
            }

            var response = await _client.PostAsync(
                $"{_apiBaseUrl}/sync/push",
                JsonContent(new { deviceId = "pos-terminal-01", payload = new { bookings, payments } }));
            if (!response.IsSuccessStatusCode) return false;

            _db.ExecuteNonQuery("UPDATE Transactions SET SyncStatus = 'synced' WHERE SyncStatus = 'pending'");
            _db.ExecuteNonQuery("UPDATE SyncLogs SET Status = 'synced' WHERE Status = 'pending'");
            return true;
        }

        private static StringContent JsonContent(object value) =>
            new StringContent(JsonConvert.SerializeObject(value), Encoding.UTF8, "application/json");
    }
}
