# Integration Checklist & Implementation Steps

## ✅ What's Already Implemented (Backend)

- [x] Database schema with Subscription table
- [x] SubscriptionService for managing subscriptions
- [x] PaymentHandler for payment processing
- [x] SubscriptionMiddleware for access control
- [x] SubscriptionController with API endpoints
- [x] Updated AuthController to check subscriptions on login
- [x] Routing rules configured
- [x] All services integrated into front controller

## 📋 Implementation Checklist

### Phase 1: Backend Verification (5-10 minutes)

- [ ] **1.1 Run Database Migration**
  ```bash
  cd server-php
  php database/migrate.php
  ```
  - Should output: "Migration complete! Database ready at: server-php/database/dev.db"
  - Verifies: Subscription table created with proper indexes

- [ ] **1.2 Verify Files Exist**
  ```bash
  # Check all new files created
  ls -la server-php/middleware/SubscriptionMiddleware.php
  ls -la server-php/services/SubscriptionService.php
  ls -la server-php/services/PaymentHandler.php
  ls -la server-php/controllers/SubscriptionController.php
  ```

- [ ] **1.3 Test Backend Health**
  ```bash
  curl http://localhost:4000/api/health
  # Should respond: {"status":"ok",...}
  ```

### Phase 2: Test Payment Success Endpoint (10 minutes)

- [ ] **2.1 Start PHP Backend**
  ```bash
  npm run backend:start
  # Or from server-php: php -S localhost:4000 -t public router.php
  ```

- [ ] **2.2 Test Payment Success API**
  ```bash
  curl -X POST http://localhost:4000/api/subscription/payment-success \
    -H "Content-Type: application/json" \
    -d '{
      "payment_id": "test_pay_123",
      "email": "testuser@example.com",
      "name": "Test User",
      "plan_name": "Professional Plan",
      "amount": 4999,
      "signature": "test_sig"
    }'
  ```
  - Expected: User created, Subscription created
  - Response should include: success, user info, subscription details

- [ ] **2.3 Verify User Created**
  ```bash
  sqlite3 server-php/database/dev.db "SELECT * FROM \"User\" WHERE email='testuser@example.com';"
  ```
  - Should show: user record with role='USER'

- [ ] **2.4 Verify Subscription Created**
  ```bash
  sqlite3 server-php/database/dev.db "SELECT * FROM \"Subscription\" WHERE status='active';"
  ```
  - Should show: subscription record with status='active'

### Phase 3: Test Login with Subscription Check (10 minutes)

- [ ] **3.1 Test User Without Subscription**
  ```bash
  curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "newuser@example.com",
      "password": "SomePassword123"
    }'
  ```
  - Expected: 403 error with "No active subscription"
  - Response includes: "redirect": "/pricing"

- [ ] **3.2 Test User With Active Subscription**
  ```bash
  # Use the testuser@example.com created in Phase 2
  # First set a password
  sqlite3 server-php/database/dev.db "UPDATE \"User\" SET passwordHash='\$(php -r 'echo password_hash(\"password123\", PASSWORD_BCRYPT);')' WHERE email='testuser@example.com';"
  
  # Then login
  curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "testuser@example.com",
      "password": "password123"
    }'
  ```
  - Expected: 200 OK with JWT token
  - Response includes: "token": "eyJ...", "hasActiveSubscription": true

### Phase 4: Landing Website Integration (1-2 hours)

- [ ] **4.1 Copy Code Examples**
  - Copy payment handler code from LANDING_INTEGRATION_EXAMPLES.md
  - Add to your landing website

- [ ] **4.2 Configure Environment**
  ```bash
  # In landing website .env.local
  REACT_APP_ADMIN_API_URL=http://localhost:4000
  REACT_APP_CLOUD_PLAN_MANAGER_URL=http://localhost:5000
  REACT_APP_RAZORPAY_KEY=your_razorpay_key_here
  ```

- [ ] **4.3 Update Payment Gateway Config**
  - Get Razorpay/Stripe API keys
  - Set environment variables
  - Test payment with test credentials

