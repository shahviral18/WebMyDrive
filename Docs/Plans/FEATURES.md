# WebMyDrive — Feature List (demo1)

**Environment:** `webmydrive.com/demo1`  
**Last updated:** April 2026  
**Stack:** PHP backend · React/TypeScript frontend · MySQL · cPanel shared hosting

---

## Status Legend
- ✅ Complete & live
- ⚠️ Partial / needs configuration
- 🔜 Planned / coming soon
- ❌ Not yet built

---

## 1. Public Website

| Feature | Status | Notes |
|---|---|---|
| Landing page (Hero, Stats, Features, How It Works, FAQ, Contact) | ✅ | `/` |
| Pricing section with Monthly / Yearly toggle | ✅ | Fetches plans from DB |
| Subscribe slide-over panel (order summary + billing form) | ✅ | Opens on Subscribe click |
| Username selection & account setup page | ✅ | `/subscribe/:plan/username` |
| Referral link handler | ✅ | `/ref/:code` — stores code in localStorage, auto-fills at checkout |
| Coupon / promo code field at checkout | ✅ | Validates against DB via API |
| Payment success page | ✅ | `/payment/success` |
| Distributor application form | ✅ | `/resell` |
| Account activation page | ✅ | `/activate` |

---

## 2. Payment & Checkout

| Feature | Status | Notes |
|---|---|---|
| Zoho Payments India — widget integration | ✅ | Widget loads client-side; reference number passed through |
| Zoho webhook handler | ✅ | `POST /api/webhook/zoho-payment` — HMAC-SHA256 verified |
| PendingCheckout table (stores username/password before payment) | ✅ | Idempotency via reference number |
| Post-payment: user account created in DB | ✅ | Inside webhook handler |
| Post-payment: Google Workspace account provisioned | ✅ | Temp password `Welcome@XXXX` |
| Post-payment: welcome email with credentials + service links | ✅ | PHP mail() from noreply@webmydrive.com |
| Post-payment: Zoho Books invoice created & emailed | ✅ | Auto GST: CGST+SGST (Gujarat) or IGST (others) |
| Razorpay (legacy) | ⚠️ | Code present; demo mode when keys not set |
| Subscription renewal payments | ⚠️ | Backend logic exists; renewal flow not fully tested |

---

## 3. User Portal (`/user/`)

| Feature | Status | Notes |
|---|---|---|
| Login (email/password + Google OAuth) | ✅ | JWT-based sessions |
| Dashboard — workspace status, storage, quick actions | ✅ | |
| Google Drive file view (read-only) | ✅ | Via Google Drive API |
| Shared Drives list | ✅ | |
| Storage usage breakdown | ✅ | Drive + Gmail + Photos |
| Active sessions list + revoke | ✅ | |
| Login history | ✅ | |
| Profile settings (name, contact, recovery email) | ✅ | Syncs to Google Workspace |
| Password change | ✅ | |
| Plan upgrade flow | ✅ | Preview → initiate → confirm |
| Plan downgrade (schedule + cancel) | ✅ | |
| Orders / billing history | ✅ | |
| Referral dashboard (link, earnings, history) | ✅ | |
| Wallet balance display | ✅ | |
| 2FA status display | ✅ | Read-only from Google |

---

## 4. Distributor Portal (`/distributor/`)

| Feature | Status | Notes |
|---|---|---|
| Login (separate JWT via distributor token) | ✅ | Dual-token: dist + linked user |
| Panel switcher (switch between User ↔ Distributor view) | ✅ | Token stored on dashboard load |
| Dashboard — sales KPIs, tier, wallet, commission | ✅ | |
| Sales / referral history | ✅ | |
| Earnings analytics | ✅ | By year / monthly breakdown |
| Wallet balance & transaction log | ✅ | |
| Payout request | ✅ | Min threshold: ₹5,000 above ₹2,000 balance |
| Payout history | ✅ | |
| Customers list | ✅ | |
| Marketing tools page (referral link) | ✅ | |
| Promo code display | ✅ | Shows code assigned by admin + discount table |
| Distributor application form (public) | ✅ | PAN + Aadhar upload |
| Tier progression (Starter → Silver → Gold) | ✅ | Auto-upgrade on revenue threshold |

---

## 5. Admin Console (`/admin/`)

