import { ArrowLeft, Lock, AtSign, CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlans } from "@/hooks/use-plans";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeSwitch } from "@/components/ui/theme-switch";

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
    company: "",
    mobile: "",
    country: "India",
    state: "Gujarat",
    city: "",
    address: "",
    zipCode: "",
  });

  const [couponInput, setCouponInput] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingPeriod] = useState<"monthly" | "yearly">("yearly");

  // Success screen states
  const [showIdSetup, setShowIdSetup] = useState(false);
  const [wmdIdInput, setWmdIdInput] = useState("");
  const [idCheckStatus, setIdCheckStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [chosenWmdEmail, setChosenWmdEmail] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [idSetupLoading, setIdSetupLoading] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [finalCredentials, setFinalCredentials] = useState<{ email: string; password: string } | null>(null);
  const idCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedPlan = useMemo(() => {
    if (!plans) return null;
    return plans.find(p => planToSlug(p.name) === planSlug) || plans.find(p => String(p.id) === planSlug);
  }, [plans, planSlug]);

  const applyCoupon = () => {
    if (!couponInput || !selectedPlan) return;
    if (selectedPlan.coupon && couponInput.trim().toLowerCase() === selectedPlan.coupon.toLowerCase()) {
      setDiscountPercent(parseInt(selectedPlan.discount || "0"));
      toast.success("Coupon applied!");
    } else {
      setDiscountPercent(0);
      toast.error("Invalid coupon code");
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    setIsProcessing(true);

    // Simulate payment process
    setTimeout(() => {
      toast.success("Payment successful!");
      setShowIdSetup(true);
      setIsProcessing(false);
    }, 1500);
  };

  const checkIdAvailability = async (username: string) => {
    if (!username) return;
    setIdCheckStatus("checking");
    setTimeout(() => {
      setIdCheckStatus("available");
      setChosenWmdEmail(`${username}@webmydrive.com`);
    }, 800);
  };

  const handleWmdIdChange = (value: string) => {
    const local = value.split("@")[0].toLowerCase().trim();
    setWmdIdInput(local);
    setIdCheckStatus("idle");
    if (idCheckTimerRef.current) clearTimeout(idCheckTimerRef.current);
    if (!local) return;
    idCheckTimerRef.current = setTimeout(() => checkIdAvailability(local), 600);
  };

  const handleConfirmId = async () => {
    if (!chosenWmdEmail || !passwordInput) return toast.error("Please enter a password.");
    setIdSetupLoading(true);
    setTimeout(() => {
      setFinalCredentials({ email: chosenWmdEmail, password: passwordInput });
      setShowCredentials(true);
      setIdSetupLoading(false);
    }, 1000);
  };

  // Calculations
  const monthlyAmount = selectedPlan ? (selectedPlan.monthlyPrice || parseAmount(selectedPlan.price)) : 0;
  const yearlyAmount = selectedPlan ? (selectedPlan.yearlyPrice || monthlyAmount * 12) : 0;
  const baseAmount = billingPeriod === "monthly" ? monthlyAmount : yearlyAmount;
  const discountAmount = (baseAmount * discountPercent) / 100;
  const total = baseAmount - discountAmount + (baseAmount - discountAmount) * 0.18;

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>;
  if (!selectedPlan) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Plan not found</div>;

  // Credential Screen
  if (showCredentials && finalCredentials) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full bg-slate-900 border border-white/10 p-8 rounded-3xl text-center">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Account Ready!</h2>
          <div className="bg-slate-950/50 p-6 rounded-2xl border border-white/5 mb-8 text-left space-y-4">
            <div><p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Your ID</p><p className="text-xl font-mono text-cyan-400">{finalCredentials.email}</p></div>
            <div><p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Password</p><p className="text-xl font-mono text-white">••••••••</p></div>
          </div>
          <Button onClick={() => window.location.href = "/login"} className="w-full bg-cyan-500 py-6 text-lg rounded-2xl">Access My Drive</Button>
        </motion.div>
      </div>
    );
  }

  // ID Setup Screen
  if (showIdSetup) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-10 flex items-center justify-center">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-lg w-full bg-slate-900 border border-white/10 p-8 rounded-[32px]">
          <h2 className="text-3xl font-bold mb-2">Create Your WebMyDrive ID</h2>
          <p className="text-slate-400 mb-8 font-sans">This will be your official @webmydrive.com login.</p>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-slate-300 ml-1">Choose your ID</Label>
              <div className="relative">
                <Input value={wmdIdInput} onChange={(e) => handleWmdIdChange(e.target.value)} className="h-14 bg-slate-950 border-white/10 rounded-2xl pr-40 text-lg" placeholder="username" />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold tracking-tight">@webmydrive.com</div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 ml-1">Set Password</Label>
              <Input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="h-14 bg-slate-950 border-white/10 rounded-2xl text-lg" placeholder="••••••••" />
            </div>
            <Button onClick={handleConfirmId} disabled={idSetupLoading || idCheckStatus !== "available"} className="w-full h-14 bg-cyan-500 rounded-2xl text-lg font-bold">
              {idSetupLoading ? <Loader2 className="animate-spin" /> : "Confirm and Create"}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Direct One-Page Checkout Flow
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-10 relative" data-checkout-version="direct-v3">
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Theme</span>
        <ThemeSwitch checked={isDark} onCheckedChange={toggleTheme} size={12} ariaLabel="Toggle theme" />
      </div>

      <div className="max-w-5xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-8 text-slate-400 hover:text-white hover:bg-white/5 px-0"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Plans
        </Button>

        <h1 className="text-4xl font-bold mb-10 tracking-tight">Checkout: {selectedPlan.name}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
            <div className="p-8 bg-slate-900/50 border border-white/10 rounded-[32px] backdrop-blur-sm">
              <h2 className="text-xl font-bold mb-6 text-cyan-400">Order Summary</h2>
              <div className="space-y-4 font-sans">
                <div className="flex justify-between text-slate-400">
                  <span>Plan Subtotal</span>
                  <span className="text-white">{formatMoney(baseAmount)}</span>
                </div>
                {discountPercent > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount ({discountPercent}%)</span>
                    <span>-{formatMoney(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>GST (18%)</span>
                  <span className="text-white">{formatMoney((baseAmount - discountAmount) * 0.18)}</span>
                </div>
                <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                  <span className="text-lg font-bold">Total Amount</span>
                  <span className="text-3xl font-bold text-cyan-400">{formatMoney(total)}</span>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-900/50 border border-white/10 rounded-[32px] backdrop-blur-sm">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Have a Coupon?</h2>
              <div className="flex gap-2">
                <Input
                  placeholder="Code"
                  value={couponInput}
                  onChange={e => setCouponInput(e.target.value)}
                  className="bg-slate-950 border-white/10 rounded-xl h-12"
                />
                <Button onClick={applyCoupon} variant="secondary" className="rounded-xl h-12 px-6">Apply</Button>
              </div>
            </div>
          </div>

          <form onSubmit={handlePayment} className="lg:col-span-8 space-y-6 p-8 bg-slate-900 border border-white/10 rounded-[32px] order-1 lg:order-2">
            <h2 className="text-2xl font-bold flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/20">
                <Mail className="h-5 w-5 text-cyan-400" />
              </div>
              Billing Details
            </h2>

            <div className="space-y-2">
              <Label className="text-xs text-slate-400 uppercase tracking-widest ml-1 font-bold">Email Address (For Account Creation)</Label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="bg-slate-950 h-14 border-white/10 rounded-2xl text-lg focus:border-cyan-500/50 transition-all font-sans"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs text-slate-400 uppercase tracking-widest ml-1 font-bold">First Name</Label>
                <Input
                  placeholder="John"
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  className="bg-slate-950 h-14 border-white/10 rounded-2xl text-lg font-sans"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-400 uppercase tracking-widest ml-1 font-bold">Last Name</Label>
                <Input
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  className="bg-slate-950 h-14 border-white/10 rounded-2xl text-lg font-sans"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-slate-400 uppercase tracking-widest ml-1 font-bold">Mobile Number</Label>
              <Input
                placeholder="+91 00000 00000"
                value={formData.mobile}
                onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                className="bg-slate-950 h-14 border-white/10 rounded-2xl text-lg font-sans"
                required
              />
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                className="w-full h-16 bg-cyan-500 hover:bg-cyan-400 text-white text-xl font-bold rounded-[20px] shadow-2xl shadow-cyan-500/20 transition-all transform hover:scale-[1.01]"
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : "Complete Subscription"}
              </Button>
              <p className="text-center text-slate-500 text-xs mt-4 flex items-center justify-center gap-2">
                <Lock className="h-3 w-3" /> Secure Payment processed via Razorpay
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
