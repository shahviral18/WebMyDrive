import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, X, Tag, CheckCircle2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plan } from "@/hooks/use-plans";
import { api } from "@/lib/api";

interface CheckoutSheetProps {
  open: boolean;
  onClose: () => void;
  plan: Plan | null;
  billingPeriod: "monthly" | "yearly";
  onBillingPeriodChange: (p: "monthly" | "yearly") => void;
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

export function CheckoutSheet({
  open,
  onClose,
  plan,
  billingPeriod,
  onBillingPeriodChange,
}: CheckoutSheetProps) {
  const navigate = useNavigate();

  const [billToCompany, setBillToCompany] = useState(false);
  const [formData, setFormData] = useState({
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
    billing: { country: "India", state: "Gujarat", city: "", address: "", zipCode: "" },
  });
  const [couponInput, setCouponInput] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Reset form when plan changes
  const planKey = plan?.id;
  useMemo(() => {
    if (planKey) {
      setBillToCompany(false);
      setFormData({
        firstName: "", lastName: "", email: "", mobile: "",
        recoveryEmail: "", whatsapp: "",
        companyName: "", gstNumber: "", accountantPhone: "", accountantEmail: "",
        billing: { country: "India", state: "Gujarat", city: "", address: "", zipCode: "" },
      });
      setCouponInput("");
      setDiscountPercent(0);
      setCouponApplied(false);
    }
  }, [planKey]);

  // Auto-fill referral code from localStorage when sheet opens
  useEffect(() => {
    if (open) {
      const pendingRef = localStorage.getItem("wmd_pending_ref");
      if (pendingRef && !couponInput) {
        setCouponInput(pendingRef);
      }
    }
  }, [open]);

  const baseAmount = useMemo(() => {
    if (!plan) return 0;
    return billingPeriod === "yearly" ? plan.yearlyTotal : plan.monthlyPrice;
  }, [plan, billingPeriod]);

  const discountAmount = (baseAmount * discountPercent) / 100;
  const taxableAmount = baseAmount - discountAmount;
  const cgst = taxableAmount * 0.09;
  const sgst = taxableAmount * 0.09;
  const total = taxableAmount + cgst + sgst;

  const applyCoupon = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!couponInput.trim() || !plan || isApplyingCoupon) return;
    setIsApplyingCoupon(true);
    try {
      const data = await api.post("/referral/validate-code", {
        promoCode: couponInput.trim(),
        planName: plan.name,
      });
      if (data.success) {
        const pct = data.discountPct ?? 0;
        setDiscountPercent(pct);
        setCouponApplied(true);
        if (pct > 0) {
          toast.success(`Code applied — ${pct}% off!`);
        } else {
          toast.success("Referral code applied! Your referrer will earn commission.");
        }
      } else {
        setDiscountPercent(0);
        setCouponApplied(false);
        toast.error(data.error || "Invalid code");
      }
    } catch (err: any) {
      setDiscountPercent(0);
      setCouponApplied(false);
      toast.error(err.message || "Invalid code");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.mobile) {
      toast.error("Please fill in all required fields.");
      return;
    }
    onClose();
    navigate(`/subscribe/${planToSlug(plan.name)}/username`, {
      state: {
        ...formData,
        billToCompany,
        couponInput,
        planId: plan.id,
        planName: plan.name,
        billingPeriod,
        amount: total,
      },
    });
  };

  if (!plan) return null;

  const billingLabel = billingPeriod === "yearly"
    ? `₹${plan.yearlyTotal.toLocaleString("en-IN")} / year`
    : `₹${plan.monthlyPrice.toLocaleString("en-IN")} / month`;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[80vw] sm:max-w-[900px] overflow-y-auto p-0 bg-[#f8fbff]"
      >
        {/* Header */}
        <SheetHeader className="bg-[#4a90e2] text-white px-6 py-4 sticky top-0 z-10 flex flex-row items-center justify-between">
          <SheetTitle className="text-white text-lg font-semibold">
            Order Summary — {plan.name.replace(/^Cloud Storage\s*[–-]\s*/i, "")}
          </SheetTitle>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </SheetHeader>

        <div className="px-6 py-6 space-y-6 max-w-2xl mx-auto">

          {/* Billing toggle */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1 w-fit shadow-sm">
            <button
              type="button"
              onClick={() => onBillingPeriodChange("monthly")}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${billingPeriod === "monthly" ? "bg-[#4a90e2] text-white shadow" : "text-slate-500 hover:text-slate-700"}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => onBillingPeriodChange("yearly")}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${billingPeriod === "yearly" ? "bg-[#4a90e2] text-white shadow" : "text-slate-500 hover:text-slate-700"}`}
            >
              Yearly
              {billingPeriod === "yearly" && plan.discount && (
                <span className="ml-1.5 text-[10px] bg-white/25 px-1.5 py-0.5 rounded-full">{plan.discount}</span>
              )}
            </button>
          </div>

          {/* Order table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
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
                  <td className="px-6 py-5 italic">
                    {plan.name}
                    <span className="ml-2 text-xs font-normal text-slate-400 not-italic">
                      ({billingPeriod === "yearly" ? "Annual" : "Monthly"})
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">1</td>
                  <td className="px-6 py-5 text-right">{formatMoney(baseAmount)}</td>
                </tr>
                <tr className="border-b border-slate-50 text-slate-600 font-normal text-sm">
                  <td colSpan={2} className="px-6 py-3">Subtotal</td>
                  <td className="px-6 py-3 text-right">{formatMoney(baseAmount)}</td>
                </tr>
                {discountPercent > 0 && (
                  <tr className="border-b border-slate-50 text-emerald-600 font-normal text-sm">
                    <td colSpan={2} className="px-6 py-3">Discount ({discountPercent}%)</td>
                    <td className="px-6 py-3 text-right">-{formatMoney(discountAmount)}</td>
                  </tr>
                )}
                <tr className="border-b border-slate-50 text-slate-500 font-normal text-sm">
                  <td colSpan={2} className="px-6 py-3">CGST (9%)</td>
                  <td className="px-6 py-3 text-right">{formatMoney(cgst)}</td>
                </tr>
                <tr className="border-b border-slate-50 text-slate-500 font-normal text-sm">
                  <td colSpan={2} className="px-6 py-3">SGST (9%)</td>
                  <td className="px-6 py-3 text-right">{formatMoney(sgst)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="px-6 py-4 border-b border-dashed border-slate-200">
                    <div className="flex items-center gap-2 max-w-xs">
                      {couponApplied
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        : <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                      }
                      <Input
                        placeholder="Referral / Promo Code"
                        value={couponInput}
                        onChange={e => { setCouponInput(e.target.value); setCouponApplied(false); setDiscountPercent(0); }}
                        className={`h-9 focus-visible:ring-blue-500 rounded text-sm ${couponApplied ? "border-emerald-400" : "border-slate-200"}`}
                      />
                      <button
                        type="button"
                        onClick={applyCoupon}
                        disabled={isApplyingCoupon || !couponInput.trim()}
                        className="text-[#4a90e2] hover:text-blue-700 text-sm font-semibold whitespace-nowrap disabled:opacity-40"
                      >
                        {isApplyingCoupon ? "…" : couponApplied ? "Applied" : "Apply"}
                      </button>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="px-6 py-5 text-[#4a90e2] font-bold text-lg">Total</td>
                  <td className="px-6 py-5 text-[#4a90e2] font-bold text-lg text-right">{formatMoney(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Account Information */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-base font-bold text-slate-800 mb-5">Account Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input placeholder="First Name*" required value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  className="h-11 border-slate-200 rounded" />
                <Input placeholder="Last Name*" required value={formData.lastName}
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  className="h-11 border-slate-200 rounded" />
                <Input type="email" placeholder="Email*" required value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="h-11 border-slate-200 rounded" />
                <div className="flex gap-2">
                  <select className="h-11 w-20 shrink-0 rounded border border-slate-200 bg-white px-2 text-sm">
                    <option>+91</option>
                  </select>
                  <Input placeholder="Mobile No.*" required value={formData.mobile}
                    onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                    className="h-11 border-slate-200 rounded w-full" />
                </div>
                <Input type="email" placeholder="Recovery Email" value={formData.recoveryEmail}
                  onChange={e => setFormData({ ...formData, recoveryEmail: e.target.value })}
                  className="h-11 border-slate-200 rounded" />
                <div className="flex gap-2">
                  <select className="h-11 w-20 shrink-0 rounded border border-slate-200 bg-white px-2 text-sm">
                    <option>+91</option>
                  </select>
                  <Input placeholder="WhatsApp No." value={formData.whatsapp}
                    onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="h-11 border-slate-200 rounded w-full" />
                </div>
              </div>
            </div>

            {/* Billing Address */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-slate-800">Billing Address</h2>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-sm text-slate-500">Bill to Company?</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={billToCompany}
                    onClick={() => setBillToCompany(v => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${billToCompany ? "bg-blue-500" : "bg-slate-200"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${billToCompany ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </label>
              </div>
              <div className="space-y-4">
                {billToCompany && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input placeholder="Company Name" value={formData.companyName}
                        onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                        className="h-11 border-slate-200 rounded" />
                      <Input placeholder="GST Number" value={formData.gstNumber}
                        onChange={e => setFormData({ ...formData, gstNumber: e.target.value })}
                        className="h-11 border-slate-200 rounded" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex gap-2">
                        <select className="h-11 w-20 shrink-0 rounded border border-slate-200 bg-white px-2 text-sm">
                          <option>+91</option>
                        </select>
                        <Input placeholder="Accountant Phone" value={formData.accountantPhone}
                          onChange={e => setFormData({ ...formData, accountantPhone: e.target.value })}
                          className="h-11 border-slate-200 rounded w-full" />
                      </div>
                      <Input type="email" placeholder="Accountant Email" value={formData.accountantEmail}
                        onChange={e => setFormData({ ...formData, accountantEmail: e.target.value })}
                        className="h-11 border-slate-200 rounded" />
                    </div>
                  </>
                )}
                {!billToCompany && (
                  <p className="text-sm text-slate-400 italic">
                    Billing to: {formData.firstName || "First Name"} {formData.lastName || "Last Name"}
                  </p>
                )}
                <select className="h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm"
                  value={formData.billing.country}
                  onChange={e => setFormData({ ...formData, billing: { ...formData.billing, country: e.target.value } })}>
                  <option>India</option>
                  <option>United States</option>
                  <option>Others</option>
                </select>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <select className="h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm"
                    value={formData.billing.state}
                    onChange={e => setFormData({ ...formData, billing: { ...formData.billing, state: e.target.value } })}>
                    <option>Gujarat</option>
                    <option>Maharashtra</option>
                    <option>Delhi</option>
                    <option>Others</option>
                  </select>
                  <Input placeholder="City" value={formData.billing.city}
                    onChange={e => setFormData({ ...formData, billing: { ...formData.billing, city: e.target.value } })}
                    className="h-11 border-slate-200 rounded" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input placeholder="Address" value={formData.billing.address}
                    onChange={e => setFormData({ ...formData, billing: { ...formData.billing, address: e.target.value } })}
                    className="h-11 border-slate-200 rounded" />
                  <Input placeholder="ZIP Code" value={formData.billing.zipCode}
                    onChange={e => setFormData({ ...formData, billing: { ...formData.billing, zipCode: e.target.value } })}
                    className="h-11 border-slate-200 rounded" />
                </div>
              </div>
            </div>

            {/* Billing period summary + submit */}
            <div className="bg-white rounded-lg border border-slate-200 px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">You will be charged</p>
                <p className="text-lg font-bold text-[#4a90e2]">{formatMoney(total)}</p>
                <p className="text-xs text-slate-500">{billingLabel} + 18% GST</p>
              </div>
              <Button type="submit"
                className="h-12 px-8 bg-[#4a90e2] hover:bg-blue-600 text-white font-bold text-base rounded-md shadow-md transition-all hover:scale-[1.02] gap-2">
                <Lock className="w-4 h-4" />
                Continue to Username
              </Button>
            </div>

            <p className="text-center text-xs text-slate-400 pb-4">
              Secured by Zoho Payments · Zoho Billing System · Powered by WebMyDrive
            </p>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
