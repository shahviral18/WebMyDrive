import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, Loader2, Tag, ArrowLeft, KeyRound, Phone } from "lucide-react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ThemeSwitch } from "@/components/ui/theme-switch";

export default function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { loginAs } = useUser();
    const { isDark, toggleTheme } = useTheme();

    // ── Login state ────────────────────────────────────────────────────────────
    const [username, setUsername] = useState(""); // local part only, @webmydrive.com appended on submit
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [shake, setShake] = useState(false);
    const [error, setError] = useState("");
    const [pendingRef, setPendingRef] = useState<string | null>(null);

    // ── Force-change / OTP state ───────────────────────────────────────────────
    const [mode, setMode] = useState<"login" | "forgot" | "force_change">("login");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [pendingLoginData, setPendingLoginData] = useState<any>(null);
    const [isFirstLogin, setIsFirstLogin] = useState(false);

    // Forgot password OTP sub-states
    const [forgotStep, setForgotStep] = useState<1 | 2>(1);
    const [forgotMaskedEmail, setForgotMaskedEmail] = useState("");
    const [forgotNoRecovery, setForgotNoRecovery] = useState(false);
    const [forgotOtp, setForgotOtp] = useState("");

    useEffect(() => {
        const refFromUrl = searchParams.get("ref");
        if (refFromUrl) {
            navigate(`/ref/${refFromUrl.toUpperCase()}`, { replace: true });
            return;
        }
        const saved = localStorage.getItem("wmd_pending_ref");
        if (saved) setPendingRef(saved);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleThemeChange = (next: boolean) => { if (next !== isDark) toggleTheme(); };

    const triggerShake = () => {
        setShake(true);
        setTimeout(() => setShake(false), 600);
    };

    const getLoginEmail = () => {
        const u = username.trim().toLowerCase();
        return u.includes("@") ? u : u + "@webmydrive.com";
    };

    const finishLoginProcessing = (token: string, user: any, role: string, userToken?: string | null) => {
        if (role === "ADMIN" || role === "SUPERADMIN") {
            sessionStorage.setItem("token", token);
            sessionStorage.setItem("wmd_admin_auth", "true");
            const base = import.meta.env.BASE_URL.replace(/\/$/, "");
            window.location.href = `${base}/admin/dashboard`;
            return;
        }
        localStorage.setItem("token", token);
        sessionStorage.setItem("wmd_user_auth", "true");
        sessionStorage.setItem("wmd_user_email", user?.email);
        sessionStorage.setItem("wmd_user_role", role.toLowerCase());
        if (role === "DISTRIBUTOR") {
            // Store distributor token explicitly so PanelSwitcher can swap between panels
            localStorage.setItem("wmd_dist_token", token);
            if (userToken) {
                localStorage.setItem("wmd_user_token", userToken);
            }
        }
        loginAs({
            id: user?.id,
            name: user?.name,
            email: user?.email,
            role: role.toLowerCase() as "user" | "distributor",
            referralCode: user?.referralCode,
            walletBalance: user?.walletBalance,
        });
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        if (role === "DISTRIBUTOR") {
            navigate("/distributor/dashboard");
        } else {
            const ref = pendingRef || localStorage.getItem("wmd_pending_ref");
            if (ref) navigate(`/plans?ref=${encodeURIComponent(ref)}`);
            else navigate("/user/dashboard");
        }
    };

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!username || !password) { setError("Please fill in all fields."); triggerShake(); return; }
        setLoading(true);
        try {
            const data = await api.post("/auth/login", { email: getLoginEmail(), password });
            if (!data || !data.user) { setError(data?.message || "Login failed"); return; }
            if (data.requiresPasswordChange) {
                setPendingLoginData(data);
                setIsFirstLogin(!!data.first_login);
                setMode("force_change");
                setNewPassword("");
                setConfirmPassword("");
                return;
            }
            finishLoginProcessing(data.token, data.user, data.user.role || "", data.userToken);
        } catch (err: any) {
            const msg = err.message || "";
            setError(
                msg.toLowerCase().includes("internal server") || msg.toLowerCase().includes("500")
                    ? "Something went wrong on our end. Please try again in a moment."
                    : msg || "Invalid credentials"
            );
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setForgotNoRecovery(false);
        if (!username.trim()) { setError("Please enter your WebMyDrive ID."); triggerShake(); return; }
        setLoading(true);
        try {
            const res = await api.post("/auth/forgot-otp-request", { wmdId: getLoginEmail() });
            if (res.noRecovery) { setForgotNoRecovery(true); return; }
            setForgotMaskedEmail(res.maskedEmail || "");
            setForgotStep(2);
        } catch (err: any) {
            setError(err.message || "Account not found. Check your WebMyDrive ID.");
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!forgotOtp || forgotOtp.replace(/\D/g, "").length !== 6) {
            setError("Enter the 6-digit OTP sent to your recovery email.");
            triggerShake();
            return;
        }
        if (newPassword.length < 8) { setError("Password must be at least 8 characters."); triggerShake(); return; }
        if (newPassword !== confirmPassword) { setError("Passwords do not match."); triggerShake(); return; }
        setLoading(true);
        try {
            await api.post("/auth/forgot-otp-verify", {
                wmdId: getLoginEmail(),
                otp: forgotOtp.trim(),
                newPassword,
            });
            toast.success("Password reset successfully! Please sign in.");
            setMode("login");
            setForgotStep(1);
            setForgotOtp("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: any) {
            setError(err.message || "Invalid or expired OTP.");
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    const handleForceChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (newPassword.length < 8) { setError("Password must be at least 8 characters."); triggerShake(); return; }
        if (newPassword !== confirmPassword) { setError("Passwords do not match."); triggerShake(); return; }
        setLoading(true);
        try {
            await api.post("/auth/forgot-password", {
                email: pendingLoginData?.user?.email,
                newPassword,
            });
            toast.success(isFirstLogin ? "Welcome! Password set. Logging you in…" : "Password updated successfully!");
            const { token, user, userToken: pendingUserToken } = pendingLoginData;
            finishLoginProcessing(token, user, user.role, pendingUserToken);
        } catch (err: any) {
            setError(err.message || "Failed to update password.");
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    const enterForgot = () => {
        setMode("forgot");
        setForgotStep(1);
        setForgotNoRecovery(false);
        setForgotMaskedEmail("");
        setForgotOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setError("");
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden gradient-bg-mesh">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            </div>

            <div className="absolute top-6 right-6 z-50 flex items-center gap-3 px-4 py-2 rounded-full bg-background/40 backdrop-blur-md border border-border/50 shadow-sm">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Theme</span>
                <ThemeSwitch checked={isDark} onCheckedChange={handleThemeChange} size={12} ariaLabel="Toggle theme" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={`relative z-10 w-full max-w-md mx-4 ${shake ? "animate-shake" : ""}`}
            >
                <div className="bg-background/80 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-border/50">

                    {/* Referral banner */}
                    {mode === "login" && pendingRef && (
                        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
                            <Tag className="w-5 h-5 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold">Referral activated!</p>
                                <p className="text-xs opacity-80">Code <span className="font-mono font-bold">{pendingRef}</span> is queued — sign in to activate it.</p>
                            </div>
                        </div>
                    )}

                    {/* Header */}
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.1, type: "spring" }}
                            className="flex justify-center mb-4"
                        >
                            {mode === "login" ? (
                                <img
                                    src={`${import.meta.env.BASE_URL}Logo-2.png`}
                                    alt="WebMyDrive"
                                    className="w-[68px] h-[68px] object-contain"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-2xl bg-primary shadow-lg flex items-center justify-center">
                                    <KeyRound className="w-7 h-7 text-primary-foreground" />
                                </div>
                            )}
                        </motion.div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">
                            {mode === "login"
                                ? "WebMyDrive"
                                : mode === "force_change"
                                    ? (isFirstLogin ? "Welcome aboard! 🎉" : "Password Reset Required")
                                    : "Reset Password"}
                        </h1>
                        <p className={`text-sm mt-1 ${mode === "login" ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                            {mode === "login"
                                ? "Sign in to portal to manage your account"
                                : mode === "force_change"
                                    ? (isFirstLogin ? "Set a secure password for your new @webmydrive.com account." : "Please set a new secure password to continue.")
                                    : forgotStep === 1
                                        ? "We'll send a one-time code to your recovery email."
                                        : `Enter the OTP sent to ${forgotMaskedEmail}`}
                        </p>
                    </div>

                    {/* Error message */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-4 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm font-medium"
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Login form ── */}
                    {mode === "login" && (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="text-center pb-2">
                                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Secure Access</span>
                            </div>

                            {/* Username + @webmydrive.com suffix */}
                            <div className="space-y-1.5">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">User ID</Label>
                                <div className="flex rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all h-11">
                                    <input
                                        type="text"
                                        placeholder="yourname"
                                        value={username}
                                        onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, "").replace(/@.*/g, ""))}
                                        autoComplete="username"
                                        autoFocus
                                        className="flex-1 px-3 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60"
                                        style={{ fontFamily: "monospace" }}
                                    />
                                    <span className="px-3 flex items-center text-sm text-muted-foreground bg-muted border-l border-border whitespace-nowrap select-none shrink-0">
                                        @webmydrive.com
                                    </span>
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Password</Label>
                                    <button type="button" onClick={enterForgot} className="text-xs text-primary font-semibold hover:underline">
                                        Forgot Password?
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        autoComplete="current-password"
                                        className="pl-10 pr-10 bg-card border-border focus:border-primary h-11"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold mt-2 shadow-lg transition-all hover:scale-[1.01]" disabled={loading}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                            </Button>
                        </form>
                    )}

                    {/* ── Forgot password — Step 1: Enter WMD ID ── */}
                    {mode === "forgot" && forgotStep === 1 && (
                        <form onSubmit={handleRequestOtp} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Your WebMyDrive ID</Label>
                                <div className="flex rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all h-11">
                                    <input
                                        type="text"
                                        placeholder="yourname"
                                        value={username}
                                        onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, "").replace(/@.*/g, ""))}
                                        autoFocus
                                        className="flex-1 px-3 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60"
                                        style={{ fontFamily: "monospace" }}
                                    />
                                    <span className="px-3 flex items-center text-sm text-muted-foreground bg-muted border-l border-border whitespace-nowrap select-none shrink-0">
                                        @webmydrive.com
                                    </span>
                                </div>
                            </div>

                            {/* No recovery email message */}
                            {forgotNoRecovery && (
                                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700">
                                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">No recovery email on file</p>
                                    <p className="text-sm text-amber-700 dark:text-amber-400">
                                        We couldn't find a recovery email for this account. Please contact our helpdesk for assistance.
                                    </p>
                                    <a
                                        href="tel:+919825027360"
                                        className="inline-flex items-center gap-2 mt-3 text-sm font-bold text-amber-800 dark:text-amber-200 hover:underline"
                                    >
                                        <Phone className="w-4 h-4" />
                                        +91-9825027360
                                    </a>
                                </div>
                            )}

                            <div className="pt-1 flex flex-col gap-3">
                                <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg" disabled={loading || !username.trim()}>
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send OTP"}
                                </Button>
                                <Button type="button" variant="ghost" onClick={() => { setMode("login"); setError(""); }} className="w-full text-sm flex items-center gap-2 text-muted-foreground" disabled={loading}>
                                    <ArrowLeft className="w-4 h-4" /> Back to Sign In
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* ── Forgot password — Step 2: OTP + New password ── */}
                    {mode === "forgot" && forgotStep === 2 && (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-center text-foreground">
                                OTP sent to <span className="font-mono font-bold">{forgotMaskedEmail}</span>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">6-Digit OTP</Label>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="——————"
                                    value={forgotOtp}
                                    onChange={e => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                                    autoFocus
                                    className="bg-card border-border focus:border-primary h-11 text-center text-xl font-mono tracking-[0.5em]"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">New Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type={showNewPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        autoComplete="new-password"
                                        className="pl-10 pr-10 bg-card border-border focus:border-primary h-11"
                                    />
                                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Confirm Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type={showNewPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        autoComplete="new-password"
                                        className="pl-10 bg-card border-border focus:border-primary h-11"
                                    />
                                </div>
                            </div>

                            <div className="pt-1 flex flex-col gap-3">
                                <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg" disabled={loading}>
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => { setForgotStep(1); setError(""); setForgotNoRecovery(false); }}
                                    className="text-xs text-muted-foreground hover:text-foreground text-center hover:underline"
                                    disabled={loading}
                                >
                                    Didn't receive it? Send again
                                </button>
                                <Button type="button" variant="ghost" onClick={() => { setMode("login"); setError(""); }} className="w-full text-sm flex items-center gap-2 text-muted-foreground" disabled={loading}>
                                    <ArrowLeft className="w-4 h-4" /> Back to Sign In
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* ── Force change password (first login / admin reset) ── */}
                    {mode === "force_change" && (
                        <form onSubmit={handleForceChange} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">New Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type={showNewPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        autoComplete="new-password"
                                        className="pl-10 pr-10 bg-card border-border focus:border-primary h-11"
                                    />
                                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Confirm Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type={showNewPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        autoComplete="new-password"
                                        className="pl-10 bg-card border-border focus:border-primary h-11"
                                    />
                                </div>
                            </div>

                            <div className="pt-2 flex flex-col gap-3">
                                <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg transition-all hover:scale-[1.01]" disabled={loading}>
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Continue"}
                                </Button>
                                <Button type="button" variant="ghost" onClick={() => setMode("login")} className="w-full text-sm flex items-center gap-2 text-muted-foreground" disabled={loading}>
                                    <ArrowLeft className="w-4 h-4" /> Back to Sign In
                                </Button>
                            </div>
                        </form>
                    )}
                </div>

                <p className="text-center mt-6 text-xs text-muted-foreground">© 2026 WebMyDrive. All rights reserved.</p>
            </motion.div>
        </div>
    );
}
