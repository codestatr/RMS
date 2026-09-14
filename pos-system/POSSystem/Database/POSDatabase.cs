using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;

namespace RMS.POSSystem.Database
{
    /// <summary>
    /// Manages SQLite database operations for POS system
    /// </summary>
    public class POSDatabase
    {
        private readonly string _connectionString;

        public POSDatabase(string databasePath = "pos_system.db")
        {
            _connectionString = $"Data Source={databasePath};";
        }

        /// <summary>
        /// Initialize database schema
        /// </summary>
        public void Initialize()
        {
            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();

                // Users table
                var command = connection.CreateCommand();
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS Users (
                        Id TEXT PRIMARY KEY,
                        Username TEXT UNIQUE,
                        Email TEXT UNIQUE,
                        FullName TEXT,
                        Role TEXT,
                        Status TEXT,
                        PasswordHash TEXT,
                        CreatedAt DATETIME,
                        UpdatedAt DATETIME,
                        LastLogin DATETIME
                    )
                ";
                command.ExecuteNonQuery();

                // Properties table
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS Properties (
                        Id TEXT PRIMARY KEY,
                        Name TEXT,
                        Type TEXT,
                        Description TEXT,
                        Address TEXT,
                        PricePerNight REAL,
                        Capacity INTEGER,
                        Status TEXT,
                        CreatedAt DATETIME,
                        UpdatedAt DATETIME
                    )
                ";
                command.ExecuteNonQuery();

                // Transactions table
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS Transactions (
                        Id TEXT PRIMARY KEY,
                        PropertyId TEXT,
                        CustomerId TEXT,
                        CashierId TEXT,
                        CheckInDate DATE,
                        CheckOutDate DATE,
                        NumberOfGuests INTEGER,
                        TotalAmount REAL,
                        AmountPaid REAL,
                        PaymentMethod TEXT,
                        TransactionReference TEXT,
                        TransactionStatus TEXT,
                        SyncStatus TEXT,
                        ReceiptNumber TEXT UNIQUE,
                        CreatedAt DATETIME,
                        UpdatedAt DATETIME,
                        SpecialRequests TEXT,
                        PickupLocation TEXT,
                        PickupDestination TEXT,
                        PickupTime TEXT,
                        PickupNotes TEXT,
                        FOREIGN KEY (PropertyId) REFERENCES Properties(Id),
                        FOREIGN KEY (CashierId) REFERENCES Users(Id)
                    )
                ";
                command.ExecuteNonQuery();

                foreach (var column in new[]
                {
                    "TransactionReference TEXT",
                    "PickupLocation TEXT",
                    "PickupDestination TEXT",
                    "PickupTime TEXT",
                    "PickupNotes TEXT"
                })
                {
                    try
                    {
                        command.CommandText = $"ALTER TABLE Transactions ADD COLUMN {column}";
                        command.ExecuteNonQuery();
                    }
                    catch (SqliteException ex) when (ex.SqliteErrorCode == 1)
                    {
                        // Existing databases already contain the column.
                    }
                }

                // Shifts table
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS Shifts (
                        Id TEXT PRIMARY KEY,
                        CashierId TEXT,
                        OpenTime DATETIME,
                        CloseTime DATETIME,
                        OpeningBalance REAL,
                        ExpectedClosingBalance REAL,
                        ActualClosingBalance REAL,
                        TransactionCount INTEGER,
                        Status TEXT,
                        Notes TEXT,
                        FOREIGN KEY (CashierId) REFERENCES Users(Id)
                    )
                ";
                command.ExecuteNonQuery();

                // Sync logs table
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS SyncLogs (
                        Id TEXT PRIMARY KEY,
                        EntityType TEXT,
                        EntityId TEXT,
                        Action TEXT,
                        Status TEXT,
                        Timestamp DATETIME,
                        ErrorMessage TEXT
                    )
                ";
                command.ExecuteNonQuery();

                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS SyncState (
                        Id TEXT PRIMARY KEY,
                        LastPullAt DATETIME
                    )
                ";
                command.ExecuteNonQuery();
            }
        }

        /// <summary>
        /// Execute a non-query command
        /// </summary>
        public int ExecuteNonQuery(string sql, Dictionary<string, object> parameters = null)
        {
            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = sql;

                if (parameters != null)
                {
                    foreach (var param in parameters)
                    {
                        command.Parameters.AddWithValue($"@{param.Key}", param.Value ?? DBNull.Value);
                    }
                }

                return command.ExecuteNonQuery();
            }
        }

        /// <summary>
        /// Execute a query that returns data
        /// </summary>
        public List<Dictionary<string, object>> ExecuteQuery(string sql, Dictionary<string, object> parameters = null)
        {
            var results = new List<Dictionary<string, object>>();

            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = sql;

                if (parameters != null)
                {
                    foreach (var param in parameters)
                    {
                        command.Parameters.AddWithValue($"@{param.Key}", param.Value ?? DBNull.Value);
                    }
                }

                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var row = new Dictionary<string, object>();
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
                        }
                        results.Add(row);
                    }
                }
            }

            return results;
        }

        /// <summary>
        /// Get a single value
        /// </summary>
        public object ExecuteScalar(string sql, Dictionary<string, object> parameters = null)
        {
            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = sql;

                if (parameters != null)
                {
                    foreach (var param in parameters)
                    {
                        command.Parameters.AddWithValue($"@{param.Key}", param.Value ?? DBNull.Value);
                    }
                }

                return command.ExecuteScalar();
            }
        }
    }
}
