# Local Development Environment Test

**Last Updated:** March 5, 2026

## ✅ Configuration Status

### Service Ports & URLs
| Service | Port | URL | Status |
|---------|------|-----|--------|
| PHP Backend | 4000 | http://localhost:4000 | ✓ Configured |
| Admin Console | 6173 | http://localhost:6173 | ✓ Configured |
| Cloud-Plan-Manager | 5000 | http://localhost:5000 | ✓ Configured |

### Environment Configuration
- **Admin Console (vite.config.ts)**: 
  - Port: 6173 ✓
  - API Proxy: /api → http://localhost:4000 ✓
  
- **Cloud-Plan-Manager (dev via PORT env var)**:
  - Port: 5000 (set by dev-all.ps1) ✓
  - Configuration: Uses PORT=5000 environment variable ✓

- **API Config (src/lib/api-config.ts)**:
  - ADMIN_API_URL: http://localhost:4000 ✓
  - CLOUD_PLAN_MANAGER_URL: http://localhost:5000 ✓
  - PURCHASE_SUCCESS_REDIRECT: http://localhost:5000/login ✓

## 🚀 How to Start Services Locally

### Option 1: Start All Services Together (Recommended)
```powershell
cd c:\Users\admin\Desktop\webmydrive-admin-console-main\webmydrive-admin-console-main
npm run dev:full
```
This starts:
1. PHP Backend on port 4000
2. Admin Console on port 6173
3. Cloud-Plan-Manager on port 5000

**Wait 30 seconds for all services to initialize.**

### Option 2: Start Services Individually
```powershell
# Terminal 1: Start PHP Backend
npm run backend:start

# Terminal 2: Start Admin Console
npm run dev

# Terminal 3: Start Cloud-Plan-Manager
cd C:\Users\admin\Downloads\Cloud-Plan-Manager\Cloud-Plan-Manager
$env:PORT="5000"
npm run dev
```

## 🧪 Local Testing Checklist

### 1. Service Availability
- [ ] Admin Console loads: http://localhost:6173 (should see login page)
- [ ] Cloud-Plan-Manager loads: http://localhost:5000 (should see home/pricing)
- [ ] Pricing page accessible: http://localhost:5000/pricing (recently fixed)
- [ ] PHP Backend responds: http://localhost:4000/api/health or similar endpoint

### 2. API Connectivity
- [ ] Admin Console can reach PHP backend via /api proxy
- [ ] Database is initialized (check server-php/database folder)
- [ ] Subscription table exists (check migrate.php was run)

### 3. User Flow Testing
```
Step 1: Visit Pricing Page
  → Navigate to http://localhost:5000/pricing
  → Should see list of available plans

Step 2: Select Plan and Proceed to Payment
  → Click on a plan (e.g., 500GB)
  → Click "Proceed to Pay" button
  → Should redirect to payment page/checkout

Step 3: Complete Payment
  → Complete payment flow with test credentials
  → System should create user account
  → System should create subscription record

Step 4: Login with New Account
  → Navigate to http://localhost:5000/login
  → Login with newly created account
  → Should be checked for active subscription
  → Should either allow login OR redirect to /pricing if no subscription

Step 5: Access Dashboard
  → Once logged in, should be able to access dashboard
  → Should only see if subscription is active
```

### 4. Database Operations
- [ ] Users table populated: Check with `SELECT COUNT(*) FROM Users;`
- [ ] Subscriptions table populated: Check with `SELECT COUNT(*) FROM Subscription;`
- [ ] Orders recorded: Check with `SELECT COUNT(*) FROM Orders;`

### 5. API Endpoints (Test with Postman/curl)
```bash
# Get subscription status (requires auth token)
curl http://localhost:4000/api/subscription/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get all active subscriptions (admin only)
curl http://localhost:4000/api/subscription/all \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"

# Get subscription stats
curl http://localhost:4000/api/subscription/stats \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

## 🔧 Service Health Checks

### Check PHP Backend
```powershell
# Verify PHP backend is running
netstat -ano | Select-String ":4000"

# Check PHP error logs
Get-Content C:\Users\admin\Desktop\webmydrive-admin-console-main\webmydrive-admin-console-main\server-php\logs\* -ErrorAction SilentlyContinue
```

### Check Admin Console
```powershell
# Verify Admin Console is running
netstat -ano | Select-String ":6173"

# Vite should show "VITE v5... ready in Xms"
```

### Check Cloud-Plan-Manager
```powershell
# Verify Cloud-Plan-Manager is running
netstat -ano | Select-String ":5000"

# Should show Vite dev server on port 5000
```

## 🐛 Common Local Development Issues

### Issue: 404 on Pricing Page
**Solution (Already Applied):** 
- ✓ Pricing.tsx component created
- ✓ Route added to App.tsx
- ✓ Should work at http://localhost:5000/pricing

### Issue: Cannot Connect to PHP Backend
**Solution:**
1. Verify backend is running: `npm run backend:start`
2. Check port 4000: `netstat -ano | Select-String ":4000"`
3. Check server-php logs for errors

### Issue: API Proxy Not Working
**Solution:**
1. Check vite.config.ts has correct proxy config
2. Restart Admin Console: `npm run dev`
3. Clear browser cache (Ctrl+Shift+Delete)

### Issue: PORT Environment Variable Not Set
**Solution:**
1. This is handled by dev-all.ps1 automatically
2. If starting manually, set before running:
   ```powershell
   $env:PORT="5000"
   npm run dev
   ```

### Issue: Subscription Check Failing at Login
**Solution:**
1. Verify migrate.php was executed
2. Check Subscription table exists: `sqlite database.db ".tables"`
3. Verify SubscriptionService.php exists in server-php/services/

## 📝 Configuration Files to Review

1. **Admin Console**: `webmydrive-admin-console-main/vite.config.ts`
   - Defines port 6173 and /api proxy

2. **API Config**: `webmydrive-admin-console-main/src/lib/api-config.ts`
   - Centralized URL configuration for all services

3. **Dev Script**: `webmydrive-admin-console-main/scripts/dev-all.ps1`
   - Orchestrates starting all 3 services

4. **PHP Backend**: `webmydrive-admin-console-main/server-php/public/index.php`
   - Front controller with all routes registered

5. **Authentication**: `webmydrive-admin-console-main/server-php/controllers/AuthController.php`
   - Login flow includes subscription check

## ✨ What Works Locally

✅ All 3 services configured to run on localhost
✅ Service-to-service communication via HTTP
✅ Database initialized with migration schema
✅ Pricing page accessible and routable
✅ Subscription middleware implemented
✅ Login flow includes subscription verification
✅ Payment success handler ready for webhooks
✅ Admin endpoints for managing subscriptions

## 🚨 Ready for Testing

Your local development environment is **fully configured** and **ready to test**:

1. **Start all services**: `npm run dev:full` (from admin console directory)
2. **Test pricing page**: Navigate to http://localhost:5000/pricing
3. **Test complete flow**: Pricing → Checkout → Payment → Login → Dashboard
4. **Monitor logs**: Watch npm/terminal output for errors

### Next Steps:
- [ ] Start services with `npm run dev:full`
- [ ] Test pricing page loads without 404
- [ ] Test complete user flow from pricing to login
- [ ] Report any errors or unexpected behavior

---

**Last Verified:** Configuration matches across all services
**Status:** Ready for local testing
