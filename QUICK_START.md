# WebMyDrive Integration - Quick Reference

## 🚀 Start All Services (One Command)

```powershell
cd c:\Users\admin\Desktop\webmydrive-admin-console-main\webmydrive-admin-console-main
npm run dev:full
```

**All services will start automatically:**
- ✅ PHP Backend: `http://localhost:4000`
- ✅ Admin Console: `http://localhost:6173`
- ✅ Cloud-Plan-Manager: `http://localhost:3000`

---

## 📋 What's New

### 1. **Integrated Purchase Flow**
   - Users buy plans on Admin Console → Redirected to Cloud-Plan-Manager login
   - Single command to start all services together
   - Order data automatically passed between services

### 2. **Updated Components**
   - `src/pages/Pricing.tsx` - Handle checkout and redirect
   - `src/lib/api-config.ts` - Centralized configuration
   - `vite.config.ts` (Cloud-Plan-Manager) - Port 3000 configuration

### 3. **New Scripts & Configuration**
   - `scripts/dev-all.ps1` - Start all 3 services at once
   - `.env.example` - Environment variable template
   - Multiple documentation files

---

## 🔄 Purchase Flow

**User Journey:**
1. Visit Admin Console (http://localhost:6173)
2. Login & select plan
3. Review order and fill billing info
4. Click "Proceed to Pay"
5. ✨ Automatically redirected to Cloud-Plan-Manager login
6. User logs in on main website
7. Plan gets activated

---

## 📁 Configuration Files

### Admin Console (`.env.local` in root)
```
VITE_ADMIN_API_URL=http://localhost:4000
VITE_CLOUD_PLAN_MANAGER_URL=http://localhost:3000
VITE_PURCHASE_SUCCESS_REDIRECT=http://localhost:3000/login
```

### Production URLs
```
VITE_ADMIN_API_URL=https://api.yourdomain.com
VITE_CLOUD_PLAN_MANAGER_URL=https://yourdomain.com
VITE_PURCHASE_SUCCESS_REDIRECT=https://yourdomain.com/login
```

---

## 📚 Documentation

- **SETUP_GUIDE.md** - Detailed setup and troubleshooting
- **INTEGRATION_GUIDE.md** - How the integration works
- **.env.example** - Available environment variables

---

## ✅ What Was Implemented

### Code Changes:
- ✅ Added checkout button handler with API integration
- ✅ Created api-config.ts for centralized URLs
- ✅ Updated Cloud-Plan-Manager vite.config for port 3000
- ✅ Enhanced error handling and loading states
- ✅ Added sessionStorage for order data persistence

### Scripts:
- ✅ Updated dev-all.ps1 to start 3 services
- ✅ Created dev-full.ps1 as alternative
- ✅ Verified dev:full npm script works

### Documentation:
- ✅ SETUP_GUIDE.md - Complete setup walkthrough
- ✅ INTEGRATION_GUIDE.md - Technical integration details
- ✅ .env.example - Configuration template
- ✅ This quick reference guide

---

## 🧪 Test the Integration

1. **Start everything:**
   ```powershell
   npm run dev:full
   ```

2. **Open in browser:**
   - Admin Console: http://localhost:6173
   - Cloud-Plan-Manager: http://localhost:3000

3. **Test checkout flow:**
   - Login to admin console
   - Go to pricing
   - Select a plan
   - Fill in form and click "Proceed to Pay"
   - Should redirect to http://localhost:3000/login

---

## 🔧 Troubleshooting

### All services running but can't see them?
```powershell
# Check if ports are available
Get-NetTCPConnection -LocalPort 3000
Get-NetTCPConnection -LocalPort 4000
Get-NetTCPConnection -LocalPort 6173
```

### Port already in use?
```powershell
# Kill process using port
Stop-Process -Id <PID> -Force
```

### Need to restart?
```
Ctrl+C in the dev:full window will stop all services
```

---

## 📞 Key Concepts

**Admin Console (Port 6173)**
- Plan browsing and subscription purchase
- Admin dashboard
- Referral management
- Redirects users to Cloud-Plan-Manager after purchase

**Cloud-Plan-Manager (Port 3000)**
- Main user website
- User account management
- Cloud storage interface
- Payment completion

**PHP Backend (Port 4000)**
- Authentication
- Checkout session creation
- Order processing
- Database operations

---

## 🎯 Next Steps

1. **Setup Cloud-Plan-Manager login page** to handle redirect from buy page
2. **Implement payment verification** on Cloud-Plan-Manager
3. **Add subscription activation** logic
4. **Test with real payment gateway** (Razorpay integration)
5. **Deploy to staging environment**

---

## 📞 Support

See **SETUP_GUIDE.md** and **INTEGRATION_GUIDE.md** for:
- Detailed configuration
- API endpoint documentation
- Production deployment
- Troubleshooting guide
- Development tips
