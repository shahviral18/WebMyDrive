import { Lock, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlans } from "@/hooks/use-plans";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

const SESSION_KEY = "wmd_subscribe_form";

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

function planToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function loadSaved(planSlug: string) {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.planSlug !== planSlug) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function SubscribePage() {
  const { planSlug } = useParams<{ planSlug: string }>();
  const navigate = useNavigate();
  const { state: navState } = useLocation() as { state: any };
  const { data: plans, isLoading } = usePlans();
  const { isDark, toggleTheme } = useTheme();

  const saved = loadSaved(planSlug ?? "");

  const [billToCompany, setBillToCompany] = useState<boolean>(saved?.billToCompany ?? navState?.billToCompany ?? false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(saved?.billingPeriod ?? navState?.billingPeriod ?? "yearly");
  const [formData, setFormData] = useState(() => saved?.formData ?? navState ?? {
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    recoveryEmail: "",
    whatsapp: "",
    companyName: "",
    gstNumber: "",
    accountantPhone: "",
    accountantEmail: "",
    billing: {
      country: "India",
      state: "Gujarat",
      city: "",
      address: "",
      zipCode: "",
    },
  });

  const [couponInput, setCouponInput] = useState<string>(saved?.couponInput ?? navState?.couponInput ?? "");
  const [couponState, setCouponState] = useState<"idle" | "checking" | "applied" | "invalid">(
    saved?.discountPercent > 0 ? "applied" : "idle"
  );
  const [discountPercent, setDiscountPercent] = useState<number>(saved?.discountPercent ?? 0);
  const [discountLabel, setDiscountLabel] = useState<string>(saved?.discountLabel ?? "");

  const selectedPlan = useMemo(() => {
    if (!plans || plans.length === 0) return null;
    const byId = plans.find(p => String(p.id) === planSlug);
    if (byId) return byId;
    return plans.find(p => planToSlug(p.name) === planSlug) ?? null;
  }, [plans, planSlug]);

  // Calculations
  const baseAmount = useMemo(() => {
    if (!selectedPlan) return 0;
    if (billingPeriod === "monthly") {
      return parseAmount(String(selectedPlan.priceMonthlyINR ?? selectedPlan.monthlyPrice ?? selectedPlan.price ?? 0));
    }
    return parseAmount(String(selectedPlan.priceYearlyINR ?? selectedPlan.yearlyPrice ?? selectedPlan.price ?? 0));
  }, [selectedPlan, billingPeriod]);

  const discountAmount = (baseAmount * discountPercent) / 100;
  const taxableAmount = baseAmount - discountAmount;
  // GST: Gujarat = CGST+SGST 9%+9%, others = IGST 18%
  const isGujarat = formData.billing.state?.toLowerCase() === "gujarat";
  const gstAmount = taxableAmount * 0.18;
  const cgst = isGujarat ? taxableAmount * 0.09 : 0;
  const sgst = isGujarat ? taxableAmount * 0.09 : 0;
  const igst = !isGujarat ? gstAmount : 0;
  const total = taxableAmount + gstAmount;

  function saveToSession(extra: Record<string, any> = {}) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        planSlug,
        formData,
        billToCompany,
        billingPeriod,
        couponInput,
        discountPercent,
        discountLabel,
        ...extra,
      }));
    } catch {}
  }

  const applyCoupon = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!couponInput.trim() || !selectedPlan) return;
    setCouponState("checking");
    try {
      const res = await api.get(`/referral/validate-code?code=${encodeURIComponent(couponInput.trim())}&planId=${selectedPlan.id}`);
      if (res?.valid && res.discountPct > 0) {
        setDiscountPercent(res.discountPct);
        setDiscountLabel(`${res.discountPct}% off`);
        setCouponState("applied");
        saveToSession({ discountPercent: res.discountPct, discountLabel: `${res.discountPct}% off` });
        toast.success(`Coupon applied — ${res.discountPct}% discount!`);
      } else {
        setDiscountPercent(0);
        setDiscountLabel("");
        setCouponState("invalid");
        toast.error("Invalid or expired coupon code");
      }
    } catch {
      setCouponState("invalid");
      toast.error("Could not validate coupon. Please try again.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    if (!formData.firstName || !formData.lastName) {
      toast.error("Please enter your first and last name.");
      return;
    }
    if (!formData.email) {
      toast.error("Please enter your personal email address.");
      return;
    }
    if (!formData.mobile) {
      toast.error("Please enter your mobile number.");
      return;
    }

    const checkoutState = {
      ...formData,
      billToCompany,
      billingPeriod,
      couponInput: couponState === "applied" ? couponInput : "",
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      amount: total,
    };

    saveToSession({ formData, billToCompany, billingPeriod });

    navigate(`/subscribe/${planSlug}/username`, { state: checkoutState });
  };

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
    </div>
  );

  if (!selectedPlan) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
      <div className="text-lg font-semibold text-slate-700">Plan not found</div>
      <a href={`${import.meta.env.BASE_URL}`} className="text-sm text-blue-500 hover:underline">Back to home</a>
    </div>
  );

  return (
    <div className={cn("min-h-screen bg-[#f8fbff] pb-20 font-sans", isDark && "bg-slate-950")}>
      <div className="fixed top-4 right-4 z-50">
        <ThemeSwitch checked={isDark} onCheckedChange={toggleTheme} size={12} />
      </div>

      <div className="max-w-3xl mx-auto pt-12 px-4">

        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="bg-[#4a90e2] text-white px-6 py-3 flex items-center justify-between">
            <span className="font-semibold text-lg">Order Summary</span>
            {/* Billing period toggle */}
            <div className="flex items-center gap-1 bg-white/20 rounded-full p-1">
              <button
                type="button"
                onClick={() => setBillingPeriod("monthly")}
                className={cn(
                  "text-xs font-semibold px-3 py-1 rounded-full transition-colors",
                  billingPeriod === "monthly" ? "bg-white text-[#4a90e2]" : "text-white/80 hover:text-white"
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod("yearly")}
                className={cn(
                  "text-xs font-semibold px-3 py-1 rounded-full transition-colors",
                  billingPeriod === "yearly" ? "bg-white text-[#4a90e2]" : "text-white/80 hover:text-white"
                )}
              >
                Yearly
              </button>
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-sm">
                <th className="px-6 py-4 font-normal">Item</th>
                <th className="px-6 py-4 font-normal text-center">Qty</th>
                <th className="px-6 py-4 font-normal text-right">Price</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 font-medium">
              <tr className="border-b border-slate-50">
                <td className="px-6 py-6 italic">{selectedPlan.name} ({billingPeriod})</td>
                <td className="px-6 py-6 text-center">1</td>
                <td className="px-6 py-6 text-right">{formatMoney(baseAmount)}</td>
              </tr>
              {discountPercent > 0 && (
                <tr className="border-b border-slate-50 text-emerald-600 font-normal">
                  <td colSpan={2} className="px-6 py-3">Discount ({discountLabel})</td>
                  <td className="px-6 py-3 text-right">-{formatMoney(discountAmount)}</td>
                </tr>
              )}
              {isGujarat ? (
                <>
                  <tr className="border-b border-slate-50 text-slate-600 font-normal">
                    <td colSpan={2} className="px-6 py-3">CGST (9%)</td>
                    <td className="px-6 py-3 text-right">{formatMoney(cgst)}</td>
                  </tr>
                  <tr className="border-b border-slate-50 text-slate-600 font-normal">
                    <td colSpan={2} className="px-6 py-3">SGST (9%)</td>
                    <td className="px-6 py-3 text-right">{formatMoney(sgst)}</td>
                  </tr>
                </>
              ) : (
                <tr className="border-b border-slate-50 text-slate-600 font-normal">
                  <td colSpan={2} className="px-6 py-3">IGST (18%)</td>
                  <td className="px-6 py-3 text-right">{formatMoney(igst)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="px-6 py-4 border-b border-dashed border-slate-200">
                  <div className="flex items-center gap-2 max-w-xs">
                    <div className="relative flex-1">
                      <Input
                        placeholder="Voucher / Coupon Code"
                        value={couponInput}
                        onChange={e => { setCouponInput(e.target.value); if (couponState !== "idle") setCouponState("idle"); }}
                        className={cn(
                          "h-10 rounded pr-8",
                          couponState === "applied" && "border-emerald-400 focus-visible:ring-emerald-400",
                          couponState === "invalid" && "border-red-400 focus-visible:ring-red-400",
                        )}
                      />
                      {couponState === "applied" && <CheckCircle2 className="absolute right-2 top-2.5 w-4 h-4 text-emerald-500" />}
                      {couponState === "invalid" && <XCircle className="absolute right-2 top-2.5 w-4 h-4 text-red-400" />}
                    </div>
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={couponState === "checking" || !couponInput.trim()}
                      className="text-blue-500 hover:text-blue-600 text-sm font-semibold transition-colors disabled:opacity-40"
                    >
                      {couponState === "checking" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                    </button>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Account Information */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Account Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                placeholder="First Name"
                value={formData.firstName}
                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                className="h-11 border-slate-200 rounded"
                required
              />
              <Input
                placeholder="Last Name"
                value={formData.lastName}
                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                className="h-11 border-slate-200 rounded"
                required
              />
              <Input
                type="email"
                placeholder="Personal Email (invoices will be sent here)"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="h-11 border-slate-200 rounded"
                required
              />
              <div className="flex gap-2">
                <div className="w-24 shrink-0">
                  <select className="flex h-11 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>+91</option>
                  </select>
                </div>
                <Input
                  placeholder="Mobile Number"
                  value={formData.mobile}
                  onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                  className="h-11 border-slate-200 rounded w-full"
                  required
                />
              </div>
              <Input
                type="email"
                placeholder="Recovery Email (optional)"
                value={formData.recoveryEmail}
                onChange={e => setFormData({ ...formData, recoveryEmail: e.target.value })}
                className="h-11 border-slate-200 rounded"
              />
              <div className="flex gap-2">
                <div className="w-24 shrink-0">
                  <select className="flex h-11 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>+91</option>
                  </select>
                </div>
                <Input
                  placeholder="WhatsApp No. (optional)"
                  value={formData.whatsapp}
                  onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                  className="h-11 border-slate-200 rounded w-full"
                />
              </div>
            </div>
          </div>

          {/* Billing Address */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">Billing Address</h2>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-sm text-slate-500">Bill to Company?</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={billToCompany}
                  onClick={() => setBillToCompany(v => !v)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    billToCompany ? "bg-blue-500" : "bg-slate-200"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    billToCompany ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </label>
            </div>

            <div className="space-y-6">
              {billToCompany && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      placeholder="Company Name"
                      value={formData.companyName}
                      onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                      className="h-11 border-slate-200 rounded"
                    />
                    <Input
                      placeholder="GST Number"
                      value={formData.gstNumber}
                      onChange={e => setFormData({ ...formData, gstNumber: e.target.value })}
                      className="h-11 border-slate-200 rounded"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex gap-2">
                      <div className="w-24 shrink-0">
                        <select className="flex h-11 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option>+91</option>
                        </select>
                      </div>
                      <Input
                        placeholder="Accountant Phone"
                        value={formData.accountantPhone}
                        onChange={e => setFormData({ ...formData, accountantPhone: e.target.value })}
                        className="h-11 border-slate-200 rounded w-full"
                      />
                    </div>
                    <Input
                      type="email"
                      placeholder="Accountant Email"
                      value={formData.accountantEmail}
                      onChange={e => setFormData({ ...formData, accountantEmail: e.target.value })}
                      className="h-11 border-slate-200 rounded"
                    />
                  </div>
                </>
              )}

              {!billToCompany && (
                <p className="text-sm text-slate-400 italic">
                  Billing to: {formData.firstName || "First Name"} {formData.lastName || "Last Name"}
                </p>
              )}

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
                  <option>Karnataka</option>
                  <option>Tamil Nadu</option>
                  <option>Telangana</option>
                  <option>Uttar Pradesh</option>
                  <option>Rajasthan</option>
                  <option>West Bengal</option>
                  <option>Others</option>
                </select>
                <Input
                  placeholder="City"
                  value={formData.billing.city}
                  onChange={e => setFormData({ ...formData, billing: { ...formData.billing, city: e.target.value } })}
                  className="h-11 border-slate-200 rounded"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  placeholder="Address"
                  value={formData.billing.address}
                  onChange={e => setFormData({ ...formData, billing: { ...formData.billing, address: e.target.value } })}
                  className="h-11 border-slate-200 rounded"
                />
                <Input
                  placeholder="ZIP Code"
                  value={formData.billing.zipCode}
                  onChange={e => setFormData({ ...formData, billing: { ...formData.billing, zipCode: e.target.value } })}
                  className="h-11 border-slate-200 rounded"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex flex-col items-center gap-6">
            <Button
              type="submit"
              className="w-full md:w-64 h-12 bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg rounded-md shadow-md shadow-blue-500/10 transition-all hover:scale-[1.02]"
            >
              Select Username →
            </Button>
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <div className="flex items-center gap-2 text-xs">
                <Lock className="w-3 h-3" />
                <span>Secured by Zoho Payments • Zoho Billing System</span>
              </div>
              <p className="text-[10px] italic">Powered by WebMyDrive Platform</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