- [ ] **4.4 Implement Payment Success Handler**
  - Add `handlePaymentSuccess()` function
  - Call `/api/subscription/payment-success` endpoint
  - Handle success/error responses
  - Redirect to login on success

- [ ] **4.5 Test Payment Flow**
  ```
  1. Start landing website (npm run dev)
  2. Select a plan
  3. Enter test credentials
  4. Complete payment
  5. Verify user created in database
  6. Verify subscription created
  ```

### Phase 5: Dashboard Login Integration (1-2 hours)

- [ ] **5.1 Copy Code Examples**
  - Copy login component code from LANDING_INTEGRATION_EXAMPLES.md
  - Update dashboard login page

- [ ] **5.2 Configure Environment**
  ```bash
  # In dashboard .env.local
  REACT_APP_ADMIN_API_URL=http://localhost:4000
  REACT_APP_CLOUD_PLAN_MANAGER_URL=http://localhost:5000
  ```

- [ ] **5.3 Update Login Component**
  - Add subscription check after password verification
  - Show error if no active subscription
  - Redirect to pricing if needed
  - Show temporary password if new user

- [ ] **5.4 Test Login-to-Subscription Check**
  ```
  1. Try login without subscription → Should redirect to pricing
  2. Purchase plan on landing site
  3. Try login with subscription → Should succeed
  4. Verify redirected to dashboard
  ```

### Phase 6: Protected Routes (1 hour)

- [ ] **6.1 Create ProtectedRoute Component**
  - Copy code from LANDING_INTEGRATION_EXAMPLES.md
  - Add to your dashboard routing

- [ ] **6.2 Wrap Dashboard Routes**
  ```javascript
  <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    }
  />
  ```

- [ ] **6.3 Test Protected Routes**
  ```
  1. Logout or delete token
  2. Try accessing /dashboard directly
  3. Should redirect to /login
  4. Try accessing without subscription
  5. Should redirect to /pricing
  ```

### Phase 7: Payment Gateway Integration (2-3 hours)

- [ ] **7.1 Get API Credentials**
  - Create account on Razorpay/Stripe
  - Get test credentials
  - Add to environment variables

- [ ] **7.2 Implement Real Payment Verification**
  ```php
  // In PaymentHandler::verifyRazorpayPayment()
  // Implement actual verification logic
  ```

- [ ] **7.3 Implement Signature Verification**
  ```php
  // In SubscriptionController::verifyPaymentSignature()
  // Implement signature checking
  ```

- [ ] **7.4 Test with Real Gateway**
  - Use test credentials
  - Process test payment
  - Verify user created
  - Verify subscription created
  - Verify can login

### Phase 8: Testing & QA (2-3 hours)

- [ ] **8.1 Complete User Flow**
  ```
  ✓ User visits landing site
  ✓ User selects plan
  ✓ User completes payment
  ✓ User receives credentials
  ✓ User redirects to login
  ✓ User logs in with subscription check
  ✓ User accesses dashboard
  ✓ User browses protected routes
  ```

- [ ] **8.2 Error Scenarios**
  ```
  ✓ User tries login without subscription
  ✓ User tries to access dashboard without token
  ✓ User tries to access with expired subscription
  ✓ Payment fails and user not created
  ✓ Invalid email or duplicate email handling
  ```

- [ ] **8.3 Edge Cases**
  ```
  ✓ Same user purchases twice (idempotency)
  ✓ New user with temporary password
  ✓ Admin bypasses subscription check
  ✓ Subscription renewal
  ✓ Subscription expiry
  ```

### Phase 9: Production Deployment (2-4 hours)

- [ ] **9.1 Security Hardening**
  - [ ] Implement rate limiting on auth endpoints
  - [ ] Add CORS configuration for production domains
  - [ ] Use HTTPS for all endpoints
  - [ ] Set secure JWT expiration (e.g., 24 hours)
  - [ ] Hide error details in production

- [ ] **9.2 Database Setup**
  - [ ] Migrate from SQLite to PostgreSQL/MySQL
  - [ ] Set up database backups
  - [ ] Create read-only user for queries
  - [ ] Add database indexes