| Feature | Status | Notes |
|---|---|---|
| Admin login (separate JWT) | ✅ | |
| Dashboard KPIs (users, distributors, revenue, orders) | ✅ | |
| **User Management** | | |
| — List / search users | ✅ | |
| — Create user manually | ✅ | |
| — Reset password | ✅ | |
| — Enable / disable account | ✅ | |
| — Delete user | ✅ | |
| — Adjust wallet balance | ✅ | |
| — Change plan (super-admin only) | ✅ | |
| — Assign to distributor | ✅ | |
| **Plan Management** | | |
| — Create / edit / delete plans | ✅ | |
| — Toggle plan active/inactive | ✅ | |
| — Price overrides per plan | ✅ | |
| — Google Workspace OU path per plan | ✅ | |
| **Promo Codes** | | |
| — Create / edit / delete promo codes | ✅ | |
| — Assign promo code to distributor | ✅ | |
| — Revoke distributor promo code | ✅ | |
| — Full assignment history per distributor | ✅ | |
| **Distributor Management** | | |
| — List distributors | ✅ | |
| — Create distributor manually | ✅ | |
| — Reset distributor password | ✅ | |
| — Adjust distributor wallet | ✅ | |
| — Review distributor applications (approve/reject) | ✅ | |
| — Download KYC documents (PAN/Aadhar) | ✅ | |
| **Orders** | | |
| — View all orders | ✅ | |
| — Commission override per order | ✅ | |
| **Import Existing Users** | | |
| — Fetch users from Google Workspace | ✅ | |
| — Import individually or bulk | ✅ | |
| — Collect billing details before import | ✅ | |
| — Sync to Google Admin | ✅ | |
| **System Settings** | ✅ | Plan defaults, referral rates, distributor tiers, wallet thresholds |
| **Audit Logs** | ✅ | Full trail of every system action |
| **Alerts** | 🔜 | Phase 2 |
| **Feature Controls / Flags** | 🔜 | Phase 2 |

---

## 6. Integrations

| Integration | Status | Notes |
|---|---|---|
| **Google Workspace Admin SDK** | ⚠️ | Create/update users, move OU; credentials at `/home1/wmdadmin/google_api/`; scope permissions need review |
| **Google Drive API** | ⚠️ | Read-only file/storage data; requires drive.readonly scope in delegation |
| **Google OAuth 2.0** | ✅ | User login via Google account |
| **Zoho Payments India** | ✅ | Widget flow; API key + signing key configured |
| **Zoho Books** | ✅ | Invoice creation + email; OAuth refresh token configured |
| **Razorpay** | ⚠️ | Keys present but running in demo mode; not primary gateway |
| **PHP mail()** | ✅ | Welcome emails via server sendmail; from noreply@webmydrive.com |

---

## 7. Commission & Referral System

| Feature | Status | Notes |
|---|---|---|
| User referral codes (auto-generated on signup) | ✅ | |
| Referral link tracking (`/ref/:code`) | ✅ | |
| Commission on first purchase | ✅ | Rate from AdminConfig |
| Commission decay on renewals | ✅ | Configurable multiplier per year |
| Distributor commission tiers | ✅ | 10% / 15% / 20% based on tier |
| Promo code discount at checkout | ✅ | Per-plan discount rates configurable |
| Wallet credit after commission | ✅ | Atomic transaction |
| Anti-self-referral & loop prevention | ✅ | |
| Payout request + threshold enforcement | ✅ | |

---

## 8. Infrastructure & Security

| Feature | Status | Notes |
|---|---|---|
| JWT authentication | ✅ | 7-day expiry; separate tokens for user/admin/distributor |
| Rate limiting | ⚠️ | Middleware exists; limits set for login/register/OTP |
| CORS | ✅ | Origin whitelist from env |
| Webhook signature verification | ✅ | HMAC-SHA256 for both Zoho and Razorpay |
| Audit logging | ✅ | Every create/update/delete logged |
| Password hashing | ✅ | bcrypt |
| Credentials outside web root | ✅ | Google API keys at `/home1/wmdadmin/google_api/` |
| Environment config via `.env` | ✅ | Never committed to git |

---

## 9. What Needs Configuration Before Full Production Use

1. **Google Workspace OU paths** — Set `googleOrgUnit` for each plan in Admin → Plans (e.g. `/webmydrive.com/A - Basic - 500GB`)
2. **Google Admin SDK scopes** — Service account needs `admin.directory.user` + `admin.directory.orgunit` in domain-wide delegation
3. **Zoho Books invoice series** — Default FY sequence `INV-26-27-000xxx`; invoice reference uses `WMD-{orderId}` format (e.g. `WMD-0001`)
4. **Email delivery** — PHP mail() works on cPanel but may land in spam; consider Zoho Mail SMTP for production
5. **Razorpay keys** — Either configure live keys or fully remove from codebase if Zoho Payments is the only gateway
6. **Webhook URL update** — When going live (root domain), update Zoho webhook URL from `/demo1/...` to `/...`
7. **Rate limits** — Review and tighten limits for production traffic
8. **ALLOWED_ORIGINS** — Update env to production domain only

---

## 10. Key File Locations

| Area | Path |
|---|---|
| Backend entry point | `backend/public/index.php` |
| All API routes | `backend/public/index.php` (bottom section) |
| Environment config | `backend/config/env.php` |
| Database config | `backend/config/database.php` |
| Controllers | `backend/controllers/` |
| Services | `backend/services/` |
| Frontend pages | `src/pages/` |
| Frontend components | `src/components/` |
| Google API credentials | `/home1/wmdadmin/google_api/` (server only, outside web root) |
| Distributor KYC uploads | `/home1/wmdadmin/secure_uploads/distributor-applications/` |
| Server logs | `backend/logs/app-YYYY-MM-DD.log` |
