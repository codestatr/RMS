# Backend Implementation Guide

## Architecture Overview

The RMS backend is built with Express.js following a layered architecture:

```
┌─────────────────────────────────────────┐
│         HTTP Requests / Routes          │
├─────────────────────────────────────────┤
│  Middleware (Auth, Validation, Errors)  │
├─────────────────────────────────────────┤
│         Route Handlers                   │
├─────────────────────────────────────────┤
│         Services (Business Logic)        │
├─────────────────────────────────────────┤
│         Database Layer                   │
├─────────────────────────────────────────┤
│    MySQL Database (Primary)              │
└─────────────────────────────────────────┘
```

## Directory Structure

```
backend/
├── src/
│   ├── app.js                    # Main Express app with middleware & routes
│   ├── server.js                 # Server entry point (if using as CLI)
│   ├── database/
│   │   └── db.js                 # MySQL connection pool & query helpers
│   ├── middleware/
│   │   └── auth.js               # JWT authentication & role-based access
│   ├── routes/
│   │   ├── auth.js               # Authentication endpoints
│   │   ├── users.js              # User management
│   │   ├── properties.js         # Property listing & management
│   │   ├── bookings.js           # Booking management
│   │   ├── payments.js           # Payment processing
│   │   └── reports.js            # Analytics & reporting
│   ├── services/
│   │   ├── UserService.js        # User business logic
│   │   ├── PropertyService.js    # Property business logic
│   │   ├── BookingService.js     # Booking business logic
│   │   ├── PaymentService.js     # Payment business logic
│   │   └── ReportService.js      # Reporting logic
│   ├── utils/
│   │   ├── auth.js               # JWT, password hashing, OTP generation
│   │   ├── validation.js         # Input validation & sanitization
│   │   └── errors.js             # Custom error classes & handler
│   └── config/
│       └── database.sql          # Database schema (if managing separately)
├── .env.example                   # Environment variables template
├── package.json                   # Dependencies
└── package-lock.json              # Dependency lock file
```

## Request Flow Example

### User Registration Flow

```
1. POST /api/auth/register
   ├─ Express route handler (routes/auth.js)
   ├─ asyncHandler wrapper catches errors
   ├─ Validation middleware checks input
   ├─ UserService.register() called
   │  ├─ Validates email format
   │  ├─ Validates password strength
   │  ├─ Checks if email already exists (DB query)
   │  ├─ Hashes password with bcryptjs
   │  ├─ Creates user in database
   │  └─ Returns formatted user object
   ├─ Response sent to client
   └─ If error: caught by errorHandler middleware
```

## Core Components

### 1. Database Layer (database/db.js)

**Purpose**: Abstract database operations with connection pooling and error handling

```javascript
import { getPool, query, transaction } from '../database/db.js'

// Simple query
const users = await query('SELECT * FROM users WHERE id = ?', [userId])

// Transaction
await transaction(async (connection) => {
  await connection.execute('UPDATE users SET status = ?', ['active'])
  await connection.execute('INSERT INTO audit_logs ...')
})
```

**Key Features**:
- Connection pooling (max 10 connections)
- Prepared statements (SQL injection prevention)
- Error handling and connection retry
- Transaction support with rollback

### 2. Authentication (utils/auth.js)

**Purpose**: Handle all cryptographic operations

```javascript
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js'

// Registration
const hash = await hashPassword(password)

// Login
const isValid = await comparePassword(password, storedHash)

// Token generation
const token = generateToken({ id, email, role }, '24h')
const refreshToken = generateRefreshToken({ id, email })
```

**Key Features**:
- bcryptjs with 10 salt rounds
- JWT with expiration
- OTP generation for 2FA
- Secure token generation for email verification

### 3. Validation (utils/validation.js)

**Purpose**: Validate and sanitize user input

```javascript
import { validateEmail, validateSchema, sanitizeInput } from '../utils/validation.js'

// Individual validators
if (!validateEmail(email)) throw new Error('Invalid email')

// Schema-based validation
const { isValid, errors } = validateSchema(req.body, {
  email: { required: true, type: 'string', pattern: /^.+@.+\..+$/ },
  password: { required: true, minLength: 8 },
  age: { type: 'number', min: 18, max: 120 }
})

// Sanitization
const safe = sanitizeInput(req.body)
```

