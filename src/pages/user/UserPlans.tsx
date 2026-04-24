import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2, AlertCircle, Check, Eye, EyeOff, AtSign, CheckCircle2, XCircle,
    Mail, Lock, Crown, Calendar, ArrowUp, ArrowDown, Tag, X, CreditCard,
} from "lucide-react";
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
import { MONTHLY_BASE_PRICES, roundDiscountedPrice, getShortPlanName } from "@/lib/pricing";
import "./plans-light.css";

interface Plan {
    id: number;
    name: string;
    price: number;
    priceINR?: number;
    priceMonthlyINR?: number;
    features: string | null;
    isActive?: boolean;
    storageGB?: number;
    maxUsers?: number;
    googleSKU?: string;
    monthlyPrice?: number;
    yearlyPrice?: number;
    sortOrder?: number;
}

interface CurrentPlanInfo {
    hasPlan: boolean;
    planId?: number;
    planName?: string;
    billingPeriod?: "monthly" | "yearly";
    startDate?: string;
    renewalDate?: string;
    daysRemaining?: number | null;
    baseAmountPaid?: number | null;
    monthlyPrice?: number;
    yearlyPrice?: number;
    storageGB?: number;
    nextPlanId?: number | null;
    nextPlanName?: string | null;
}

interface UpgradeBreakdown {
    daysRemaining: number;
    currentPlanName: string;
    targetPlanName: string;
    billingPeriod: string;
    newPlanRemaining: number;
    discountPct: number;
    discountAmt: number;
    remainingValue: number;
    upgradeBase: number;
    upgradeGST: number;
    upgradeTotal: number;
    promoValid: boolean;
}

