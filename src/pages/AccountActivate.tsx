import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Home, Info, AtSign, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getApiUrl } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeSwitch } from "@/components/ui/theme-switch";

type Step = "find" | "setup" | "done";

export default function AccountActivatePage() {
    const navigate = useNavigate();
    const { isDark, toggleTheme } = useTheme();
    const [email, setEmail] = useState("");
    const [finding, setFinding] = useState(false);
    const [step, setStep] = useState<Step>("find");
    const [foundUser, setFoundUser] = useState<{ userId: number; token: string; email: string } | null>(null);

    // ID Setup state
    const [wmdIdInput, setWmdIdInput] = useState("");
    const [idCheckStatus, setIdCheckStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
    const [chosenWmdEmail, setChosenWmdEmail] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [finalCreds, setFinalCreds] = useState<{ email: string; password: string } | null>(null);

    // ── Step 1: Find subscription by email ────────────────────────────────────
    const handleFindSubscription = async () => {
        if (!email || !email.includes("@")) {
            return toast.error("Please enter a valid email address.");
        }
        setFinding(true);
        try {
            const res = await fetch(getApiUrl("/auth/activate-lookup"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Subscription not found");

            // Store token and move to setup
            if (data.token) localStorage.setItem("wmd_token", data.token);
            setFoundUser({ userId: data.userId, token: data.token, email: data.email });

            // Pre-fill ID input from email prefix
            const prefix = data.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
            setWmdIdInput(prefix);
            setTimeout(() => checkIdAvailability(prefix), 100);
            setStep("setup");
            toast.success("Subscription found! Set up your credentials.");
        } catch (err: any) {
            toast.error(err.message || "No subscription found for this email.");
        } finally {
            setFinding(false);
        }
    };

    // ── ID Availability Check ─────────────────────────────────────────────────
    const checkIdAvailability = async (username: string) => {
        if (!username) { setIdCheckStatus("idle"); setSuggestions([]); return; }
        setIdCheckStatus("checking");
        try {
            const resp = await fetch(getApiUrl(`/user/check-username?u=${encodeURIComponent(username)}`));
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (data.available) {
                setIdCheckStatus("available");
                setChosenWmdEmail(data.email);
                setSuggestions([]);
            } else {
                setIdCheckStatus("taken");
                setChosenWmdEmail("");
                setSuggestions(data.suggestions || []);
            }
        } catch {
            setIdCheckStatus("idle");
        }
    };

    let idCheckTimer: ReturnType<typeof setTimeout> | null = null;
    const handleIdChange = (val: string) => {
        const clean = val.toLowerCase().replace(/[^a-z0-9._-]/g, "");
        setWmdIdInput(clean);
        setIdCheckStatus("idle");
        setChosenWmdEmail("");
        if (idCheckTimer) clearTimeout(idCheckTimer);
        if (!clean) return;
        idCheckTimer = setTimeout(() => checkIdAvailability(clean), 600);
    };

    // ── Step 2: Save ID + password ────────────────────────────────────────────
    const handleSaveCredentials = async () => {
        if (!chosenWmdEmail || idCheckStatus !== "available") {
            return toast.error("Please choose an available @webmydrive.com ID.");
        }
        if (!password || password.length < 8) {
            return toast.error("Password must be at least 8 characters.");
        }
        setSaving(true);
        try {
            const token = foundUser?.token || localStorage.getItem("wmd_token");
            const resp = await fetch(getApiUrl("/user/profile"), {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ webMyDriveId: chosenWmdEmail, password }),
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `Error ${resp.status}`);
            }
            setFinalCreds({ email: chosenWmdEmail, password });
            setStep("done");
        } catch (err: any) {
            toast.error(err.message || "Failed to save credentials.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative"
            style={{ background: isDark ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" : "linear-gradient(135deg, #e8f4fd 0%, #f0f7ff 50%, #e8f0fe 100%)" }}>

            {/* Theme toggle */}
            <div className="absolute top-6 right-6 z-50 flex items-center gap-3 px-4 py-2 rounded-full bg-background/40 backdrop-blur-md border border-border/50 shadow-sm">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Theme</span>
                <ThemeSwitch checked={isDark} onCheckedChange={toggleTheme} size={12} ariaLabel="Toggle theme" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
                {/* Header */}
                <div className="flex flex-col items-center pt-10 pb-6 px-8 text-center">
                    <div className="w-14 h-14 rounded-full border-2 border-[#1fb6ff] flex items-center justify-center mb-4 text-[#1fb6ff]">
                        <Info className="w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Welcome to WebMyDrive</h1>
                    <p className="text-sm text-gray-500 mt-2">
                        {step === "find" && "Please complete your payment to create your account."}
                        {step === "setup" && "Set up your WebMyDrive ID and password."}
                        {step === "done" && "Your account is activated and ready to use!"}
                    </p>
                </div>

                <div className="px-8 pb-8">
                    <AnimatePresence mode="wait">

                        {/* ── Step 1: Find Subscription ── */}
                        {step === "find" && (
                            <motion.div key="find" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
                                <div className="border border-[#1fb6ff]/30 rounded-xl p-5 bg-[#f0faff]">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-5 h-5 rounded-full border-2 border-[#1fb6ff] flex items-center justify-center">
                                            <div className="w-2 h-2 rounded-full bg-[#1fb6ff]" />
                                        </div>
                                        <p className="text-sm font-semibold text-gray-800">Already Paid?</p>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-4 ml-7">
                                        Enter your payment email to fetch your subscription details and create your account.
                                    </p>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">
                                        Payment Email Address
                                    </label>
                                    <Input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && handleFindSubscription()}
                                        placeholder="you@example.com"
                                        className="mb-1 border-gray-200 focus-visible:ring-[#1fb6ff]"
                                    />
                                    <p className="text-xs text-gray-400 mb-4 ml-1">
                                        Use the same email you provided during payment
                                    </p>
                                    <Button
                                        onClick={handleFindSubscription}
                                        disabled={finding}
                                        className="w-full bg-[#1fb6ff] hover:bg-[#0ea5e9] text-white font-semibold h-11"
                                    >
                                        {finding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                                        {finding ? "Searching..." : "Find My Subscription"}
                                    </Button>
                                </div>

                                <div className="mt-6 text-center space-y-3">
                                    <p className="text-xs text-gray-400">Haven't completed payment yet?</p>
                                    <Button
                                        variant="outline"
                                        onClick={() => navigate("/")}
                                        className="border-gray-200 text-gray-600 hover:bg-gray-50"
                                    >
                                        <Home className="w-4 h-4 mr-2" /> Go to Homepage
                                    </Button>
                                    <p className="text-xs text-gray-400 pt-2">
                                        Need help? Email{" "}
                                        <a href="mailto:support@webmydrive.com" className="text-[#1fb6ff] hover:underline">
                                            support@webmydrive.com
                                        </a>
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* ── Step 2: Setup WebMyDrive ID + Password ── */}
                        {step === "setup" && (
                            <motion.div key="setup" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-4">
                                {/* ID Input */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">WebMyDrive ID</label>
                                    <div className="flex rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-[#1fb6ff]/50 focus-within:border-[#1fb6ff] transition-all">
                                        <input
                                            autoFocus
                                            value={wmdIdInput}
                                            onChange={e => handleIdChange(e.target.value)}
                                            placeholder="yourname"
                                            className="flex-1 px-4 py-3 text-gray-900 bg-white text-sm outline-none min-w-0 font-mono"
                                        />
                                        <span className="px-3 py-3 text-sm text-gray-400 bg-gray-50 border-l border-gray-200 whitespace-nowrap select-none">
                                            @webmydrive.com
                                        </span>
                                    </div>
                                    <div className="mt-2 min-h-[20px]">
                                        {idCheckStatus === "checking" && (
                                            <span className="flex items-center gap-1 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Checking…</span>
                                        )}
                                        {idCheckStatus === "available" && (
                                            <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> {chosenWmdEmail} is available!</span>
                                        )}
                                        {idCheckStatus === "taken" && (
                                            <div>
                                                <span className="flex items-center gap-1 text-xs text-red-500 font-semibold"><XCircle className="w-3.5 h-3.5" /> Already taken.</span>
                                                {suggestions.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {suggestions.map(s => (
                                                            <button key={s} onClick={() => { setWmdIdInput(s); handleIdChange(s); }}
                                                                className="px-2 py-1 text-xs rounded-full bg-blue-50 border border-blue-200 text-blue-700 hover:bg-[#1fb6ff] hover:text-white font-mono">
                                                                {s}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Password — show after ID is confirmed */}
                                {idCheckStatus === "available" && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Set Password</label>
                                        <div className="relative">
                                            <Input
                                                type={showPassword ? "text" : "password"}
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                placeholder="Minimum 8 characters"
                                                className="pr-10 border-gray-300 focus-visible:ring-[#1fb6ff]"
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                <Button
                                    onClick={handleSaveCredentials}
                                    disabled={!chosenWmdEmail || idCheckStatus !== "available" || password.length < 8 || saving}
                                    className="w-full h-11 bg-[#1fb6ff] hover:bg-[#0ea5e9] text-white font-semibold"
                                >
                                    {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…</> : "Activate Account →"}
                                </Button>
                            </motion.div>
                        )}

                        {/* ── Step 3: Credentials Summary ── */}
                        {step === "done" && finalCreds && (
                            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5">
                                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500">
                                    <CheckCircle2 className="w-9 h-9" />
                                </div>
                                <div className="text-center">
                                    <h2 className="text-xl font-bold text-gray-900">Account Activated! 🎉</h2>
                                    <p className="text-sm text-gray-500 mt-1">Save your credentials below.</p>
                                </div>
                                <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                                    <div>
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Login Email</p>
                                        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                                            <span className="text-sm font-mono text-gray-900 break-all">{finalCreds.email}</span>
                                            <button onClick={() => { navigator.clipboard.writeText(finalCreds.email); toast.success("Copied!"); }}
                                                className="ml-2 text-xs text-[#1fb6ff] hover:text-blue-700 font-semibold shrink-0 flex items-center gap-1">
                                                <Copy className="w-3 h-3" /> Copy
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Password</p>
                                        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                                            <span className="text-sm font-mono text-gray-900">{finalCreds.password}</span>
                                            <button onClick={() => { navigator.clipboard.writeText(finalCreds.password); toast.success("Copied!"); }}
                                                className="ml-2 text-xs text-[#1fb6ff] hover:text-blue-700 font-semibold shrink-0 flex items-center gap-1">
                                                <Copy className="w-3 h-3" /> Copy
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 text-center">
                                    ⚠️ Please save these credentials. You can change your password from settings anytime.
                                </p>
                                <Button onClick={() => { window.location.href = `${import.meta.env.BASE_URL}login`; }}
                                    className="w-full h-11 bg-[#1fb6ff] hover:bg-[#0ea5e9] text-white font-semibold">
                                    Go to Login →
                                </Button>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
