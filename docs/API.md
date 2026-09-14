# RMS API Documentation

Complete REST API reference for the House Rental & Booking Management System.

**Base URL:** `http://localhost:3000/api`

**Version:** 1.0.0

## Table of Contents

1. [Authentication](#authentication)
2. [Response Format](#response-format)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [Endpoints](#endpoints)
   - [Authentication](#auth-endpoints)
   - [Properties](#properties-endpoints)
   - [Bookings](#bookings-endpoints)
   - [Payments](#payments-endpoints)
   - [Users](#users-endpoints)
   - [Reports](#reports-endpoints)

## Authentication

All endpoints (except `/auth/register` and `/auth/login`) require JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

### Roles and Permissions

- **Customer**: Can view properties, make bookings, view own profile
- **Admin**: Full access to all resources
- **Cashier**: Can create bookings, process payments (restricted to POS)

## Response Format

All responses follow a consistent JSON format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation completed successfully"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2026-09-02T12:00:00Z"
}
```

## Error Handling

| Status Code | Meaning |
|-------------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

## Rate Limiting

- **Limit**: 100 requests per 15 minutes per IP
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## API Endpoints

### Auth Endpoints

#### Register User

**POST** `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+254712345678",
  "role": "customer"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "role": "customer",
    "createdAt": "2026-09-02T12:00:00Z"
  }
}
```

#### Login

**POST** `/auth/login`

Authenticate user and get JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "customer"
    }
  }
}
```

#### Refresh Token

**POST** `/auth/refresh`

Get a new access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "token"
}
```

#### Verify Token

**POST** `/auth/verify`

Verify if a token is valid.

**Request Body:**
```json
{
  "token": "token"
}
```

---

### Properties Endpoints

#### List Properties

**GET** `/properties`

Get all properties with filtering and pagination.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `type`: Property type filter
- `city`: City filter
- `minPrice`: Minimum price filter
- `maxPrice`: Maximum price filter
- `rating`: Minimum rating filter
- `search`: Search term

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Modern Apartment",
      "type": "one_bedroom",
      "address": "123 Main St",
      "city": "Nairobi",
      "pricePerNight": 65,
      "capacity": 2,
      "status": "available",
      "images": ["url1", "url2"],
      "rating": 4.8,
      "reviewCount": 127
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

#### Get Property Details

**GET** `/properties/:id`

Get detailed information about a specific property.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Modern Apartment",
    "type": "one_bedroom",
    "description": "Beautiful apartment...",
    "address": "123 Main St",
    "city": "Nairobi",
    "latitude": -1.2856,
    "longitude": 36.8172,
    "pricePerNight": 65,
    "pricePerWeek": 400,
    "pricePerMonth": 1500,
    "capacity": 2,
    "bedrooms": 1,
    "bathrooms": 1,
    "amenities": ["WiFi", "Parking", "Pool"],
    "images": [
      {
        "url": "image-url",
        "isCover": true
      }
    ],
    "reviews": [
      {
        "id": "uuid",
        "rating": 5,
        "comment": "Excellent property!",
        "authorName": "Jane Doe",
        "createdAt": "2026-08-15T12:00:00Z"
      }
    ]
  }
}
```

#### Create Property (Admin Only)

**POST** `/properties`

Create a new property listing.

**Request Body:**
```json
{
  "name": "Modern Apartment",
  "type": "one_bedroom",
  "description": "Beautiful apartment...",
  "address": "123 Main St",
  "city": "Nairobi",
  "latitude": -1.2856,
  "longitude": 36.8172,
  "pricePerNight": 65,
  "capacity": 2,
  "bedrooms": 1,
  "bathrooms": 1
}
```

#### Update Property (Admin Only)

**PUT** `/properties/:id`

Update property details.

#### Delete Property (Admin Only)

**DELETE** `/properties/:id`

Delete a property.

#### Check Availability

**GET** `/properties/:id/availability`

Check property availability for a date range.

**Query Parameters:**
- `checkIn`: Check-in date (YYYY-MM-DD)
- `checkOut`: Check-out date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "isAvailable": true,
    "availableDates": ["2026-09-05", "2026-09-06"],
    "bookedDates": ["2026-09-10", "2026-09-11"]
  }
}
```

---

### Bookings Endpoints

#### Create Booking

**POST** `/bookings`

Create a new booking.

**Request Body:**
```json
{
  "propertyId": "uuid",
  "checkInDate": "2026-09-10",
  "checkOutDate": "2026-09-13",
  "numberOfGuests": 2,
  "specialRequests": "Please provide extra pillows"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "booking-uuid",
    "propertyId": "uuid",
    "status": "pending",
    "totalAmount": 225.75,
    "createdAt": "2026-09-02T12:00:00Z"
  }
}
```

#### Get My Bookings

**GET** `/bookings`

Get bookings for the current user.

**Query Parameters:**
- `status`: Filter by status (pending, confirmed, checked_out, cancelled)
- `page`: Page number
- `limit`: Items per page

#### Get Booking Details

**GET** `/bookings/:id`

Get details of a specific booking.

#### Update Booking Status (Admin Only)

**PUT** `/bookings/:id`

Update booking status.

**Request Body:**
```json
{
  "status": "confirmed"
}
```

#### Cancel Booking

**POST** `/bookings/:id/cancel`

Cancel a booking.

**Request Body:**
```json
{
  "reason": "Change of plans"
}
```

---

### Payments Endpoints

#### Create Payment

**POST** `/payments`

Create a payment for a booking.

**Request Body:**
```json
{
  "bookingId": "uuid",
  "amount": 225.75,
  "method": "card",
  "cardToken": "stripe-token"
}
```

#### Get Payment Details

**GET** `/payments/:id`

Get payment information.

#### Update Payment Status (Admin Only)

**PUT** `/payments/:id`

Update payment status.

**Request Body:**
```json
{
  "status": "paid"
}
```

#### Refund Payment

**POST** `/payments/:id/refund`

Refund a payment.

**Request Body:**
```json
{
  "reason": "Customer request"
}
```

#### Webhook - Stripe

**POST** `/payments/webhook/stripe`

Handle Stripe payment webhooks.

#### Webhook - M-Pesa

**POST** `/payments/webhook/mpesa`

Handle M-Pesa payment callbacks.

---

### Users Endpoints

#### Get Current User Profile

**GET** `/users/me/profile`

Get the current authenticated user's profile.

#### Get User Profile

**GET** `/users/:id`

Get a user's profile.

#### Update Profile

**PUT** `/users/:id`

Update user profile information.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+254712345678",
  "address": "123 Main St"
}
```

#### Change Password

**POST** `/users/:id/change-password`

Change user password.

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

#### Setup 2FA

**POST** `/users/:id/2fa-setup`

Setup two-factor authentication.

#### Verify 2FA

**POST** `/users/:id/2fa-verify`

Verify 2FA code during login.

**Request Body:**
```json
{
  "code": "123456"
}
```

---

### Reports Endpoints

#### Revenue Report

**GET** `/reports/revenue`

Get revenue report.

**Query Parameters:**
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)
- `propertyId`: Filter by property (optional)
- `groupBy`: Group by day/week/month (default: month)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 15000,
    "bookingsCount": 45,
    "averageBookingValue": 333.33,
    "breakdown": [
      {
        "period": "2026-09",
        "revenue": 5000,
        "bookings": 15
      }
    ]
  }
}
```

#### Occupancy Report

**GET** `/reports/occupancy`

Get occupancy rate report.

#### Bookings Report

**GET** `/reports/bookings`

Get bookings report by source and status.

#### Payments Report

**GET** `/reports/payments`

Get payments report by method and status.

#### Dashboard KPIs

**GET** `/reports/dashboard`

Get dashboard KPIs and analytics.

**Response:**
```json
{
  "success": true,
  "data": {
    "todayBookings": 3,
    "todayRevenue": 450,
    "totalBookings": 125,
    "monthlyRevenue": 15000,
    "occupancyRate": 75.5,
    "averageRating": 4.8,
    "pendingPayments": 2,
    "topProperties": [
      {
        "id": "uuid",
        "name": "Modern Apartment",
        "revenue": 3000
      }
    ]
  }
}
```

#### Export Report

**POST** `/reports/export`

Export report as PDF or Excel.

**Request Body:**
```json
{
  "reportType": "revenue",
  "format": "pdf",
  "startDate": "2026-09-01",
  "endDate": "2026-09-30"
}
```

---

## Examples

### Complete Booking Flow

1. **Browse Properties**
```bash
GET /api/properties?city=Nairobi&minPrice=50&maxPrice=150
```

2. **Get Property Details**
```bash
GET /api/properties/{propertyId}
```

3. **Check Availability**
```bash
GET /api/properties/{propertyId}/availability?checkIn=2026-09-10&checkOut=2026-09-13
```

4. **Create Booking**
```bash
POST /api/bookings
{
  "propertyId": "uuid",
  "checkInDate": "2026-09-10",
  "checkOutDate": "2026-09-13",
  "numberOfGuests": 2
}
```

5. **Create Payment**
```bash
POST /api/payments
{
  "bookingId": "booking-uuid",
  "amount": 225.75,
  "method": "card"
}
```

---

## Best Practices

1. **Always include error handling** in your client code
2. **Use pagination** for list endpoints to limit data transfer
3. **Cache responses** where appropriate
4. **Implement exponential backoff** for retry logic
5. **Monitor rate limits** and implement throttling
6. **Keep access tokens secure** and refresh before expiry
7. **Validate input** on the client side before sending requests
8. **Use HTTPS** in production environments

---

## Support

For API issues and questions:
- Email: api-support@rms-system.com
- Documentation: Complete examples available in the repository
- GitHub Issues: Report bugs and feature requests
