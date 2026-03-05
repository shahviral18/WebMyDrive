# WebMyDrive: Landing to Dashboard Integration Guide

## Project Overview

This document explains how to merge a landing/pricing website with a PHP-based dashboard with subscription-based access control.

### System Architecture

```
┌─────────────────────────────────────┐
│    Landing/Pricing Website (Port 5000/3000)  │
│    React + Express/TypeScript        │
│    - Display pricing plans           │
│    - Handle payments                 │
│    - Redirect to dashboard login     │
└──────────────┬──────────────────────┘
               │
               ├─ Payment Success
               │  Calls /api/subscription/payment-success
               ↓
┌─────────────────────────────────────┐
│  PHP Backend (Port 4000)              │
│  - Create user account                │
│  - Create subscription                │
│  - Generate JWT token                 │
│  - Check subscription on login        │
└──────────────┬──────────────────────┘
               │
               ├─ User credentials + token
               ↓
┌─────────────────────────────────────┐
│    Dashboard Application              │
│    - Login page (checks subscription) │
│    - User dashboard                   │
│    - File management                  │
│    - Protected routes require token   │
└─────────────────────────────────────┘
```

## User Flow

### 1. Purchase Flow (Landing Website)

```
1. User visits landing website (http://localhost:5000)
2. Browses pricing plans
3. Selects a plan and clicks "Subscribe"
4. Enters personal details (name, email, phone, address)
5. Completes payment through payment gateway (Razorpay, Stripe, etc.)
6. Payment gateway confirms payment
7. Landing website calls /api/subscription/payment-success
8. PHP backend creates:
   - User account (if new)
   - Subscription record
   - Returns account credentials
9. User is redirected to login page
```

### 2. Login Flow (Dashboard)

```
1. User visits login page (http://localhost:5000/login or dashboard login)
2. Enters email and password
3. Dashboard/Backend verifies credentials:
   - Check if user exists
   - Verify password
   - Check if user has ACTIVE subscription ← KEY STEP
4. If no active subscription:
   - Return error: "Please purchase a plan"
   - Redirect to pricing page
5. If subscription is active:
   - Generate JWT token
   - User logged in successfully
   - Can access dashboard
```

### 3. Dashboard Access Control

```
Every protected route checks:
├─ JWT token is valid
├─ User is authenticated
└─ User has active subscription
```

## Implementation Details

### 1. Database Schema

#### Subscription Table

```sql
CREATE TABLE IF NOT EXISTS "Subscription" (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL UNIQUE,
  plan_name      TEXT NOT NULL,
  payment_id     TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'active',
  start_date     TEXT NOT NULL,
  end_date       TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES "User"(id)
);

CREATE INDEX idx_subscription_user_id ON "Subscription"(user_id);
CREATE INDEX idx_subscription_status ON "Subscription"(status);
CREATE INDEX idx_subscription_end_date ON "Subscription"(end_date);
```

The `status` field can have values:
- `active` - User has paid and subscription is valid
- `expired` - Subscription end date has passed
- `cancelled` - User manually cancelled

### 2. Core Components

#### A. SubscriptionService (`services/SubscriptionService.php`)

Handles subscription operations:

```php
// Create subscription after payment
SubscriptionService::createSubscription($userId, $planName, $paymentId);

// Get user's active subscription
$sub = SubscriptionService::getUserSubscription($userId);

// Check if user has active subscription
$hasActive = SubscriptionService::hasActiveSubscription($userId);

// Renew subscription
SubscriptionService::renewSubscription($userId, $paymentId);

// Get statistics
$stats = SubscriptionService::getSubscriptionStats();
```

#### B. PaymentHandler (`services/PaymentHandler.php`)

Handles payment verification and account creation:

```php
$result = PaymentHandler::handlePaymentSuccess([
    'payment_id' => 'pay_123456',
    'email' => 'user@example.com',
    'name' => 'John Doe',
    'plan_name' => 'Professional',
    'amount' => 4999,
]);

// Returns:
// {
//   "success": true,
//   "user": { "email", "name" },
//   "subscription": { "plan_name", "status", "end_date" },
//   "requiresPasswordChange": true/false,
//   "temporaryPassword": "TempPass123!" (if new user)
// }
```

#### C. SubscriptionMiddleware (`middleware/SubscriptionMiddleware.php`)

Checks if user has active subscription:

```php
// In routes that require active subscription:
SubscriptionMiddleware::requireActiveSubscription($request);

// Or check without blocking:
$subscription = SubscriptionMiddleware::checkSubscription($request);
```

#### D. SubscriptionController (`controllers/SubscriptionController.php`)

API endpoints for subscription management.

### 3. API Endpoints