**Supported Validators**:
- Email, phone, UUID, date formats
- Password strength
- Property types, booking status, payment methods
- Custom patterns and functions

### 4. Error Handling (utils/errors.js)

**Purpose**: Consistent error responses across the API

```javascript
import { ApiError, ValidationError, NotFoundError } from '../utils/errors.js'

throw new ValidationError('Email already exists')
throw new NotFoundError('User')
throw new ApiError(403, 'Insufficient permissions', 'FORBIDDEN')
```

**Error Types**:
- `ApiError(statusCode, message, code)` - Generic
- `ValidationError(message, errors)` - Input validation failed
- `NotFoundError(resource)` - Resource not found (404)
- `UnauthorizedError(message)` - Not authenticated (401)
- `ForbiddenError(message)` - No permission (403)
- `ConflictError(message)` - Duplicate resource (409)

**Error Response Format**:
```json
{
  "success": false,
  "error": "Email already registered",
  "code": "DUPLICATE_ENTRY",
  "errors": {
    "email": "This email is already in use"
  },
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

### 5. Middleware (middleware/auth.js)

**Purpose**: Protect routes and enforce permissions

```javascript
import { authenticate, requireRole } from '../middleware/auth.js'

// Protect a route
router.get('/', authenticate, (req, res) => {
  console.log(req.user) // { id, email, role }
})

// Enforce role
router.post('/admin', authenticate, requireRole('admin'), (req, res) => {
  // Only admins can access
})

// Multiple roles
requireRole('admin', 'cashier')
```

### 6. Services (Business Logic)

Each service encapsulates business logic for a domain:

#### UserService
```javascript
import UserService from '../services/UserService.js'

// Registration
await UserService.register({
  email: 'user@example.com',
  password: 'SecurePass123!',
  firstName: 'John',
  lastName: 'Doe'
})

// Login
const { token, refreshToken, user } = await UserService.login(email, password)

// Profile update
await UserService.updateProfile(userId, { firstName, phone })

// Change password
await UserService.changePassword(userId, oldPassword, newPassword)
```

#### PropertyService
```javascript
import PropertyService from '../services/PropertyService.js'

// Create property
await PropertyService.createProperty(ownerId, {
  name: 'Beachfront Apartment',
  type: 'airbnb',
  pricePerNight: 150,
  address: '123 Beach St',
  city: 'Nairobi'
})

// Get with filters
const result = await PropertyService.getAllProperties({
  city: 'Nairobi',
  minPrice: 100,
  maxPrice: 500,
  search: 'beach'
}, page = 1, limit = 20)

// Check availability
const { isAvailable, conflictingBookings } = 
  await PropertyService.checkAvailability(propertyId, '2024-01-20', '2024-01-25')
```

#### BookingService
```javascript
import BookingService from '../services/BookingService.js'

// Create booking
const booking = await BookingService.createBooking(customerId, {
  propertyId: 'property-uuid',
  checkInDate: '2024-01-20',
  checkOutDate: '2024-01-25',
  numberOfGuests: 2
})

// Status transitions
await BookingService.updateBookingStatus(bookingId, 'confirmed')

// Cancel
await BookingService.cancelBooking(bookingId, customerId)
```

#### PaymentService
```javascript
import PaymentService from '../services/PaymentService.js'

// Create payment
await PaymentService.createPayment(bookingId, 500, 'card')

// Get revenue
const revenue = await PaymentService.getDailyRevenue('2024-01-15')

// Outstanding balances
const outstanding = await PaymentService.getOutstandingPayments()
```

#### ReportService
```javascript
import ReportService from '../services/ReportService.js'

// Dashboard KPIs
const kpis = await ReportService.getDashboardKPIs()
// { totalRevenue, totalBookings, totalProperties, occupancyRate }

// Revenue by date
const revenue = await ReportService.getRevenueByDateRange('2024-01-01', '2024-01-31')

