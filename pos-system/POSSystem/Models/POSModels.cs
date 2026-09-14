using System;

namespace RMS.POSSystem.Models
{
    /// <summary>
    /// Represents a cashier/POS user
    /// </summary>
    public class POSUser
    {
        public string Id { get; set; }
        public string Username { get; set; }
        public string Email { get; set; }
        public string FullName { get; set; }
        public string Role { get; set; } // "cashier" or "admin"
        public string Status { get; set; } // "active", "inactive"
        public string PasswordHash { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? LastLogin { get; set; }
    }

    /// <summary>
    /// Represents a POS transaction (booking with payment)
    /// </summary>
    public class POSTransaction
    {
        public string Id { get; set; }
        public string PropertyId { get; set; }
        public string CustomerId { get; set; }
        public string CashierId { get; set; }
        public DateTime CheckInDate { get; set; }
        public DateTime CheckOutDate { get; set; }
        public int NumberOfGuests { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal AmountPaid { get; set; }
        public string PaymentMethod { get; set; } // "cash", "card", "mobile_money"
        public string TransactionReference { get; set; }
        public string TransactionStatus { get; set; } // "pending", "completed", "cancelled"
        public string SyncStatus { get; set; } // "pending", "synced", "error"
        public string ReceiptNumber { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string SpecialRequests { get; set; }
        public string PickupLocation { get; set; }
        public string PickupDestination { get; set; }
        public string PickupTime { get; set; }
        public string PickupNotes { get; set; }
    }

    /// <summary>
    /// Represents a cashier shift (work session)
    /// </summary>
    public class CashierShift
    {
        public string Id { get; set; }
        public string CashierId { get; set; }
        public DateTime OpenTime { get; set; }
        public DateTime? CloseTime { get; set; }
        public decimal OpeningBalance { get; set; }
        public decimal ExpectedClosingBalance { get; set; }
        public decimal ActualClosingBalance { get; set; }
        public int TransactionCount { get; set; }
        public string Status { get; set; } // "open", "closed"
        public string Notes { get; set; }
    }

    /// <summary>
    /// Represents a property available for booking
    /// </summary>
    public class Property
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Type { get; set; } // "one_bedroom", "airbnb", "single_room", "bedsitter", "bnb"
        public string Description { get; set; }
        public string Address { get; set; }
        public decimal PricePerNight { get; set; }
        public int Capacity { get; set; }
        public string Status { get; set; } // "available", "booked", "maintenance"
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
