import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Check, Eye, EyeOff, Loader2, CheckCircle2, XCircle, RefreshCw, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

const DOMAIN = "@webmydrive.com";

type CheckoutState = {
  planId: number | string;
  planName: string;
  billingPeriod?: "monthly" | "yearly";
  amount: number;
  couponInput?: string;
  firstName: string;
  lastName: string;
  recoveryEmail?: string;
  whatsapp?: string;
  email: string;
  companyName?: string;
  mobile: string;
  gstNumber?: string;
  billing: {
    country: string;
    state: string;
    city: string;
    address: string;
    zipCode: string;
  };
};

type Availability =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; email: string }
  | { status: "taken"; suggestions: string[] }
  | { status: "error"; message: string };

function validatePassword(pw: string): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (pw.length < 8) errors.push("at least 8 characters");
  if (!/[A-Za-z]/.test(pw)) errors.push("one letter");
  if (!/[0-9]/.test(pw)) errors.push("one number");
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push("one special character");
  return { ok: errors.length === 0, errors };
}

export default function SubscribeUsernamePage() {
  const { planSlug } = useParams<{ planSlug: string }>();
  const navigate = useNavigate();
  const { state: navState } = useLocation() as { state: CheckoutState | null };
  const { isDark, toggleTheme } = useTheme();

  // Prefer navigation state; fall back to sessionStorage on page refresh
  const state: CheckoutState | null = navState ?? (() => {
    try {
      const saved = sessionStorage.getItem("wmd_subscribe_form");
      return saved ? (JSON.parse(saved) as CheckoutState) : null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    // If Zoho redirected back here after payment, go to success page immediately
    const pending = sessionStorage.getItem("wmd_pending_payment");
    if (pending) {
      try {
        const { ref, email, firstName, wsEmail } = JSON.parse(pending);
        window.location.href = `${import.meta.env.BASE_URL}payment/success?ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(firstName)}&ws=${encodeURIComponent(wsEmail)}`;
      } catch {
        sessionStorage.removeItem("wmd_pending_payment");
      }
      return;
    }
    // If no navigation state, try sessionStorage fallback (page refresh mid-checkout)
    if (!state) {
      const saved = sessionStorage.getItem("wmd_subscribe_form");
      if (!saved) {
        navigate(`/subscribe/${planSlug}`, { replace: true });
      }
      // If saved data exists, the component will use it via the state variable below
    }
  }, [state, planSlug, navigate]);


  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState<Availability>({ status: "idle" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true);

  const normalizedUsername = useMemo(
    () => username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, ""),
    [username]
  );

  useEffect(() => {
    if (!normalizedUsername || normalizedUsername.length < 3) {
      setAvailability({ status: "idle" });
      return;
    }
    setAvailability({ status: "checking" });
    const t = setTimeout(async () => {
      try {
        const data = await api.get(`/user/check-username?u=${encodeURIComponent(normalizedUsername)}`);
        if (data.available) {
          setAvailability({ status: "available", email: data.email });
        } else {
          setAvailability({ status: "taken", suggestions: data.suggestions ?? [] });
        }
      } catch (err: any) {
        setAvailability({ status: "error", message: err.message ?? "Check failed" });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [normalizedUsername]);

  const pwCheck = validatePassword(password);
  const pwMatch = password !== "" && password === confirm;
  const canProceed =
    availability.status === "available" && pwCheck.ok && pwMatch && !isProcessing && state !== null;

  const handleEdit = () => {
    navigate(`/subscribe/${planSlug}`, { state });
  };

  const handleConfirm = async () => {
    if (!canProceed || !state || availability.status !== "available") return;
    setIsProcessing(true);
    try {
      const sessionData = await api.post("/payment/create-session", {
        planId: state.planId,
        planName: state.planName,
        amount: state.amount,
        billingPeriod: state.billingPeriod ?? "yearly",
        username: availability.email,
        password,
        firstName: state.firstName,
        lastName: state.lastName,
        customerEmail: state.email,
        customerPhone: state.mobile,
        recoveryEmail: state.recoveryEmail || undefined,
        whatsapp: state.whatsapp || undefined,
        companyName: state.companyName || undefined,
        gstNumber: state.gstNumber || undefined,
        autoRenew,
        billingAddress: {
          country: state.billing.country,
          state: state.billing.state,
          city: state.billing.city,
          address: state.billing.address,
          zipCode: state.billing.zipCode,
        },
        promoCode: state.couponInput || undefined,
      });

      if (!sessionData.success) {
        toast.error(sessionData.error || "Failed to create checkout session");
        setIsProcessing(false);
        return;
      }

      // Load Zoho Payments widget SDK
      const existingScript = document.getElementById("zpay-sdk");
      const loadWidget = async () => {
        try {
          const zpay = new (window as any).ZPayments({
            account_id: sessionData.account_id,
            domain: "IN",
            otherOptions: { api_key: sessionData.api_key },
          });

          const wsEmail = availability.status === "available" ? availability.email : "";
          const ref = sessionData.referenceNumber;
          const successUrl = `${import.meta.env.BASE_URL}payment/success?ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(state?.email || "")}&name=${encodeURIComponent(state?.firstName || "")}&ws=${encodeURIComponent(wsEmail)}`;

          // Poll backend every 2s while widget is open — redirect as soon as COMPLETED
          let pollStopped = false;
          const poll = setInterval(async () => {
            if (pollStopped) return;
            try {
              const data = await api.get(`/payment/status?ref=${encodeURIComponent(ref)}`);
              if (data.status === "COMPLETED") {
                pollStopped = true;
                clearInterval(poll);
                window.location.href = successUrl;
              }
            } catch {}
          }, 2000);

          const result = await zpay.requestPaymentMethod({
            payments_session_id: sessionData.payments_session_id,
            transaction_type: "payment",
            amount: parseFloat(sessionData.amount).toFixed(2),
            currency_code: "INR",
            reference_number: ref,
            business: "WebMyDrive",
            description: sessionData.description || state.planName,
            address: {
              name: `${state.firstName} ${state.lastName}`.trim() || state.email,
              email: state.email,
              phone: state.mobile,
            },
          });

          // Widget promise resolved — handle result
          pollStopped = true;
          clearInterval(poll);

          if (result?.status === "success" || result?.status === "succeeded") {
            window.location.href = successUrl;
          } else if (result?.status === "widget_closed" || result?.status === "cancelled") {
            setIsProcessing(false);
          } else {
            // Unknown — check one final time if payment actually went through
            try {
              const data = await api.get(`/payment/status?ref=${encodeURIComponent(ref)}`);
              if (data.status === "COMPLETED") {
                window.location.href = successUrl;
                return;
              }
            } catch {}
            setIsProcessing(false);
          }
        } catch (err: any) {
          toast.error(err.message || "Payment failed");
          setIsProcessing(false);
        }
      };

      if (existingScript || (window as any).ZPayments) {
        loadWidget();
      } else {
        const script = document.createElement("script");
        script.id = "zpay-sdk";
        script.src = "https://static.zohocdn.com/zpay/zpay-js/v1/zpayments.js";
        script.async = true;
        script.onload = loadWidget;
        script.onerror = () => {
          toast.error("Failed to load payment widget. Please try again.");
          setIsProcessing(false);
        };
        document.body.appendChild(script);
      }
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
      setIsProcessing(false);
    }
  };

  if (!state) return null;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n);

  return (
    <div className={cn("min-h-screen bg-[#f8fbff] pb-20 font-sans", isDark && "bg-slate-950")}>
      <div className="fixed top-4 right-4 z-50">
        <ThemeSwitch checked={isDark} onCheckedChange={toggleTheme} size={12} />
      </div>

      <div className="max-w-3xl mx-auto pt-12 px-4 space-y-8">
        {/* Username */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-bold text-slate-800 mb-2">Choose your WebMyDrive username</h2>
          <p className="text-sm text-slate-500 mb-6">This will be your login and email address.</p>

          <div className="flex">
            <Input
              placeholder="yourname"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-11 rounded-r-none border-slate-200 lowercase"
              autoFocus
            />
            <div className="h-11 flex items-center px-4 rounded-r border border-l-0 border-slate-200 bg-slate-50 text-slate-500 text-sm">
              {DOMAIN}
            </div>
          </div>

          <div className="mt-3 min-h-[24px] text-sm">
            {availability.status === "checking" && (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking availability…
              </div>
            )}
            {availability.status === "available" && (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" /> {availability.email} is available
              </div>
            )}
            {availability.status === "taken" && (
              <div className="flex items-start gap-2 text-rose-600">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div>Already taken.</div>
                  {availability.suggestions.length > 0 && (
                    <div className="text-slate-600 text-xs mt-1">
                      Try:{" "}
                      {availability.suggestions.map((s, i) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setUsername(s.replace(DOMAIN, ""))}
                          className="text-blue-500 hover:underline"
                        >
                          {s}
                          {i < availability.suggestions.length - 1 ? ", " : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {availability.status === "error" && (
              <div className="text-rose-600">{availability.message}</div>
            )}
          </div>
        </div>

        {/* Password */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Set your password</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 border-slate-200 rounded pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Input
              type={showPw ? "text" : "password"}
              placeholder="Confirm Password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-11 border-slate-200 rounded"
            />
          </div>

          <div className="mt-3 text-xs text-slate-500 space-y-1">
            {[
              ["at least 8 characters", password.length >= 8],
              ["one letter", /[A-Za-z]/.test(password)],
              ["one number", /[0-9]/.test(password)],
              ["one special character", /[^A-Za-z0-9]/.test(password)],
              ["passwords match", pwMatch],
            ].map(([label, ok]) => (
              <div key={label as string} className="flex items-center gap-1.5">
                {ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-slate-300" />
                )}
                <span className={ok ? "text-emerald-700" : "text-slate-500"}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Review */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Review your details</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <Row label="Plan" value={`${state.planName} — ${fmt(state.amount)}`} />
            <Row label="Name" value={`${state.firstName} ${state.lastName}`} />
            {state.recoveryEmail && <Row label="Recovery Email" value={state.recoveryEmail} />}
            {state.whatsapp && <Row label="WhatsApp" value={`+91 ${state.whatsapp}`} />}
            <Row label="Account Email" value={state.email} />
            <Row label="Account Phone" value={`+91 ${state.mobile}`} />
            {state.companyName && <Row label="Company" value={state.companyName} />}
            {state.gstNumber && <Row label="GST" value={state.gstNumber} />}
            {state.couponInput && <Row label="Promo Code" value={state.couponInput} />}
            <Row
              label="Billing Address"
              value={[
                state.billing.address,
                state.billing.city,
                state.billing.state,
                state.billing.zipCode,
                state.billing.country,
              ]
                .filter(Boolean)
                .join(", ")}
              full
            />
          </dl>
        </div>

        {/* Auto-Renewal Choice */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Renewal preference</h2>
          <p className="text-sm text-slate-500 mb-5">Choose how you'd like your subscription renewed when it expires.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAutoRenew(true)}
              className={[
                "flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
                autoRenew
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-300"
                  : "border-slate-200 hover:border-blue-300",
              ].join(" ")}
            >
              <div className={["mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", autoRenew ? "border-blue-500 bg-blue-500" : "border-slate-300"].join(" ")}>
                {autoRenew && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <div>
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                  <RefreshCw className="w-4 h-4 text-blue-500" /> Enable Auto-Renewal
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Recommended</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Never lose access to your files. We'll automatically renew your plan before it expires using your saved payment method.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAutoRenew(false)}
              className={[
                "flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
                !autoRenew
                  ? "border-slate-500 bg-slate-50 ring-1 ring-slate-300"
                  : "border-slate-200 hover:border-slate-300",
              ].join(" ")}
            >
              <div className={["mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", !autoRenew ? "border-slate-600 bg-slate-600" : "border-slate-300"].join(" ")}>
                {!autoRenew && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <div>
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                  <CalendarClock className="w-4 h-4 text-slate-500" /> I'll renew manually
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  We'll send you reminders at 30 days and 7 days before expiry so you can renew on your own schedule.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleEdit}
            className="w-full md:w-48 h-12 rounded-md"
          >
            Edit Details
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canProceed}
            className="w-full md:w-56 h-12 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-md shadow-md shadow-blue-500/10 transition-all disabled:opacity-50"
          >
            {isProcessing ? "Processing…" : "Confirm and Pay"}
          </Button>
        </div>

        <div className="flex flex-col items-center gap-2 text-slate-400">
          <div className="flex items-center gap-2 text-xs">
            <Lock className="w-3 h-3" />
            <span>Secured by Zoho Payments • Zoho Billing System</span>
          </div>
          <p className="text-[10px] italic">Powered by WebMyDrive Platform</p>
        </div>
      </div>

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
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h3>
              <p className="text-slate-600 mb-8">
                Your account is being set up. You will receive an email at {state?.email} once it's ready — this usually takes less than a minute.
              </p>
              <Button
                onClick={() => (window.location.href = "/user/dashboard")}
                className="w-full h-12 bg-[#4a90e2] rounded-lg"
              >
                Continue
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={cn(full && "md:col-span-2")}>
      <dt className="text-slate-400 text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-slate-700 font-medium break-words">{value}</dd>
    </div>
  );
}
