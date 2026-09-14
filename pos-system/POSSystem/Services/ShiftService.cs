using System;
using System.Collections.Generic;
using RMS.POSSystem.Database;
using RMS.POSSystem.Models;

namespace RMS.POSSystem.Services
{
    public class ShiftService
    {
        private readonly POSDatabase _db;
        public static CashierShift ActiveShift { get; private set; }

        public ShiftService(POSDatabase db)
        {
            _db = db;
        }

        public CashierShift GetActiveShift(string cashierId)
        {
            var rows = _db.ExecuteQuery(
                "SELECT * FROM Shifts WHERE CashierId = @cid AND Status = 'open' ORDER BY OpenTime DESC LIMIT 1",
                new Dictionary<string, object> { { "cid", cashierId } }
            );

            if (rows.Count == 0)
            {
                ActiveShift = null;
                return null;
            }

            var r = rows[0];
            ActiveShift = new CashierShift
            {
                Id = r["Id"]?.ToString(),
                CashierId = r["CashierId"]?.ToString(),
                OpenTime = r["OpenTime"] != null ? Convert.ToDateTime(r["OpenTime"]) : DateTime.UtcNow,
                OpeningBalance = r["OpeningBalance"] != null ? Convert.ToDecimal(r["OpeningBalance"]) : 0m,
                Status = "open",
                Notes = r["Notes"]?.ToString()
            };

            return ActiveShift;
        }

        public CashierShift OpenShift(string cashierId, decimal openingBalance, string notes)
        {
            var existing = GetActiveShift(cashierId);
            if (existing != null)
            {
                throw new InvalidOperationException("Cashier already has an active open shift.");
            }

            var shiftId = Guid.NewGuid().ToString();
            var now = DateTime.UtcNow;

            _db.ExecuteNonQuery(
                @"INSERT INTO Shifts (Id, CashierId, OpenTime, OpeningBalance, Status, Notes)
                  VALUES (@id, @cid, @open, @balance, 'open', @notes)",
                new Dictionary<string, object>
                {
                    { "id", shiftId },
                    { "cid", cashierId },
                    { "open", now },
                    { "balance", openingBalance },
                    { "notes", notes ?? "Shift started" }
                }
            );

            ActiveShift = new CashierShift
            {
                Id = shiftId,
                CashierId = cashierId,
                OpenTime = now,
                OpeningBalance = openingBalance,
                Status = "open",
                Notes = notes
            };

            return ActiveShift;
        }

        public CashierShift CloseShift(string shiftId, decimal actualCashCount, string closingNotes)
        {
            var rows = _db.ExecuteQuery("SELECT * FROM Shifts WHERE Id = @id", new Dictionary<string, object> { { "id", shiftId } });
            if (rows.Count == 0) throw new InvalidOperationException("Shift not found.");

            var shift = rows[0];
            var opening = Convert.ToDecimal(shift["OpeningBalance"]);
            var openTime = Convert.ToDateTime(shift["OpenTime"]);
            var cashierId = shift["CashierId"]?.ToString();

            // Calculate cash sales collected in this shift
            var txRows = _db.ExecuteQuery(
                @"SELECT COUNT(*) as Count, SUM(AmountPaid) as TotalCash 
                  FROM Transactions 
                  WHERE CashierId = @cid AND PaymentMethod = 'cash' AND CreatedAt >= @openTime",
                new Dictionary<string, object> { { "cid", cashierId }, { "openTime", openTime } }
            );

            int txCount = txRows.Count > 0 && txRows[0]["Count"] != null ? Convert.ToInt32(txRows[0]["Count"]) : 0;
            decimal totalCash = txRows.Count > 0 && txRows[0]["TotalCash"] != null ? Convert.ToDecimal(txRows[0]["TotalCash"]) : 0m;
            decimal expectedBalance = opening + totalCash;

            var closeTime = DateTime.UtcNow;

            _db.ExecuteNonQuery(
                @"UPDATE Shifts SET 
                    CloseTime = @closeTime,
                    ExpectedClosingBalance = @exp,
                    ActualClosingBalance = @act,
                    TransactionCount = @cnt,
                    Status = 'closed',
                    Notes = @notes
                  WHERE Id = @id",
                new Dictionary<string, object>
                {
                    { "closeTime", closeTime },
                    { "exp", expectedBalance },
                    { "act", actualCashCount },
                    { "cnt", txCount },
                    { "notes", closingNotes ?? "" },
                    { "id", shiftId }
                }
            );

            ActiveShift = null;

            return new CashierShift
            {
                Id = shiftId,
                CashierId = cashierId,
                OpenTime = openTime,
                CloseTime = closeTime,
                OpeningBalance = opening,
                ExpectedClosingBalance = expectedBalance,
                ActualClosingBalance = actualCashCount,
                TransactionCount = txCount,
                Status = "closed",
                Notes = closingNotes
            };
        }

        public List<CashierShift> GetAllShifts()
        {
            var list = new List<CashierShift>();
            var rows = _db.ExecuteQuery("SELECT * FROM Shifts ORDER BY OpenTime DESC LIMIT 100");

            foreach (var r in rows)
            {
                list.Add(new CashierShift
                {
                    Id = r["Id"]?.ToString(),
                    CashierId = r["CashierId"]?.ToString(),
                    OpenTime = Convert.ToDateTime(r["OpenTime"]),
                    CloseTime = r["CloseTime"] != DBNull.Value && r["CloseTime"] != null ? Convert.ToDateTime(r["CloseTime"]) : (DateTime?)null,
                    OpeningBalance = Convert.ToDecimal(r["OpeningBalance"]),
                    ExpectedClosingBalance = r["ExpectedClosingBalance"] != DBNull.Value && r["ExpectedClosingBalance"] != null ? Convert.ToDecimal(r["ExpectedClosingBalance"]) : 0m,
                    ActualClosingBalance = r["ActualClosingBalance"] != DBNull.Value && r["ActualClosingBalance"] != null ? Convert.ToDecimal(r["ActualClosingBalance"]) : 0m,
                    TransactionCount = r["TransactionCount"] != DBNull.Value && r["TransactionCount"] != null ? Convert.ToInt32(r["TransactionCount"]) : 0,
                    Status = r["Status"]?.ToString(),
                    Notes = r["Notes"]?.ToString()
                });
            }

            return list;
        }
    }
}
