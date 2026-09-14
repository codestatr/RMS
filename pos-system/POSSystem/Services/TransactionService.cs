using System;
using System.Collections.Generic;
using RMS.POSSystem.Database;
using RMS.POSSystem.Models;

namespace RMS.POSSystem.Services
{
    public class TransactionService
    {
        private readonly POSDatabase _db;

        public TransactionService(POSDatabase db)
        {
            _db = db;
        }

        public List<Property> GetAvailableProperties()
        {
            var list = new List<Property>();
            var rows = _db.ExecuteQuery("SELECT * FROM Properties WHERE Status = 'available' ORDER BY Name ASC");

            if (rows.Count == 0)
            {
                // Fallback demo properties with realistic Kenyan Shilling (KES) rates
                list.Add(new Property { Id = "prop-101", Name = "Sunlight Luxury 1-Bedroom Apartment", Type = "one_bedroom", Address = "Woodvale Grove, Westlands", PricePerNight = 5500.0m, Capacity = 2, Status = "available" });
                list.Add(new Property { Id = "prop-102", Name = "Ocean Breeze Beachfront Airbnb Villa", Type = "airbnb", Address = "Diani Beach Road", PricePerNight = 18000.0m, Capacity = 6, Status = "available" });
                list.Add(new Property { Id = "prop-103", Name = "Cozy Urban Bedsitter Studio", Type = "bedsitter", Address = "Ngong Road, Kilimani", PricePerNight = 2500.0m, Capacity = 1, Status = "available" });
                list.Add(new Property { Id = "prop-104", Name = "Lakeview Executive Bed & Breakfast", Type = "bnb", Address = "Riat Hills, Kisumu", PricePerNight = 6500.0m, Capacity = 3, Status = "available" });
                list.Add(new Property { Id = "prop-105", Name = "Downtown Executive Single Room Suite", Type = "single_room", Address = "Kenyatta Avenue, CBD", PricePerNight = 3500.0m, Capacity = 1, Status = "available" });
                list.Add(new Property { Id = "prop-106", Name = "Amber Heights 1-Bedroom Penthouse", Type = "one_bedroom", Address = "Riverside Drive", PricePerNight = 9500.0m, Capacity = 2, Status = "available" });
                return list;
            }

            foreach (var r in rows)
            {
                list.Add(new Property
                {
                    Id = r["Id"]?.ToString(),
                    Name = r["Name"]?.ToString(),
                    Type = r["Type"]?.ToString(),
                    Description = r["Description"]?.ToString(),
                    Address = r["Address"]?.ToString(),
                    PricePerNight = r["PricePerNight"] != null ? Convert.ToDecimal(r["PricePerNight"]) : 5500.0m,
                    Capacity = r["Capacity"] != null ? Convert.ToInt32(r["Capacity"]) : 1,
                    Status = r["Status"]?.ToString() ?? "available",
                });
            }

            return list;
        }

        public POSTransaction CreateWalkInBooking(
            string propertyId,
            string customerName,
            string customerPhone,
            DateTime checkInDate,
            DateTime checkOutDate,
            int numberOfGuests,
            decimal amountPaid,
            string paymentMethod,
            string specialRequests,
            string pickupLocation = null,
            string pickupDestination = null,
            string pickupTime = null,
            string pickupNotes = null)
        {
            var txId = Guid.NewGuid().ToString();
            var datePrefix = DateTime.Now.ToString("yyyyMMdd");
            var rand = new Random().Next(1000, 9999);
            var receiptNo = $"POS-{datePrefix}-{rand}";

            var nights = Math.Max(1, (int)(checkOutDate.Date - checkInDate.Date).TotalDays);

            // Fetch property to get nightly rate
            var props = _db.ExecuteQuery("SELECT PricePerNight FROM Properties WHERE Id = @id", new Dictionary<string, object> { { "id", propertyId } });
            decimal rate = 5500.0m;
            if (props.Count > 0 && props[0]["PricePerNight"] != null)
            {
                rate = Convert.ToDecimal(props[0]["PricePerNight"]);
            }

            var subtotal = rate * nights;
            var tax = subtotal * 0.16m; // 16% VAT
            var total = subtotal + tax;

            var cashierId = AuthService.CurrentUser?.Id ?? "cashier-default";

            _db.ExecuteNonQuery(
                @"INSERT INTO Transactions (
                    Id, PropertyId, CustomerId, CashierId, CheckInDate, CheckOutDate,
                    NumberOfGuests, TotalAmount, AmountPaid, PaymentMethod, TransactionStatus,
                    SyncStatus, ReceiptNumber, CreatedAt, UpdatedAt, SpecialRequests,
                    PickupLocation, PickupDestination, PickupTime, PickupNotes
                ) VALUES (
                    @Id, @PropertyId, @CustomerId, @CashierId, @CheckInDate, @CheckOutDate,
                    @NumberOfGuests, @TotalAmount, @AmountPaid, @PaymentMethod, 'completed',
                    'pending', @ReceiptNumber, @CreatedAt, @UpdatedAt, @SpecialRequests,
                    @PickupLocation, @PickupDestination, @PickupTime, @PickupNotes
                )",
                new Dictionary<string, object>
                {
                    { "Id", txId },
                    { "PropertyId", propertyId },
                    { "CustomerId", customerName + (string.IsNullOrEmpty(customerPhone) ? "" : $" ({customerPhone})") },
                    { "CashierId", cashierId },
                    { "CheckInDate", checkInDate.ToString("yyyy-MM-dd") },
                    { "CheckOutDate", checkOutDate.ToString("yyyy-MM-dd") },
                    { "NumberOfGuests", numberOfGuests },
                    { "TotalAmount", total },
                    { "AmountPaid", amountPaid },
                    { "PaymentMethod", paymentMethod },
                    { "ReceiptNumber", receiptNo },
                    { "CreatedAt", DateTime.UtcNow },
                    { "UpdatedAt", DateTime.UtcNow },
                    { "SpecialRequests", specialRequests ?? "" },
                    { "PickupLocation", pickupLocation ?? "" },
                    { "PickupDestination", pickupDestination ?? "" },
                    { "PickupTime", pickupTime ?? "" },
                    { "PickupNotes", pickupNotes ?? "" }
                }
            );