- [ ] **9.3 Environment Configuration**
  - [ ] Set production environment variables
  - [ ] Update API URLs to production domains
  - [ ] Configure payment gateway for production
  - [ ] Set proper JWT secret

- [ ] **9.4 Email Integration**
  - [ ] Send welcome email to new users
  - [ ] Email contains temporary password
  - [ ] Send login credentials after purchase
  - [ ] Set up email templates

- [ ] **9.5 Monitoring & Logging**
  - [ ] Set up error tracking (Sentry, etc.)
  - [ ] Configure log aggregation
  - [ ] Set up alerts for failed payments
  - [ ] Monitor subscription metrics

- [ ] **9.6 Deployment**
  - [ ] Build landing website for production
  - [ ] Build dashboard for production
  - [ ] Deploy backend
  - [ ] Test complete flow in production
  - [ ] Monitor for errors

### Phase 10: Post-Deployment (Ongoing)

- [ ] **10.1 Monitoring**
  - [ ] Check error rates daily
  - [ ] Monitor payment success rates
  - [ ] Track user signup funnel
  - [ ] Monitor system performance

- [ ] **10.2 Maintenance**
  - [ ] Set up subscription renewal reminders
  - [ ] Create subscription expiry handler
  - [ ] Monitor database size
  - [ ] Rotate security keys regularly

- [ ] **10.3 User Support**
  - [ ] Set up support email
  - [ ] Create FAQ for common issues
  - [ ] Document user flows
  - [ ] Create account recovery process

## 📚 Reference Documents

1. **PROJECT_MERGE_SUMMARY.md** - Overview of what was implemented
2. **SUBSCRIPTION_INTEGRATION_GUIDE.md** - Detailed technical guide
3. **LANDING_INTEGRATION_EXAMPLES.md** - Code examples and templates
4. **This file** - Checklist and implementation steps

## 🔧 Quick Command Reference

```bash
# Backend
npm run backend:start                    # Start PHP backend on :4000
php server-php/database/migrate.php      # Run migrations

# Testing
curl http://localhost:4000/api/health   # Test backend health

# Database
sqlite3 server-php/database/dev.db       # Open SQLite console
.tables                                  # List tables
SELECT * FROM "Subscription" LIMIT 5;    # View subscriptions
SELECT * FROM "User" LIMIT 5;            # View users

# Frontend
npm run dev                              # Start landing/dashboard dev
npm run build                            # Build for production
```

## ⏱️ Time Estimate

- Backend verification: 10 min
- Backend testing: 20 min
- Landing integration: 2 hours
- Dashboard integration: 2 hours
- Protected routes: 1 hour
- Payment gateway: 3 hours
- QA testing: 3 hours
- Production setup: 3 hours

**Total: 14-16 hours**

This assumes you have existing landing and dashboard UIs ready.

## 🆘 Troubleshooting

If you encounter issues during implementation:

1. **Check logs**: 
   ```bash
   tail -f server-php/logs/*
   ```

2. **Check database**:
   ```bash
   sqlite3 server-php/database/dev.db ".schema Subscription"
   ```

3. **Test endpoint**:
   ```bash
   curl http://localhost:4000/api/health
   ```

4. **Check network**:
   ```bash
   # Verify ports are open
   lsof -i :4000  # PHP backend
   lsof -i :5000  # Landing site
   lsof -i :5173  # Dashboard (dev)
   ```

## ✉️ Support

- Review SUBSCRIPTION_INTEGRATION_GUIDE.md for detailed info
- Check LANDING_INTEGRATION_EXAMPLES.md for code samples
- Look at error messages in server-php/logs/

## 🎯 Final Steps

After completing all phases:

1. ✅ All endpoints tested and working
2. ✅ Full user flow tested (purchase → login → access)
3. ✅ Error scenarios handled
4. ✅ Production ready
5. ✅ Documentation updated
6. ✅ Team trained
7. ✅ Go live!

---

**Status**: Backend implementation ✅ Complete
**Next**: Frontend integration (landing + dashboard)
**Timeline**: 1-2 weeks for full implementation
