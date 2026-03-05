# Landing Website Integration - Code Examples

This guide provides practical code examples for integrating the landing website with the subscription system.

## 1. Payment Success Handler (React/TypeScript)

Add this to your landing website's payment verification component:

```typescript
// client/src/lib/payment.ts

import { API_CONFIG } from '@/lib/api-config';

interface PaymentSuccessPayload {
  paymentId: string;
  email: string;
  name: string;
  planName: string;
  amount: number;
  signature?: string;
}

/**
 * Call backend to verify payment and create subscription
 */
export async function handlePaymentSuccess(
  paymentData: PaymentSuccessPayload
): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_CONFIG.ADMIN_API_URL}/api/subscription/payment-success`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: paymentData.paymentId,
          email: paymentData.email,
          name: paymentData.name,
          plan_name: paymentData.planName,
          amount: paymentData.amount,
          signature: paymentData.signature || '',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Payment processing failed');
    }

    const result = await response.json();

    if (result.success) {
      // Store user info in session for login page
      sessionStorage.setItem('pendingLogin', JSON.stringify({
        email: result.user.email,
        name: result.user.name,
        planName: result.subscription.plan_name,
        requiresPasswordChange: result.requiresPasswordChange,
        temporaryPassword: result.temporaryPassword,
      }));

      // Redirect to login page
      setTimeout(() => {
        window.location.href = `${API_CONFIG.CLOUD_PLAN_MANAGER_URL}/login`;
      }, 2000);

      return true;
    } else {
      throw new Error(result.error || 'Payment verification failed');
    }
  } catch (error) {
    console.error('Payment error:', error);
    throw error;
  }
}

/**
 * Handle Razorpay payment completion
 */
export function initRazorpayPayment(options: {
  planName: string;
  amount: number;
  email: string;
  name: string;
  onSuccess: (paymentId: string) => void;
  onError: (error: any) => void;
}) {
  const razorpayKey = process.env.REACT_APP_RAZORPAY_KEY;

  if (!razorpayKey) {
    console.error('Razorpay key not configured');
    return;
  }

  const payload = {
    key: razorpayKey,
    amount: Math.round(options.amount * 100), // Convert to paise
    currency: 'INR',
    name: 'WebMyDrive',
    description: `Buy ${options.planName} Plan`,
    customer_notif: 1,
    email: options.email,
    contact: '', // Add phone if available
    handler: function (response: any) {
      console.log('Razorpay payment successful:', response.razorpay_payment_id);
      options.onSuccess(response.razorpay_payment_id);
    },
    prefill: {
      email: options.email,
      name: options.name,
    },
    theme: {
      color: '#3399cc',
    },
    modal: {
      ondismiss: () => {
        options.onError(new Error('Payment cancelled'));
      },
    },
  };

  // Load Razorpay script dynamically
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.onload = () => {
    // @ts-ignore
    const rzp = new (window as any).Razorpay(payload);
    rzp.open();
  };
  document.body.appendChild(script);
}
```

## 2. Checkout Component (React)

```typescript
// client/src/components/CheckoutForm.tsx

import { useState } from 'react';
import { handlePaymentSuccess, initRazorpayPayment } from '@/lib/payment';

