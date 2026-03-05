# WebMyDrive Full Development Setup Guide

## Overview

This project is a complete cloud storage and subscription management platform with three main components:

1. **Admin Console** (Port 6173) - Plan management and admin dashboard
2. **Cloud-Plan-Manager** (Port 3000) - Main WebMyDrive website and user login
3. **PHP Backend** (Port 4000) - API server and business logic

## Quick Start

### Option 1: Run All Services at Once (Recommended)

```powershell
cd c:\Users\admin\Desktop\webmydrive-admin-console-main\webmydrive-admin-console-main
npm run dev:full
```

This single command will start:
- ✅ PHP Backend on http://localhost:4000
- ✅ Admin Console on http://localhost:6173
- ✅ Cloud-Plan-Manager on http://localhost:3000

### Option 2: Run Services Individually

**Terminal 1 - Start PHP Backend:**
```powershell
npm run backend:start
```

**Terminal 2 - Start Admin Console:**
```powershell
npm run dev
```

**Terminal 3 - Start Cloud-Plan-Manager:**
```powershell
cd C:\Users\admin\Downloads\Cloud-Plan-Manager\Cloud-Plan-Manager
npm run dev
```

## Usage Flow

### User Purchase Flow

1. User visits **Admin Console** (http://localhost:6173)
2. Logs in or browses plans
3. Selects a plan and clicks "Subscribe"
4. Reviews order summary and fills in details
5. Clicks "Proceed to Pay"
6. **Automatically redirected** to Cloud-Plan-Manager login page
7. User logs in/creates account on Cloud-Plan-Manager
8. Plan activation completes

### Admin Flow

1. Visit http://localhost:6173/admin
2. Manage plans, view audit logs, handle referrals
3. Monitor user subscriptions

## Services Detail

### 1. Admin Console
- **URL**: http://localhost:6173
- **Port**: 6173
- **Technology**: React + Vite + TypeScript
- **Purpose**: Manage plans, subscriptions, referrals, and admin tasks
- **Entry point**: `src/main.tsx`
- **Build**: `npm run build`

### 2. Cloud-Plan-Manager (WebMyDrive)
- **URL**: http://localhost:3000
- **Port**: 3000
- **Technology**: React + Express + TypeScript
- **Purpose**: Main user-facing website and cloud storage management
- **Location**: `C:\Users\admin\Downloads\Cloud-Plan-Manager\Cloud-Plan-Manager`
- **Entry point**: `client/src/main.tsx` + `server/index.ts`
- **Build**: `npm run build`
- **Start Production**: `npm start`

### 3. PHP Backend
- **URL**: http://localhost:4000
- **Port**: 4000
- **Technology**: PHP with custom router
- **Purpose**: Handle authentication, orders, referrals, and business logic
- **Location**: `server-php/`
- **Entry point**: `server-php/public/index.php`
- **Start**: `npm run backend:start` (via PowerShell script with PHP)

## Environment Configuration

### Admin Console

Create `.env.local` in the admin console root:

```
VITE_ADMIN_API_URL=http://localhost:4000
VITE_CLOUD_PLAN_MANAGER_URL=http://localhost:3000
VITE_PURCHASE_SUCCESS_REDIRECT=http://localhost:3000/login
```

### Cloud-Plan-Manager

Check `server/.env` for backend configuration:

```
DB_URL=your_database_url
NODE_ENV=development
PORT=3000
```

## API Integration

### Creating a Checkout Session

When user clicks "Proceed to Pay", the admin console calls:

```
POST /api/referral/create-checkout
Headers: Authorization: Bearer {token}
Body: {
  planId: "plan-123",
  promoCode: "SUMMER20"
}
```

The backend returns a session ID and the user is redirected to the Cloud-Plan-Manager with plan details.

### Available API Endpoints

**Authentication:**
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`

**Plans:**
- `GET /api/plans`
- `GET /api/plans/{id}`

**Orders:**
- `POST /api/referral/create-checkout`
- `POST /api/referral/verify-payment`
- `GET /api/referral/my-orders`

**Referrals:**
- `GET /api/referral/dashboard`
- `GET /api/referral/history`
- `GET /api/referral/resolve?uid=123`

## Troubleshooting

### Port Already in Use

If a port is already in use:

```powershell
# Find process using port 6173
Get-NetTCPConnection -LocalPort 6173

# Kill the process
Stop-Process -Id <PID> -Force
```

### Database Migrations

If database structure changes are needed:

```powershell
cd server-php
php database/migrate.php
```

### Clear Node Modules

If experiencing module issues:

```powershell
npm install
npm run build
```

## Development Tips

### Hot Module Reload (HMR)

Both Vite instances support HMR:
- Changes to `.tsx` and `.ts` files auto-refresh the page
- CSS changes update without reload

### Debugging

**Admin Console Console Logs:**
- Open DevTools with F12
- Check all network requests in Network tab

**PHP Backend Logs:**
- Check `server-php/logs/` directory
- Enable verbose logging with `LOG_LEVEL=debug`

**Cloud-Plan-Manager Logs:**
- Server logs in terminal window
- Client logs in browser DevTools (F12)

## Production Deployment

### Build All Services

```powershell
# Admin Console
npm run build

# Cloud-Plan-Manager
cd C:\Users\admin\Downloads\Cloud-Plan-Manager\Cloud-Plan-Manager
npm run build
```

### Environment Variables

Update environment variables for your production domain:

```
VITE_ADMIN_API_URL=https://api.webmydrive.com
VITE_CLOUD_PLAN_MANAGER_URL=https://webmydrive.com
VITE_PURCHASE_SUCCESS_REDIRECT=https://webmydrive.com/login
```

### Run Production Services

```powershell
# Admin Console
npm run preview

# Cloud-Plan-Manager
npm start

# PHP Backend
PHP_PORT=4000 php -S localhost:4000
```

## Support

For issues or questions:
1. Check the logs in each service
2. Verify environment variables are set correctly
3. Ensure all ports (3000, 4000, 6173) are available
4. Clear browser cache if seeing stale content
