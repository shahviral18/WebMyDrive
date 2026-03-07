import { ArrowLeft, Lock, Mail, Check, CreditCard, ShoppingCart, Truck, MapPin, Loader2 } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlans } from "@/hooks/use-plans";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

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

/** Convert a plan name into a URL-friendly slug */
function planToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function SubscribePage() {
  const { planSlug } = useParams<{ planSlug: string }>();
  const navigate = useNavigate();
  const { data: plans, isLoading } = usePlans();
  const { isDark, toggleTheme } = useTheme();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    companyName: "",
    mobile: "",
    gstNumber: "",
    billing: {
      country: "India",
      state: "Gujarat",
      city: "",
      address: "",
      zipCode: "",
    },
    shipping: {
      country: "India",
      state: "Gujarat",
      city: "",
      address: "",
      zipCode: "",
    },
    sameAsBilling: true
  });

  const [couponInput, setCouponInput] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const selectedPlan = useMemo(() => {
    if (!plans) return null;
    // Try to find by ID first (most reliable), then fallback to slug matching
    const byId = plans.find(p => String(p.id) === planSlug);
    if (byId) return byId;
    return plans.find(p => planToSlug(p.name) === planSlug);
  }, [plans, planSlug]);

  const applyCoupon = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!couponInput || !selectedPlan) return;
    if (selectedPlan.coupon && couponInput.trim().toLowerCase() === selectedPlan.coupon.toLowerCase()) {
      setDiscountPercent(parseInt(selectedPlan.discount || "5"));
      toast.success("Coupon applied successfully!");
    } else {
      setDiscountPercent(0);
      toast.error("Invalid coupon code");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    setIsProcessing(true);

    try {
      // Create checkout session
      const sessionData = await api.post("/referral/create-checkout", {
        planId: selectedPlan.id,
        promoCode: couponInput || undefined,
        billingPeriod: "monthly",
        customerEmail: formData.email,
        customerName: `${formData.firstName} ${formData.lastName}`,
        customerPhone: formData.mobile,
        billingAddress: {
          country: formData.billing.country,
          state: formData.billing.state,
          city: formData.billing.city,
          address: formData.billing.address,
          zipCode: formData.billing.zipCode,
        },
        shippingAddress: formData.sameAsBilling ? undefined : {
          country: formData.shipping.country,
          state: formData.shipping.state,
          city: formData.shipping.city,
          address: formData.shipping.address,
          zipCode: formData.shipping.zipCode,
        },
      });

      if (!sessionData.success) {
        toast.error(sessionData.error || "Failed to create checkout session");
        setIsProcessing(false);
        return;
      }

      // Load Razorpay script and open payment gateway
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => {
        const rzp = new (window as any).Razorpay({
          key: sessionData.razorpayKeyId,
          amount: sessionData.amount * 100,
          currency: "INR",
          name: "WebMyDrive",
          description: selectedPlan.name,
          order_id: sessionData.rzpOrderId,
          theme: { color: "#1fb6ff" },
          handler: async function (response: any) {
            try {
              toast.loading("Verifying payment…", { id: "pay-verify" });
              const verifyData = await api.post("/referral/verify-payment", {
                orderId: sessionData.orderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.dismiss("pay-verify");
              if (verifyData.success) {
                toast.success(`🎉 Payment successful!`);
                setShowSuccess(true);
              } else {
                toast.error(verifyData.error || "Payment verification failed");
              }
            } catch (err: any) {
              toast.error(err.message || "Payment verification failed");
            } finally {
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
            }
          }
        });
        rzp.open();
      };
      document.body.appendChild(script);
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
      setIsProcessing(false);
    }
  };

  // Calculations
  const baseAmount = selectedPlan ? (selectedPlan.monthlyPrice || parseAmount(selectedPlan.price)) : 0;
  const discountAmount = (baseAmount * discountPercent) / 100;
  const taxableAmount = baseAmount - discountAmount;
  const cgst = taxableAmount * 0.09;
  const sgst = taxableAmount * 0.09;
  const total = taxableAmount + cgst + sgst;

  if (isLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;
  if (!selectedPlan) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Plan not found</div>;

  return (
    <div className={cn("min-h-screen bg-[#f8fbff] pb-20 font-sans", isDark && "bg-slate-950")}>
      {/* Theme Toggle Overlay */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeSwitch checked={isDark} onCheckedChange={toggleTheme} size={12} />
      </div>

      <div className="max-w-3xl mx-auto pt-12 px-4">
        {/* Order Summary Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="bg-[#4a90e2] text-white px-6 py-3 font-semibold text-lg">
            Order Summary
          </div>
          <div className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-sm">
                  <th className="px-6 py-4 font-normal">Item</th>
                  <th className="px-6 py-4 font-normal text-center">Quantity</th>
                  <th className="px-6 py-4 font-normal text-right">Price</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 font-medium">
                <tr className="border-b border-slate-50">
                  <td className="px-6 py-6 italic">{selectedPlan.name}</td>
                  <td className="px-6 py-6 text-center">1</td>
                  <td className="px-6 py-6 text-right">{formatMoney(baseAmount)}</td>
                </tr>
                <tr className="border-b border-slate-50 text-slate-600 font-normal">
                  <td colSpan={2} className="px-6 py-4">Subtotal</td>
                  <td className="px-6 py-4 text-right">{formatMoney(baseAmount)}</td>
                </tr>
                {discountPercent > 0 && (
                  <tr className="border-b border-slate-50 text-emerald-600 font-normal">
                    <td colSpan={2} className="px-6 py-4">Discount ({discountPercent}%)</td>
                    <td className="px-6 py-4 text-right">-{formatMoney(discountAmount)}</td>
                  </tr>
                )}
                <tr className="border-b border-slate-50 text-slate-600 font-normal">
                  <td colSpan={2} className="px-6 py-4">CGST9 (9%)</td>
                  <td className="px-6 py-4 text-right">{formatMoney(cgst)}</td>
                </tr>
                <tr className="border-b border-slate-50 text-slate-600 font-normal">
                  <td colSpan={2} className="px-6 py-4">SGST9 (9%)</td>
                  <td className="px-6 py-4 text-right">{formatMoney(sgst)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="px-6 py-4 border-b border-dashed border-slate-200">
                    <div className="flex items-center gap-2 max-w-xs">
                      <Input
                        placeholder="Coupon Code"
                        value={couponInput}
                        onChange={e => setCouponInput(e.target.value)}
                        className="h-10 border-slate-200 focus-visible:ring-blue-500 rounded"
                      />
                      <button
                        onClick={applyCoupon}
                        className="text-blue-500 hover:text-blue-600 text-sm font-semibold transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-6 py-4 border-b border-dashed border-slate-200">
                    <div className="max-w-xs">
                      <Input
                        placeholder="GST Identification Number"
                        value={formData.gstNumber}
                        onChange={e => setFormData({ ...formData, gstNumber: e.target.value })}
                        className="h-10 border-slate-200 focus-visible:ring-blue-500 rounded"
                      />
                    </div>
                  </td>
                </tr>
                <tr className="bg-slate-50/30">
                  <td colSpan={2} className="px-6 py-6 text-[#4a90e2] font-bold text-lg">Total</td>
                  <td className="px-6 py-6 text-[#4a90e2] font-bold text-lg text-right">{formatMoney(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Form Sections */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Account Information */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
            <h2 className="text-lg font-bold text-slate-800 mb-6 font-sans">Account Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Input
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  className="h-11 border-slate-200 rounded"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Input
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  className="h-11 border-slate-200 rounded"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Input
                  type="email"
                  placeholder="Email Address*"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="h-11 border-slate-200 rounded"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Input
                  placeholder="Company Name"
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                  className="h-11 border-slate-200 rounded"
                />
              </div>
              <div className="md:col-span-2">
                <div className="flex gap-2">
                  <div className="w-24 shrink-0">
                    <select className="flex h-11 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>+91</option>
                    </select>
                  </div>
                  <Input
                    placeholder="Mobile*"
                    value={formData.mobile}
                    onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                    className="h-11 border-slate-200 rounded w-full"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Billing Address */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Billing Address</h2>
            <div className="space-y-6">
              <select
                className="flex h-11 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.billing.country}
                onChange={e => setFormData({ ...formData, billing: { ...formData.billing, country: e.target.value } })}
              >
                <option>India</option>
                <option>United States</option>
                <option>Others</option>
              </select>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <select
                  className="flex h-11 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.billing.state}
                  onChange={e => setFormData({ ...formData, billing: { ...formData.billing, state: e.target.value } })}
                >
                  <option>Gujarat</option>
                  <option>Maharashtra</option>
                  <option>Delhi</option>
                  <option>Others</option>
                </select>
                <Input
                  placeholder="City*"
                  value={formData.billing.city}
                  onChange={e => setFormData({ ...formData, billing: { ...formData.billing, city: e.target.value } })}
                  className="h-11 border-slate-200 rounded"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  placeholder="Address*"
                  value={formData.billing.address}
                  onChange={e => setFormData({ ...formData, billing: { ...formData.billing, address: e.target.value } })}
                  className="h-11 border-slate-200 rounded"
                  required
                />
                <Input
                  placeholder="ZIP Code*"
                  value={formData.billing.zipCode}
                  onChange={e => setFormData({ ...formData, billing: { ...formData.billing, zipCode: e.target.value } })}
                  className="h-11 border-slate-200 rounded"
                  required
                />
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">Shipping Address</h2>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, sameAsBilling: !formData.sameAsBilling })}
                className="text-blue-500 text-sm hover:underline"
              >
                {formData.sameAsBilling ? "Edit Shipping Address" : "Use Billing Address"}
              </button>
            </div>

            <AnimatePresence>
              {!formData.sameAsBilling && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-6"
                >
                  <select
                    className="flex h-11 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.shipping.country}
                    onChange={e => setFormData({ ...formData, shipping: { ...formData.shipping, country: e.target.value } })}
                  >
                    <option>India</option>
                  </select>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <select
                      className="flex h-11 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.shipping.state}
                      onChange={e => setFormData({ ...formData, shipping: { ...formData.shipping, state: e.target.value } })}
                    >
                      <option>Gujarat</option>
                    </select>
                    <Input placeholder="City" className="h-11 border-slate-200 rounded" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input placeholder="Address" className="h-11 border-slate-200 rounded" />
                    <Input placeholder="ZIP Code" className="h-11 border-slate-200 rounded" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {formData.sameAsBilling && (
              <p className="text-slate-400 text-sm">Same as billing address.</p>
            )}
          </div>

          {/* Action Button */}
          <div className="flex flex-col items-center gap-6">
            <Button
              type="submit"
              disabled={isProcessing}
              className="w-full md:w-64 h-12 bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg rounded-md shadow-md shadow-blue-500/10 transition-all hover:scale-[1.02]"
            >
              {isProcessing ? "Processing..." : "Proceed to Pay"}
            </Button>

            <div className="flex flex-col items-center gap-2 text-slate-400">
              <div className="flex items-center gap-2 text-xs">
                <Lock className="w-3 h-3" />
                <span>Secured by Razorpay • Zoho Billing System</span>
              </div>
              <p className="text-[10px] italic">Powered by WebMyDrive Platform</p>
            </div>
          </div>
        </form>
      </div>

      {/* Success Modal Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Almost there!</h3>
              <p className="text-slate-600 mb-8">We are redirecting you to our secure payment gateway to complete the transaction.</p>
              <Button onClick={() => window.location.href = "/admin/dashboard"} className="w-full h-12 bg-[#4a90e2] rounded-lg">
                Continue
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
