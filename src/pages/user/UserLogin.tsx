import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Eye, EyeOff, Lock, Mail, Loader2, Sun, Moon, Tag, ArrowLeft, KeyRound } from "lucide-react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const DEMO_ACCOUNTS = [
    { label: "User · Referrer", badge: "PR", email: "priya@webmydrive.com", pass: "priya123", colours: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-400/25" },
    { label: "User · Buyer", badge: "AM", email: "amit@webmydrive.com", pass: "amit123", colours: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-400/25" },
    { label: "Distributor", badge: "DS", email: "partner@webmydrive.com", pass: "partner123", colours: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-400/25" },
];

export default function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { loginAs } = useUser();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [shake, setShake] = useState(false);
    const [error, setError] = useState("");
    const [isDark, setIsDark] = useState(true);
    const [pendingRef, setPendingRef] = useState<string | null>(null);

    const [mode, setMode] = useState<"login" | "forgot" | "force_change">("login");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [pendingLoginData, setPendingLoginData] = useState<any>(null);
    const [isFirstLogin, setIsFirstLogin] = useState(false);

    useEffect(() => {
        setIsDark(document.documentElement.classList.contains("dark"));
        const refFromUrl = searchParams.get("ref");
        if (refFromUrl) {
            const code = refFromUrl.toUpperCase();
            navigate(`/ref/${code}`, { replace: true });
            return;
        } else {
            const saved = localStorage.getItem("wmd_pending_ref");
            if (saved) setPendingRef(saved);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleTheme = () => {
        const next = !isDark;
        setIsDark(next);
        document.documentElement.classList.toggle("dark", next);
    };

    const triggerShake = () => {
        setShake(true);
        setTimeout(() => setShake(false), 600);
    };

    const finishLoginProcessing = (token: string, user: any, role: string) => {
        // ── Admin / SuperAdmin: redirect to admin console immediately ──
        if (role === "ADMIN" || role === "SUPERADMIN") {
            sessionStorage.setItem("wmd_token", token);
            sessionStorage.setItem("wmd_admin_auth", "true");
            // Do NOT set wmd_user_auth or call loginAs — keep portals independent
            window.location.href = "/admin/dashboard";
            return;
        }

        localStorage.setItem("wmd_token", token);
        sessionStorage.setItem("wmd_user_auth", "true");
        sessionStorage.setItem("wmd_user_email", user.email);
        sessionStorage.setItem("wmd_user_role", role.toLowerCase());

        loginAs({
            id: user.id,
            name: user.name,
            email: user.email,
            role: role.toLowerCase() as "user" | "distributor",
            referralCode: user.referralCode,
            walletBalance: user.walletBalance,
        });

        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

        if (role === "DISTRIBUTOR") {
            navigate("/distributor/dashboard");
        } else {
            const ref = pendingRef || localStorage.getItem("wmd_pending_ref");
            if (ref) {
                // Use public /plans route to avoid UserLayout's sessionStorage guard
                navigate(`/plans?ref=${encodeURIComponent(ref)}`);
            } else {
                navigate("/user/dashboard");
            }
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!email || !password) {
            setError("Please fill in all fields.");
            triggerShake();
            return;
        }

        setLoading(true);
        try {
            const response = await api.post("/auth/login", { email, password });

            if (response.requiresPasswordChange) {
                setPendingLoginData(response);
                setIsFirstLogin(!!response.first_login); // Use server-sent first_login flag
                setMode("force_change");
                setNewPassword("");
                setConfirmPassword("");
                return;
            }

            const { token, user } = response;
            const role: string = user?.role || "";
            finishLoginProcessing(token, user, role);
        } catch (err: any) {
            const msg = err.message || "Invalid credentials";
            setError(msg);
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (mode === "forgot" && !email) {
            setError("Please enter your email.");
            triggerShake();
            return;
        }

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters.");
            triggerShake();
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            triggerShake();
            return;
        }

        setLoading(true);
        try {
            // For force_change (first login or password reset required), use forgot-password
            // which doesn't need the current password and correctly clears first_login
            await api.post("/auth/forgot-password", {
                email: mode === "forgot" ? email : pendingLoginData?.user?.email,
                newPassword
            });

            if (mode === "force_change") {
                toast.success(isFirstLogin ? "Welcome! Password set. Logging you in…" : "Password updated successfully!");
                setIsFirstLogin(false);
                const { token, user } = pendingLoginData;
                finishLoginProcessing(token, user, user.role);
            } else {
                toast.success("Password updated successfully! Please login with your new password.");
                setMode("login");
                setPassword("");
            }
        } catch (err: any) {
            setError(err.message || "Failed to update password.");
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden gradient-bg-mesh">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            </div>

            <div className="absolute top-4 right-4 z-50">
                <Button variant="outline" size="icon" onClick={toggleTheme} className="bg-card/50 backdrop-blur border-border/50 text-foreground hover:bg-muted">
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </Button>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className={`relative z-10 w-full max-w-md mx-4 ${shake ? "animate-shake" : ""}`}>
                <div className="bg-background/80 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-border/50">

                    {mode === "login" && pendingRef && (
                        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
                            <Tag className="w-5 h-5 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold">Referral activated!</p>
                                <p className="text-xs opacity-80">Code <span className="font-mono font-bold">{pendingRef}</span> is queued — sign in to activate it.</p>
                            </div>
                        </div>
                    )}

                    <div className="text-center mb-8">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: "spring" }} className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg mb-4">
                            {mode === "login" ? <Cloud className="w-7 h-7 text-primary-foreground" /> : <KeyRound className="w-7 h-7 text-primary-foreground" />}
                        </motion.div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">
                            {mode === "login" ? "WebMyDrive" : (mode === "force_change" ? (isFirstLogin ? "Welcome aboard! 🎉" : "Password Reset Required") : "Reset Password")}
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            {mode === "login" ? "Sign in to your account" : (mode === "force_change" ? (isFirstLogin ? "Set a secure password for your new @webmydrive.com account." : "Please set a new secure password to continue.") : "Enter your email and a new password")}
                        </p>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm font-medium">
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {mode === "login" ? (
                        <form onSubmit={handleLogin} className="space-y-4">

                            {/* Google Sign In */}
                            <GoogleSignInButton
                                label="Continue with Google"
                                onSuccess={({ token, user }) => {
                                    const role: string = user?.role || "";
                                    finishLoginProcessing(token, user, role);
                                }}
                                onError={(msg) => { setError(msg); triggerShake(); }}
                            />

                            <div className="flex items-center gap-3 my-2">
                                <div className="flex-1 h-px bg-border/50" />
                                <span className="text-xs text-muted-foreground font-medium">or sign in with email</span>
                                <div className="flex-1 h-px bg-border/50" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input id="email" type="email" placeholder="you@webmydrive.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" className="pl-10 bg-card border-border focus:border-primary h-11" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Password</Label>
                                    <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary font-semibold hover:underline">
                                        Forgot Password?
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="pl-10 pr-10 bg-card border-border focus:border-primary h-11" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold mt-2 shadow-lg transition-all hover:scale-[1.01]" disabled={loading}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                            </Button>

                            <div className="mt-6 pt-5 border-t border-border/40">
                                <p className="text-[11px] text-muted-foreground text-center mb-3 uppercase tracking-widest font-semibold">Demo Accounts · Click to fill</p>
                                <div className="grid gap-2">
                                    {DEMO_ACCOUNTS.map(acc => (
                                        <button key={acc.email} type="button" onClick={() => { setEmail(acc.email); setPassword(acc.pass); }} className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg border text-left transition-all hover:opacity-75 active:scale-[0.98] ${acc.colours}`}>
                                            <span className="w-7 h-7 rounded-full bg-background/50 flex items-center justify-center text-[11px] font-bold shrink-0">{acc.badge}</span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-semibold text-foreground">{acc.label}</p>
                                                <p className="text-[10px] font-mono text-muted-foreground truncate">{acc.email} · {acc.pass}</p>
                                            </div>
                                            <span className="text-[11px] shrink-0 opacity-60">⇧ fill</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handlePasswordAction} className="space-y-4">
                            {mode === "forgot" && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="reset-email" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Email</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input id="reset-email" type="email" placeholder="you@webmydrive.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 bg-card border-border focus:border-primary h-11" />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label htmlFor="new-password" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">New Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input id="new-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="pl-10 pr-10 bg-card border-border focus:border-primary h-11" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="confirm-password" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Confirm Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input id="confirm-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="pl-10 pr-10 bg-card border-border focus:border-primary h-11" />
                                </div>
                            </div>

                            <div className="pt-2 flex flex-col gap-3">
                                <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg transition-all hover:scale-[1.01]" disabled={loading}>
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === "force_change" ? "Save & Continue" : "Reset Password")}
                                </Button>
                                <Button type="button" variant="ghost" onClick={() => setMode("login")} className="w-full text-sm flex items-center gap-2 text-muted-foreground" disabled={loading}>
                                    <ArrowLeft className="w-4 h-4" /> Back to Login
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
