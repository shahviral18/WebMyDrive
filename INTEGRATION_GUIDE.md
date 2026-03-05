# Integration: Admin Console to WebMyDrive Website

## What's New

The admin console is now fully integrated with the main WebMyDrive website (Cloud-Plan-Manager). When a user purchases a plan through the admin console, they are automatically redirected to the main website login page.

## The Purchase Flow

### Step-by-Step Flow

1. **User starts on Admin Console** (http://localhost:6173)
   - Browses available plans
   - Logs in to their account
   - Selects a plan to purchase

2. **Pricing & Review Page**
   - User fills in billing information
   - Applies coupons if available
   - Reviews order total (including taxes)
   - Clicks "Proceed to Pay" button

3. **Backend Checkout Creation**
   - Admin console calls `/api/referral/create-checkout`
   - PHP backend validates the order
   - Creates a checkout session
   - Returns session ID to frontend

4. **Automatic Redirect**
   - Admin console redirects to WebMyDrive login page
   - URL: `http://localhost:3000/login?from=admin-console&planId=xyz&planName=...`
   - Order information stored in browser sessionStorage

5. **User Logs In on WebMyDrive**
   - User creates account or logs in
   - Cloud-Plan-Manager retrieves pending order from sessionStorage
   - Completes payment verification
   - Activates the plan

6. **Plan Activation**
   - User can now access cloud storage
   - Storage quota applied to their account
   - Can manage files and subscription settings

## Files Modified for Integration

### 1. **src/pages/Pricing.tsx** (Admin Console)
- Added `handleProceedToPay()` function
- Integrates with `/api/referral/create-checkout` endpoint
- Passes order info via sessionStorage
- Redirects to Cloud-Plan-Manager login page
- Shows loading state and error handling

### 2. **src/lib/api-config.ts** (Admin Console)
- New file for centralized API configuration
- Defines backend URLs:
  - `ADMIN_API_URL`: Points to PHP backend (http://localhost:4000)
  - `CLOUD_PLAN_MANAGER_URL`: Points to Cloud-Plan-Manager (http://localhost:3000)
  - `PURCHASE_SUCCESS_REDIRECT`: Final destination after purchase

### 3. **vite.config.ts** (Cloud-Plan-Manager)
- Updated to run on port 3000
- Added HMR configuration for proper websocket communication

### 4. **scripts/dev-all.ps1** (Admin Console)
- Updated to start all three services
- PHP Backend → Admin Console → Cloud-Plan-Manager
- Handles job management and cleanup
- Shows colored output for easy monitoring

### 5. **.env.example** (Admin Console)
- New file documenting all available environment variables
- Template for production configuration

## Environment Variables

Configure these in `.env.local` on the admin console:

```
# Backend API
VITE_ADMIN_API_URL=http://localhost:4000

# WebMyDrive Website URLs
VITE_CLOUD_PLAN_MANAGER_URL=http://localhost:3000
VITE_PURCHASE_SUCCESS_REDIRECT=http://localhost:3000/login
```

For production, update to your domain:

```
VITE_ADMIN_API_URL=https://api.webmydrive.com
VITE_CLOUD_PLAN_MANAGER_URL=https://webmydrive.com
VITE_PURCHASE_SUCCESS_REDIRECT=https://webmydrive.com/login
```

## API Endpoints Used

### Create Checkout Session
```
POST /api/referral/create-checkout
Authorization: Bearer {user_token}

Request Body:
{
  "planId": "plan-123",
  "promoCode": "SUMMER20"  // optional
}

Response:
{
  "sessionId": "session-abc123",
  "orderId": "order-xyz789",
  "amount": 4999.00
}
```

### Order Information Passed
When redirecting to Cloud-Plan-Manager, the following data is stored:

```javascript
{
  planId: "plan-123",
  planName: "Professional - 2TB + 500GB",
  planPrice: "₹2,499.00",
  amount: "₹2,957.82",  // with GST
  couponApplied: true,
  checkoutSessionId: "session-abc123",
  userId: "user-123"
}
```

## How to Run

### Quick Start (All Services)
```powershell
cd c:\Users\admin\Desktop\webmydrive-admin-console-main\webmydrive-admin-console-main
npm run dev:full
```

This starts:
- 🔌 PHP Backend: http://localhost:4000
- 📱 Admin Console: http://localhost:6173
- 🛒 Cloud-Plan-Manager: http://localhost:3000

### Individual Services
**Terminal 1:**
```powershell
npm run backend:start
```

**Terminal 2:**
```powershell
npm run dev
```

**Terminal 3:**
```powershell
cd C:\Users\admin\Downloads\Cloud-Plan-Manager\Cloud-Plan-Manager
npm run dev
```

## Testing the Flow

1. **Login**
   - Go to http://localhost:6173
   - Login with test account (or create one)

2. **Browse Plans**
   - Navigate to pricing section
   - Select a plan

3. **Fill Checkout Form**
   - Enter dummy billing info
   - Add coupon if any
   - Review total

4. **Complete Purchase**
   - Click "Proceed to Pay"
   - Should see loading animation
   - Should be redirected to http://localhost:3000/login

5. **Cloud-Plan-Manager**
   - Login or create account
   - Plan should be pending activation
   - Complete payment flow

## Error Handling

The integration includes comprehensive error handling:

- **No user logged in**: Button disabled with tooltip
- **Checkout session creation fails**: Shows error message
- **Network issues**: Retryable error display
- **Invalid plan**: Back navigation option
- **Redirect fails**: Fallback to manual navigation

## Important Notes

1. **Order Data Persistence**
   - Order info stored in `sessionStorage`, not `localStorage`
   - Cleared when browser tab is closed
   - Survives page navigation

2. **Token Management**
   - User token from admin console stored in localStorage
   - Passed in Authorization header for API calls
   - Cloud-Plan-Manager may use same or separate auth system

3. **Cross-Domain Considerations**
   - Both services run on localhost (different ports)
   - sessionStorage is port-specific
   - Different domains would need API-based handoff or redirect params

4. **Production Deployment**
   - Update all URLs in `.env.local`
   - Ensure HTTPS on both domains
   - Configure CORS properly if on different domains
   - Use secure token transmission methods

## Troubleshooting

### Button shows processing but doesn't redirect
- Check browser console for errors (F12)
- Verify PHP backend is running on port 4000
- Check network tab for `/api/referral/create-checkout` request

### Redirected but Cloud-Plan-Manager doesn't show plan
- Verify sessionStorage has order info (DevTools → Storage)
- Check Cloud-Plan-Manager login page reads sessionStorage
- Clear browser cache and try again

### Services won't start together
- Verify all three directories exist
- Check that ports 3000, 4000, 6173 are available
- Try starting individually and checking logs

## Next Steps

1. **Cloud-Plan-Manager Integration**
   - Implement login page to read sessionStorage
   - Implement payment verification
   - Store subscription to database

2. **Payment Processing**
   - Integrate Razorpay API for real payments
   - Verify payment before activating subscriptions
   - Handle refunds and cancellations

3. **User Experience**
   - Add payment success/failure pages
   - Implement subscription management
   - Add plan upgrade/downgrade flow

4. **Analytics**
   - Track conversion rates
   - Monitor checkout abandonment
   - Log all transactions

## Support

For issues with the integration:
1. Check SETUP_GUIDE.md for detailed configuration
2. Review error messages in browser console (F12)
3. Check network requests in DevTools Network tab
4. Verify all services are running: http://localhost:3000, :4000, :6173
