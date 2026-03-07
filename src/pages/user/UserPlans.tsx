import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, RefreshCw, Check, Cloud, KeyRound, Eye, EyeOff, AtSign, CheckCircle2, XCircle, Mail, Lock } from "lucide-react";
import { WmdLogo } from "@/components/WmdLogo";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import UserLayout from "@/components/user/UserLayout";
import DistributorLayout from "@/components/distributor/DistributorLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import "./plans-light.css";

interface Plan {
    id: number;
    name: string;
    price: number;
    priceINR?: number;       // Yearly per-month price (billed annually)
    priceMonthlyINR?: number;  // Monthly price (billed monthly)
    features: string | null;
    isActive?: boolean;
    storageGB?: number;
    maxUsers?: number;
    googleSKU?: string;
}

function parseFeatures(f: string | null): { label: string, value: string }[] {
    if (!f) return [];
    try {
        const parsed = JSON.parse(f);
        if (Array.isArray(parsed)) {
            return parsed.map(item => {
                if (typeof item === 'string') return { label: item, value: 'Included' };
                return { label: item.label || '', value: item.value || '' };
            });
        }
        return [];
    } catch {
        return f.split(",").map(s => ({ label: s.trim(), value: "Included" })).filter(x => x.label);
    }
}

function extractRefCode(input: string): string {
    const trimmed = input.trim();
    try {
        const url = new URL(trimmed);
        const ref = url.searchParams.get("ref") || url.searchParams.get("REF");
        if (ref) return ref.toUpperCase();
        const match = url.pathname.match(/\/ref\/([^/]+)/);
        if (match) return match[1].toUpperCase();
    } catch { /* not a URL */ }
    return trimmed.toUpperCase();
}

