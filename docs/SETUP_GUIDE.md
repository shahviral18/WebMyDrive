# WebMyDrive Development Setup Guide

## Overview

WebMyDrive is a cloud storage subscription platform with two components:

1. **Frontend** (React + Vite + TypeScript) - Admin console, user dashboard, landing page
2. **PHP Backend** (Port 4000) - API server, authentication, payments, business logic

## Quick Start

```powershell
# Start everything (frontend + backend)
npm run dev:full
```

This starts:
- Frontend on http://localhost:6173
- PHP Backend on http://localhost:4000

### Run Services Individually

**Terminal 1 - PHP Backend:**
```powershell
npm run backend:start
```

**Terminal 2 - Frontend:**
```powershell
npm run dev
```

## Project Structure

```
WebmydriveV2/
  src/                  # React frontend source
  backend/              # PHP backend
    public/             # Entry point (index.php + .htaccess)
    config/             # env.php, database.php
    controllers/        # API route handlers
    services/           # Business logic
    middleware/          # Auth, rate limiting
    helpers/            # JWT, Router, Request, Response, Logger
    database/           # MySQL schema + seed scripts
  e2e/                  # Playwright end-to-end tests
  tests/                # Vitest unit tests
  scripts/              # Dev + deployment scripts
  docs/                 # Documentation
  public/               # Static assets (copied to dist/ on build)
```

## Environment Variables

### Frontend (`.env`)
```
VITE_API_URL=http://localhost:4000
VITE_ADMIN_API_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=                          # Optional: Google OAuth
VITE_CLOUD_PLAN_MANAGER_URL=https://test.webmydrive.com
VITE_PURCHASE_SUCCESS_REDIRECT=https://test.webmydrive.com/WebMyDrive/demo/1/login
```

### Backend (`backend/.env`)
```
NODE_ENV=development
PORT=4000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:6173
DB_HOST=localhost
DB_NAME=wmdtest_webmydrive_db
DB_USER=wmdtest_wmd_user
DB_PASS=<your_password>
JWT_SECRET=<dev_secret>
JWT_EXPIRY=604800
RAZORPAY_KEY_ID=                                # Leave blank for demo mode
RAZORPAY_KEY_SECRET=
SITE_URL=http://localhost:6173
```

## Database Setup (Local MySQL)

1. Create database and user in MySQL:
   ```sql
   CREATE DATABASE wmdtest_webmydrive_db;
   CREATE USER 'wmdtest_wmd_user'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON wmdtest_webmydrive_db.* TO 'wmdtest_wmd_user'@'localhost';
   ```

2. Import schema:
   ```bash
   mysql -u wmdtest_wmd_user -p wmdtest_webmydrive_db < backend/database/mysql-schema.sql
   ```

3. Seed data:
   ```bash
   php backend/database/mysql-seed.php
   ```

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| SuperAdmin | admin@webmydrive.com | Admin@2026! |
| User | user@webmydrive.com | Admin@2026! |
| Distributor | distributor@webmydrive.com | Admin@2026! |

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 6173) |
| `npm run dev:full` | Start frontend + backend together |
| `npm run build` | Production build |
| `npm run backend:start` | Start PHP backend (port 4000) |
| `npm run test` | Run unit tests (Vitest) |
| `npm run e2e` | Run end-to-end tests (Playwright) |
| `npm run e2e:ui` | Run e2e tests with UI |
| `npm run lint` | Lint codebase |

## Deployment

See [CPANEL_DEPLOYMENT_REFERENCE.md](CPANEL_DEPLOYMENT_REFERENCE.md) for cPanel deployment.

Deploy to test.webmydrive.com:
```bash
CPANEL_TOKEN=your_token ./scripts/deploy-cpanel.sh
```

## Troubleshooting

**Port in use:**
```powershell
Get-NetTCPConnection -LocalPort 6173
Stop-Process -Id <PID> -Force
```

**PHP backend logs:** Check `backend/logs/app-YYYY-MM-DD.log`

**Reset demo data:**
```bash
php backend/cleanup_demo.php
php backend/database/mysql-seed.php
```