// Top properties
const topProps = await ReportService.getTopPropertiesByRevenue(10, '2024-01')
```

## API Endpoint Overview

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Get JWT token
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Log logout event
- `POST /api/auth/verify` - Check token validity
- `POST /api/auth/change-password` - Change password

### Users
- `GET /api/users` - List all users (admin)
- `GET /api/users/me` - Current user profile
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update profile
- `POST /api/users/:id/deactivate` - Deactivate account
- `POST /api/users/:id/suspend` - Suspend user (admin)
- `POST /api/users/:id/reactivate` - Reactivate user (admin)
- `DELETE /api/users/:id` - Delete account (admin)

### Properties
- `GET /api/properties` - List with filters
- `POST /api/properties` - Create
- `GET /api/properties/:id` - Get details
- `PUT /api/properties/:id` - Update
- `DELETE /api/properties/:id` - Delete
- `GET /api/properties/:id/availability` - Check dates
- `POST /api/properties/:id/images` - Add image
- `GET /api/properties/owner/:ownerId` - By owner

### Bookings
- `GET /api/bookings` - List (filtered by role)
- `POST /api/bookings` - Create
- `GET /api/bookings/:id` - Get details
- `PUT /api/bookings/:id` - Update status (admin)
- `POST /api/bookings/:id/confirm` - Confirm (admin)
- `POST /api/bookings/:id/cancel` - Cancel
- `GET /api/bookings/property/:id/availability` - Check availability

### Payments
- `POST /api/payments` - Create payment
- `GET /api/payments` - List (admin/cashier)
- `GET /api/payments/:id` - Get details
- `GET /api/payments/booking/:bookingId` - For booking
- `PUT /api/payments/:id` - Update status (admin)
- `POST /api/payments/:id/refund` - Refund (admin)
- `GET /api/payments/reports/revenue` - Daily revenue
- `GET /api/payments/reports/by-method` - By payment method
- `GET /api/payments/reports/outstanding` - Outstanding balances

### Reports
- `GET /api/reports/dashboard` - KPIs (admin)
- `GET /api/reports/revenue` - Revenue report
- `GET /api/reports/occupancy` - Occupancy rate
- `GET /api/reports/bookings` - Bookings breakdown
- `GET /api/reports/payments` - Payment breakdown
- `GET /api/reports/outstanding` - Outstanding balances
- `GET /api/reports/top-properties` - Top by revenue
- `GET /api/reports/customer-activity/:customerId` - Customer stats
- `POST /api/reports/export` - Export report (stub)

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "role": "customer",
    "createdAt": "2024-01-15T10:30:45Z"
  }
}
```

Error responses:
```json
{
  "success": false,
  "error": "Invalid email format",
  "code": "VALIDATION_ERROR",
  "errors": {
    "email": "Must be valid email"
  },
  "timestamp": "2024-01-15T10:30:45Z"
}
```

## Running the Server

```bash
# Install dependencies
npm install

# Create .env file from example
cp .env.example .env

# Configure database credentials in .env

# Start server
npm start

# Server starts on http://localhost:3000
# API docs at http://localhost:3000/api
# Health check at http://localhost:3000/health
```

## Development Tips

### Testing Endpoints
```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecurePass123!"}'

# Use token
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer <token>"
```

### Debugging
- Enable detailed logs: `NODE_ENV=development npm start`
- Check database connection: `GET /health`
- View error stack traces in development mode

### Common Errors
- `ECONNREFUSED`: Database not running
- `Invalid token`: Token expired or invalid secret
- `Duplicate entry`: Email/unique constraint violation
- `Access denied`: Missing or invalid role

## Security Checklist
- ✅ All passwords hashed with bcryptjs
- ✅ JWT tokens with expiration
- ✅ Prepared statements for SQL injection prevention
- ✅ Input validation and sanitization
- ✅ CORS configured
- ✅ Helmet security headers
- ✅ Rate limiting enabled
- ✅ Role-based access control
- ✅ User permission checks for data access

## Adding New Features

### Adding a New Route
1. Create handler in route file
2. Use asyncHandler wrapper for error handling
3. Apply middleware (authenticate, requireRole)
4. Validate input using validation utils
5. Call service method
6. Return consistent response format

### Adding a New Service Method
1. Keep business logic separate from database
2. Use database layer for queries
3. Validate input before processing
4. Throw appropriate error types
5. Return formatted data

### Adding a New Endpoint
1. Add route to appropriate route file
2. Create service method if needed
3. Add middleware for authentication/authorization
4. Document in API docs
5. Update error handling for new error cases
