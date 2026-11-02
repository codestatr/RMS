# CozyStay House Rental & Booking Management System

This repository contains the full-stack CozyStay platform for managing rental listings, bookings, payments, admin operations, and POS workflows.

## Overview

The project is split into the following main parts:

### 1. Backend API
Location: [backend](backend)
- Node.js + Express API
- MySQL as the main application database
- JWT authentication and RBAC-style access control
- Booking, payment, receipt, notification, review, and report flows
- File upload handling and service integrations

### 2. Customer Frontend
Location: [frontend](frontend)
- React + Vite application
- Tailwind-based UI
- Booking/search experience for customers
- PWA-oriented frontend structure

### 3. Admin Desktop Client
Location: [admin-client](admin-client)
- Electron + React + Vite desktop app
- SQLite local database with sync support
- Property and booking management experience
- Includes sync code for offline/online operation

### 4. Shared Package
Location: [shared](shared)
- Shared TypeScript sources, constants, schemas, and types
- Used across app modules

### 5. POS System
Location: [pos-system](pos-system)
- C# .NET Windows desktop client
- POS and walk-in booking workflows
- Local SQLite database and sync-oriented design

### 6. Database
Location: [database](database)
- MySQL schema definitions and SQLite schema artifacts
- SQL setup scripts for the system foundation

### 7. Documentation
Location: [docs](docs)
- Setup and deployment documentation
- Database and API reference material

---

## Repository Structure

```text
RMS/
├── .env.docker.example
├── README.md
├── compose.yaml
├── Dockerfile.backend
├── Dockerfile.frontend
├── package.json
├── package-lock.json
├── admin-client/
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   └── src/
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── src/
│   ├── tests/
│   └── uploads/
├── database/
│   ├── schema.sql
│   └── sqlite_schema.sql
├── docs/
│   ├── API.md
│   ├── DATABASE.md
│   ├── DOCKER_DEPLOYMENT.md
│   ├── PRODUCT_DIFFERENTIATION.md
│   └── SETUP.md
├── frontend/
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   └── src/
├── pos-system/
│   └── POSSystem/                # WPF project (.csproj; no solution file)
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
```

---

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- MySQL 8.0+
- .NET 7.0+ for the POS project
- Git

---

## Workspace Scripts

The workspace root exposes shared commands via [package.json](package.json):

```bash
npm install
npm run build
npm run backend:dev
npm run frontend:dev
npm run admin:dev
npm run test --workspace=@rms/backend
npm run test --workspace=@rms/frontend
```

Notes:
- The root does not define a reliable all-workspace `dev` or `test` command. Run the app-specific scripts above.
- `npm run build` runs each workspace's build script, including the shared TypeScript package.
- `npm run admin:dev` starts the admin Vite renderer. The `electron` script launches Electron after building with `npm run admin:build`.
- `npm run stop` and `npm run stop:ports` help shut down dev processes.

---

## Local Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd RMS
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment files

Create env files from the examples:

```bash
cp .env.docker.example .env

cd backend
cp .env.example .env

cd ../frontend
cp .env.example .env

cd ../admin-client
cp .env.example .env
```

The example values are configured for common local development defaults:
- backend uses MySQL on `localhost:3306`
- frontend calls the backend at `http://localhost:3000/api`
- admin client also targets the backend at `http://localhost:3000/api`

### M-Pesa sandbox on localhost

The website can initiate M-Pesa payments against Safaricom's sandbox by setting `MPESA_ENVIRONMENT=sandbox` in `backend/.env` and filling in the Daraja sandbox credentials. Safaricom must be able to reach the callback, so `MPESA_CALLBACK_URL` needs a public HTTPS tunnel pointing to `http://localhost:3000/api/payments/webhook/mpesa`; a plain `localhost` callback will not work. Keep production credentials out of local development.

Property images can be uploaded through `POST /api/properties/:id/images` as multipart form data using the file field `image`. Configure `CLOUDINARY_NAME`, `CLOUDINARY_KEY`, and `CLOUDINARY_SECRET` in `backend/.env`; uploads accept JPG, PNG, and WebP files up to 4 MB and are stored in the `rms_uploads` Cloudinary folder. Include the bearer token as with other authenticated API routes. Optional fields are `isCover` (`true` or `false`) and `displayOrder`. Existing JSON requests with an `imageUrl` remain supported.

### 4. Set up the database

Create the database from a terminal, then import the schema:

```bash
mysql -u root -p
```

At the MySQL prompt, run:

```sql
CREATE DATABASE rms_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

Then import:

```bash
cd database
mysql -u root -p rms_database < schema.sql
```

### 5. Run the apps

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Admin client:

```bash
cd admin-client
npm run build
npm run electron
```

`npm run dev` starts only the Vite renderer server; Electron loads the built app.

POS system:

Open [POSSystem.csproj](pos-system/POSSystem/POSSystem.csproj) in Visual Studio, or run `dotnet restore` and `dotnet run` from `pos-system/POSSystem`. This repository contains a project file, not a `.sln` solution file.

---

## Docker Deployment

The repository includes a docker setup via [compose.yaml](compose.yaml). This starts:
- MySQL database
- backend API
- frontend web app

Example:

```bash
copy .env.docker.example .env
docker compose up -d --build
```

Default ports:
- Backend: http://localhost:3000
- Frontend: http://localhost:8080

More deployment details are in [docs/DOCKER_DEPLOYMENT.md](docs/DOCKER_DEPLOYMENT.md).

---

## Key Features

### Customer side
- Property browsing and search
- Booking flow
- Payment processing
- Booking history and receipts
- Reviews and wishlist support

### Admin side
- Property management
- Booking approval and handling
- Reporting and monitoring
- Payment visibility
- Staff/admin operations
- Admins can choose the system accent color in Settings; the website and POS load the shared color from the backend.

### POS side
- Walk-in booking support
- Cashier workflows
- Receipts and reconciliation

---

## Documentation

- [docs/SETUP.md](docs/SETUP.md)
- [docs/API.md](docs/API.md)
- [docs/DATABASE.md](docs/DATABASE.md)
- [docs/DOCKER_DEPLOYMENT.md](docs/DOCKER_DEPLOYMENT.md)
- [docs/PRODUCT_DIFFERENTIATION.md](docs/PRODUCT_DIFFERENTIATION.md)
- [docs/COZYSTAY_DESIGN_SYSTEM.md](docs/COZYSTAY_DESIGN_SYSTEM.md)

---

## Notes

- The backend is the main service layer for the system.
- The admin and POS clients include local SQLite storage and sync code. Verify sync behavior and conflict handling before relying on offline changes in production.
- The root project uses npm workspaces; individual apps can also be run independently.

---

Last updated: 2026-09-11
