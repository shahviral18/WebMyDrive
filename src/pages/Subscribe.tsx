import { ArrowLeft, Lock, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlans } from "@/hooks/use-plans";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { api } from "@/lib/api";
import { toast } from "sonner";

function parseAmount(price: string): number {
  const value = Number(price.replace(/[^\d.]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getPlanShortName(name: string): string {
  return name.replace(/^Cloud Storage\s*[–-]\s*/i, "").trim();
}

function getStorageValue(storage: string): string {
  return storage.replace(/\s*Combined Storage$/i, "").trim();
}

export default function SubscribePage() {
  // ===== ALL HOOKS AT TOP LEVEL FIRST =====
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { data: plans, isLoading } = usePlans();

  // All state hooks declared at top level
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    mobile: "",
    country: "India",
    state: "",
    city: "",
    address: "",
    zipCode: "",
  });

  const [couponInput, setCouponInput] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountError, setDiscountError] = useState("");
  const [formError, setFormError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  // Google authentication state
  const [googleEmail, setGoogleEmail] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState("");

  // ===== NOW CONDITIONAL LOGIC AFTER ALL HOOKS =====
  console.log("=== Subscribe Page Loaded ===");
  console.log("Plan ID:", planId);
  console.log("Plans:", plans);
  console.log("Is Loading:", isLoading);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-2xl font-bold mb-4">Loading plans...</p>
        </div>
      </div>
    );
  }

  // Show error if no plans
  if (!plans || plans.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-center max-w-md">
          <p className="text-2xl font-bold mb-4">❌ No plans loaded</p>
          <p className="text-slate-400 mb-8">Plans data: {JSON.stringify(plans)}</p>
          <button 
            onClick={() => navigate("/")}
            className="bg-blue-600 px-6 py-2 rounded text-white hover:bg-blue-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Show Google auth screen if not authenticated
  if (!googleEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Purchase Plan</h1>
            <p className="text-slate-400">Sign in with Google to continue</p>
          </div>

          <GoogleSignInButton
            label="Continue with Google"
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setAuthError(msg)}
            className="w-full"
          />

          {authError && <p className="text-red-500 text-sm mt-4 text-center">{authError}</p>}
          {isAuthenticating && <p className="text-slate-300 text-sm mt-4 text-center">Setting up your account...</p>}

          <button
            onClick={() => navigate("/pricing")}
            className="w-full mt-4 text-slate-400 hover:text-white text-sm transition-colors"
          >
            Back to plans
          </button>
        </div>
      </div>
    );
  }

  // Find selected plan
  const selectedPlan = plans.find(p => String(p.id) === planId);

  // Show error if plan not found
  if (!selectedPlan) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-center max-w-md">
          <p className="text-2xl font-bold mb-4">❌ Plan not found</p>
          <p className="text-slate-400 mb-2">Looking for Plan ID: <span className="font-mono bg-slate-800 px-2 py-1">{planId}</span></p>
          <p className="text-slate-400 mb-8">Available plans: {plans.map(p => p.id).join(", ")}</p>
          <button 
            onClick={() => navigate("/pricing")}
            className="bg-blue-600 px-6 py-2 rounded text-white hover:bg-blue-700"
          >
            Back to Pricing
          </button>
        </div>
      </div>
    );
  }

  // ===== CALCULATE AMOUNTS =====
  const monthlyAmount = selectedPlan.monthlyPrice || parseAmount(selectedPlan.price);
  const yearlyAmount = selectedPlan.yearlyPrice || monthlyAmount * 12;
  const baseAmount = billingPeriod === "monthly" ? monthlyAmount : yearlyAmount;
  const discountAmount = (baseAmount * discountPercent) / 100;
  const discountedSubtotal = baseAmount - discountAmount;
  const cgst = Math.round(discountedSubtotal * 0.09 * 100) / 100;
  const sgst = Math.round(discountedSubtotal * 0.09 * 100) / 100;
  const total = discountedSubtotal + cgst + sgst;

  // ===== EVENT HANDLERS =====
  const handleGoogleSuccess = async (response: { token: string; user: any }) => {
    setAuthError("");
    setIsAuthenticating(true);
    try {
      const gEmail = response.user.email || "";
      setGoogleEmail(gEmail);
      
      // Pre-fill form with Google email
      setFormData((prev) => ({ ...prev, email: gEmail }));
      
      // Try to auto-login if account exists
      try {
        await api.post("/auth/google-login", {
          googleEmail: gEmail,
          name: response.user.name || gEmail.split("@")[0],
          idToken: response.token,
        });
        toast.success("Logged in successfully!");
      } catch (err: any) {
        // Account doesn't exist - that's fine, we'll create it during checkout
        toast.info("Ready to checkout!");
      }
    } catch (err: any) {
      console.error("Google auth error:", err);
      setAuthError(err.message || "Authentication failed");
      toast.error("Authentication failed");
      setGoogleEmail("");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const validateCoupon = (): boolean => {
    if (!couponInput) {
      setDiscountPercent(0);
      setDiscountError("");
      return;
    }

    if (
      selectedPlan.coupon &&
      couponInput.trim().toLowerCase() === selectedPlan.coupon.toLowerCase()
    ) {
      const discountVal = parseInt(selectedPlan.discount || "0");
      setDiscountPercent(discountVal);
      setDiscountError("");
    } else {
      setDiscountPercent(0);
      setDiscountError("Invalid coupon code");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.mobile) {
      setFormError("Please fill in all required fields");
      return false;
    }
    if (!formData.address || !formData.city || !formData.state || !formData.zipCode) {
      setFormError("Please fill in complete billing address");
      return false;
    }
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setFormError("Please enter a valid email address");
      return false;
    }
    return true;
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!validateForm()) {
      return;
    }

    setIsProcessing(true);

    try {
      const fullName = `${formData.firstName} ${formData.lastName}`;
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

      // Step 1: Create checkout session
      const sessionResponse = await fetch(`${apiUrl}/api/checkout/create-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: String(selectedPlan.id),
          planName: selectedPlan.name,
          amount: Math.round(total * 100) / 100,
          customerName: fullName,
          customerEmail: formData.email,
          customerPhone: formData.mobile,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
        }),
      });

      if (!sessionResponse.ok) {
        const errData = await sessionResponse.json();
        throw new Error(errData.error || "Failed to create checkout session");
      }

      const sessionData = await sessionResponse.json();

      if (!sessionData.success) {
        throw new Error(sessionData.message || "Failed to create checkout session");
      }

      // Check if we're in demo mode
      if (sessionData.isDemoMode) {
        console.log("🎬 DEMO MODE - Processing payment directly...");
        
        // In demo mode, simulate payment with demo payment ID
        try {
          const demoPaymentResponse = await fetch(`${apiUrl}/api/checkout/process-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId: sessionData.sessionId,
              paymentId: `demo_pay_${Date.now()}`,
              orderId: sessionData.orderId,
              signature: `demo_sig_${Date.now()}`,
            }),
          });

          if (!demoPaymentResponse.ok) {
            const errData = await demoPaymentResponse.json();
            throw new Error(errData.error || "Payment processing failed");
          }

          const demoPaymentData = await demoPaymentResponse.json();

          if (demoPaymentData.success) {
            alert("✅ Payment successful! You can now login with your credentials.");
            window.location.href = "/login";
          } else {
            throw new Error(demoPaymentData.message || "Payment processing failed");
          }
        } catch (err) {
          setFormError(err instanceof Error ? err.message : "Payment processing failed");
          console.error("Demo payment error:", err);
          setIsProcessing(false);
        }
        return;
      }

      // Step 2: Initialize Razorpay payment (production mode only)
      const razorpayScript = document.createElement("script");
      razorpayScript.src = "https://checkout.razorpay.com/v1/checkout.js";
      razorpayScript.async = true;

      razorpayScript.onload = () => {
        if (!window.Razorpay && !(window as any).Razorpay) {
          setFormError("Payment gateway not available. Please try again.");
          setIsProcessing(false);
          return;
        }

        const options = {
          key: sessionData.razorpayKeyId,
          amount: Math.round(total * 100),
          currency: "INR",
          order_id: sessionData.orderId,
          name: "WebMyDrive",
          description: `Subscription to ${selectedPlan.name}`,
          prefill: {
            name: fullName,
            email: formData.email,
            contact: formData.mobile,
          },
          theme: {
            color: "#0ea5e9",
          },
          handler: async (response: any) => {
            try {
              const paymentResponse = await fetch(`${apiUrl}/api/checkout/process-payment`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  sessionId: sessionData.sessionId,
                  paymentId: response.razorpay_payment_id,
                  orderId: response.razorpay_order_id,
                  signature: response.razorpay_signature,
                }),
              });

              if (!paymentResponse.ok) {
                const errData = await paymentResponse.json();
                throw new Error(errData.error || "Payment processing failed");
              }

              const paymentData = await paymentResponse.json();

              if (paymentData.success) {
                alert("Payment successful! You can now login with your credentials.");
                window.location.href = "/login";
              } else {
                throw new Error(paymentData.message || "Payment processing failed");
              }
            } catch (err) {
              setFormError(err instanceof Error ? err.message : "Payment processing failed");
              console.error("Payment processing error:", err);
            } finally {
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
              setFormError("Payment cancelled");
            },
          },
        };

        try {
          const RazorpayClass = (window as any).Razorpay || window.Razorpay;
          const rzpPayment = new RazorpayClass(options);
          rzpPayment.open();
        } catch (error) {
          console.error("Razorpay initialization error:", error);
          setFormError("Could not open payment modal. Please try again.");
          setIsProcessing(false);
        }
      };

      razorpayScript.onerror = () => {
        setFormError("Failed to load payment gateway. Please try again.");
        setIsProcessing(false);
      };

      document.body.appendChild(razorpayScript);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "An error occurred");
      console.error("Payment error:", err);
      setIsProcessing(false);
    }
  };

  // Success - plan found, render checkout form
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <button
          type="button"
          onClick={() => navigate("/pricing")}
          className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to plans
        </button>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Subscribe to {selectedPlan.name}
          </h1>
          <div className="flex flex-col gap-4">
            <p className="text-slate-300 text-lg">
              {formatMoney(billingPeriod === "monthly" ? monthlyAmount : Math.round(yearlyAmount / 12))} per month{billingPeriod === "yearly" ? ", billed annually" : ""}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  billingPeriod === "monthly"
                    ? "bg-cyan-500 text-white shadow-lg"
                    : "bg-white/10 text-slate-300 hover:bg-white/20"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod("yearly")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  billingPeriod === "yearly"
                    ? "bg-cyan-500 text-white shadow-lg"
                    : "bg-white/10 text-slate-300 hover:bg-white/20"
                }`}
              >
                Yearly
              </button>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-4">
            <h2 className="text-2xl font-bold text-slate-950">Order Summary</h2>
          </div>

          <div className="p-6 md:p-8 space-y-4">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 text-slate-300 text-sm uppercase tracking-wider pb-4 border-b border-white/10">
              <p>Item</p>
              <p>Qty</p>
              <p className="text-right">Price</p>
            </div>

            <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center py-3">
              <p className="text-lg font-medium">{selectedPlan.name} ({billingPeriod === "monthly" ? "Monthly" : "Annual"})</p>
              <p>1</p>
              <p className="text-right text-lg">{formatMoney(baseAmount)}</p>
            </div>

            {discountPercent > 0 && (
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center py-3 text-emerald-400">
                <p className="text-lg">Discount ({discountPercent}%)</p>
                <p></p>
                <p className="text-right text-lg">- {formatMoney(discountAmount)}</p>
              </div>
            )}

            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="grid grid-cols-[1fr_auto] gap-4">
                <p>Subtotal</p>
                <p>{formatMoney(discountedSubtotal)}</p>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-4">
                <p className="text-slate-300">CGST (9%)</p>
                <p>{formatMoney(cgst)}</p>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-4">
                <p className="text-slate-300">SGST (9%)</p>
                <p>{formatMoney(sgst)}</p>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-4 pt-4 border-t border-white/10 text-xl font-bold">
                <p>Total</p>
                <p className="text-cyan-300">{formatMoney(total)}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                <Input
                  placeholder="Coupon Code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="h-11 bg-slate-800/60 border-white/15 text-white placeholder:text-slate-400"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyCoupon}
                  className="h-11 text-white border-white/20"
                >
                  Apply
                </Button>
              </div>
              {discountError && <p className="text-red-400 text-sm">{discountError}</p>}
              {discountPercent > 0 && <p className="text-emerald-400 text-sm">Coupon applied! ({discountPercent}% OFF)</p>}
            </div>
          </div>
        </div>

        {/* Checkout Form */}
        <form onSubmit={handlePayment} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg p-6 md:p-8 space-y-6">
          <h3 className="text-2xl font-bold">Account Information</h3>

          {formError && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm">{formError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-slate-300">First Name *</Label>
              <Input
                id="firstName"
                name="firstName"
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleInputChange}
                className="h-11 bg-slate-800/60 border-white/15 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-slate-300">Last Name *</Label>
              <Input
                id="lastName"
                name="lastName"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleInputChange}
                className="h-11 bg-slate-800/60 border-white/15 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email *</Label>
              <Input
                id="email"
                name="email"
                placeholder="email@example.com"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                className="h-11 bg-slate-800/60 border-white/15 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile" className="text-slate-300">Mobile *</Label>
              <Input
                id="mobile"
                name="mobile"
                placeholder="+91 9876543210"
                value={formData.mobile}
                onChange={handleInputChange}
                className="h-11 bg-slate-800/60 border-white/15 text-white placeholder:text-slate-500"
                required
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <h4 className="text-xl font-bold mb-4">Billing Address</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address" className="text-slate-300">Address *</Label>
                <Input
                  id="address"
                  name="address"
                  placeholder="Street Address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="h-11 bg-slate-800/60 border-white/15 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city" className="text-slate-300">City *</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="City"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="h-11 bg-slate-800/60 border-white/15 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state" className="text-slate-300">State *</Label>
                <Input
                  id="state"
                  name="state"
                  placeholder="State"
                  value={formData.state}
                  onChange={handleInputChange}
                  className="h-11 bg-slate-800/60 border-white/15 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode" className="text-slate-300">ZIP Code *</Label>
                <Input
                  id="zipCode"
                  name="zipCode"
                  placeholder="PIN Code"
                  value={formData.zipCode}
                  onChange={handleInputChange}
                  className="h-11 bg-slate-800/60 border-white/15 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="company" className="text-slate-300">Company (Optional)</Label>
                <Input
                  id="company"
                  name="company"
                  placeholder="Company Name"
                  value={formData.company}
                  onChange={handleInputChange}
                  className="h-11 bg-slate-800/60 border-white/15 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isProcessing}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? "Processing..." : `Pay ${formatMoney(total)}`}
          </Button>

          <p className="text-center text-slate-400 flex items-center justify-center gap-2">
            <Lock className="h-4 w-4" />
            Secured by Razorpay
          </p>
        </form>
      </div>
    </div>
  );
}
