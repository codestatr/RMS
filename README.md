# RMS House Rental & Booking Management System

This repository contains the full-stack RMS platform for managing rental listings, bookings, payments, admin operations, and POS workflows.

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
- SQLite local database for offline-first admin work
- Property and booking management experience
- Sync-ready architecture for offline/online operation

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
│   └── POSSystem/
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
└──
```

---

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- MySQL 8.0+
- .NET 7.0+ for the POS project
- Git

---

## Root Scripts

The workspace root exposes shared commands via [package.json](package.json):

```bash
npm install
npm run dev
npm run build
npm run test

npm run backend:dev
npm run frontend:dev
npm run admin:dev
```

Notes:
- `npm run dev` runs the workspaces in development mode.
- `npm run build` runs workspace builds.
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

### 4. Set up the database

Use MySQL and import the schema:

```bash
mysql -u root -p
CREATE DATABASE rms_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
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
npm run dev
```

POS system:

Open the solution in Visual Studio and build/run the project in [pos-system/POSSystem](pos-system/POSSystem).

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

---

## Notes

- The backend is the main service layer for the system.
- The admin desktop client is designed to work with local SQLite while still syncing with upstream app data when available.
- The root project uses npm workspaces; individual apps can also be run independently.

---

Last updated: 2026-09-11
