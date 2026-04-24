# WebMyDrive Deployment Status & Roadmap

> Last updated: 2026-04-24

---

## Current Deployment (demo1)

| Item | Value |
|------|-------|
| **URL** | https://webmydrive.com/demo1 |
| **cPanel user** | wmdadmin |
| **cPanel host** | webmydrive.com:2083 |
| **Server path** | /home4/wmdadmin/public_html/demo1/ |
| **Database** | TBD |
| **DB user** | TBD |
| **PHP version** | 8.1+ |
| **SSL** | AutoSSL (valid, auto-renewing) |
| **Payment gateway** | Razorpay (demo mode — no real keys yet) |
| **Deploy method** | cPanel API token via `scripts/deploy-cpanel.sh` |

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| SuperAdmin | admin@webmydrive.com | Admin@2026! |
| User | user@webmydrive.com | Admin@2026! |
| Distributor | distributor@webmydrive.com | Admin@2026! |

---

## Production Deployment (Future)

| Item | Value |
|------|-------|
| **URL** | https://webmydrive.com |
| **cPanel** | New cPanel account (TBD) |
| **Database** | New MySQL database with strong credentials |
| **DB credentials** | Stored in `/home/<user>/secure_config/db_config.php` (outside public_html) |
| **JWT secret** | New random 64-char hex string |
| **Payment gateway** | Razorpay live keys (or Zoho Payments) |
| **Google OAuth** | Production Client ID authorized for webmydrive.com |
| **CORS** | ALLOWED_ORIGINS=https://webmydrive.com |
| **Vite base path** | Change from `/WebMyDrive/demo/1/` to `/` |
| **React Router basename** | Change from `/WebMyDrive/demo/1` to empty |

### Migration Checklist (test -> production)

- [ ] New cPanel account on production server
- [ ] Create MySQL database + user with strong password
- [ ] Import `backend/database/mysql-schema.sql` via phpMyAdmin
- [ ] Run seed script for admin user and plans
- [ ] Create `/home/<user>/secure_config/db_config.php` with DB credentials
- [ ] Update `vite.config.ts` base path from `/WebMyDrive/demo/1/` to `/`
- [ ] Update `src/App.tsx` BrowserRouter basename
- [ ] Update `.htaccess` RewriteBase
- [ ] Create new `.env.production` with production domain, CORS, JWT
- [ ] Set up Razorpay live keys (or Zoho Payments)
- [ ] Set up Google OAuth with production domain
- [ ] Set up Google Workspace API for email provisioning
- [ ] Configure DNS A record for webmydrive.com -> server IP
- [ ] Verify AutoSSL issues certificate
- [ ] Force HTTPS redirect in `.htaccess`
- [ ] Deploy via cPanel API token
- [ ] Test all flows end-to-end

---

## What's Working Now

- [x] Frontend (React SPA with admin, user, distributor dashboards)
- [x] PHP backend API (37+ routes)
- [x] JWT authentication (login, register, role-based access)
- [x] MySQL database (14 tables, seeded with plans and demo users)
- [x] Rate limiting on auth endpoints (login, register, forgot-password)
- [x] CORS with origin whitelist (production mode)
- [x] Backend source files protected via .htaccess (403 on direct access)
- [x] .env files protected (403)
- [x] Directory listing disabled
- [x] Subscription/plan management (CRUD via admin panel)
- [x] Referral system (user + distributor referral codes, commissions)
- [x] Distributor portal (onboarding, sales tracking, wallet, payouts)
- [x] Audit logging (all actions logged to AuditLog table)
- [x] Checkout flow (demo mode with simulated payments)
- [x] Dark mode support
- [x] cPanel deployment script (`scripts/deploy-cpanel.sh`)
- [x] E2E test suite (7 Playwright specs)
- [x] SSL/HTTPS working

---

## Pending Items

### 1. Google Workspace API Integration (Backend PHP)

**Status:** Not started. This is the core product feature.

**What it does:** When a user purchases a plan, the backend should provision a Google Workspace account (email, storage) for them automatically.

**What needs to be built:**

| Component | Description |
|-----------|-------------|
| **Google Cloud Project** | Create project in Google Cloud Console, enable Admin SDK + Reseller API |
| **Service Account** | Create service account with domain-wide delegation |
| **GoogleWorkspaceService.php** | New service class to call Google Admin SDK via REST API |
| **User provisioning** | `createUser()` — create Google Workspace user account with purchased storage |
| **Subscription binding** | `assignLicense()` — assign Google Workspace license to user |
| **Email setup** | `createEmail()` — set up user@customdomain via Google Workspace |
| **Storage allocation** | `setStorageQuota()` — set storage limit per plan tier |
| **Webhook/callback** | Handle provisioning status updates |
| **Error handling** | Queue failed provisioning for retry (cron job) |