function loadRazorpayScript(): Promise<boolean> {
    return new Promise(resolve => {
        if ((window as any).Razorpay) return resolve(true);
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

type IdCheckStatus = "idle" | "checking" | "available" | "taken";

// Ensure the brand font matches the screenshot if possible (using a standard sans for now)
export default function UserPlans() {
    const { user, refreshUser, isLoadingAuth } = useUser();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [purchasing, setPurchasing] = useState<number | null>(null);
    const [authRequiredForPlan, setAuthRequiredForPlan] = useState<Plan | null>(null);
    const [emailInput, setEmailInput] = useState("");
    const [emailAuthLoading, setEmailAuthLoading] = useState(false);
    const [authStep, setAuthStep] = useState(1);
    const [wmdIdInput, setWmdIdInput] = useState("");
    const [idCheckStatus, setIdCheckStatus] = useState<IdCheckStatus>("idle");
    const [idSuggestions, setIdSuggestions] = useState<string[]>([]);
    const [chosenWmdEmail, setChosenWmdEmail] = useState("");

    const [registerPasswordInput, setRegisterPasswordInput] = useState("");
    const [showRegisterPassword, setShowRegisterPassword] = useState(false);

    // Provisioning & Password setup
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [provisionedWorkspace, setProvisionedWorkspace] = useState<{ email: string } | null>(null);
    const [passwordInput, setPasswordInput] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [settingPassword, setSettingPassword] = useState(false);

    const isPublicPage = !location.pathname.startsWith("/user") && !location.pathname.startsWith("/distributor");

    // Force light mode on public page so dark theme doesn't bleed in
    useEffect(() => {
        if (isPublicPage) {
            const html = document.documentElement;
            const wasDark = html.classList.contains("dark");
            html.classList.remove("dark");
            return () => {
                if (wasDark) html.classList.add("dark");
            };
        }
    }, [isPublicPage]);

    // Referral Code
    const getInitialRef = () => {
        const fromUrl = searchParams.get("ref") || "";
        if (fromUrl) return fromUrl.toUpperCase();
        return (localStorage.getItem("wmd_pending_ref") || "").toUpperCase();
    };
    const initialRef = getInitialRef();
    const [codeInput, setCodeInput] = useState(initialRef);
    const [appliedCode, setAppliedCode] = useState(initialRef);
    const [discount, setDiscount] = useState<{ pct: number, isBannerOnly?: boolean, role?: string } | null>(null);
    const [validatingCode, setValidatingCode] = useState(false);

    const [isYearly, setIsYearly] = useState(true); // Toggle: true = yearly billing, false = monthly

    const fetchPlans = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.get("/user/plans");
            const arr: Plan[] = Array.isArray(data) ? data : (data.plans || []);
            setPlans(arr);
        } catch (err: any) {
            setError(err.message || "Failed to load plans.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPlans(); }, []);

    const validatePromoCode = async (code: string, isAuto: boolean) => {
        setValidatingCode(true);
        try {
            const res = await api.post("/referral/validate-code", { promoCode: code });
            if (res.success) {
                setDiscount({ pct: res.discountPct });
                setAppliedCode(code);
                localStorage.setItem("wmd_pending_ref", code);
                if (!isAuto) toast.success(`Code "${code}" applied!`);
                else toast.success(`Referral code "${code}" auto-applied!`, { id: "ref-applied", duration: 5000 });
            }
        } catch (err: any) {
            const errMsg = err.message || "Invalid code";
            if (!isAuto || errMsg.includes("expired")) {
                toast.error(errMsg);
            }
            if (isAuto) localStorage.removeItem("wmd_pending_ref");
            setAppliedCode("");
            setDiscount(null);
        } finally {
            setValidatingCode(false);
        }
    }

    useEffect(() => {
        // Referral Context logic
        const did = searchParams.get("did");
        const uid = searchParams.get("uid");
        if (did || uid) {
            const id = did || uid || "";
            const role = did ? "DISTRIBUTOR" : "USER";
            sessionStorage.setItem("wmd_ref_context", JSON.stringify({ id, role }));
        }

        const fetchReferralContext = async () => {
            const stored = sessionStorage.getItem("wmd_ref_context");
            if (stored) {
                try {
                    const ctx = JSON.parse(stored);
                    const param = ctx.role === 'DISTRIBUTOR' ? `did=${ctx.id}` : `uid=${ctx.id}`;
                    const res = await api.get(`/referral/resolve?${param}`);
                    if (res.success) {
                        setDiscount({ pct: res.percent, isBannerOnly: true, role: res.role });
                        // Clear promo codes if referral link is active
                        localStorage.removeItem("wmd_pending_ref");
                        setAppliedCode("");
                        setCodeInput("");
                    }
                } catch { }
            } else if (initialRef && !discount) {
                validatePromoCode(initialRef, true);
            }
        };

        fetchReferralContext();

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    const handleApplyCode = () => {
        const storedCtx = sessionStorage.getItem("wmd_ref_context");
        if (storedCtx) {
            return toast.error("Referral links override promo codes. You cannot apply a code now.");
        }
        const code = extractRefCode(codeInput);
        if (!code) return toast.error("Enter a referral code first");
        validatePromoCode(code, false);
    };

    const discountedPrice = (plan: Plan) => {
        const yearlyAmount = Number((plan.priceINR ?? plan.price ?? 0));
        const basePrice = isYearly ? yearlyAmount : Math.round(yearlyAmount / 12);
        if (!discount || discount.isBannerOnly) return basePrice;
        return Math.max(1, Math.round(basePrice * (1 - discount.pct / 100)));
    };

    const originalPriceFor = (plan: Plan) => {
        const yearlyAmount = Number((plan.priceINR ?? plan.price ?? 0));
        return isYearly ? yearlyAmount : Math.round(yearlyAmount / 12);
    };

    const pollForCredentials = () => {
        toast.dismiss("provisioning");
        toast.success("✅ Account provisioned!", { duration: 3000 });

        if (registerPasswordInput || user) {
            setTimeout(() => {
                window.location.href = "/user/dashboard";
            }, 1000);
            return;
        }

        let targetEmail = emailInput && emailInput.includes('@') ? emailInput : "demo@webmydrive.com";

        setProvisionedWorkspace({ email: targetEmail });
    };

    // ─── WebMyDrive ID Checking Logic ──────────────────────────────────────────

    const idCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    /**
     * Takes a raw input (just the local part like "khushi" or "khushi@webmydrive.com")
     * and returns the normalized local part.
     */
    const normalizeIdInput = (raw: string): string => {
        if (raw.includes("@")) return raw.split("@")[0].toLowerCase().trim();
        return raw.toLowerCase().trim();
    };

    /**
     * Checks availability of a given username part against the backend.
     */
    const checkIdAvailability = async (username: string) => {
        if (!username) {
            setIdCheckStatus("idle");
            setIdSuggestions([]);
            return;
        }
        setIdCheckStatus("checking");
        setIdSuggestions([]);
        try {
            const res = await api.get(`/user/check-username?u=${encodeURIComponent(username)}`);
            if (res.available) {
                setIdCheckStatus("available");
                setChosenWmdEmail(res.email);
                setIdSuggestions([]);
            } else {
                setIdCheckStatus("taken");
                setChosenWmdEmail("");
                setIdSuggestions(res.suggestions || []);
            }
        } catch {
            setIdCheckStatus("idle");
        }
    };

    /** Called when user types in the @webmydrive.com ID field — debounced */
    const handleWmdIdChange = (value: string) => {
        // Strip @ and domain if user pastes a full email
        const local = normalizeIdInput(value);
        setWmdIdInput(local);
        setIdCheckStatus("idle");
        setChosenWmdEmail("");
        setIdSuggestions([]);

        if (idCheckTimerRef.current) clearTimeout(idCheckTimerRef.current);
        if (!local) return;
        idCheckTimerRef.current = setTimeout(() => {
            checkIdAvailability(local);
        }, 600);
    };

    /** Called when user clicks a suggestions chip */
    const handleSuggestionSelect = (suggestedEmail: string) => {
        const local = suggestedEmail.split("@")[0];
        setWmdIdInput(local);
        setIdCheckStatus("available");
        setChosenWmdEmail(suggestedEmail);
        setIdSuggestions([]);
    };

    /** Step 1 → Step 2: called after successful Email / Google auth */
    const handleGoogleAuthSuccess = async (token: string, googleUser: any) => {
        localStorage.setItem("wmd_token", token);
        await refreshUser();
        toast.success("Signed in! Now choose your WebMyDrive ID.");

        // Pre-populate the WMD ID from Google email prefix
        const emailPrefix = googleUser.email?.split("@")[0] || "";
        const suggested = emailPrefix.toLowerCase().replace(/[^a-z0-9._-]/g, "");
        setWmdIdInput(suggested);
        setIdCheckStatus("idle");
        setChosenWmdEmail("");
        setIdSuggestions([]);
        setAuthStep(2);
        if (suggested) {
            setTimeout(() => checkIdAvailability(suggested), 100);
        }
    };

    const handleManualEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailInput || !registerPasswordInput) return toast.error("Please enter email and password.");
        if (registerPasswordInput.length < 8) return toast.error("Password must be at least 8 characters.");

        setEmailAuthLoading(true);
        try {
            // Try explicit login first
            try {
                const res = await api.post("/auth/login", { email: emailInput, password: registerPasswordInput });
                if (res.token) {
                    await handleGoogleAuthSuccess(res.token, res.user);
                    return;
                }
            } catch (err: any) {
                if (err.message?.includes("Invalid credentials") || err.message?.includes("User not found")) {
                    // Extract distributor ID from referral context if present
                    const storedCtx = sessionStorage.getItem("wmd_ref_context");
                    let distId: number | undefined = undefined;
                    if (storedCtx) {
                        try {
                            const ctx = JSON.parse(storedCtx);
                            if (ctx.role === 'DISTRIBUTOR') distId = Number(ctx.id);
                        } catch { }
                    }
                    const regRes = await api.post("/auth/register", {
                        email: emailInput,
                        password: registerPasswordInput,
                        name: emailInput.split('@')[0],
                        role: "USER",
                        distributorId: distId ?? undefined,
                    });
                    if (regRes.token) {
                        await handleGoogleAuthSuccess(regRes.token, regRes.user);
                        return;
                    }
                } else {
                    throw err;
                }
            }
        } catch (err: any) {
            toast.error(err.message || "Authentication failed. Make sure your password is correct.");
        } finally {
            setEmailAuthLoading(false);
        }
    };

    /** Step 2: Confirm chosen ID and proceed to payment */
    const handleConfirmId = async () => {
        if (!chosenWmdEmail || idCheckStatus !== "available") {
            return toast.error("Please choose an available @webmydrive.com ID.");
        }

        setEmailAuthLoading(true);

        try {
            // Save the chosen ID to the user profile
            await api.put("/user/profile", { webMyDriveId: chosenWmdEmail });
            await refreshUser();

            const planToPurchase = authRequiredForPlan;
            setAuthRequiredForPlan(null);
            setAuthStep(1);

            if (planToPurchase) {
                setTimeout(() => proceedToPayment(planToPurchase), 500);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to save ID.");
        } finally {
            setEmailAuthLoading(false);
        }
    };



    const proceedToPayment = async (plan: Plan) => {
        setPurchasing(plan.id);

        try {

            let ctxPayload = undefined;
            const storedCtx = sessionStorage.getItem("wmd_ref_context");
            if (storedCtx) {
                ctxPayload = JSON.parse(storedCtx);
            }

            const sessionData = await api.post("/referral/create-checkout", {
                planId: plan.id,
                promoCode: appliedCode || undefined,
                referralContext: ctxPayload,
                billingPeriod: isYearly ? "yearly" : "monthly",
            });

            if (!sessionData.success) {
                toast.error(sessionData.error || "Failed to create checkout session");
                setPurchasing(null);
                return;
            }

            if (sessionData.discountPct && !discount?.isBannerOnly) {
                setDiscount({ pct: sessionData.discountPct });
            }

            if (sessionData.isDemoMode) {
                toast.loading("Processing payment…", { id: "pay-verify" });
                await new Promise(r => setTimeout(r, 1500));
                const verifyData = await api.post("/referral/verify-payment", {
                    orderId: sessionData.orderId,
                    razorpay_payment_id: `demo_pay_${Date.now()}`,
                    razorpay_order_id: sessionData.rzpOrderId,
                    razorpay_signature: "demo_sig",
                });
                toast.dismiss("pay-verify");
                if (verifyData.success) {
                    toast.success(`🎉 Payment successful!`);
                    localStorage.removeItem("wmd_pending_ref");
                    pollForCredentials();
                } else {
                    toast.error(verifyData.error || "Payment failed");
                }
                setPurchasing(null);
                return;
            }

            const loaded = await loadRazorpayScript();
            if (!loaded) {
                toast.error("Could not load payment gateway.");
                setPurchasing(null);
                return;
            }

            const rzp = new (window as any).Razorpay({
                key: sessionData.razorpayKeyId,
                amount: sessionData.amount * 100,
                currency: "INR",
                name: "WebMyDrive",
                description: `${plan.name} — Monthly`,
                order_id: sessionData.rzpOrderId,
                theme: { color: "#1eb6ff" },
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
                            localStorage.removeItem("wmd_pending_ref");
                            pollForCredentials();
                        } else {
                            toast.error(verifyData.error || "Payment verification failed");
                        }
                    } catch (e: any) {
                        toast.dismiss("pay-verify");
                        toast.error(e.message || "Failed to verify payment");
                    }
                },
                modal: { ondismiss: () => toast("Payment cancelled") }
            });
            rzp.open();

        } catch (e: any) {
            toast.error(e.message || "Payment initiation failed.");
        } finally {
            setPurchasing(null);
        }
    };

    const handlePurchase = (plan: Plan) => {
        // Navigate directly to checkout page using plan ID for reliable matching
        navigate(`/subscribe/${plan.id}`);
    };

    const handleSetupPassword = async () => {
        if (passwordInput.length < 8) return toast.error("Password must be at least 8 characters.");
        setSettingPassword(true);
        try {
            await api.post("/auth/setup-workspace-password", { newPassword: passwordInput });
            toast.success("Password secured! Welcome aboard.");
            setProvisionedWorkspace(null);
            setTimeout(() => {
                window.location.href = "/user/dashboard";
            }, 1000);
        } catch (err: any) {
            toast.error(err.message || "Failed to set password");
        } finally {
            setSettingPassword(false);
        }
    };

    // ─── public site layout matching webmydrive.com ────────────────────────

    // Website top nav matching screenshot
    const publicHeader = (
        <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
            <div className="max-w-7xl mx-auto flex items-center justify-between h-20 px-6">
                <div className="flex items-center gap-1 cursor-pointer" onClick={() => navigate("/")}>
                    <WmdLogo size="sm" />
                </div>

                <nav className="hidden md:flex items-center gap-8 text-gray-600 font-medium text-sm">
                    <span className="cursor-pointer hover:text-[#1fb6ff] transition-colors" onClick={() => navigate("/#features")}>Features</span>
                    <span className="cursor-pointer hover:text-[#1fb6ff] transition-colors" onClick={() => navigate("/plans")}>Pricing</span>
                    <span className="cursor-pointer hover:text-[#1fb6ff] transition-colors" onClick={() => navigate("/#faq")}>FAQ</span>
                    <span className="cursor-pointer hover:text-[#1fb6ff] transition-colors" onClick={() => navigate("/#contact")}>Contact</span>
                </nav>

                <div className="flex items-center gap-4">
                    {user?.email ? (
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-gray-900 hidden sm:inline-block">
                                {user.email}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setAuthRequiredForPlan(plans[0] ?? null)}
                                className="text-gray-600 font-medium hover:text-[#1fb6ff] transition-colors"
                            >
                                Sign In
                            </button>
                        </div>
                    )}
                    <button className="bg-[#1fb6ff] hover:bg-[#1a9ce6] text-white px-6 py-2.5 rounded text-sm font-semibold transition-colors shadow-sm">
                        Subscribe Now
                    </button>
                </div>
            </div>
        </header>
    );

    const plansContent = (
        <div className="w-full space-y-6 pb-24">
            {/* Top Banner — stays primary blue */}
            <div className="bg-primary rounded-xl p-6 md:p-8 text-white shadow-none relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold mb-2">Choose Your Plan</h1>
                    <p className="text-blue-100 max-w-lg text-sm md:text-base">
                        Upgrade your storage and unlock full WebMyDrive features.
                    </p>
                </div>
                <div className="bg-white/10 p-1 rounded-lg inline-flex items-center backdrop-blur-sm border border-white/20 shrink-0">
                    <button
                        onClick={() => setIsYearly(false)}
                        className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${!isYearly
                            ? "bg-white text-primary font-bold shadow-sm"
                            : "text-white/80 hover:text-white hover:bg-white/10"
                            }`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setIsYearly(true)}
                        className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${isYearly
                            ? "bg-white text-primary font-bold shadow-sm"
                            : "text-white/80 hover:text-white hover:bg-white/10"
                            }`}
                    >
                        Yearly
                    </button>
                </div>
            </div>

            {/* Referral Input */}
            <div className="flex flex-col items-center justify-center py-2">
                <div className="flex items-center justify-center min-h-[40px]">
                    {discount?.isBannerOnly ? (
                        <div className="flex items-center gap-2 px-6 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 font-medium shadow-sm">
                            <span>
                                {discount.role === 'DISTRIBUTOR'
                                    ? `Referred by Distributor`
                                    : `Referred by User`}
                            </span>
                        </div>
                    ) : appliedCode ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium shadow-sm">
                            <span>Code <b>{appliedCode}</b> applied!</span>
                            <button onClick={() => { setAppliedCode(""); setDiscount(null); localStorage.removeItem("wmd_pending_ref"); }} className="ml-2 text-green-500 hover:text-green-800">
                                <AlertCircle className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 referral-input">
                            <input
                                value={codeInput}
                                onChange={e => setCodeInput(e.target.value)}
                                placeholder="Referral Code"
                                style={{ backgroundColor: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 8, height: 40, padding: '0 14px', fontSize: 14, width: 240, outline: 'none' }}
                                className="referral-input"
                            />
                            <Button disabled={validatingCode} onClick={handleApplyCode} className="shadow-sm h-10 px-4">
                                {validatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Plans Grid */}
            <div className="plan-grid-wrapper pt-2">
                {loading ? (
                    <div className="flex justify-center py-24"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
                ) : error ? (
                    <div className="text-center py-24" style={{ color: '#ef4444' }}>{error}</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {plans.map((plan, i) => {
                            const features = parseFeatures(plan.features);
                            const originalPrice = originalPriceFor(plan);
                            const finalPrice = discountedPrice(plan);

                            return (
                                <div key={plan.id} className="plan-card rounded-xl flex flex-col overflow-hidden transition-all duration-200" style={{ background: 'var(--plan-card-bg, white)', border: '1px solid var(--plan-card-border, #e2e8f0)' }}>
                                    {/* Card title strip */}
                                    <div className="plan-card-header text-center p-5 pb-4" style={{ background: 'var(--plan-card-header-bg, #f8fafc)', borderBottom: '1px solid var(--plan-card-border, #e2e8f0)' }}>
                                        <h3 className="font-bold text-lg uppercase tracking-wider" style={{ color: 'var(--plan-card-title, #1e293b)' }}>
                                            {plan.name}
                                        </h3>
                                    </div>

                                    <div className="flex flex-col flex-1 p-6">
                                        <div className="text-center mb-6">
                                            <span className="text-4xl font-extrabold" style={{ color: 'var(--plan-price-color, #0f172a)' }}>₹{finalPrice.toLocaleString("en-IN")}</span>
                                            <p className="text-center text-xs mt-2 font-medium" style={{ color: 'var(--plan-label-color, #64748b)' }}>
                                                {isYearly ? "Per Year" : "Per Month"}
                                            </p>
                                        </div>

                                        <Button
                                            onClick={() => handlePurchase(plan)}
                                            disabled={purchasing !== null}
                                            className="w-full mb-6 font-semibold shadow-sm"
                                        >
                                            {purchasing === plan.id ? <Loader2 className="w-5 h-5 animate-spin" /> : "Subscribe"}
                                        </Button>

                                        <ul className="space-y-4 flex-1 pt-5" style={{ borderTop: '1px solid var(--plan-card-border, #e2e8f0)' }}>
                                            {features.map((f, idx) => (
                                                <li key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm w-full gap-1 sm:gap-4" style={{ color: 'var(--plan-feature-color, #475569)' }}>
                                                    <div className="flex items-start sm:items-center">
                                                        <Check className="w-4 h-4 text-primary mr-3 shrink-0 mt-0.5 sm:mt-0" />
                                                        <span className="leading-snug">{f.label}</span>
                                                    </div>
                                                    <span className="font-semibold sm:text-right ml-7 sm:ml-0" style={{ color: 'var(--plan-feature-value-color, #1e293b)' }}>{f.value}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Already purchased CTA ── */}
            <div className="mt-16 mb-8 text-center py-10">
                <p className="text-2xl font-normal text-slate-700">
                    Ready to get started with Google Workspace?
                </p>
                <p className="text-lg mt-4 text-slate-600">
                    Choose a plan above to subscribe and activate your account
                </p>
                <a
                    href="/activate"
                    className="inline-block mt-5 text-xl font-semibold text-[#1fb6ff] hover:text-[#0ea5e9] hover:underline transition-colors"
                >
                    Already purchased, click here to Activate the account
                </a>
            </div>
        </div>
    );

    // ─── Email Auth + WebMyDrive ID Selection Dialog ──────────────────────────────
    const emailAuthDialog = (
        <Dialog open={!!authRequiredForPlan} onOpenChange={(o) => { if (!o) { setAuthRequiredForPlan(null); setAuthStep(1); setWmdIdInput(""); setIdCheckStatus("idle"); setIdSuggestions([]); setChosenWmdEmail(""); setRegisterPasswordInput(""); setShowRegisterPassword(false); } }}>
            <DialogContent className="sm:max-w-sm bg-white text-gray-900 border-gray-200 shadow-xl">
                <DialogHeader>
                    <div className="w-12 h-12 rounded-2xl bg-[#1fb6ff] flex items-center justify-center mb-2 mx-auto">
                        {authStep === 1 ? <Cloud className="w-6 h-6 text-white" /> : <AtSign className="w-6 h-6 text-white" />}
                    </div>
                    <DialogTitle className="text-center text-xl text-gray-900">
                        {authStep === 1 ? "Sign in to continue" : "Choose your @webmydrive.com ID"}
                    </DialogTitle>
                    <DialogDescription className="text-center text-gray-500">
                        {authStep === 1 ? (
                            <>
                                Sign in with Google to purchase <strong className="text-gray-900">{authRequiredForPlan?.name}</strong>. No passwords needed.
                            </>
                        ) : (
                            <>
                                Pick your unique WebMyDrive account ID.
                                <br />
                                <span className="text-xs mt-2 block text-gray-400">
                                    This will be your <code className="text-[#1fb6ff]">username@webmydrive.com</code> address.
                                </span>
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <AnimatePresence mode="wait">
                    {emailAuthLoading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-6"
                        >
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Creating your account…
                        </motion.div>
                    ) : authStep === 1 ? (
                        /* ── Step 1: Sign in with Google or Email ── */
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 16 }}
                            className="flex flex-col items-center gap-4 py-4 w-full"
                        >
                            <GoogleSignInButton
                                label="Continue with Google"
                                onSuccess={({ token, user: googleUser }) => handleGoogleAuthSuccess(token, googleUser)}
                                onError={(msg) => toast.error(msg)}
                                distributorId={(() => {
                                    const storedCtx = sessionStorage.getItem("wmd_ref_context");
                                    if (storedCtx) {
                                        try {
                                            const ctx = JSON.parse(storedCtx);
                                            if (ctx.role === 'DISTRIBUTOR') return Number(ctx.id);
                                        } catch { }
                                    }
                                    return undefined;
                                })()}
                            />

                            <div className="flex items-center gap-3 w-full my-1">
                                <div className="flex-1 h-px bg-gray-200" />
                                <span className="text-xs text-gray-400 font-medium">or continue with email</span>
                                <div className="flex-1 h-px bg-gray-200" />
                            </div>

                            <form onSubmit={handleManualEmailAuth} className="w-full space-y-3">
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        type="email"
                                        placeholder="you@gmail.com"
                                        value={emailInput}
                                        onChange={(e) => setEmailInput(e.target.value)}
                                        className="pl-10 bg-white border-gray-300 text-gray-900 focus-visible:ring-[#1fb6ff]"
                                        required
                                    />
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        type={showRegisterPassword ? "text" : "password"}
                                        placeholder="Password (min 8 chars)"
                                        value={registerPasswordInput}
                                        onChange={(e) => setRegisterPasswordInput(e.target.value)}
                                        className="pl-10 pr-10 bg-white border-gray-300 text-gray-900 focus-visible:ring-[#1fb6ff]"
                                        required
                                        minLength={8}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <Button
                                    type="submit"
                                    disabled={emailAuthLoading}
                                    className="w-full bg-gray-900 hover:bg-gray-800 text-white shadow-sm"
                                >
                                    {emailAuthLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    Sign In / Register
                                </Button>
                            </form>

                            <p className="text-xs text-gray-500 text-center px-1 mt-2">
                                By continuing, you establish your billing profile. No additional password required for Google login.
                            </p>
                        </motion.div>
                    ) : (
                        /* ── Step 2: WebMyDrive ID ── */
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -16 }}
                            className="flex flex-col gap-4 py-4 w-full"
                        >
                            {/* ID Input with inline domain suffix */}
                            <div className="flex rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-[#1fb6ff]/50 focus-within:border-[#1fb6ff] transition-all">
                                <input
                                    autoFocus
                                    value={wmdIdInput}
                                    onChange={(e) => handleWmdIdChange(e.target.value)}
                                    placeholder="yourname"
                                    className="flex-1 px-4 py-3 text-gray-900 bg-white text-sm outline-none min-w-0"
                                    style={{ fontFamily: 'monospace' }}
                                />
                                <span className="px-3 py-3 text-sm text-gray-400 bg-gray-50 border-l border-gray-200 whitespace-nowrap select-none">
                                    @webmydrive.com
                                </span>
                            </div>

                            {/* Availability Status */}
                            <AnimatePresence>
                                {idCheckStatus === "checking" && (
                                    <motion.div
                                        key="checking"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex items-center gap-2 text-xs text-gray-500"
                                    >
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Checking availability…
                                    </motion.div>
                                )}
                                {idCheckStatus === "available" && (
                                    <motion.div
                                        key="avail"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex items-center gap-2 text-xs text-emerald-600 font-semibold"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span><strong>{chosenWmdEmail}</strong> is available!</span>
                                    </motion.div>
                                )}
                                {idCheckStatus === "taken" && (
                                    <motion.div
                                        key="taken"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="space-y-2"
                                    >
                                        <div className="flex items-center gap-2 text-xs text-red-500 font-semibold">
                                            <XCircle className="w-4 h-4" />
                                            <span><strong>{wmdIdInput}@webmydrive.com</strong> is already taken.</span>
                                        </div>
                                        {idSuggestions.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-xs text-gray-500">Try one of these instead:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {idSuggestions.map((s) => (
                                                        <button
                                                            key={s}
                                                            onClick={() => handleSuggestionSelect(s)}
                                                            className="px-3 py-1.5 text-xs rounded-full bg-blue-50 border border-blue-200 text-blue-700 hover:bg-[#1fb6ff] hover:text-white hover:border-[#1fb6ff] transition-all font-mono font-medium"
                                                        >
                                                            {s}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2 pt-1">
                                <Button
                                    onClick={handleConfirmId}
                                    className="w-full h-12 bg-[#1fb6ff] hover:bg-[#1a9ce6] text-white font-semibold"
                                    disabled={!chosenWmdEmail || idCheckStatus !== "available"}
                                >
                                    {idCheckStatus === "checking" ? (
                                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking…</>
                                    ) : (
                                        "Confirm ID & Continue"
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => { setAuthStep(1); setWmdIdInput(""); setIdCheckStatus("idle"); setIdSuggestions([]); setChosenWmdEmail(""); setRegisterPasswordInput(""); setShowRegisterPassword(false); }}
                                    className="w-full text-sm text-gray-500 hover:text-gray-700"
                                >
                                    ← Back
                                </Button>
                            </div>

                            {/* Step indicator */}
                            <div className="flex items-center justify-center gap-2 pt-1">
                                <div className="w-2 h-2 rounded-full bg-gray-300" />
                                <div className="w-2 h-2 rounded-full bg-[#1fb6ff]" />
                                <span className="text-xs text-gray-400 ml-1">Step 2 of 2</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );

    // ─── Setup Workspace Password Dialog ────────────────────────────────────────
    const passwordSetupDialog = (
        <Dialog open={!!provisionedWorkspace} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-md bg-white text-gray-900 border-gray-200 shadow-2xl [&>button]:hidden outline-none">
                <DialogHeader className="text-center">
                    <DialogTitle className="text-2xl font-bold flex flex-col items-center gap-2">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                            <span className="text-3xl">🎉</span>
                        </div>
                        Secure Your Account
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 text-base mt-2">
                        Your account is ready! Create a secure password for <strong className="text-gray-900">{provisionedWorkspace?.email}</strong>.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 w-full">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">New Password</label>
                        <div className="relative">
                            <Input
                                type={showPassword ? "text" : "password"}
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                className="pr-10 bg-white border-gray-300 text-gray-900 focus-visible:ring-[#1fb6ff]"
                                placeholder="Create a strong password (min 8 chars)"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showPassword ? <span className="text-xs font-bold">HIDE</span> : <span className="text-xs font-bold">SHOW</span>}
                            </button>
                        </div>
                        {passwordInput.length > 0 && passwordInput.length < 8 && (
                            <p className="text-red-500 text-xs">Password must be at least 8 characters.</p>
                        )}
                        {passwordInput.length >= 8 && (
                            <p className="text-green-600 text-xs font-medium inline-flex items-center gap-1">
                                <Check className="w-3 h-3" /> Minimum length reached
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-gray-100 mt-2">
                    <Button
                        onClick={handleSetupPassword}
                        disabled={passwordInput.length < 8 || settingPassword}
                        className="w-full sm:w-auto bg-[#1fb6ff] hover:bg-[#1a9ce6] text-white"
                    >
                        {settingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {settingPassword ? "Securing..." : "Complete Setup"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );

    // ─── Render ────────────────────────────────────────────────────────────────
    if (location.pathname.startsWith("/user") || location.pathname.startsWith("/distributor")) {
        const Layout = location.pathname.startsWith("/distributor") ? DistributorLayout : UserLayout;
        return (
            <Layout>
                {/* Inject dashboard-aware plan card CSS variables for dark mode readability */}
                <style>{`
                    :root, .dark {
                        --plan-card-bg: hsl(var(--card));
                        --plan-card-header-bg: hsl(var(--muted));
                        --plan-card-border: hsl(var(--border));
                        --plan-card-title: hsl(var(--card-foreground));
                        --plan-price-color: hsl(var(--foreground));
                        --plan-label-color: hsl(var(--muted-foreground));
                        --plan-feature-color: hsl(var(--muted-foreground));
                        --plan-feature-value-color: hsl(var(--foreground));
                    }
                `}</style>
                <div className="max-w-6xl mx-auto pt-4 md:pt-6">
                    {plansContent}
                </div>
                {emailAuthDialog}
            </Layout>
        );
    }

    return (
        <div className="plans-light min-h-screen">
            {publicHeader}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {plansContent}
            </div>
            {emailAuthDialog}
            {passwordSetupDialog}
        </div>
    );
}
