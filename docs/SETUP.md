# RMS Setup Guide

Complete setup instructions for the House Rental & Booking Management System.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Backend Setup](#backend-setup)
4. [Frontend Setup](#frontend-setup)
5. [Admin Client Setup](#admin-client-setup)
6. [POS System Setup](#pos-system-setup)
7. [Database Setup](#database-setup)
8. [Running the Application](#running-the-application)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js**: v18.0.0 or higher ([Download](https://nodejs.org/))
- **npm**: v9.0.0 or higher (comes with Node.js)
- **MySQL**: v8.0 or higher ([Download](https://dev.mysql.com/downloads/mysql/))
- **.NET SDK**: v7.0 or higher ([Download](https://dotnet.microsoft.com/download))
- **Git**: Latest version ([Download](https://git-scm.com/))

### Optional

- **Electron**: For Admin Client development
- **Visual Studio Code**: For code editing
- **Postman**: For API testing
- **MySQL Workbench**: For database management

## Environment Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd RMS
```

### 2. Install Root Dependencies

```bash
npm install
```

This installs dependencies for all workspaces (backend, frontend, shared, admin-client).

### 3. Set Up Environment Variables

Create `.env` files in each component from the `.env.example` files:

#### Backend (`.env`)

```bash
cd backend
cp .env.example .env
# Edit .env and fill in your configuration
```

Key variables to configure:
- Database credentials (MySQL)
- JWT secrets
- Payment gateway keys
- Firebase configuration
- Email/SMS settings

#### Frontend (`.env`)

```bash
cd frontend
cp .env.example .env
```

Key variables:
- API URL (e.g., `http://localhost:3000/api`)
- Firebase keys (optional for real-time features)
- Google Maps API key

#### Admin Client (`.env`)

```bash
cd admin-client
cp .env.example .env
```

#### POS System

Edit `pos-system/POSSystem/App.config`:
- Database connection string
- API endpoint
- Receipt printer settings

## Database Setup

### 1. Create MySQL Database

```bash
mysql -u root -p
```

Then in MySQL:

```sql
CREATE DATABASE rms_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rms_database;
```

### 2. Import Schema

```bash
cd database
mysql -u root -p rms_database < schema.sql
```

### 3. Verify Tables

```sql
SHOW TABLES;
```

## Backend Setup

### 1. Navigate to Backend

```bash
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create `.env` File

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=rms_database

JWT_SECRET=your_secret_key_here
JWT_EXPIRY=24h

STRIPE_SECRET_KEY=your_stripe_key
MPESA_CONSUMER_KEY=your_mpesa_key
# ... other configurations
```

### 4. Run Migrations/Seed (Optional)

```bash
npm run migrate
npm run seed
```

### 5. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## Frontend Setup

### 1. Navigate to Frontend

```bash
cd frontend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create `.env` File

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_FIREBASE_API_KEY=your_firebase_key
VITE_GOOGLE_MAPS_API_KEY=your_maps_key
```

### 4. Start Development Server

```bash
npm run dev
```

The website will be available at `http://localhost:5173`

## Admin Client Setup

### 1. Navigate to Admin Client

```bash
cd admin-client
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create `.env` File

```bash
cp .env.example .env
```

### 4. Start Development

```bash
npm run dev
```

Or to run with Electron:

```bash
npm run electron-dev
```

## POS System Setup

### 1. Navigate to POS System

```bash
cd pos-system
```

### 2. Open in Visual Studio

```bash
start POSSystem.sln
```

Or with .NET CLI:

```bash
dotnet restore
dotnet build
```

### 3. Configure Database

Edit `App.config`:

```xml
<connectionStrings>
  <add name="DefaultConnection" connectionString="Data Source=pos_system.db;" providerName="Microsoft.Data.Sqlite" />
</connectionStrings>
```

### 4. Run Application

In Visual Studio: Press `F5` or click Run

Or via command line:

```bash
dotnet run
```

## Running the Application

### Development Mode (All Components)

Open separate terminal windows for each component:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - Admin Client:**
```bash
cd admin-client
npm run dev
```

**Terminal 4 - POS System:**
```bash
cd pos-system
dotnet run
```

### Production Build

#### Backend
```bash
cd backend
npm install
npm run build
npm start
```

#### Frontend
```bash
cd frontend
npm install
npm run build
npm run preview
```

#### Admin Client
```bash
cd admin-client
npm install
npm run build
npm run package
```

#### POS System
```bash
cd pos-system
dotnet publish -c Release
```

## System URLs

| Component | URL | Credentials |
|-----------|-----|-------------|
| Customer Website | http://localhost:5173 | Guest access |
| Backend API | http://localhost:3000 | N/A |
| Admin Client | Desktop app | Admin credentials |
| POS System | Desktop app | Cashier/Admin credentials |

## Troubleshooting

### Common Issues

#### 1. Database Connection Error

**Problem:** `Error: connect ECONNREFUSED 127.0.0.1:3306`

**Solution:**
```bash
# Check if MySQL is running
mysql -u root -p

# Or start MySQL (macOS)
brew services start mysql

# Or Windows
net start MySQL80
```

#### 2. Port Already in Use

**Problem:** `Error: listen EADDRINUSE :::3000`

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or use different port
PORT=3001 npm run dev
```

#### 3. Module Not Found

**Problem:** `Error: Cannot find module 'express'`

**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

#### 4. Firebase Configuration Error

**Solution:** Verify firebase credentials in `.env` file

#### 5. SQLite Database Locked

**Problem:** `database is locked`

**Solution:** Ensure only one instance of the app is running

## Next Steps

1. **Create Admin Account**: Use the registration form with "admin" role
2. **Add Properties**: Log in to Admin Client and add rental properties
3. **Test Booking Flow**: Use the website to make a test booking
4. **Configure Payments**: Set up payment gateway credentials
5. **Customize Branding**: Update colors and logos to match your brand

## Support

For support and questions:
- Email: support@rms-system.com
- Documentation: See `/docs` folder
- GitHub Issues: Open an issue on the repository

## Additional Resources

- [API Documentation](./API.md)
- [Database Documentation](./DATABASE.md)
- [User Guides](./USER_GUIDES.md)
