import { ArrowLeft, Lock, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlans } from "@/hooks/use-plans";
import { API_CONFIG } from "@/lib/api-config";
import { useUser } from "@/contexts/UserContext";
import { getApiUrl } from "@/lib/api";

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

export default function Subscribe() {
  const { planId } = useParams<{ planId: string }>();
  const themeColors = [
    {
      button: "from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400",
      headerBg: "from-cyan-500 to-blue-500",
      pageBg: "from-cyan-950 via-cyan-900 to-cyan-950",
    },
    {
      button: "from-fuchsia-500 to-purple-500 hover:from-fuchsia-400 hover:to-purple-400",
      headerBg: "from-fuchsia-500 to-purple-500",
      pageBg: "from-fuchsia-950 via-fuchsia-900 to-fuchsia-950",
    },
    {
      button: "from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400",
      headerBg: "from-orange-500 to-amber-500",
      pageBg: "from-orange-950 via-orange-900 to-orange-950",
    },
    {
      button: "from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400",
      headerBg: "from-emerald-500 to-teal-500",
      pageBg: "from-emerald-950 via-emerald-900 to-emerald-950",
    },
  ];

  const navigate = useNavigate();
  const { data: plans, isLoading, error } = usePlans();
  const { user } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState("");

  const selectedPlan = useMemo(
    () => plans?.find((plan) => plan.id === planId),
    [plans, planId],
  );

  const theme = useMemo(() => {
    if (!plans || !planId) return themeColors[0];
    const index = plans.findIndex((p) => p.id === planId);
    return themeColors[index % themeColors.length];
  }, [plans, planId]);

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-gradient-to-b ${theme.pageBg}`}>
        <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-14 w-96" />
          <Skeleton className="h-[420px] w-full rounded-3xl" />
          <Skeleton className="h-[460px] w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !selectedPlan) {
    return (
      <div className={`min-h-screen bg-gradient-to-b ${theme.pageBg} flex items-center justify-center px-4`}>
        <div className="max-w-xl w-full rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl p-8 text-center">
          <h1 className="text-3xl font-display font-bold text-white mb-3">Plan not found</h1>
          <p className="text-slate-300 mb-8">
            The selected subscription plan could not be loaded right now.
          </p>
          <Button onClick={() => navigate("/pricing")} className="w-full">
            Back to pricing
          </Button>
        </div>
      </div>
    );
  }

  const [couponInput, setCouponInput] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountError, setDiscountError] = useState("");

  const baseAmount = parseAmount(selectedPlan.price);

  const applyCoupon = () => {
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

  const handleProceedToPay = async () => {
    try {
      setIsProcessing(true);
      setProcessingError("");

      if (!user) {
        setProcessingError("Please log in to continue");
        return;
      }

      // Create checkout session
      const response = await fetch(getApiUrl("/referral/create-checkout"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          promoCode: couponInput,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setProcessingError(error.message || "Failed to create checkout session");
        return;
      }

      const data = await response.json();

      // Store order info temporarily before redirect
      const orderInfo = {
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        planPrice: formatMoney(parseAmount(selectedPlan.price)),
        amount: formatMoney((parseAmount(selectedPlan.price) * 1.18)), // Include taxes
        couponApplied: discountPercent > 0,
        checkoutSessionId: data.sessionId,
        userId: user.id,
      };

      sessionStorage.setItem("pendingOrder", JSON.stringify(orderInfo));

      // Redirect to Cloud-Plan-Manager login page
      const redirectUrl = new URL(`${API_CONFIG.CLOUD_PLAN_MANAGER_URL}/login`);
      redirectUrl.searchParams.append("from", "admin-console");
      redirectUrl.searchParams.append("planId", selectedPlan.id);
      redirectUrl.searchParams.append("planName", selectedPlan.name);

      window.location.href = redirectUrl.toString();
    } catch (err) {
      console.error("Error processing payment:", err);
      setProcessingError("An error occurred. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const discountAmount = (baseAmount * discountPercent) / 100;
  const discountedSubtotal = baseAmount - discountAmount;
  const cgst = discountedSubtotal * 0.09;
  const sgst = discountedSubtotal * 0.09;
  const total = discountedSubtotal + cgst + sgst;
  const monthlyAmount = Math.round((baseAmount / 12) / 10) * 10;

  return (
    <div className={`min-h-screen bg-gradient-to-b ${theme.pageBg} text-white`}>
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
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
            Subscribe to {selectedPlan.name}
          </h1>
          <p className="text-slate-300 text-lg">
            {formatMoney(monthlyAmount)} per month, billed annually.
          </p>
        </div>

        <div className="rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl overflow-hidden mb-6">
          <div className={`bg-gradient-to-r ${theme.headerBg} px-6 py-4`}>
            <h2 className="text-2xl font-display font-bold text-slate-950">Order Summary</h2>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 text-slate-300 text-sm uppercase tracking-wider mb-4">
              <p>Item</p>
              <p>Quantity</p>
              <p className="text-right">Price</p>
            </div>

            <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center py-5 border-t border-white/10">
              <p className="text-lg font-medium">Cloud Storage - {getPlanShortName(selectedPlan.name)}</p>
              <p className="text-lg">1</p>
              <p className="text-right text-lg">{formatMoney(baseAmount)}</p>
            </div>

            {discountPercent > 0 && (
              <div className="grid grid-cols-[1fr_auto] gap-4 items-center py-5 border-t border-white/10 text-emerald-400">
                <p className="text-lg">Discount ({discountPercent}%)</p>
                <p className="text-right text-lg">- {formatMoney(discountAmount)}</p>
              </div>
            )}

            <div className="grid grid-cols-[1fr_auto] gap-4 items-center py-5 border-t border-white/10">
              <p className="text-lg">Subtotal</p>
              <p className="text-right text-lg">{formatMoney(discountedSubtotal)}</p>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-4 items-center py-3 border-t border-white/10">
              <p className="text-slate-300">CGST (9%)</p>
              <p>{formatMoney(cgst)}</p>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-4 items-center py-3">
              <p className="text-slate-300">SGST (9%)</p>
              <p>{formatMoney(sgst)}</p>
            </div>

            <div className="py-5 border-t border-dashed border-white/20">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                <Input
                  placeholder="Coupon Code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="h-12 bg-slate-900/60 border-white/15 text-white placeholder:text-slate-400"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyCoupon}
                  className="h-12 text-white border-white/20"
                >
                  Apply
                </Button>
              </div>
              {discountError && (
                <p className="text-red-400 text-sm mt-2">{discountError}</p>
              )}
              {discountPercent > 0 && (
                <p className="text-emerald-400 text-sm mt-2">Coupon applied successfully! ({discountPercent}% OFF)</p>
              )}
            </div>

            <div className="py-5 border-t border-dashed border-white/20">
              <Input
                placeholder="GST Identification Number"
                className="h-12 bg-slate-900/60 border-white/15 text-white placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-white/10">
              <p className="text-2xl font-display font-bold">Total</p>
              <p className="text-3xl font-display font-bold text-cyan-300">{formatMoney(total)}</p>
            </div>
          </div>
        </div>

        <form className="rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl p-6 md:p-8">
          <h3 className="text-2xl font-display font-bold mb-6">Account Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-slate-300">First Name</Label>
              <Input id="firstName" placeholder="First Name" className="h-12 bg-slate-900/60 border-white/15 text-white placeholder:text-slate-400" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-slate-300">Last Name</Label>
              <Input id="lastName" placeholder="Last Name" className="h-12 bg-slate-900/60 border-white/15 text-white placeholder:text-slate-400" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email Address</Label>
              <Input id="email" placeholder="Email Address" type="email" className="h-12 bg-slate-900/60 border-white/15 text-white placeholder:text-slate-400" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company" className="text-slate-300">Company Name</Label>
              <Input id="company" placeholder="Company Name" className="h-12 bg-slate-900/60 border-white/15 text-white placeholder:text-slate-400" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="mobile" className="text-slate-300">Mobile Number</Label>
              <Input id="mobile" placeholder="+91 Mobile Number" className="h-12 bg-slate-900/60 border-white/15 text-white placeholder:text-slate-400" />
            </div>
          </div>

          <h4 className="text-xl font-display font-semibold mb-4">Billing Address</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="country" className="text-slate-300">Country</Label>
              <Input id="country" placeholder="India" className="h-12 bg-slate-900/60 border-white/15 text-white placeholder:text-slate-400" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state" className="text-slate-300">State</Label>
              <Input id="state" placeholder="State" className="h-12 bg-slate-900/60 border-white/15 text-white placeholder:text-slate-400" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city" className="text-slate-300">City</Label>
              <Input id="city" placeholder="City" className="h-12 bg-slate-900/60 border-white/15 text-white placeholder:text-slate-400" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address" className="text-slate-300">Address</Label>
              <Input id="address" placeholder="Address" className="h-12 bg-slate-900/60 border-white/15 text-white placeholder:text-slate-400" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode" className="text-slate-300">ZIP Code</Label>
              <Input id="zipCode" placeholder="ZIP Code" className="h-12 bg-slate-900/60 border-white/15 text-white placeholder:text-slate-400" />
            </div>
          </div>

          <p className="text-slate-300 mb-6">
            Storage selected: <span className="text-cyan-300 font-semibold">{getStorageValue(selectedPlan.storage)}</span>
          </p>

          {processingError && (
            <div className="mb-4 p-4 rounded-lg bg-red-950/50 border border-red-900 text-red-300">
              {processingError}
            </div>
          )}

          <Button
            type="button"
            onClick={handleProceedToPay}
            disabled={isProcessing || !user}
            className={`w-full h-12 text-base font-semibold bg-gradient-to-r ${theme.button} text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Proceed to Pay"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-slate-300 flex items-center justify-center gap-2">
          <Lock className="h-4 w-4" />
          Secured checkout flow
        </p>
      </div>
    </div>
  );
}