#### Payment Success Handler
```
POST /api/subscription/payment-success

Request body:
{
  "payment_id": "pay_123456",
  "email": "user@example.com",
  "name": "John Doe",
  "plan_name": "Professional Plan",
  "amount": 4999.00,
  "signature": "sha256_hash..." (for verification)
}

Response:
{
  "success": true,
  "user": { "email": "...", "name": "..." },
  "subscription": {
    "plan_name": "...",
    "status": "active",
    "start_date": "2026-03-05T10:30:00Z",
    "end_date": "2027-03-05T10:30:00Z"
  },
  "requiresPasswordChange": true,
  "temporaryPassword": "..." (if new user)
}
```

#### Check Subscription Status
```
GET /api/subscription/status

Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "hasActiveSubscription": true,
  "subscription": {
    "plan_name": "Professional",
    "status": "active",
    "start_date": "2026-03-05",
    "end_date": "2027-03-05",
    "days_remaining": 365
  }
}
```

#### Get Subscription Details
```
GET /api/subscription/details

Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "subscription": {
    "id": 1,
    "plan_name": "Professional",
    "status": "active",
    "payment_id": "pay_123456",
    "start_date": "2026-03-05T10:30:00Z",
    "end_date": "2027-03-05T10:30:00Z",
    "days_remaining": 365
  }
}
```

#### Renew Subscription
```
POST /api/subscription/renew

Headers: Authorization: Bearer {token}

Request body:
{
  "payment_id": "pay_789..."
}

Response:
{
  "success": true,
  "subscription": {
    "plan_name": "Professional",
    "status": "active",
    "end_date": "2028-03-05T10:30:00Z"
  }
}
```

### 4. Login Flow Changes

The login endpoint has been updated to check subscription:

```php
// In AuthController::login()

// After password verification...
if ($user['role'] === 'USER') {
    $subscription = SubscriptionService::getUserSubscription((int)$user['id']);
    if (!$subscription) {
        Response::json([
            'token' => null,
            'hasActiveSubscription' => false,
            'message' => 'No active subscription. Please purchase a plan first.',
            'redirect' => '/pricing',
        ], 403);
    }
}

// If subscription exists, return token normally
Response::json([
    'token' => $token,
    'hasActiveSubscription' => true,
    'requiresPasswordChange' => $requiresPasswordChange,
    'user' => [ ... ]
]);
```

Admin users (SUPERADMIN, ADMIN) bypass subscription checks.

## Integration Steps

### Step 1: Update Database

Run the migration to add subscription tables:

```bash
cd server-php
php database/migrate.php
```

This will:
- Create the `Subscription` table
- Create indexes for performance
- Keep all existing tables intact

### Step 2: Configure Landing Website

Update the payment success handler to call the backend:

```javascript
// In landing website (React/TypeScript)

const handlePaymentSuccess = async (paymentData) => {
  const response = await fetch('http://localhost:4000/api/subscription/payment-success', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payment_id: paymentData.payment_id,
      email: paymentData.email,
      name: paymentData.name,
      plan_name: paymentData.plan_name,
      amount: paymentData.amount,
      signature: paymentData.signature
    })
  });

  const result = await response.json();
  
  if (result.success) {
    // Store temporary password if new user
    if (result.temporaryPassword) {
      sessionStorage.setItem('tempPassword', result.temporaryPassword);
      sessionStorage.setItem('email', result.user.email);
    }
    
    // Redirect to login
    window.location.href = 'http://localhost:5000/login';
  }
};
```

### Step 3: Update Dashboard Login

Update the login component to handle subscription errors:

```javascript
// In dashboard login component

const handleLogin = async (email, password) => {
  const response = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  
  // Check subscription status
  if (data.hasActiveSubscription === false) {
    // User tried to login without subscription
    alert('Please purchase a plan first');
    window.location.href = 'http://localhost:5000/pricing';
    return;
  }
  
  if (data.token) {
    // Save token and log user in
    localStorage.setItem('token', data.token);
    window.location.href = '/dashboard';
  }
};
```

### Step 4: Protect Dashboard Routes

Add subscription check to protected routes:

```javascript
// In React component for protected routes

useEffect(() => {
  const checkSubscription = async () => {
    const response = await fetch('http://localhost:4000/api/subscription/status', {
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    
    if (!data.hasActiveSubscription) {
      // Redirect to pricing
      window.location.href = 'http://localhost:5000/pricing';
    }
  };
  
  checkSubscription();
}, []);
```

### Step 5: Handle Redirects

Create a middleware/guard in dashboard to check subscription before allowing access:

```javascript
// In a Route guard component

const ProtectedRoute = ({ children }) => {
  const [isValid, setIsValid] = useState(null);
  
  useEffect(() => {
    const verify = async () => {
      try {
        const response = await fetch('http://localhost:4000/api/subscription/status', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        const data = await response.json();
        
        if (!data.hasActiveSubscription) {
          window.location.href = 'http://localhost:5000/pricing';
          return;
        }
        
        setIsValid(true);
      } catch (error) {
        window.location.href = 'http://localhost:5000/login';
      }
    };
    
    verify();
  }, []);
  
  if (isValid === null) return <Loader />;
  if (!isValid) return null;
  
  return children;
};
```

