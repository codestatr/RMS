# RMS Docker Deployment

This deployment runs the customer web application, backend API, and MySQL database together. The Electron admin/POS client remains a native desktop application and connects to the backend API exposed on the host.

## Requirements

- Docker Desktop with Compose v2
- 4 GB RAM available to Docker
- Ports `8080` and `3000` available, or custom ports in `.env`

## First install

From the repository root:

```text
copy .env.docker.example .env
docker compose up -d --build
```

The customer web application is available at:

```text
http://localhost:8080
```

The API health endpoint is:

```text
http://localhost:3000/health
```

The backend waits for MySQL to become healthy before running the database migration and starting the API. MySQL data is stored in the named `rms_mysql_data` volume and survives container recreation.

## Optional seed data

After the stack is running, seed the database only when installing a new demo environment:

```text
docker compose exec backend node src/database/seed.js
```

Do not run the seed command on a production database unless the seed script's upsert behavior has been reviewed for that environment.

## Admin/POS desktop client

The Electron client is intentionally not placed inside a Linux container because it needs a native desktop window, printing, and local device integration. Build and open it on the workstation with `Open-Admin.bat`.

For a workstation using the Docker backend, set the admin client's API URL to the host API address before building:

```text
VITE_API_URL=http://localhost:3000/api
```

If the Electron client runs on another PC, replace `localhost` with the Docker host's LAN address, for example:

```text
VITE_API_URL=http://192.168.1.50:3000/api
```

## Moving to another PC

1. Install Docker Desktop.
2. Copy the repository to the new PC.
3. Copy `.env.docker.example` to `.env`.
4. Replace the example database and JWT secrets.
5. Run `docker compose up -d --build`.
6. Open `http://localhost:8080` or the host LAN address.
7. Point any native admin/POS workstation at the host's API address.

## Operations

```text
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart
docker compose down
docker compose down -v
```

`docker compose down -v` deletes the MySQL volume and all stored database data. Use it only when intentionally resetting the environment.