            // Log sync record
            _db.ExecuteNonQuery(
                @"INSERT INTO SyncLogs (Id, EntityType, EntityId, Action, Status, Timestamp)
                  VALUES (@id, 'transaction', @entityId, 'insert', 'pending', @time)",
                new Dictionary<string, object>
                {
                    { "id", Guid.NewGuid().ToString() },
                    { "entityId", txId },
                    { "time", DateTime.UtcNow }
                }
            );

            return new POSTransaction
            {
                Id = txId,
                PropertyId = propertyId,
                CustomerId = customerName,
                CashierId = cashierId,
                CheckInDate = checkInDate,
                CheckOutDate = checkOutDate,
                NumberOfGuests = numberOfGuests,
                TotalAmount = total,
                AmountPaid = amountPaid,
                PaymentMethod = paymentMethod,
                TransactionStatus = "completed",
                SyncStatus = "pending",
                ReceiptNumber = receiptNo,
                CreatedAt = DateTime.UtcNow,
                SpecialRequests = specialRequests,
                PickupLocation = pickupLocation,
                PickupDestination = pickupDestination,
                PickupTime = pickupTime,
                PickupNotes = pickupNotes
            };
        }

        public List<POSTransaction> GetRecentTransactions(string cashierId = null, int limit = 50)
        {
            var list = new List<POSTransaction>();
            string sql = "SELECT * FROM Transactions";
            var parameters = new Dictionary<string, object>();

            if (!string.IsNullOrEmpty(cashierId))
            {
                sql += " WHERE CashierId = @cid";
                parameters.Add("cid", cashierId);
            }

            sql += " ORDER BY CreatedAt DESC LIMIT " + limit;
            var rows = _db.ExecuteQuery(sql, parameters);

            foreach (var r in rows)
            {
                list.Add(new POSTransaction
                {
                    Id = r["Id"]?.ToString(),
                    PropertyId = r["PropertyId"]?.ToString(),
                    CustomerId = r["CustomerId"]?.ToString(),
                    CashierId = r["CashierId"]?.ToString(),
                    CheckInDate = r["CheckInDate"] != null ? Convert.ToDateTime(r["CheckInDate"]) : DateTime.MinValue,
                    CheckOutDate = r["CheckOutDate"] != null ? Convert.ToDateTime(r["CheckOutDate"]) : DateTime.MinValue,
                    NumberOfGuests = r["NumberOfGuests"] != null ? Convert.ToInt32(r["NumberOfGuests"]) : 1,
                    TotalAmount = r["TotalAmount"] != null ? Convert.ToDecimal(r["TotalAmount"]) : 0m,
                    AmountPaid = r["AmountPaid"] != null ? Convert.ToDecimal(r["AmountPaid"]) : 0m,
                    PaymentMethod = r["PaymentMethod"]?.ToString(),
                    TransactionStatus = r["TransactionStatus"]?.ToString(),
                    SyncStatus = r["SyncStatus"]?.ToString(),
                    ReceiptNumber = r["ReceiptNumber"]?.ToString(),
                    CreatedAt = r["CreatedAt"] != null ? Convert.ToDateTime(r["CreatedAt"]) : DateTime.UtcNow,
                    SpecialRequests = r["SpecialRequests"]?.ToString(),
                    PickupLocation = r["PickupLocation"]?.ToString(),
                    PickupDestination = r["PickupDestination"]?.ToString(),
                    PickupTime = r["PickupTime"]?.ToString(),
                    PickupNotes = r["PickupNotes"]?.ToString()
                });
            }

            return list;
        }
    }
}