## Environment Configuration

### Backend (.env)

```
DB_PATH=server-php/database/dev.db
JWT_SECRET=your_jwt_secret_key
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
STRIPE_SECRET_KEY=your_stripe_key
```

### Payment Gateway Integration

For Razorpay:

```php
// Verify payment signature
private function verifyPaymentSignature($paymentId, $amount, $signature) {
    $secret = getenv('RAZORPAY_WEBHOOK_SECRET');
    $hash = hash_hmac('sha256', "$paymentId|$amount", $secret);
    return hash_equals($hash, $signature);
}
```

## Testing the Integration

### 1. Test Payment Success Flow

```bash
# Call payment success endpoint directly
curl -X POST http://localhost:4000/api/subscription/payment-success \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "test_pay_123",
    "email": "test@example.com",
    "name": "Test User",
    "plan_name": "Professional",
    "amount": 4999,
    "signature": "test_sig"
  }'
```

### 2. Test Subscription Check

```bash
# Check subscription status
curl -X GET http://localhost:4000/api/subscription/status \
  -H "Authorization: Bearer {jwt_token}"
```

### 3. Test Login with Subscription Check

```bash
# Try login after purchasing subscription
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

## Admin Features

### View All Subscriptions

```
GET /api/subscription/all?limit=100&offset=0

Headers: Authorization: Bearer {admin_token}
```

### Get Statistics

```
GET /api/subscription/stats

Returns:
{
  "total": 150,
  "active": 145,
  "expired": 5
}
```

## Error Handling

### User Without Subscription

Status: 403

```json
{
  "error": "No active subscription found. Please purchase a plan.",
  "redirect": "/pricing"
}
```

### Expired Subscription

Status: 403

```json
{
  "error": "Your subscription has expired. Please renew your plan.",
  "redirect": "/pricing"
}
```

### Invalid Token

Status: 401

```json
{
  "error": "Invalid token"
}
```

## Production Checklist

- [ ] Update payment gateway credentials in .env
- [ ] Implement actual payment signature verification
- [ ] Set up proper HTTPS/SSL certificates
- [ ] Configure CORS properly for cross-domain requests
- [ ] Set up email notifications for:
  - Subscription creation
  - Subscription renewal
  - Subscription expiration
- [ ] Create subscription expiry cron job
- [ ] Set up monitoring/alerts for failed payments
- [ ] Test with real payment gateway
- [ ] Create user documentation
- [ ] Set up automated backups

## Security Considerations

1. **Payment Verification**: Always verify payment signatures from gateway
2. **JWT Tokens**: Use secure, time-limited tokens
3. **HTTPS**: Always use HTTPS in production
4. **CORS**: Configure CORS properly to prevent unauthorized access
5. **Rate Limiting**: Implement rate limiting on auth endpoints
6. **Input Validation**: Validate all inputs on both frontend and backend
7. **Database Security**: Use SQLite in development, PostgreSQL/MySQL in production
8. **Sensitive Data**: Don't log passwords or payment details

## Troubleshooting

### Issue: User can login without subscription

**Solution**: Check that SubscriptionService is imported in AuthController and subscription check is active.

### Issue: Subscription not created after payment

**Solution**:
1. Verify payment signature verification is working
2. Check that email is correct and unique
3. Verify database migration ran successfully
4. Check logs in `server-php/logs/`

### Issue: JWT token invalid after login

**Solution**:
1. Check JWT_SECRET is set in .env
2. Verify token expiration time
3. Check token format in Authorization header (should be "Bearer token")

### Issue: CORS errors

**Solution**:
1. Add proper CORS headers in backend
2. Use proxy in development
3. Configure frontend API base URL correctly

## Future Enhancements

1. **Subscription Plans**: Support multiple plan tiers
2. **Recurring Billing**: Set up automatic renewal
3. **Payment Methods**: Support multiple payment gateways
4. **Usage Tracking**: Track storage usage against plan limits
5. **Plan Upgrades**: Allow users to upgrade/downgrade
6. **Trial Period**: Offer free trial period
7. **Discounts**: Support coupon codes and bulk discounts
8. **Analytics**: Track subscription metrics and revenue
9. **Notifications**: Email notifications for important events
10. **Cancellation Flow**: Allow users to cancel subscriptions

## Support & References

- Razorpay Docs: https://razorpay.com/docs/
- Stripe Docs: https://stripe.com/docs
- JWT Intro: https://jwt.io/introduction
- PHP Security: https://www.php.net/manual/en/security.php