interface CheckoutFormProps {
  planName: string;
  planPrice: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function CheckoutForm({
  planName,
  planPrice,
  onSuccess,
  onError,
}: CheckoutFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckout = async () => {
    // Validate form
    if (!formData.name || !formData.email) {
      setError('Name and email are required');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Initialize Razorpay payment
      initRazorpayPayment({
        planName,
        amount: planPrice,
        email: formData.email,
        name: formData.name,
        onSuccess: async (paymentId) => {
          try {
            // Verify payment with backend
            await handlePaymentSuccess({
              paymentId,
              email: formData.email,
              name: formData.name,
              planName,
              amount: planPrice,
            });

            setFormData({
              name: '',
              email: '',
              phone: '',
              address: '',
              city: '',
              state: '',
              zipCode: '',
            });

            onSuccess();
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Payment failed';
            setError(message);
            onError(message);
            setIsProcessing(false);
          }
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : 'Payment cancelled';
          setError(message);
          onError(message);
          setIsProcessing(false);
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout failed';
      setError(message);
      onError(message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="checkout-form">
      <h2>Checkout</h2>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-group">
        <label>Full Name</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          placeholder="John Doe"
          required
        />
      </div>

      <div className="form-group">
        <label>Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleInputChange}
          placeholder="john@example.com"
          required
        />
      </div>

      <div className="form-group">
        <label>Phone</label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleInputChange}
          placeholder="+91 98765 43210"
        />
      </div>

      <div className="form-group">
        <label>Address</label>
        <input
          type="text"
          name="address"
          value={formData.address}
          onChange={handleInputChange}
          placeholder="123 Main Street"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>City</label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleInputChange}
            placeholder="New York"
          />
        </div>

        <div className="form-group">
          <label>State</label>
          <input
            type="text"
            name="state"
            value={formData.state}
            onChange={handleInputChange}
            placeholder="NY"
          />
        </div>

        <div className="form-group">
          <label>ZIP Code</label>
          <input
            type="text"
            name="zipCode"
            value={formData.zipCode}
            onChange={handleInputChange}
            placeholder="10001"
          />
        </div>
      </div>

      <div className="order-summary">
        <h3>{planName}</h3>
        <p className="price">₹{planPrice.toLocaleString()}</p>
        <p className="tax">+ 18% GST</p>
        <hr />
        <p className="total">
          Total: ₹
          {Math.round(planPrice * 1.18).toLocaleString()}
        </p>
      </div>

      <button
        onClick={handleCheckout}
        disabled={isProcessing}
        className="btn btn-primary btn-lg"
      >
        {isProcessing ? 'Processing...' : 'Proceed to Payment'}
      </button>
    </div>
  );
}
```

## 3. Login Page Integration (Dashboard)

```typescript
// dashboard/src/pages/Login.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_CONFIG } from '@/lib/api-config';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Check if user just completed payment
  useEffect(() => {
    const pendingLogin = sessionStorage.getItem('pendingLogin');
    if (pendingLogin) {
      const data = JSON.parse(pendingLogin);
      setEmail(data.email);

      // If new user, show temporary password
      if (data.temporaryPassword) {
        alert(
          `Your account has been created!\n\nTemporary Password: ${data.temporaryPassword}\n\nPlease change it on first login.`
        );
      }

      sessionStorage.removeItem('pendingLogin');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(
        `${API_CONFIG.ADMIN_API_URL}/api/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();

      // Check if user has active subscription
      if (data.hasActiveSubscription === false) {
        setError('You need an active subscription to access the dashboard.');
        setTimeout(() => {
          window.location.href = `${API_CONFIG.CLOUD_PLAN_MANAGER_URL}/pricing`;
        }, 3000);
        return;
      }

      if (!response.ok || !data.token) {
        setError(data.error || 'Login failed');
        return;
      }

      // Save token
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred during login'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>WebMyDrive Login</h1>

        {error && (
          <div className="alert alert-error">
            {error}
            {error.includes('subscription') && (
              <button
                onClick={() =>
                  (window.location.href = `${API_CONFIG.CLOUD_PLAN_MANAGER_URL}/pricing`)
                }
                className="btn btn-sm btn-primary"
              >
                View Plans
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary btn-lg btn-block"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="text-center mt-3">
          Don't have an account?{' '}
          <a href={`${API_CONFIG.CLOUD_PLAN_MANAGER_URL}/pricing`}>
            Purchase a plan
          </a>
        </p>
      </div>
    </div>
  );
}
```

## 4. Protected Route Component

```typescript
// dashboard/src/components/ProtectedRoute.tsx

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { API_CONFIG } from '@/lib/api-config';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const token = localStorage.getItem('authToken');

  useEffect(() => {
    const verifyAccess = async () => {
      if (!token) {
        setIsValid(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_CONFIG.ADMIN_API_URL}/api/subscription/status`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          setIsValid(false);
          return;
        }

        const data = await response.json();

        if (!data.hasActiveSubscription) {
          // Redirect to pricing
          window.location.href = `${API_CONFIG.CLOUD_PLAN_MANAGER_URL}/pricing?reason=expired_subscription`;
          setIsValid(false);
          return;
        }

        setIsValid(true);
      } catch (error) {
        console.error('Access verification failed:', error);
        setIsValid(false);
      }
    };

    verifyAccess();
  }, [token]);

  if (isValid === null) {
    return <div className="loader">Verifying access...</div>;
  }

  if (!isValid) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Usage in App.tsx or Router
// <Route
//   path="/dashboard"
//   element={
//     <ProtectedRoute>
//       <DashboardPage />
//     </ProtectedRoute>
//   }
// />
```

## 5. Environment Configuration

Create `.env.local` in your landing website and dashboard:

```bash
# Landing Website (.env.local)
REACT_APP_ADMIN_API_URL=http://localhost:4000
REACT_APP_CLOUD_PLAN_MANAGER_URL=http://localhost:5000
REACT_APP_RAZORPAY_KEY=rzp_test_xxxxxxxxx

# Dashboard (.env.local)
REACT_APP_ADMIN_API_URL=http://localhost:4000
REACT_APP_CLOUD_PLAN_MANAGER_URL=http://localhost:5000
```

## 6. Testing the Flow

### Test Script

```bash
#!/bin/bash
# test-integration.sh

BASE_URL="http://localhost:4000"

echo "1. Testing payment success..."
curl -X POST $BASE_URL/api/subscription/payment-success \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "test_pay_'$(date +%s)'",
    "email": "testuser'$(date +%s)'@example.com",
    "name": "Test User",
    "plan_name": "Professional",
    "amount": 4999,
    "signature": "test_sig"
  }'

echo -e "\n\n2. Testing subscription status..."
# Get token from login first, then test
curl -X GET $BASE_URL/api/subscription/status \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Key Points to Remember

1. **Payment Gateway**: Replace the Razorpay integration with your actual payment provider
2. **Signature Verification**: Always verify the payment signature to prevent fraud
3. **Session Storage**: Used for temporary data like new user credentials
4. **CORS**: Configure CORS properly for cross-origin requests
5. **Tokens**: Store JWT tokens securely (httpOnly cookies recommended)
6. **Error Handling**: Always show clear error messages to users
7. **Redirects**: Use absolute URLs when redirecting between sites

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Add correct API URLs and enable CORS in backend |
| Payment not verified | Check payment gateway API keys |
| User redirected to pricing | Verify subscription check middleware |
| Token invalid | Check token expiration and format |
| Email already exists | Add unique constraint validation |