**Database fields already prepared:**
- `Plan.googleSKU` — maps plans to Google Workspace SKUs (basic_500gb, professional_5tb, etc.)
- `Workspace.googleCustomerId` — stores the Google customer ID after provisioning
- `Workspace.metadata` — JSON field for provisioning details
- `Workspace.status` — PENDING/ACTIVE/SUSPENDED

**Where to integrate:**
- `backend/services/PaymentHandler.php` — after successful payment, call GoogleWorkspaceService
- `backend/controllers/CheckoutController.php:processPayment()` — trigger provisioning
- `backend/controllers/ReferralController.php:verifyPayment()` — trigger provisioning

**Google APIs needed:**
- Admin SDK Directory API (manage users)
- Google Workspace Reseller API (manage subscriptions)
- Gmail API (optional — for email setup verification)

### 2. Razorpay Live Keys

**Status:** Demo mode active (empty keys = simulated payments)

**To enable:**
1. Create Razorpay account at https://dashboard.razorpay.com
2. Get test-mode Key ID and Key Secret
3. Update `backend/.env.production`:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
   ```
4. Re-deploy backend `.env`
5. Test with Razorpay test cards before going live

**Alternative:** Zoho Payments — would need a new `ZohoPaymentService.php` similar to `RazorpayService.php`

### 3. Google OAuth (Frontend Login)

**Status:** Client ID exists but not authorized for production domain

**To enable:**
1. Go to Google Cloud Console -> APIs & Services -> Credentials
2. Edit OAuth 2.0 Client ID
3. Add authorized origins:
   - `https://webmydrive.com` (demo1 + production)
4. Add authorized redirect URIs:
   - `https://webmydrive.com/demo1/login`
5. Update `VITE_GOOGLE_CLIENT_ID` in `.env.production`
6. Rebuild and redeploy frontend

**Backend side:** Currently uses deprecated `oauth2.googleapis.com/tokeninfo` endpoint. Should be updated to use proper JWT validation library or Google's `google-auth-library` equivalent in PHP.

### 4. Email Notifications

**Status:** Not implemented

**Needed for:**
- Password reset emails
- Subscription confirmation
- Payment receipts
- Welcome emails after registration

**Options:**
- PHP `mail()` function (cPanel Exim — basic, may hit spam)
- External SMTP via PHPMailer (SendGrid, Mailgun, Zoho Mail)
- Set up SPF, DKIM, DMARC DNS records for deliverability

### 5. HTTPS Enforcement

**Status:** SSL works but HTTP is not redirected to HTTPS

**To enable (when ready):** Add to `.htaccess`:
```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### 6. Secure Config (Production)

**Status:** Using `.env` file (inside public_html). Acceptable for test, not ideal for production.

**For production:** Create `/home/<user>/secure_config/db_config.php`:
```php
<?php
$db_host = 'localhost';
$db_name = 'prod_database';
$db_user = 'prod_user';
$db_pass = 'strong_production_password';
```
The backend's `database.php` already checks for this file first before falling back to `.env`.

---

## Architecture Notes

### API Base Path
- **Dev:** `http://localhost:4000/api/*` (Vite proxy)
- **demo1:** `https://webmydrive.com/demo1/backend/public/api/*` (relative path from frontend)
- **Future prod:** `https://webmydrive.com/backend/public/api/*`

### Payment Flow
1. User selects plan on frontend
2. Frontend calls `POST /api/checkout/create-session` with plan details
3. Backend creates Razorpay order (or demo order)
4. Frontend shows Razorpay checkout modal
5. After payment, frontend calls `POST /api/checkout/process-payment`
6. Backend verifies signature, creates User + Order + Subscription + Workspace
7. **[PENDING]** Backend provisions Google Workspace account

### Security Model
- JWT tokens (HS256, 7-day expiry)
- Role-based access: USER, ADMIN, SUPERADMIN, DISTRIBUTOR
- Rate limiting: 10 login attempts / 5 registrations / 3 password resets per 15 min
- CORS: whitelist-based in production
- Backend source: protected by .htaccess (403 on direct access)
- DB credentials: env-based with secure_config fallback
