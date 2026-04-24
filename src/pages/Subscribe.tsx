import { Lock } from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlans } from "@/hooks/use-plans";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { cn } from "@/lib/utils";

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
  const { state: restored } = useLocation() as { state: any };
  const { data: plans, isLoading } = usePlans();
  const { isDark, toggleTheme } = useTheme();

  const [billToCompany, setBillToCompany] = useState<boolean>(restored?.billToCompany ?? false);
  const [formData, setFormData] = useState(() =>
    restored ?? {
      firstName: "",
      lastName: "",
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
    }
  );

  const [couponInput, setCouponInput] = useState<string>(restored?.couponInput ?? "");
  const [discountPercent, setDiscountPercent] = useState(0);

  const selectedPlan = useMemo(() => {
    if (!plans || plans.length === 0) {
      console.warn("No plans available for matching");
      return null;
    }

    // Try to find by ID first (most reliable), then fallback to slug matching
    const byId = plans.find(p => String(p.id) === planSlug);
    if (byId) {
      console.log("Plan matched by ID:", byId);
      return byId;
    }

    const bySlug = plans.find(p => planToSlug(p.name) === planSlug);
    if (bySlug) {
      console.log("Plan matched by slug:", bySlug);
      return bySlug;
    }

    console.warn(`No plan found for planSlug="${planSlug}". Available plans:`, plans.map(p => ({ id: p.id, name: p.name, slug: planToSlug(p.name) })));
    return null;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    if (!formData.firstName || !formData.lastName) {
      toast.error("Please enter your first and last name.");
      return;
    }
    navigate(`/subscribe/${planSlug}/username`, {
      state: {
        ...formData,
        billToCompany,
        couponInput,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: total,
      },
    });
  };

  // Calculations
  const baseAmount = selectedPlan ? (selectedPlan.monthlyPrice || parseAmount(selectedPlan.price)) : 0;
  const discountAmount = (baseAmount * discountPercent) / 100;
  const taxableAmount = baseAmount - discountAmount;
  const cgst = taxableAmount * 0.09;
  const sgst = taxableAmount * 0.09;
  const total = taxableAmount + cgst + sgst;

  if (isLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading plans...</div>;
  if (!selectedPlan) {
    console.error("Subscribe page error: selectedPlan is null. planSlug:", planSlug, "plans:", plans);
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
      <div>Plan not found</div>
      <div className="text-sm text-slate-500">planSlug: {planSlug}</div>
      {plans && <div className="text-xs text-slate-400">Available plans: {plans.map(p => p.id).join(", ")}</div>}
    </div>;
  }

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
                  placeholder="Recovery Email"
                  value={formData.recoveryEmail}
                  onChange={e => setFormData({ ...formData, recoveryEmail: e.target.value })}
                  className="h-11 border-slate-200 rounded"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <div className="w-24 shrink-0">
                    <select className="flex h-11 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>+91</option>
                    </select>
                  </div>
                  <Input
                    placeholder="WhatsApp No."
                    value={formData.whatsapp}
                    onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="h-11 border-slate-200 rounded w-full"
                  />
                </div>
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
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                      billToCompany ? "translate-x-6" : "translate-x-1"
                    )}
                  />
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

          {/* Action Button */}
          <div className="flex flex-col items-center gap-6">
            <Button
              type="submit"
              className="w-full md:w-64 h-12 bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg rounded-md shadow-md shadow-blue-500/10 transition-all hover:scale-[1.02]"
            >
              Select the UserName
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
    </div>
  );
}