function parseFeatures(f: string | null): { label: string; value: string }[] {
    if (!f) return [];
    try {
        const parsed = JSON.parse(f);
        if (Array.isArray(parsed)) {
            return parsed.map(item => {
                if (typeof item === "string") return { label: item, value: "Included" };
                return { label: item.label || "", value: item.value || "" };
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

export default function UserPlans() {
    const { user, refreshUser } = useUser();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    // ── Existing purchase-flow state ──────────────────────────────────────────
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

    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [provisionedWorkspace, setProvisionedWorkspace] = useState<{ email: string } | null>(null);
    const [passwordInput, setPasswordInput] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [settingPassword, setSettingPassword] = useState(false);

    const isPublicPage = !location.pathname.startsWith("/user") && !location.pathname.startsWith("/distributor");
    const isUserPath = !isPublicPage;

    // ── Current plan management state ─────────────────────────────────────────
    const [currentPlan, setCurrentPlan] = useState<CurrentPlanInfo | null>(null);
    const [currentPlanLoading, setCurrentPlanLoading] = useState(false);

    // Upgrade modal
    const [upgradeTargetPlan, setUpgradeTargetPlan] = useState<Plan | null>(null);
    const [upgradeBillingPeriod, setUpgradeBillingPeriod] = useState<"monthly" | "yearly">("yearly");
    const [upgradePromoInput, setUpgradePromoInput] = useState("");
    const [upgradeAppliedPromo, setUpgradeAppliedPromo] = useState("");
    const [upgradePreview, setUpgradePreview] = useState<UpgradeBreakdown | null>(null);
    const [upgradePreviewLoading, setUpgradePreviewLoading] = useState(false);
    const [upgradePaymentLoading, setUpgradePaymentLoading] = useState(false);

    // Downgrade modal
    const [downgradeTargetPlan, setDowngradeTargetPlan] = useState<Plan | null>(null);
    const [downgradeLoading, setDowngradeLoading] = useState(false);
    const [cancellingDowngrade, setCancellingDowngrade] = useState(false);

    // ── Light mode on public page ─────────────────────────────────────────────
    useEffect(() => {
        if (isPublicPage) {
            const html = document.documentElement;
            const wasDark = html.classList.contains("dark");
            html.classList.remove("dark");
            return () => { if (wasDark) html.classList.add("dark"); };
        }
    }, [isPublicPage]);

    // ── Referral & promo ──────────────────────────────────────────────────────
    const getInitialRef = () => {
        const fromUrl = searchParams.get("ref") || "";
        if (fromUrl) return fromUrl.toUpperCase();
        return (localStorage.getItem("wmd_pending_ref") || "").toUpperCase();
    };
    const initialRef = getInitialRef();
    const [codeInput, setCodeInput] = useState(initialRef);
    const [appliedCode, setAppliedCode] = useState(initialRef);
    const [discount, setDiscount] = useState<{ pct: number; isBannerOnly?: boolean; role?: string } | null>(null);
    const [validatingCode, setValidatingCode] = useState(false);
    const [isYearly, setIsYearly] = useState(true);

    // ── Data fetching ─────────────────────────────────────────────────────────
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

    const fetchCurrentPlan = async () => {
        setCurrentPlanLoading(true);
        try {
            const data = await api.get("/user/current-plan");
            setCurrentPlan(data);
        } catch {
            setCurrentPlan({ hasPlan: false });
        } finally {
            setCurrentPlanLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
        if (isUserPath) fetchCurrentPlan();
    }, []);

    // ── Referral context ──────────────────────────────────────────────────────
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
            if (!isAuto || errMsg.includes("expired")) toast.error(errMsg);
            if (isAuto) localStorage.removeItem("wmd_pending_ref");
            setAppliedCode("");
            setDiscount(null);
        } finally {
            setValidatingCode(false);
        }
    };

    useEffect(() => {
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
                    const param = ctx.role === "DISTRIBUTOR" ? `did=${ctx.id}` : `uid=${ctx.id}`;
                    const res = await api.get(`/referral/resolve?${param}`);
                    if (res.success) {
                        setDiscount({ pct: res.percent, isBannerOnly: true, role: res.role });
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
        return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }, []);

    const handleApplyCode = () => {
        const storedCtx = sessionStorage.getItem("wmd_ref_context");
        if (storedCtx) return toast.error("Referral links override promo codes.");
        const code = extractRefCode(codeInput);
        if (!code) return toast.error("Enter a referral code first");
        validatePromoCode(code, false);
    };

    const originalPriceFor = (plan: Plan) => {
        const shortName = getShortPlanName(plan.name);
        const monthlyBase = MONTHLY_BASE_PRICES[shortName] ?? MONTHLY_BASE_PRICES[plan.name] ?? plan.price;
        return isYearly ? roundDiscountedPrice(monthlyBase as number) : monthlyBase;
    };

    const discountedPrice = (plan: Plan) => {
        const basePrice = originalPriceFor(plan);
        if (!discount || discount.isBannerOnly) return basePrice;
        return Math.max(1, Math.round(basePrice * (1 - discount.pct / 100)));
    };

    // ── Upgrade preview ───────────────────────────────────────────────────────
    const fetchUpgradePreview = async (planId: number, billingPeriod: string, promoCode: string) => {
        setUpgradePreviewLoading(true);
        setUpgradePreview(null);
        try {
            const params = new URLSearchParams({ planId: String(planId), billingPeriod });
            if (promoCode) params.set("promoCode", promoCode);
            const data = await api.get(`/user/upgrade-preview?${params}`);
            setUpgradePreview(data);
        } catch (e: any) {
            toast.error(e.message || "Failed to get upgrade preview");
        } finally {
            setUpgradePreviewLoading(false);
        }
    };

    useEffect(() => {
        if (upgradeTargetPlan) {
            fetchUpgradePreview(upgradeTargetPlan.id, upgradeBillingPeriod, upgradeAppliedPromo);
        }
    }, [upgradeTargetPlan, upgradeBillingPeriod, upgradeAppliedPromo]);

    const handleApplyUpgradePromo = () => {
        const code = extractRefCode(upgradePromoInput);
        if (!code) return toast.error("Enter a promo code first");
        setUpgradeAppliedPromo(code);
    };

    const handleUpgradePayment = async () => {
        if (!upgradeTargetPlan || !upgradePreview) return;
        setUpgradePaymentLoading(true);
        try {
            const initData = await api.post("/user/initiate-upgrade", {
                planId: upgradeTargetPlan.id,
                billingPeriod: upgradeBillingPeriod,
                promoCode: upgradeAppliedPromo || undefined,
            });

            if (initData.isDemoMode) {
                toast.loading("Processing payment…", { id: "upg-pay" });
                await new Promise(r => setTimeout(r, 1500));
                await api.post("/user/confirm-upgrade", {
                    orderId: initData.orderId,
                    razorpayPaymentId: `demo_pay_${Date.now()}`,
                    razorpayOrderId: initData.razorpayOrderId,
                    razorpaySignature: "demo_sig",
                });
                toast.dismiss("upg-pay");
                toast.success(`Upgraded to ${upgradeTargetPlan.name}!`);
                setUpgradeTargetPlan(null);
                await fetchCurrentPlan();
                return;
            }

            const loaded = await loadRazorpayScript();
            if (!loaded) { toast.error("Could not load payment gateway."); return; }

            const rzp = new (window as any).Razorpay({
                key: initData.razorpayKeyId,
                amount: initData.amount * 100,
                currency: "INR",
                name: "WebMyDrive",
                description: `Upgrade to ${upgradeTargetPlan.name}`,
                order_id: initData.razorpayOrderId,
                theme: { color: "#1eb6ff" },
                handler: async (response: any) => {
                    try {
                        toast.loading("Verifying payment…", { id: "upg-verify" });
                        await api.post("/user/confirm-upgrade", {
                            orderId: initData.orderId,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpayOrderId: response.razorpay_order_id,
                            razorpaySignature: response.razorpay_signature,
                        });
                        toast.dismiss("upg-verify");
                        toast.success(`Upgraded to ${upgradeTargetPlan.name}!`);
                        setUpgradeTargetPlan(null);
                        await fetchCurrentPlan();
                    } catch (e: any) {
                        toast.dismiss("upg-verify");
                        toast.error(e.message || "Payment verification failed");
                    }
                },
                modal: { ondismiss: () => toast("Payment cancelled") },
            });
            rzp.open();
        } catch (e: any) {
            toast.error(e.message || "Failed to initiate upgrade");
        } finally {
            setUpgradePaymentLoading(false);
        }
    };

    // ── Downgrade ─────────────────────────────────────────────────────────────
    const handleConfirmDowngrade = async () => {
        if (!downgradeTargetPlan) return;
        setDowngradeLoading(true);
        try {
            const res = await api.post("/user/schedule-downgrade", { planId: downgradeTargetPlan.id });
            toast.success(`Downgrade to ${res.nextPlanName} scheduled for ${formatDate(res.effectiveDate)}`);
            setDowngradeTargetPlan(null);
            await fetchCurrentPlan();
        } catch (e: any) {
            toast.error(e.message || "Failed to schedule downgrade");
        } finally {
            setDowngradeLoading(false);
        }
    };

    const handleCancelDowngrade = async () => {
        setCancellingDowngrade(true);
        try {
            await api.delete("/user/cancel-downgrade");
            toast.success("Downgrade cancelled");
            await fetchCurrentPlan();
        } catch (e: any) {
            toast.error(e.message || "Failed to cancel downgrade");
        } finally {
            setCancellingDowngrade(false);
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return "—";
        return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    };

    const getPlanAction = (plan: Plan): "current" | "upgrade" | "downgrade" => {
        if (!currentPlan?.hasPlan || !currentPlan.planId) return "upgrade";
        if (plan.id === currentPlan.planId) return "current";
        const currentMonthly = currentPlan.monthlyPrice ?? 0;
        const planMonthly = plan.monthlyPrice ?? 0;
        return planMonthly > currentMonthly ? "upgrade" : "downgrade";
    };

    // ── Existing payment flow (new purchases) ─────────────────────────────────
    const pollForCredentials = () => {
        toast.dismiss("provisioning");
        toast.success("✅ Account provisioned!", { duration: 3000 });
        if (registerPasswordInput || user) {
            setTimeout(() => { window.location.href = "/user/dashboard"; }, 1000);
            return;
        }
        const targetEmail = emailInput && emailInput.includes("@") ? emailInput : "demo@webmydrive.com";
        setProvisionedWorkspace({ email: targetEmail });
    };

    const idCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const normalizeIdInput = (raw: string): string => {
        if (raw.includes("@")) return raw.split("@")[0].toLowerCase().trim();
        return raw.toLowerCase().trim();
    };

    const checkIdAvailability = async (username: string) => {
        if (!username) { setIdCheckStatus("idle"); setIdSuggestions([]); return; }
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

    const handleWmdIdChange = (value: string) => {
        const local = normalizeIdInput(value);
        setWmdIdInput(local);
        setIdCheckStatus("idle");
        setChosenWmdEmail("");
        setIdSuggestions([]);
        if (idCheckTimerRef.current) clearTimeout(idCheckTimerRef.current);
        if (!local) return;
        idCheckTimerRef.current = setTimeout(() => checkIdAvailability(local), 600);
    };

    const handleSuggestionSelect = (suggestedEmail: string) => {
        const local = suggestedEmail.split("@")[0];
        setWmdIdInput(local);
        setIdCheckStatus("available");
        setChosenWmdEmail(suggestedEmail);
        setIdSuggestions([]);
    };

    const handleGoogleAuthSuccess = async (token: string, googleUser: any) => {
        localStorage.setItem("token", token);
        await refreshUser();
        toast.success("Signed in! Now choose your WebMyDrive ID.");
        const emailPrefix = googleUser.email?.split("@")[0] || "";
        const suggested = emailPrefix.toLowerCase().replace(/[^a-z0-9._-]/g, "");
        setWmdIdInput(suggested);
        setIdCheckStatus("idle");
        setChosenWmdEmail("");
        setIdSuggestions([]);
        setAuthStep(2);
        if (suggested) setTimeout(() => checkIdAvailability(suggested), 100);
    };

    const handleManualEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailInput || !registerPasswordInput) return toast.error("Please enter email and password.");
        if (registerPasswordInput.length < 8) return toast.error("Password must be at least 8 characters.");
        setEmailAuthLoading(true);
        try {
            try {
                const res = await api.post("/auth/login", { email: emailInput, password: registerPasswordInput });
                if (res.token) { await handleGoogleAuthSuccess(res.token, res.user); return; }
            } catch (err: any) {
                if (err.message?.includes("Invalid credentials") || err.message?.includes("User not found")) {
                    const storedCtx = sessionStorage.getItem("wmd_ref_context");
                    let distId: number | undefined = undefined;
                    if (storedCtx) {
                        try {
                            const ctx = JSON.parse(storedCtx);
                            if (ctx.role === "DISTRIBUTOR") distId = Number(ctx.id);
                        } catch { }
                    }
                    const regRes = await api.post("/auth/register", {
                        email: emailInput,
                        password: registerPasswordInput,
                        name: emailInput.split("@")[0],
                        role: "USER",
                        distributorId: distId ?? undefined,
                    });
                    if (regRes.token) { await handleGoogleAuthSuccess(regRes.token, regRes.user); return; }
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

    const handleConfirmId = async () => {
        if (!chosenWmdEmail || idCheckStatus !== "available") return toast.error("Please choose an available @webmydrive.com ID.");
        setEmailAuthLoading(true);
        try {
            await api.put("/user/profile", { webMyDriveId: chosenWmdEmail });
            await refreshUser();
            const planToPurchase = authRequiredForPlan;
            setAuthRequiredForPlan(null);
            setAuthStep(1);
            if (planToPurchase) setTimeout(() => proceedToPayment(planToPurchase), 500);
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
            if (storedCtx) ctxPayload = JSON.parse(storedCtx);

            const sessionData = await api.post("/referral/create-checkout", {
                planId: plan.id,
                promoCode: appliedCode || undefined,
                referralContext: ctxPayload,
                billingPeriod: isYearly ? "yearly" : "monthly",
            });

            if (!sessionData.success) { toast.error(sessionData.error || "Failed to create checkout session"); return; }
            if (sessionData.discountPct && !discount?.isBannerOnly) setDiscount({ pct: sessionData.discountPct });

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
                if (verifyData.success) { toast.success("🎉 Payment successful!"); localStorage.removeItem("wmd_pending_ref"); pollForCredentials(); }
                else toast.error(verifyData.error || "Payment failed");
                return;
            }

            const loaded = await loadRazorpayScript();
            if (!loaded) { toast.error("Could not load payment gateway."); return; }

            const rzp = new (window as any).Razorpay({
                key: sessionData.razorpayKeyId,
                amount: sessionData.amount * 100,
                currency: "INR",
                name: "WebMyDrive",
                description: `${plan.name} — ${isYearly ? "Yearly" : "Monthly"}`,
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
                        if (verifyData.success) { toast.success("🎉 Payment successful!"); localStorage.removeItem("wmd_pending_ref"); pollForCredentials(); }
                        else toast.error(verifyData.error || "Payment verification failed");
                    } catch (e: any) {
                        toast.dismiss("pay-verify");
                        toast.error(e.message || "Failed to verify payment");
                    }
                },
                modal: { ondismiss: () => toast("Payment cancelled") },
            });
            rzp.open();
        } catch (e: any) {
            toast.error(e.message || "Payment initiation failed.");
        } finally {
            setPurchasing(null);
        }
    };

    const handlePurchase = (plan: Plan) => {
        navigate(`/subscribe/${plan.id}`);
    };

    const handleSetupPassword = async () => {
        if (passwordInput.length < 8) return toast.error("Password must be at least 8 characters.");
        setSettingPassword(true);
        try {
            await api.post("/auth/setup-workspace-password", { newPassword: passwordInput });
            toast.success("Password secured! Welcome aboard.");
            setProvisionedWorkspace(null);
            setTimeout(() => { window.location.href = "/user/dashboard"; }, 1000);
        } catch (err: any) {
            toast.error(err.message || "Failed to set password");
        } finally {
            setSettingPassword(false);
        }
    };

    // ── Plan grid shared between both views ───────────────────────────────────
    const billingToggle = (
        <div className="bg-primary rounded-xl p-6 md:p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-2">
                    {currentPlan?.hasPlan ? "Manage Your Plan" : "Choose Your Plan"}
                </h1>
                <p className="text-blue-100 max-w-lg text-sm md:text-base">
                    {currentPlan?.hasPlan
                        ? "Upgrade for more storage, or schedule a downgrade at your next renewal."
                        : "Upgrade your storage and unlock full WebMyDrive features."}
                </p>
            </div>
            <div className="bg-white/10 p-1 rounded-lg inline-flex items-center backdrop-blur-sm border border-white/20 shrink-0">
                <button onClick={() => setIsYearly(false)} className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${!isYearly ? "bg-white text-primary font-bold shadow-sm" : "text-white/80 hover:text-white hover:bg-white/10"}`}>
                    Monthly
                </button>
                <button onClick={() => setIsYearly(true)} className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${isYearly ? "bg-white text-primary font-bold shadow-sm" : "text-white/80 hover:text-white hover:bg-white/10"}`}>
                    Yearly
                </button>
            </div>
        </div>
    );

    // ── Plan management content (active subscriber) ───────────────────────────
    const planManagementContent = (
        <div className="w-full space-y-6 pb-24">
            {/* Current plan banner */}
            {currentPlan?.hasPlan && (
                <div className="rounded-xl border border-border bg-card p-5 md:p-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Crown className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Current Plan</p>
                                <h2 className="text-xl font-bold">{currentPlan.planName}</h2>
                                <p className="text-sm text-muted-foreground mt-0.5 capitalize">
                                    {currentPlan.billingPeriod} billing
                                    {currentPlan.daysRemaining != null ? ` • ${currentPlan.daysRemaining} days remaining` : ""}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                <span>Renews {formatDate(currentPlan.renewalDate)}</span>
                            </div>
                            {currentPlan.baseAmountPaid != null && currentPlan.baseAmountPaid > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <CreditCard className="w-4 h-4" />
                                    <span>
                                        ₹{(currentPlan.baseAmountPaid * 1.18).toLocaleString("en-IN", { maximumFractionDigits: 0 })} paid
                                        <span className="text-xs ml-1">
                                            (₹{currentPlan.baseAmountPaid.toLocaleString("en-IN", { maximumFractionDigits: 0 })} + GST)
                                        </span>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    {currentPlan.nextPlanId && (
                        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                                <span className="font-semibold">Downgrade scheduled:</span> Changes to{" "}
                                <strong>{currentPlan.nextPlanName}</strong> on {formatDate(currentPlan.renewalDate)}
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                                onClick={handleCancelDowngrade}
                                disabled={cancellingDowngrade}
                            >
                                {cancellingDowngrade
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <><X className="w-3.5 h-3.5" /><span className="ml-1.5 hidden sm:inline">Cancel</span></>}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {billingToggle}

            {/* Plans grid */}
            <div className="plan-grid-wrapper pt-2">
                {loading ? (
                    <div className="flex justify-center py-24"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
                ) : error ? (
                    <div className="text-center py-24 text-destructive">{error}</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {plans.map((plan) => {
                            const features = parseFeatures(plan.features);
                            const action = getPlanAction(plan);
                            const isCurrentPlan = action === "current";
                            const isDowngradeScheduled = currentPlan?.nextPlanId === plan.id;
                            const shortName = getShortPlanName(plan.name);
                            const monthlyBase = MONTHLY_BASE_PRICES[shortName] ?? MONTHLY_BASE_PRICES[plan.name] ?? plan.price;
                            const displayPrice = isYearly ? roundDiscountedPrice(monthlyBase as number) : monthlyBase;

                            return (
                                <div
                                    key={plan.id}
                                    className={`plan-card rounded-xl flex flex-col overflow-hidden transition-all duration-200 ${isCurrentPlan ? "ring-2 ring-primary shadow-lg" : ""}`}
                                    style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                                >
                                    {/* Status strip */}
                                    {isCurrentPlan && (
                                        <div className="bg-primary text-white text-xs font-bold text-center py-1.5 tracking-wider uppercase">
                                            ✓ Your Current Plan
                                        </div>
                                    )}
                                    {isDowngradeScheduled && !isCurrentPlan && (
                                        <div className="bg-amber-500 text-white text-xs font-bold text-center py-1.5 tracking-wider uppercase">
                                            Downgrade Scheduled
                                        </div>
                                    )}

                                    <div className="text-center p-5 pb-4" style={{ background: "hsl(var(--muted))", borderBottom: "1px solid hsl(var(--border))" }}>
                                        <h3 className="font-bold text-lg uppercase tracking-wider">{plan.name}</h3>
                                    </div>

                                    <div className="flex flex-col flex-1 p-6">
                                        <div className="text-center mb-6">
                                            <span className="text-4xl font-extrabold">₹{(displayPrice as number).toLocaleString("en-IN")}</span>
                                            <p className="text-xs mt-2 font-medium text-muted-foreground">
                                                {isYearly ? "Per Month / Billed Annually" : "Billed Monthly"}
                                            </p>
                                        </div>

                                        {isCurrentPlan ? (
                                            <div className="w-full mb-6 h-10 flex items-center justify-center rounded-md bg-primary/10 text-primary text-sm font-semibold">
                                                <Check className="w-4 h-4 mr-2" /> Active
                                            </div>
                                        ) : isDowngradeScheduled ? (
                                            <Button variant="outline" className="w-full mb-6 border-amber-500/30 text-amber-600" disabled>
                                                <ArrowDown className="w-4 h-4 mr-1.5" /> Scheduled
                                            </Button>
                                        ) : action === "upgrade" ? (
                                            <Button
                                                onClick={() => {
                                                    setUpgradeTargetPlan(plan);
                                                    setUpgradeBillingPeriod(isYearly ? "yearly" : "monthly");
                                                    setUpgradePromoInput("");
                                                    setUpgradeAppliedPromo("");
                                                    setUpgradePreview(null);
                                                }}
                                                className="w-full mb-6 font-semibold"
                                            >
                                                <ArrowUp className="w-4 h-4 mr-1.5" /> Upgrade
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={() => setDowngradeTargetPlan(plan)}
                                                variant="outline"
                                                className="w-full mb-6 font-semibold"
                                                disabled={!!currentPlan?.nextPlanId}
                                            >
                                                <ArrowDown className="w-4 h-4 mr-1.5" /> Downgrade
                                            </Button>
                                        )}

                                        <ul className="space-y-4 flex-1 pt-5 border-t border-border">
                                            {features.map((f, idx) => (
                                                <li key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-1 sm:gap-4 text-muted-foreground">
                                                    <div className="flex items-start sm:items-center">
                                                        <Check className="w-4 h-4 text-primary mr-3 shrink-0 mt-0.5 sm:mt-0" />
                                                        <span className="leading-snug">{f.label}</span>
                                                    </div>
                                                    <span className="font-semibold sm:text-right ml-7 sm:ml-0 text-foreground">{f.value}</span>
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
        </div>
    );

    // ── Purchase flow content (new users / no active plan) ────────────────────
    const plansContent = (
        <div className="w-full space-y-6 pb-24">
            {billingToggle}

            {/* Referral input */}
            <div className="flex flex-col items-center justify-center py-2">
                <div className="flex items-center justify-center min-h-[40px]">
                    {discount?.isBannerOnly ? (
                        <div className="flex items-center gap-2 px-6 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 font-medium shadow-sm">
                            <span>{discount.role === "DISTRIBUTOR" ? "Referred by Distributor" : "Referred by User"}</span>
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
                                style={{ backgroundColor: "#fff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 8, height: 40, padding: "0 14px", fontSize: 14, width: 240, outline: "none" }}
                                className="referral-input"
                            />
                            <Button disabled={validatingCode} onClick={handleApplyCode} className="shadow-sm h-10 px-4">
                                {validatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Plans grid */}
            <div className="plan-grid-wrapper pt-2">
                {loading ? (
                    <div className="flex justify-center py-24"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
                ) : error ? (
                    <div className="text-center py-24" style={{ color: "#ef4444" }}>{error}</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {plans.map((plan) => {
                            const features = parseFeatures(plan.features);
                            const originalPrice = originalPriceFor(plan);
                            const finalPrice = discountedPrice(plan);

                            return (
                                <div key={plan.id} className="plan-card rounded-xl flex flex-col overflow-hidden transition-all duration-200" style={{ background: "var(--plan-card-bg, white)", border: "1px solid var(--plan-card-border, #e2e8f0)" }}>
                                    <div className="plan-card-header text-center p-5 pb-4" style={{ background: "var(--plan-card-header-bg, #f8fafc)", borderBottom: "1px solid var(--plan-card-border, #e2e8f0)" }}>
                                        <h3 className="font-bold text-lg uppercase tracking-wider" style={{ color: "var(--plan-card-title, #1e293b)" }}>{plan.name}</h3>
                                    </div>

                                    <div className="flex flex-col flex-1 p-6">
                                        <div className="text-center mb-6">
                                            <span className="text-4xl font-extrabold" style={{ color: "var(--plan-price-color, #0f172a)" }}>₹{(finalPrice as number).toLocaleString("en-IN")}</span>
                                            <p className="text-center text-xs mt-2 font-medium" style={{ color: "var(--plan-label-color, #64748b)" }}>
                                                {isYearly ? "Per Month / Billed Annually" : "Billed Monthly"}
                                            </p>
                                        </div>

                                        <Button
                                            onClick={() => handlePurchase(plan)}
                                            disabled={purchasing !== null}
                                            className="w-full mb-6 font-semibold shadow-sm"
                                        >
                                            {purchasing === plan.id ? <Loader2 className="w-5 h-5 animate-spin" /> : "Subscribe"}
                                        </Button>

                                        <ul className="space-y-4 flex-1 pt-5" style={{ borderTop: "1px solid var(--plan-card-border, #e2e8f0)" }}>
                                            {features.map((f, idx) => (
                                                <li key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm w-full gap-1 sm:gap-4" style={{ color: "var(--plan-feature-color, #475569)" }}>
                                                    <div className="flex items-start sm:items-center">
                                                        <Check className="w-4 h-4 text-primary mr-3 shrink-0 mt-0.5 sm:mt-0" />
                                                        <span className="leading-snug">{f.label}</span>
                                                    </div>
                                                    <span className="font-semibold sm:text-right ml-7 sm:ml-0" style={{ color: "var(--plan-feature-value-color, #1e293b)" }}>{f.value}</span>
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

            <div className="mt-16 mb-8 text-center py-10">
                <p className="text-2xl font-normal text-slate-700">Ready to get started with Google Workspace?</p>
                <p className="text-lg mt-4 text-slate-600">Choose a plan above to subscribe and activate your account</p>
                <a href="/activate" className="inline-block mt-5 text-xl font-semibold text-[#1fb6ff] hover:text-[#0ea5e9] hover:underline transition-colors">
                    Already purchased, click here to Activate the account
                </a>
            </div>
        </div>
    );

    // ── Public header ─────────────────────────────────────────────────────────
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
                        <span className="text-sm font-medium text-gray-900 hidden sm:inline-block">{user.email}</span>
                    ) : (
                        <button onClick={() => setAuthRequiredForPlan(plans[0] ?? null)} className="text-gray-600 font-medium hover:text-[#1fb6ff] transition-colors">Sign In</button>
                    )}
                    <button className="bg-[#1fb6ff] hover:bg-[#1a9ce6] text-white px-6 py-2.5 rounded text-sm font-semibold transition-colors shadow-sm">Subscribe Now</button>
                </div>
            </div>
        </header>
    );

    // ── Dialogs ───────────────────────────────────────────────────────────────
    const upgradeModal = (
        <Dialog open={!!upgradeTargetPlan} onOpenChange={(o) => { if (!o) setUpgradeTargetPlan(null); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowUp className="w-5 h-5 text-primary" />
                        Upgrade to {upgradeTargetPlan?.name}
                    </DialogTitle>
                    <DialogDescription>
                        You pay only for the remaining days on your new plan, minus the unused value of your current plan.
                    </DialogDescription>
                </DialogHeader>

                {/* Billing period */}
                <div className="flex items-center gap-3 pt-1">
                    <span className="text-sm text-muted-foreground">Billing:</span>
                    <div className="flex rounded-lg border border-border overflow-hidden">
                        <button onClick={() => setUpgradeBillingPeriod("monthly")} className={`px-4 py-1.5 text-sm font-medium transition-colors ${upgradeBillingPeriod === "monthly" ? "bg-primary text-white" : "hover:bg-muted"}`}>Monthly</button>
                        <button onClick={() => setUpgradeBillingPeriod("yearly")} className={`px-4 py-1.5 text-sm font-medium transition-colors ${upgradeBillingPeriod === "yearly" ? "bg-primary text-white" : "hover:bg-muted"}`}>Yearly</button>
                    </div>
                </div>

                {/* Promo code */}
                <div className="flex gap-2">
                    <Input
                        value={upgradePromoInput}
                        onChange={e => setUpgradePromoInput(e.target.value)}
                        placeholder="Promo code (optional)"
                        className="flex-1"
                        onKeyDown={e => { if (e.key === "Enter") handleApplyUpgradePromo(); }}
                    />
                    <Button variant="outline" onClick={handleApplyUpgradePromo} disabled={upgradePreviewLoading}>
                        <Tag className="w-4 h-4" />
                    </Button>
                    {upgradeAppliedPromo && (
                        <Button variant="ghost" size="icon" onClick={() => { setUpgradeAppliedPromo(""); setUpgradePromoInput(""); }}>
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>
                {upgradePreview?.promoValid && (
                    <p className="text-xs text-green-600 -mt-1">"{upgradeAppliedPromo}" applied — {upgradePreview.discountPct}% off</p>
                )}

                {/* Preview breakdown */}
                {upgradePreviewLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : upgradePreview ? (
                    <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{upgradeTargetPlan?.name} for {upgradePreview.daysRemaining} days</span>
                            <span>₹{upgradePreview.newPlanRemaining.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                        </div>
                        {upgradePreview.discountAmt > 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>Promo discount ({upgradePreview.discountPct}%)</span>
                                <span>−₹{upgradePreview.discountAmt.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-muted-foreground">
                            <span>Less: {currentPlan?.planName} unused value</span>
                            <span>−₹{upgradePreview.remainingValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2 text-muted-foreground">
                            <span>Subtotal</span>
                            <span>₹{upgradePreview.upgradeBase.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>GST (18%)</span>
                            <span>₹{upgradePreview.upgradeGST.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                            <span>Total to pay</span>
                            <span className="text-primary">₹{upgradePreview.upgradeTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                ) : null}

                <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={() => setUpgradeTargetPlan(null)} disabled={upgradePaymentLoading}>Cancel</Button>
                    <Button
                        onClick={handleUpgradePayment}
                        disabled={!upgradePreview || upgradePreviewLoading || upgradePaymentLoading}
                        className="gap-1.5"
                    >
                        {upgradePaymentLoading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <CreditCard className="w-4 h-4" />}
                        {upgradePreview
                            ? `Pay ₹${upgradePreview.upgradeTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                            : "Pay"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );

    const downgradeModal = (
        <Dialog open={!!downgradeTargetPlan} onOpenChange={(o) => { if (!o) setDowngradeTargetPlan(null); }}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowDown className="w-5 h-5 text-amber-500" />
                        Schedule Downgrade
                    </DialogTitle>
                    <DialogDescription>
                        Your plan will change to <strong>{downgradeTargetPlan?.name}</strong> on{" "}
                        <strong>{formatDate(currentPlan?.renewalDate)}</strong>.
                        Your current plan stays active until then.
                    </DialogDescription>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                    No payment required. The change takes effect automatically at renewal.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setDowngradeTargetPlan(null)}>Keep Current Plan</Button>
                    <Button
                        variant="outline"
                        className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                        onClick={handleConfirmDowngrade}
                        disabled={downgradeLoading}
                    >
                        {downgradeLoading
                            ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            : <ArrowDown className="w-4 h-4 mr-2" />}
                        Confirm Downgrade
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );

    const emailAuthDialog = (
        <Dialog open={!!authRequiredForPlan} onOpenChange={(o) => { if (!o) { setAuthRequiredForPlan(null); setAuthStep(1); setWmdIdInput(""); setIdCheckStatus("idle"); setIdSuggestions([]); setChosenWmdEmail(""); setRegisterPasswordInput(""); setShowRegisterPassword(false); } }}>
            <DialogContent className="sm:max-w-sm bg-white text-gray-900 border-gray-200 shadow-xl">
                <DialogHeader>
                    <div className="w-12 h-12 rounded-2xl bg-[#1fb6ff] flex items-center justify-center mb-2 mx-auto">
                        {authStep === 1 ? <img src={`${import.meta.env.BASE_URL}Logo-2.png`} alt="Logo" className="w-6 h-6 object-contain" /> : <AtSign className="w-6 h-6 text-white" />}
                    </div>
                    <DialogTitle className="text-center text-xl text-gray-900">
                        {authStep === 1 ? "Sign in to continue" : "Choose your @webmydrive.com ID"}
                    </DialogTitle>
                    <DialogDescription className="text-center text-gray-500">
                        {authStep === 1 ? (
                            <>Sign in with Google to purchase <strong className="text-gray-900">{authRequiredForPlan?.name}</strong>. No passwords needed.</>
                        ) : (
                            <>Pick your unique WebMyDrive account ID.<br />
                                <span className="text-xs mt-2 block text-gray-400">This will be your <code className="text-[#1fb6ff]">username@webmydrive.com</code> address.</span></>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <AnimatePresence mode="wait">
                    {emailAuthLoading ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-6">
                            <Loader2 className="w-5 h-5 animate-spin" /> Creating your account…
                        </motion.div>
                    ) : authStep === 1 ? (
                        <motion.div key="step1" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} className="flex flex-col items-center gap-4 py-4 w-full">
                            <GoogleSignInButton
                                label="Continue with Google"
                                onSuccess={({ token, user: googleUser }) => handleGoogleAuthSuccess(token, googleUser)}
                                onError={(msg) => toast.error(msg)}
                                distributorId={(() => {
                                    const storedCtx = sessionStorage.getItem("wmd_ref_context");
                                    if (storedCtx) { try { const ctx = JSON.parse(storedCtx); if (ctx.role === "DISTRIBUTOR") return Number(ctx.id); } catch { } }
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
                                    <Input type="email" placeholder="you@gmail.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="pl-10 bg-white border-gray-300 text-gray-900 focus-visible:ring-[#1fb6ff]" required />
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input type={showRegisterPassword ? "text" : "password"} placeholder="Password (min 8 chars)" value={registerPasswordInput} onChange={(e) => setRegisterPasswordInput(e.target.value)} className="pl-10 pr-10 bg-white border-gray-300 text-gray-900 focus-visible:ring-[#1fb6ff]" required minLength={8} />
                                    <button type="button" onClick={() => setShowRegisterPassword(!showRegisterPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <Button type="submit" disabled={emailAuthLoading} className="w-full bg-gray-900 hover:bg-gray-800 text-white shadow-sm">
                                    {emailAuthLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Sign In / Register
                                </Button>
                            </form>
                            <p className="text-xs text-gray-500 text-center px-1 mt-2">By continuing, you establish your billing profile.</p>
                        </motion.div>
                    ) : (
                        <motion.div key="step2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="flex flex-col gap-4 py-4 w-full">
                            <div className="flex rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-[#1fb6ff]/50 focus-within:border-[#1fb6ff] transition-all">
                                <input autoFocus value={wmdIdInput} onChange={(e) => handleWmdIdChange(e.target.value)} placeholder="yourname" className="flex-1 px-4 py-3 text-gray-900 bg-white text-sm outline-none min-w-0" style={{ fontFamily: "monospace" }} />
                                <span className="px-3 py-3 text-sm text-gray-400 bg-gray-50 border-l border-gray-200 whitespace-nowrap select-none">@webmydrive.com</span>
                            </div>
                            <AnimatePresence>
                                {idCheckStatus === "checking" && (
                                    <motion.div key="checking" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-xs text-gray-500">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking availability…
                                    </motion.div>
                                )}
                                {idCheckStatus === "available" && (
                                    <motion.div key="avail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-xs text-emerald-600 font-semibold">
                                        <CheckCircle2 className="w-4 h-4" /><span><strong>{chosenWmdEmail}</strong> is available!</span>
                                    </motion.div>
                                )}
                                {idCheckStatus === "taken" && (
                                    <motion.div key="taken" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs text-red-500 font-semibold">
                                            <XCircle className="w-4 h-4" /><span><strong>{wmdIdInput}@webmydrive.com</strong> is already taken.</span>
                                        </div>
                                        {idSuggestions.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-xs text-gray-500">Try one of these instead:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {idSuggestions.map((s) => (
                                                        <button key={s} onClick={() => handleSuggestionSelect(s)} className="px-3 py-1.5 text-xs rounded-full bg-blue-50 border border-blue-200 text-blue-700 hover:bg-[#1fb6ff] hover:text-white hover:border-[#1fb6ff] transition-all font-mono font-medium">{s}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div className="flex flex-col gap-2 pt-1">
                                <Button onClick={handleConfirmId} className="w-full h-12 bg-[#1fb6ff] hover:bg-[#1a9ce6] text-white font-semibold" disabled={!chosenWmdEmail || idCheckStatus !== "available"}>
                                    {idCheckStatus === "checking" ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking…</> : "Confirm ID & Continue"}
                                </Button>
                                <Button type="button" variant="ghost" onClick={() => { setAuthStep(1); setWmdIdInput(""); setIdCheckStatus("idle"); setIdSuggestions([]); setChosenWmdEmail(""); setRegisterPasswordInput(""); setShowRegisterPassword(false); }} className="w-full text-sm text-gray-500 hover:text-gray-700">
                                    ← Back
                                </Button>
                            </div>
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

    const passwordSetupDialog = (
        <Dialog open={!!provisionedWorkspace} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-md bg-white text-gray-900 border-gray-200 shadow-2xl [&>button]:hidden outline-none">
                <DialogHeader className="text-center">
                    <DialogTitle className="text-2xl font-bold flex flex-col items-center gap-2">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2"><span className="text-3xl">🎉</span></div>
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
                            <Input type={showPassword ? "text" : "password"} value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="pr-10 bg-white border-gray-300 text-gray-900 focus-visible:ring-[#1fb6ff]" placeholder="Create a strong password (min 8 chars)" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                                {showPassword ? <span className="text-xs font-bold">HIDE</span> : <span className="text-xs font-bold">SHOW</span>}
                            </button>
                        </div>
                        {passwordInput.length > 0 && passwordInput.length < 8 && <p className="text-red-500 text-xs">Password must be at least 8 characters.</p>}
                        {passwordInput.length >= 8 && <p className="text-green-600 text-xs font-medium inline-flex items-center gap-1"><Check className="w-3 h-3" /> Minimum length reached</p>}
                    </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-gray-100 mt-2">
                    <Button onClick={handleSetupPassword} disabled={passwordInput.length < 8 || settingPassword} className="w-full sm:w-auto bg-[#1fb6ff] hover:bg-[#1a9ce6] text-white">
                        {settingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {settingPassword ? "Securing..." : "Complete Setup"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );

    // ── Render ────────────────────────────────────────────────────────────────
    if (isUserPath) {
        const Layout = location.pathname.startsWith("/distributor") ? DistributorLayout : UserLayout;
        return (
            <Layout>
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
                    {currentPlanLoading ? (
                        <div className="flex justify-center py-24"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
                    ) : currentPlan?.hasPlan ? (
                        planManagementContent
                    ) : (
                        plansContent
                    )}
                </div>
                {currentPlan?.hasPlan ? (
                    <>{upgradeModal}{downgradeModal}</>
                ) : (
                    emailAuthDialog
                )}
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
